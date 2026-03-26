import { useEffect, useMemo, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";

import { buildUiHierarchy } from "../formats";
import { STAGE_SIZE } from "../presets";
import type { LegacyUILayoutNode, UiHierarchyNode, UiLayoutDocument, WorkspaceAsset } from "../types";
import { createAssetObjectUrl } from "../workspace";

type LegacyUiLayoutViewportProps = {
  document: UiLayoutDocument;
  assets: WorkspaceAsset[];
  selectedNodeId: number | null;
  onSelectNode: (nodeId: number) => void;
  onBeginDrag: (node: LegacyUILayoutNode, event: ReactPointerEvent<HTMLElement>) => void;
};

type NodeStyleBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export function LegacyUiLayoutViewport({
  document,
  assets,
  selectedNodeId,
  onSelectNode,
  onBeginDrag
}: LegacyUiLayoutViewportProps) {
  const roots = useMemo(() => buildUiHierarchy(document.nodes), [document.nodes]);
  const root = roots[0] ?? null;
  const requestedResources = useMemo(() => collectRequestedResources(document.nodes), [document.nodes]);
  const resourceMatches = useMemo(() => {
    const next = new Map<string, WorkspaceAsset>();
    for (const request of requestedResources) {
      const asset = findImageAssetForRequest(request, assets);
      if (asset) next.set(request, asset);
    }
    return next;
  }, [assets, requestedResources]);
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({});
  const visibleAssetUrls = resourceMatches.size > 0 ? assetUrls : {};

  useEffect(() => {
    const uniqueAssets = Array.from(new Map(Array.from(resourceMatches.values()).map((asset) => [asset.id, asset])).values());
    if (uniqueAssets.length <= 0) return;

    let disposed = false;
    const createdUrls: string[] = [];

    void (async () => {
      const nextEntries = await Promise.all(
        uniqueAssets.map(async (asset) => {
          const url = await createAssetObjectUrl(asset);
          createdUrls.push(url);
          return [asset.id, url] as const;
        })
      );
      if (!disposed) {
        setAssetUrls(Object.fromEntries(nextEntries));
      }
    })();

    return () => {
      disposed = true;
      for (const url of createdUrls) URL.revokeObjectURL(url);
    };
  }, [resourceMatches]);

  if (!root) {
    return (
      <div className="viewport">
        <div className="legacy-ui-stage legacy-ui-stage--empty">No root node in current layout.</div>
      </div>
    );
  }

  const stageWidth = normalizeStageDimension(root.node.w, STAGE_SIZE.width);
  const stageHeight = normalizeStageDimension(root.node.h, STAGE_SIZE.height);
  const rootSkin = resolveNodeSkin(root.node, stageWidth, stageHeight, resourceMatches, visibleAssetUrls);

  return (
    <div className="viewport">
      <div
        className={`legacy-ui-stage${selectedNodeId === root.node.id ? " legacy-ui-stage--selected" : ""}`}
        data-legacy-ui-stage={root.node.n ?? root.node.id}
        style={{
          height: `${stageHeight}px`,
          width: `${stageWidth}px`
        }}
        onPointerDown={(event) => {
          if (event.target !== event.currentTarget) return;
          onSelectNode(root.node.id);
        }}
      >
        {rootSkin ? <div className="legacy-ui-stage__skin" style={rootSkin} /> : null}
        {root.children.map((child) => (
          <LegacyUiLayoutNodePreview
            key={child.node.id}
            node={child}
            parentHeight={stageHeight}
            resourceMatches={resourceMatches}
            assetUrls={visibleAssetUrls}
            selectedNodeId={selectedNodeId}
            onSelectNode={onSelectNode}
            onBeginDrag={onBeginDrag}
          />
        ))}
      </div>
    </div>
  );
}

type LegacyUiLayoutNodePreviewProps = {
  node: UiHierarchyNode;
  parentHeight: number;
  resourceMatches: Map<string, WorkspaceAsset>;
  assetUrls: Record<string, string>;
  selectedNodeId: number | null;
  onSelectNode: (nodeId: number) => void;
  onBeginDrag: (node: LegacyUILayoutNode, event: ReactPointerEvent<HTMLElement>) => void;
};

function LegacyUiLayoutNodePreview({
  node,
  parentHeight,
  resourceMatches,
  assetUrls,
  selectedNodeId,
  onSelectNode,
  onBeginDrag
}: LegacyUiLayoutNodePreviewProps) {
  const box = computeNodeBox(node.node, parentHeight);
  const skinStyle = resolveNodeSkin(node.node, box.width, box.height, resourceMatches, assetUrls);
  const displayText = resolveNodeText(node.node);
  const textColor = resolveTextColor(node.node);
  const missingResource = shouldShowMissingResource(node.node, skinStyle);
  const selected = selectedNodeId === node.node.id;

  return (
    <div
      className={`legacy-ui-node legacy-ui-node--type-${node.node.type}${selected ? " legacy-ui-node--selected" : ""}`}
      data-node-id={node.node.id}
      data-node-name={node.node.n ?? node.node.id}
      style={buildNodeStyle(node.node, box)}
      onPointerDown={(event) => {
        event.stopPropagation();
        onSelectNode(node.node.id);
        onBeginDrag(node.node, event);
      }}
      title={`${node.node.n ?? `Node${node.node.id}`} · ${Math.round(node.node.x ?? 0)}, ${Math.round(node.node.y ?? 0)}`}
    >
      {skinStyle ? <div className="legacy-ui-node__skin" style={skinStyle} /> : null}
      {displayText ? (
        <div
          className="legacy-ui-node__text"
          style={{
            alignItems: resolveVerticalAlign(node.node),
            color: textColor ?? "#edf2ff",
            fontSize: `${Math.max(10, Math.round(resolveFontSize(node.node)))}px`,
            justifyContent: resolveHorizontalAlign(node.node),
            textAlign: resolveTextAlign(node.node)
          }}
        >
          <span>{displayText}</span>
        </div>
      ) : null}
      {missingResource ? <div className="legacy-ui-node__missing">{missingResource}</div> : null}
      {node.children.map((child) => (
        <LegacyUiLayoutNodePreview
          key={child.node.id}
          node={child}
          parentHeight={box.height}
          resourceMatches={resourceMatches}
          assetUrls={assetUrls}
          selectedNodeId={selectedNodeId}
          onSelectNode={onSelectNode}
          onBeginDrag={onBeginDrag}
        />
      ))}
    </div>
  );
}

function collectRequestedResources(nodes: LegacyUILayoutNode[]): string[] {
  const keys = new Set<string>();
  for (const node of nodes) {
    for (const rawValue of [node.res, node.sel, node.dis, node.nbf, node.nnf]) {
      const request = normalizeResourceRequest(rawValue, node.ud);
      if (request) keys.add(request);
    }
  }
  return Array.from(keys);
}

function normalizeResourceRequest(value: unknown, ud: unknown): string {
  const raw = typeof value === "string" ? value.trim().replace(/\\/g, "/") : "";
  if (!raw || raw === "null") return "";
  if (!/\.(png|jpg|jpeg|webp)$/i.test(raw) && isNeedload(ud)) return `${raw}.png`;
  return raw;
}

function findImageAssetForRequest(request: string, assets: WorkspaceAsset[]): WorkspaceAsset | null {
  const normalized = request.trim().toLowerCase();
  if (!normalized) return null;

  const directCandidates = [normalized];
  if (!/\.(png|jpg|jpeg|webp)$/i.test(normalized)) {
    directCandidates.push(`${normalized}.png`, `${normalized}.jpg`, `${normalized}.jpeg`, `${normalized}.webp`);
  }

  const tailCandidates = directCandidates.map((candidate) => candidate.split("/").pop() ?? candidate);

  return (
    assets.find(
      (asset) =>
        asset.kind === "image" &&
        (directCandidates.includes(asset.path.toLowerCase()) ||
          directCandidates.includes(asset.name.toLowerCase()) ||
          tailCandidates.includes(asset.name.toLowerCase()) ||
          tailCandidates.some((candidate) => asset.path.toLowerCase().endsWith(`/${candidate}`)))
    ) ?? null
  );
}

function resolveNodeSkin(
  node: LegacyUILayoutNode,
  width: number,
  height: number,
  resourceMatches: Map<string, WorkspaceAsset>,
  assetUrls: Record<string, string>
): CSSProperties | null {
  const request = normalizeResourceRequest(node.res, node.ud);
  const matchedAsset = request ? resourceMatches.get(request) ?? null : null;
  const imageUrl = matchedAsset ? assetUrls[matchedAsset.id] ?? null : null;
  const backgroundColor = resolveBoxColor(node);

  if (!imageUrl && !backgroundColor) return null;

  return {
    backgroundColor: backgroundColor ?? undefined,
    backgroundImage: imageUrl ? `url("${imageUrl}")` : undefined,
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    backgroundSize: node.type === 4 ? "contain" : "100% 100%",
    borderRadius: `${resolveBorderRadius(node)}px`,
    height: `${height}px`,
    left: 0,
    pointerEvents: "none",
    position: "absolute",
    top: 0,
    width: `${width}px`
  };
}

function computeNodeBox(node: LegacyUILayoutNode, parentHeight: number): NodeStyleBox {
  const width = estimateNodeWidth(node);
  const height = estimateNodeHeight(node);
  const anchorX = clamp(node.ax ?? 0.5, 0, 1);
  const anchorY = clamp(node.ay ?? 0.5, 0, 1);
  const x = Math.round(node.x ?? 0);
  const y = Math.round(node.y ?? 0);

  return {
    height,
    left: Math.round(x - anchorX * width),
    top: Math.round(parentHeight - y - (1 - anchorY) * height),
    width
  };
}

function buildNodeStyle(node: LegacyUILayoutNode, box: NodeStyleBox): CSSProperties {
  return {
    display: node.v === false ? "none" : "block",
    height: `${box.height}px`,
    left: `${box.left}px`,
    overflow: node.c ? "hidden" : "visible",
    position: "absolute",
    top: `${box.top}px`,
    width: `${box.width}px`,
    zIndex: typeof node.zo === "number" ? node.zo : node.id
  };
}

function estimateNodeWidth(node: LegacyUILayoutNode): number {
  const width = Math.round(node.w ?? 0);
  if (width > 1) return width;
  if (typeof node.text === "string" && node.text.trim()) {
    return Math.max(64, Math.round(stripRichMarkup(node.text).length * resolveFontSize(node) * 0.85));
  }
  return 72;
}

function estimateNodeHeight(node: LegacyUILayoutNode): number {
  const height = Math.round(node.h ?? 0);
  if (height > 1) return height;
  if (typeof node.text === "string" && node.text.trim()) {
    const lineCount = Math.max(1, stripRichMarkup(node.text).split(/\r?\n/).length);
    return Math.max(24, Math.round(lineCount * resolveFontSize(node) * 1.2));
  }
  return 32;
}

function resolveNodeText(node: LegacyUILayoutNode): string {
  const raw = typeof node.text === "string" ? node.text : "";
  if (!raw.trim()) return "";
  return stripRichMarkup(raw);
}

function resolveTextColor(node: LegacyUILayoutNode): string | null {
  return parseColor(node.tcolor) ?? parseColor(node.color);
}

function resolveBoxColor(node: LegacyUILayoutNode): string | null {
  if (node.type === 3) return null;
  return parseColor(node.color);
}

function parseColor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw) return null;
  if (raw.startsWith("#")) return raw;
  if (/^\d+\|\d+\|\d+$/.test(raw)) {
    const [r, g, b] = raw.split("|").map((part) => Number(part.trim()));
    return `rgb(${r}, ${g}, ${b})`;
  }
  return null;
}

function resolveFontSize(node: LegacyUILayoutNode): number {
  return Math.max(12, Number(node.fs ?? 18));
}

function resolveTextAlign(node: LegacyUILayoutNode): CSSProperties["textAlign"] {
  const align = Number(node.ht ?? 0);
  if (align === 1) return "center";
  if (align === 2) return "right";
  return "left";
}

function resolveHorizontalAlign(node: LegacyUILayoutNode): CSSProperties["justifyContent"] {
  const align = Number(node.ht ?? 0);
  if (align === 1) return "center";
  if (align === 2) return "flex-end";
  return "flex-start";
}

function resolveVerticalAlign(node: LegacyUILayoutNode): CSSProperties["alignItems"] {
  const align = Number(node.vt ?? 0);
  if (align === 1) return "center";
  if (align === 2) return "flex-end";
  return "flex-start";
}

function shouldShowMissingResource(node: LegacyUILayoutNode, skinStyle: CSSProperties | null): string {
  if (skinStyle || node.type === 3) return "";
  const request = normalizeResourceRequest(node.res, node.ud);
  if (!request) return "";
  return request.split("/").pop() ?? request;
}

function resolveBorderRadius(node: LegacyUILayoutNode): number {
  if (node.type === 2) return 12;
  if (node.type === 4) return 6;
  return 4;
}

function stripRichMarkup(input: string): string {
  return input
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?font\b[^>]*>/gi, "")
    .replace(/<\/?p\b[^>]*>/gi, "")
    .replace(/<\/?span\b[^>]*>/gi, "")
    .trim();
}

function normalizeStageDimension(value: unknown, fallback: number): number {
  const numericValue = Math.round(typeof value === "number" ? value : 0);
  return numericValue > 1 ? numericValue : fallback;
}

function isNeedload(ud: unknown): boolean {
  return typeof ud === "string" && ud.toLowerCase().includes("needload");
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
