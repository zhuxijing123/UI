import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from "react";

import { buildUiHierarchy } from "../formats";
import {
  buildLegacyBitmapFontResources,
  buildLegacyLayoutResources,
  type LegacyBitmapFontResource,
  type LegacyLayoutResource
} from "../legacy-layout-resources";
import { STAGE_SIZE } from "../presets";
import type { LegacyBitmapFont, LegacyUILayoutNode, UiHierarchyNode, UiLayoutDocument, WorkspaceAsset } from "../types";

type LegacyUiLayoutViewportProps = {
  document: UiLayoutDocument;
  assets: WorkspaceAsset[];
  interactionMode: "scene" | "preview";
  sceneTool: "hand" | "move" | "rotate" | "scale" | "rect";
  selectedNodeId: number | null;
  zoomMode: "fit" | "100";
  onContextMenu?: (e: ReactMouseEvent) => void;
  onSelectNode: (nodeId: number) => void;
  onBeginDrag: (
    node: LegacyUILayoutNode,
    mode: "move" | "rect" | "scale" | "rotate",
    event: ReactMouseEvent<HTMLElement>,
    scale: number
  ) => void;
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
  interactionMode,
  sceneTool,
  selectedNodeId,
  zoomMode,
  onContextMenu,
  onSelectNode,
  onBeginDrag
}: LegacyUiLayoutViewportProps) {
  const roots = useMemo(() => buildUiHierarchy(document.nodes), [document.nodes]);
  const root = roots[0] ?? null;
  const requestedResources = useMemo(() => collectRequestedImageResources(document.nodes), [document.nodes]);
  const requestedBitmapFonts = useMemo(() => collectRequestedBitmapFonts(document.nodes), [document.nodes]);
  const [layoutResources, setLayoutResources] = useState<Record<string, LegacyLayoutResource>>({});
  const [bitmapFontResources, setBitmapFontResources] = useState<Record<string, LegacyBitmapFontResource>>({});
  const [containerSize, setContainerSize] = useState({ height: 0, width: 0 });
  const containerRef = useRef<HTMLDivElement | null>(null);
  const panStateRef = useRef<{
    pointerId: number;
    scrollLeft: number;
    scrollTop: number;
    startX: number;
    startY: number;
  } | null>(null);
  const visibleLayoutResources = requestedResources.length > 0 ? layoutResources : {};
  const visibleBitmapFontResources = requestedBitmapFonts.length > 0 ? bitmapFontResources : {};

  useEffect(() => {
    let disposed = false;
    let cleanup: () => void = () => undefined;

    if (requestedResources.length <= 0) return;

    void (async () => {
      const result = await buildLegacyLayoutResources(requestedResources, assets);
      cleanup = result.cleanup;
      if (!disposed) setLayoutResources(result.resources);
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [assets, requestedResources]);

  useEffect(() => {
    let disposed = false;
    let cleanup: () => void = () => undefined;

    if (requestedBitmapFonts.length <= 0) return;

    void (async () => {
      const result = await buildLegacyBitmapFontResources(requestedBitmapFonts, assets);
      cleanup = result.cleanup;
      if (!disposed) setBitmapFontResources(result.resources);
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [assets, requestedBitmapFonts]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const update = () => {
      setContainerSize({
        height: element.clientHeight,
        width: element.clientWidth
      });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  if (!root) {
    return (
      <div className="viewport">
        <div className="legacy-ui-stage legacy-ui-stage--empty">No root node in current layout.</div>
      </div>
    );
  }

  const stageWidth = normalizeStageDimension(root.node.w, STAGE_SIZE.width);
  const stageHeight = normalizeStageDimension(root.node.h, STAGE_SIZE.height);
  const rootSkin = resolveNodeSkin(root.node, stageWidth, stageHeight, visibleLayoutResources);
  const stageScale = zoomMode === "100"
    ? 1
    : clamp(
      Math.min(
        containerSize.width > 0 ? (containerSize.width - 48) / Math.max(1, stageWidth) : 1,
        containerSize.height > 0 ? (containerSize.height - 48) / Math.max(1, stageHeight) : 1
      ),
      0.35,
      1
    );
  const sceneEditable = interactionMode === "scene" && sceneTool !== "hand";
  const showSelection = interactionMode === "scene";

  return (
    <div
      ref={containerRef}
      className={`viewport${sceneTool === "hand" ? " viewport--hand" : ""}`}
      onContextMenu={(event) => {
        if (event.target === event.currentTarget || (event.target instanceof HTMLElement && event.target.classList.contains("legacy-ui-stage"))) {
          onContextMenu?.(event);
        }
      }}
      onPointerDown={(event) => {
        if (sceneTool !== "hand") return;
        const element = event.currentTarget;
        panStateRef.current = {
          pointerId: event.pointerId,
          scrollLeft: element.scrollLeft,
          scrollTop: element.scrollTop,
          startX: event.clientX,
          startY: event.clientY
        };
        element.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (sceneTool !== "hand") return;
        const state = panStateRef.current;
        if (!state || state.pointerId !== event.pointerId) return;
        const element = event.currentTarget;
        element.scrollLeft = state.scrollLeft - (event.clientX - state.startX);
        element.scrollTop = state.scrollTop - (event.clientY - state.startY);
      }}
      onPointerUp={(event) => {
        if (panStateRef.current?.pointerId === event.pointerId) {
          panStateRef.current = null;
        }
      }}
      onPointerCancel={(event) => {
        if (panStateRef.current?.pointerId === event.pointerId) {
          panStateRef.current = null;
        }
      }}
    >
      <div
        className="viewport__camera"
        style={{
          height: `${stageHeight * stageScale}px`,
          width: `${stageWidth * stageScale}px`
        }}
      >
        <div
          className={`legacy-ui-stage${showSelection && selectedNodeId === root.node.id ? " legacy-ui-stage--selected" : ""}`}
          data-legacy-ui-stage={root.node.n ?? root.node.id}
          style={{
            height: `${stageHeight}px`,
            transform: `scale(${stageScale})`,
            transformOrigin: "top left",
            width: `${stageWidth}px`
          }}
          onPointerDown={(event) => {
            if (event.target !== event.currentTarget || !sceneEditable) return;
            onSelectNode(root.node.id);
          }}
        >
          {rootSkin ? <div className="legacy-ui-stage__skin" style={rootSkin} /> : null}
          {root.children.map((child) => (
            <LegacyUiLayoutNodePreview
              key={child.node.id}
              interactionMode={interactionMode}
              sceneTool={sceneTool}
              stageScale={stageScale}
              node={child}
              parentHeight={stageHeight}
              layoutResources={visibleLayoutResources}
              bitmapFontResources={visibleBitmapFontResources}
              selectedNodeId={showSelection ? selectedNodeId : null}
              onSelectNode={onSelectNode}
              onBeginDrag={onBeginDrag}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

type LegacyUiLayoutNodePreviewProps = {
  node: UiHierarchyNode;
  parentHeight: number;
  layoutResources: Record<string, LegacyLayoutResource>;
  bitmapFontResources: Record<string, LegacyBitmapFontResource>;
  interactionMode: "scene" | "preview";
  sceneTool: "hand" | "move" | "rotate" | "scale" | "rect";
  stageScale: number;
  selectedNodeId: number | null;
  onSelectNode: (nodeId: number) => void;
  onBeginDrag: (
    node: LegacyUILayoutNode,
    mode: "move" | "rect" | "scale" | "rotate",
    event: ReactMouseEvent<HTMLElement>,
    scale: number
  ) => void;
};

function LegacyUiLayoutNodePreview({
  node,
  parentHeight,
  layoutResources,
  bitmapFontResources,
  interactionMode,
  sceneTool,
  stageScale,
  selectedNodeId,
  onSelectNode,
  onBeginDrag
}: LegacyUiLayoutNodePreviewProps) {
  const box = computeNodeBox(node.node, parentHeight);
  const skinStyle = resolveNodeSkin(node.node, box.width, box.height, layoutResources);
  const bitmapFont = resolveBitmapFontResource(node.node, bitmapFontResources);
  const displayText = resolveNodeText(node.node);
  const textColor = resolveTextColor(node.node);
  const missingResource = shouldShowMissingResource(node.node, skinStyle, bitmapFont);
  const selected = selectedNodeId === node.node.id;
  const isLoadingBar = node.node.type === 6 || String(node.node.ud ?? "").includes("UILoadingBar");
  const loadingPercent = resolveLoadingPercent(node.node);
  const canInteract = interactionMode === "scene" && sceneTool !== "hand";
  const transformMode = sceneTool === "rect" || sceneTool === "scale" || sceneTool === "rotate" ? sceneTool : "move";
  const allowDirectDrag = canInteract;

  return (
    <div
      className={`legacy-ui-node legacy-ui-node--type-${node.node.type}${selected ? " legacy-ui-node--selected" : ""}${selected ? ` legacy-ui-node--tool-${sceneTool}` : ""}`}
      data-node-id={node.node.id}
      data-node-name={node.node.n ?? node.node.id}
      style={buildNodeStyle(node.node, box)}
      onClick={(event) => {
        if (!canInteract) return;
        event.stopPropagation();
        onSelectNode(node.node.id);
      }}
      onMouseDown={(event) => {
        if (!canInteract) return;
        event.stopPropagation();
        onSelectNode(node.node.id);
        if (allowDirectDrag) {
          onBeginDrag(node.node, transformMode, event, stageScale);
        }
      }}
      title={`${node.node.n ?? `Node${node.node.id}`} · ${Math.round(node.node.x ?? 0)}, ${Math.round(node.node.y ?? 0)}`}
    >
      {isLoadingBar ? (
        <div className="legacy-ui-node__loading-track">
          {skinStyle ? (
            <div
              className="legacy-ui-node__loading-fill"
              style={{
                ...skinStyle,
                width: `${Math.max(0, Math.min(100, loadingPercent * 100))}%`
              }}
            />
          ) : null}
        </div>
      ) : skinStyle ? (
        <div className="legacy-ui-node__skin" style={skinStyle} />
      ) : null}
      {bitmapFont ? (
        <LegacyBitmapFontText height={box.height} node={node.node} resource={bitmapFont} width={box.width} />
      ) : node.node.type === 13 ? (
        <LegacyRichText node={node.node} />
      ) : displayText ? (
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
      {selected && interactionMode === "scene" ? (
        <div
          className="legacy-ui-node__overlay"
          data-scene-tool={sceneTool}
          onMouseDown={(event) => {
            if (!allowDirectDrag) return;
            event.stopPropagation();
            onSelectNode(node.node.id);
            onBeginDrag(node.node, transformMode, event, stageScale);
          }}
        >
          <div className="legacy-ui-node__overlay-label">{describeSceneTool(sceneTool)}</div>
          <div className="legacy-ui-node__overlay-corners">
            <span className="legacy-ui-node__corner legacy-ui-node__corner--lt" />
            <span className="legacy-ui-node__corner legacy-ui-node__corner--rt" />
            <span className="legacy-ui-node__corner legacy-ui-node__corner--lb" />
            <span className="legacy-ui-node__corner legacy-ui-node__corner--rb" />
          </div>
          {sceneTool === "rect" || sceneTool === "scale" ? (
            <div
              className={`legacy-ui-node__handle legacy-ui-node__handle--${sceneTool}`}
              data-ui-handle={sceneTool}
              onMouseDown={(event) => {
                event.stopPropagation();
                onBeginDrag(node.node, sceneTool, event, stageScale);
              }}
            />
          ) : null}
          {sceneTool === "rotate" ? (
            <>
              <span className="legacy-ui-node__handle-line" />
              <div
                className="legacy-ui-node__handle legacy-ui-node__handle--rotate"
                data-ui-handle="rotate"
                onMouseDown={(event) => {
                  event.stopPropagation();
                  onBeginDrag(node.node, "rotate", event, stageScale);
                }}
              />
            </>
          ) : null}
        </div>
      ) : null}
      {missingResource ? <div className="legacy-ui-node__missing">{missingResource}</div> : null}
      {node.children.map((child) => (
        <LegacyUiLayoutNodePreview
          key={child.node.id}
          interactionMode={interactionMode}
          sceneTool={sceneTool}
          stageScale={stageScale}
          node={child}
          parentHeight={box.height}
          layoutResources={layoutResources}
          bitmapFontResources={bitmapFontResources}
          selectedNodeId={selectedNodeId}
          onSelectNode={onSelectNode}
          onBeginDrag={onBeginDrag}
        />
      ))}
    </div>
  );
}

function collectRequestedImageResources(nodes: LegacyUILayoutNode[]): string[] {
  const keys = new Set<string>();
  for (const node of nodes) {
    for (const rawValue of [node.res, node.sel, node.dis, node.nbf, node.nnf]) {
      const request = normalizeResourceRequest(rawValue, node.ud);
      if (request) keys.add(request);
    }
  }
  return Array.from(keys);
}

function collectRequestedBitmapFonts(nodes: LegacyUILayoutNode[]): string[] {
  const keys = new Set<string>();
  for (const node of nodes) {
    const request = normalizeBitmapFontRequest(node.fntf);
    if (request) keys.add(request);
  }
  return Array.from(keys);
}

function normalizeResourceRequest(value: unknown, ud: unknown): string {
  const raw = typeof value === "string" ? value.trim().replace(/\\/g, "/") : "";
  if (!raw || raw === "null") return "";
  if (!/\.(png|jpg|jpeg|webp)$/i.test(raw) && isNeedload(ud)) return `${raw}.png`;
  return raw;
}

function normalizeBitmapFontRequest(value: unknown): string {
  const raw = typeof value === "string" ? value.trim().replace(/\\/g, "/") : "";
  if (!raw || raw === "null") return "";
  return raw;
}

function resolveNodeSkin(
  node: LegacyUILayoutNode,
  width: number,
  height: number,
  layoutResources: Record<string, LegacyLayoutResource>
): CSSProperties | null {
  const request = normalizeResourceRequest(node.res, node.ud);
  const resource = request ? layoutResources[request] ?? null : null;
  const imageUrl = resource?.kind === "image" || resource?.kind === "atlas-frame" ? resource.url : null;
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

function resolveBitmapFontResource(
  node: LegacyUILayoutNode,
  bitmapFontResources: Record<string, LegacyBitmapFontResource>
): LegacyBitmapFontResource | null {
  const request = normalizeBitmapFontRequest(node.fntf);
  if (!request) return null;
  return bitmapFontResources[request] ?? null;
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
  const scaleX = Number.isFinite(Number(node.sx)) ? Number(node.sx) : 1;
  const scaleY = Number.isFinite(Number(node.sy)) ? Number(node.sy) : 1;
  const rotation = Number.isFinite(Number(node.r)) ? Number(node.r) : 0;
  const transformParts: string[] = [];
  if (rotation !== 0) transformParts.push(`rotate(${rotation}deg)`);
  if (scaleX !== 1 || scaleY !== 1) transformParts.push(`scale(${scaleX}, ${scaleY})`);
  return {
    display: node.v === false ? "none" : "block",
    height: `${box.height}px`,
    left: `${box.left}px`,
    overflow: node.c ? "hidden" : "visible",
    position: "absolute",
    top: `${box.top}px`,
    transform: transformParts.length > 0 ? transformParts.join(" ") : undefined,
    transformOrigin: resolveTransformOrigin(node),
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

function shouldShowMissingResource(
  node: LegacyUILayoutNode,
  skinStyle: CSSProperties | null,
  bitmapFont: LegacyBitmapFontResource | null
): string {
  if (bitmapFont) return "";
  const fontRequest = normalizeBitmapFontRequest(node.fntf);
  if (fontRequest) return fontRequest.split("/").pop() ?? fontRequest;
  if (skinStyle || node.type === 3 || node.type === 11 || node.type === 13) return "";
  const request = normalizeResourceRequest(node.res, node.ud);
  if (!request) return "";
  return request.split("/").pop() ?? request;
}

function resolveBorderRadius(node: LegacyUILayoutNode): number {
  if (node.type === 2) return 12;
  if (node.type === 4) return 6;
  return 4;
}

function resolveTransformOrigin(node: LegacyUILayoutNode): string {
  const anchorX = clamp(node.ax ?? 0.5, 0, 1);
  const anchorY = clamp(1 - (node.ay ?? 0.5), 0, 1);
  return `${Math.round(anchorX * 100)}% ${Math.round(anchorY * 100)}%`;
}

function describeSceneTool(sceneTool: "hand" | "move" | "rotate" | "scale" | "rect"): string {
  switch (sceneTool) {
    case "move":
      return "Move";
    case "rect":
      return "Rect";
    case "scale":
      return "Scale";
    case "rotate":
      return "Rotate";
    default:
      return "Hand";
  }
}

function stripRichMarkup(input: string): string {
  return input
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?font\b[^>]*>/gi, "")
    .replace(/<\/?p\b[^>]*>/gi, "")
    .replace(/<\/?span\b[^>]*>/gi, "")
    .trim();
}

function resolveLoadingPercent(node: LegacyUILayoutNode): number {
  const raw = Number((node.p ?? node.percent ?? node.value ?? node.progress ?? 1) as number);
  if (!Number.isFinite(raw)) return 1;
  const normalized = raw > 1 ? raw / 100 : raw;
  return Math.max(0, Math.min(1, normalized));
}

function LegacyRichText({ node }: { node: LegacyUILayoutNode }) {
  const segments = parseRichTextSegments(typeof node.text === "string" ? node.text : "");
  if (segments.length <= 0) return null;

  return (
    <div
      className="legacy-ui-node__text legacy-ui-node__text--rich"
      style={{
        alignItems: resolveVerticalAlign(node),
        fontSize: `${Math.max(10, Math.round(resolveFontSize(node)))}px`,
        justifyContent: resolveHorizontalAlign(node),
        textAlign: resolveTextAlign(node)
      }}
    >
      <span>
        {segments.map((segment, index) => (
          <span
            key={`${segment.text}-${index}`}
            style={{
              color: segment.color ?? resolveTextColor(node) ?? "#edf2ff",
              fontSize: `${segment.size ?? Math.max(10, Math.round(resolveFontSize(node)))}px`
            }}
          >
            {segment.text}
          </span>
        ))}
      </span>
    </div>
  );
}

function LegacyBitmapFontText({
  node,
  resource,
  width,
  height
}: {
  node: LegacyUILayoutNode;
  resource: LegacyBitmapFontResource;
  width: number;
  height: number;
}) {
  const layout = useMemo(
    () => buildBitmapFontLayout(resource.font, typeof node.text === "string" ? node.text : "", width, height, node),
    [height, node, resource.font, width]
  );

  if (!layout || layout.glyphs.length <= 0) return null;

  return (
    <div className="legacy-ui-node__bitmap-text">
      <div style={{ height: `${Math.max(1, height)}px`, position: "relative", width: `${Math.max(1, width)}px` }}>
        {layout.glyphs.map((glyph) => (
          <div
            key={glyph.key}
            data-bitmap-glyph={glyph.charCode}
            style={{
              backgroundImage: `url("${resource.url}")`,
              backgroundPosition: `${-glyph.sx}px ${-glyph.sy}px`,
              backgroundRepeat: "no-repeat",
              backgroundSize: `${layout.scaleW}px ${layout.scaleH}px`,
              height: `${glyph.height}px`,
              left: `${glyph.left}px`,
              pointerEvents: "none",
              position: "absolute",
              top: `${glyph.top}px`,
              width: `${glyph.width}px`
            }}
          />
        ))}
      </div>
    </div>
  );
}

function parseRichTextSegments(input: string): Array<{ color?: string; size?: number; text: string }> {
  const raw = input.replace(/<br\s*\/?>/gi, "\n");
  if (!raw.trim()) return [];

  const segments: Array<{ color?: string; size?: number; text: string }> = [];
  const expression = /<font\b([^>]*)>([\s\S]*?)<\/font>/gi;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = expression.exec(raw))) {
    if (match.index > cursor) {
      segments.push({ text: raw.slice(cursor, match.index) });
    }
    const attrs = match[1] ?? "";
    const colorMatch = /color\s*=\s*['"]?\s*(#?[0-9a-fA-F]{6,8})\s*['"]?/i.exec(attrs);
    const sizeMatch = /size\s*=\s*['"]?\s*(\d+)\s*['"]?/i.exec(attrs);
    segments.push({
      color: colorMatch ? normalizeHexColor(colorMatch[1] ?? "") : undefined,
      size: sizeMatch ? Number(sizeMatch[1]) : undefined,
      text: stripRichMarkup(match[2] ?? "")
    });
    cursor = match.index + match[0].length;
  }

  if (cursor < raw.length) {
    segments.push({ text: raw.slice(cursor) });
  }

  return segments.filter((segment) => segment.text.length > 0);
}

function buildBitmapFontLayout(
  font: LegacyBitmapFont,
  text: string,
  width: number,
  height: number,
  node: LegacyUILayoutNode
):
  | {
      glyphs: Array<{
        charCode: number;
        height: number;
        key: string;
        left: number;
        sx: number;
        sy: number;
        top: number;
        width: number;
      }>;
      scaleH: number;
      scaleW: number;
    }
  | null {
  if (!text) return null;

  const lines = text.split(/\r?\n/g);
  const spaceAdvance = font.chars.get(32)?.xadvance ?? Math.max(1, font.lineHeight);
  const lineWidths = lines.map((line) => {
    let cursor = 0;
    for (const char of line) {
      const glyph = font.chars.get(char.charCodeAt(0));
      cursor += glyph?.xadvance ?? spaceAdvance;
    }
    return cursor;
  });
  const totalHeight = lines.length * font.lineHeight;
  const verticalAlign = Number(node.vt ?? 0);
  const horizontalAlign = Number(node.ht ?? 0);
  const baseY = verticalAlign === 1 ? (height - totalHeight) / 2 : verticalAlign === 2 ? height - totalHeight : 0;

  const glyphs: Array<{
    charCode: number;
    height: number;
    key: string;
    left: number;
    sx: number;
    sy: number;
    top: number;
    width: number;
  }> = [];

  lines.forEach((line, lineIndex) => {
    const lineWidth = lineWidths[lineIndex] ?? 0;
    const baseX = horizontalAlign === 1 ? (width - lineWidth) / 2 : horizontalAlign === 2 ? width - lineWidth : 0;
    let cursor = 0;

    for (let charIndex = 0; charIndex < line.length; charIndex += 1) {
      const charCode = line.charCodeAt(charIndex);
      const glyph = font.chars.get(charCode);
      if (!glyph) {
        cursor += spaceAdvance;
        continue;
      }

      if (glyph.width > 0 && glyph.height > 0) {
        glyphs.push({
          charCode,
          height: glyph.height,
          key: `${lineIndex}:${charIndex}:${charCode}`,
          left: Math.round(baseX + cursor + glyph.xoffset),
          sx: glyph.x,
          sy: glyph.y,
          top: Math.round(baseY + lineIndex * font.lineHeight + glyph.yoffset),
          width: glyph.width
        });
      }

      cursor += glyph.xadvance > 0 ? glyph.xadvance : spaceAdvance;
    }
  });

  return {
    glyphs,
    scaleH: font.scaleH,
    scaleW: font.scaleW
  };
}

function normalizeHexColor(input: string): string {
  const raw = input.startsWith("#") ? input : `#${input}`;
  return raw.length === 9 ? `#${raw.slice(3)}` : raw;
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
