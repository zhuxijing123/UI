import type { LegacyUILayoutNode, UiHierarchyNode, WorkspaceAsset } from "./types";

export type AssetSortMode = "name" | "type";
export type AssetQueryMode = "all" | "name" | "kind" | "path";

export type AssetTreeNode =
  | {
      assetCount: number;
      kind: "folder";
      id: string;
      name: string;
      path: string;
      icon: string;
      meta: string;
      defaultOpen: boolean;
      depth: number;
      sortRank: number;
      children: AssetTreeNode[];
    }
  | {
      kind: "asset";
      id: string;
      name: string;
      path: string;
      icon: string;
      meta: string;
      extensionLabel: string;
      familyLabel: string | null;
      kindLabel: string;
      asset: WorkspaceAsset;
    };

export type UiViewportNode = {
  id: number;
  label: string;
  left: number;
  top: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  depth: number;
  node: LegacyUILayoutNode;
};

type ScopedTreeRule = {
  id: string;
  label: string;
  prefix: string;
  icon: string;
  meta: string;
  defaultOpen: boolean;
  sortRank: number;
};

type TreeAssetDisplay = {
  displayPath: string;
  rootGroup: ScopedTreeRule | null;
};

const SCOPED_TREE_RULES: ScopedTreeRule[] = [
  {
    id: "client-resources",
    label: "Client Resources",
    prefix: "packages/client/public/res/",
    icon: "CLI",
    meta: "packages/client/public/res",
    defaultOpen: true,
    sortRank: 10
  },
  {
    id: "server-data",
    label: "Server Data",
    prefix: "backend/runtime/gameserver/data/",
    icon: "SRV",
    meta: "backend/runtime/gameserver/data",
    defaultOpen: true,
    sortRank: 20
  },
  {
    id: "project-files",
    label: "Project Files",
    prefix: "",
    icon: "PRJ",
    meta: "other files under the selected workspace root",
    defaultOpen: false,
    sortRank: 90
  }
];

const ALWAYS_OPEN_FOLDERS = new Set([
  "uilayout",
  "uilayout-json",
  "uipic",
  "biz",
  "map",
  "long",
  "config",
  "fonts",
  "data",
  "cloth",
  "weapon",
  "effect",
  "script"
]);

function dirname(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const index = normalized.lastIndexOf("/");
  return index >= 0 ? normalized.slice(0, index) : "";
}

function getAssetKindLabel(asset: WorkspaceAsset): string {
  switch (asset.kind) {
    case "ui-layout":
      return "UI";
    case "atlas":
      return "ATLAS";
    case "bitmap-font":
      return "FONT";
    case "biz":
      return "BIZ";
    case "map":
      return "MAP";
    case "image":
      return "IMAGE";
    case "text":
      return "TEXT";
    default:
      return "FILE";
  }
}

function getAssetIcon(asset: WorkspaceAsset): string {
  switch (asset.kind) {
    case "ui-layout":
      return "UI";
    case "atlas":
      return "ATL";
    case "bitmap-font":
      return "FNT";
    case "biz":
      return "BIZ";
    case "map":
      return "MAP";
    case "image":
      return "IMG";
    case "text":
      return "TXT";
    default:
      return "FIL";
  }
}

function getAssetFamilyLabel(asset: WorkspaceAsset): string | null {
  const normalized = asset.path.replace(/\\/g, "/").toLowerCase();
  if (normalized.includes("/cloth/")) return "CLOTH";
  if (normalized.includes("/weapon/")) return "WEAPON";
  if (normalized.includes("/effect/")) return "EFFECT";
  if (normalized.includes("/uipic/")) return "UIPIC";
  if (normalized.includes("/uilayout/") || normalized.includes("/uilayout-json/")) return "LAYOUT";
  if (normalized.includes("/long/")) return "LONG";
  if (normalized.includes("/backend/runtime/gameserver/data/")) return "SERVER";
  return null;
}

function getFolderIcon(folderName: string): string {
  const lower = folderName.toLowerCase();
  if (lower.includes("uilayout")) return "UI";
  if (lower === "uipic") return "ATL";
  if (lower === "biz") return "BIZ";
  if (lower === "map") return "MAP";
  if (lower === "long") return "CSV";
  if (lower === "config") return "CFG";
  if (lower === "script") return "LUA";
  if (lower === "fonts") return "FNT";
  if (lower === "data") return "DAT";
  if (lower === "cloth" || lower === "weapon" || lower === "effect") return "IMG";
  return "DIR";
}

function getFolderDefaultOpen(folderName: string, depth: number): boolean {
  if (depth <= 1) return true;
  return ALWAYS_OPEN_FOLDERS.has(folderName.toLowerCase());
}

function getTreeAssetDisplay(asset: WorkspaceAsset, useScopedRoots: boolean): TreeAssetDisplay {
  if (!useScopedRoots) {
    return {
      displayPath: asset.path,
      rootGroup: null
    };
  }

  const normalized = asset.path.replace(/\\/g, "/");
  for (const rule of SCOPED_TREE_RULES) {
    if (!rule.prefix) continue;
    const prefixIndex = normalized.startsWith(rule.prefix) ? 0 : normalized.indexOf(`/${rule.prefix}`);
    if (prefixIndex < 0) continue;
    return {
      displayPath: normalized.slice(prefixIndex + (prefixIndex === 0 ? rule.prefix.length : rule.prefix.length + 1)),
      rootGroup: rule
    };
  }

  return {
    displayPath: normalized,
    rootGroup: SCOPED_TREE_RULES.find((rule) => rule.id === "project-files") ?? null
  };
}

export function createAssetTree(assets: WorkspaceAsset[], sortMode: AssetSortMode = "name"): AssetTreeNode[] {
  const roots: AssetTreeNode[] = [];
  const useScopedRoots = assets.some((asset) =>
    SCOPED_TREE_RULES.some((rule) => {
      if (!rule.prefix) return false;
      const normalized = asset.path.replace(/\\/g, "/");
      return normalized.startsWith(rule.prefix) || normalized.includes(`/${rule.prefix}`);
    })
  );

  const ensureFolder = (
    children: AssetTreeNode[],
    folderName: string,
    folderPath: string,
    options?: Partial<Extract<AssetTreeNode, { kind: "folder" }>>
  ): Extract<AssetTreeNode, { kind: "folder" }> => {
    const existing = children.find((child) => child.kind === "folder" && child.path === folderPath);
    if (existing && existing.kind === "folder") return existing;
    const created: Extract<AssetTreeNode, { kind: "folder" }> = {
      assetCount: 0,
      children: [],
      defaultOpen: options?.defaultOpen ?? false,
      depth: options?.depth ?? 0,
      id: `folder:${folderPath}`,
      icon: options?.icon ?? getFolderIcon(folderName),
      kind: "folder",
      meta: options?.meta ?? folderPath,
      name: folderName,
      path: folderPath,
      sortRank: options?.sortRank ?? 1000
    };
    children.push(created);
    return created;
  };

  for (const asset of assets) {
    const display = getTreeAssetDisplay(asset, useScopedRoots);
    const rawPath = display.displayPath || asset.name;
    const parts = rawPath.split("/").filter(Boolean);
    let children = roots;
    let currentPath = "";
    let currentDepth = 0;

    if (display.rootGroup) {
      const scopeFolder = ensureFolder(roots, display.rootGroup.label, `scope:${display.rootGroup.id}`, {
        defaultOpen: display.rootGroup.defaultOpen,
        depth: 0,
        icon: display.rootGroup.icon,
        meta: display.rootGroup.meta,
        sortRank: display.rootGroup.sortRank
      });
      scopeFolder.assetCount += 1;
      children = scopeFolder.children;
      currentPath = `scope:${display.rootGroup.id}`;
      currentDepth = 1;
    }

    for (let index = 0; index < parts.length - 1; index += 1) {
      const part = parts[index] ?? "";
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const folder = ensureFolder(children, part, currentPath, {
        defaultOpen: getFolderDefaultOpen(part, currentDepth),
        depth: currentDepth,
        icon: getFolderIcon(part),
        meta: currentPath.startsWith("scope:") ? currentPath.split("/").slice(1).join("/") : currentPath
      });
      folder.assetCount += 1;
      children = folder.children;
      currentDepth += 1;
    }
    children.push({
      asset,
      extensionLabel: asset.extension ? asset.extension.replace(/^\./, "").toUpperCase() : "NOEXT",
      familyLabel: getAssetFamilyLabel(asset),
      icon: getAssetIcon(asset),
      id: asset.id,
      kind: "asset",
      kindLabel: getAssetKindLabel(asset),
      meta: dirname(rawPath) || (display.rootGroup ? display.rootGroup.label : "workspace root"),
      name: asset.name,
      path: asset.path
    });
  }

  sortTree(roots, sortMode);
  return roots;
}

function compareTreeNode(left: AssetTreeNode, right: AssetTreeNode, sortMode: AssetSortMode): number {
  if (left.kind !== right.kind) return left.kind === "folder" ? -1 : 1;
  if (left.kind === "folder" && right.kind === "folder" && left.sortRank !== right.sortRank) {
    return left.sortRank - right.sortRank;
  }
  if (left.kind === "asset" && right.kind === "asset" && sortMode === "type") {
    const kindComparison = left.kindLabel.localeCompare(right.kindLabel);
    if (kindComparison !== 0) return kindComparison;
  }
  return left.name.localeCompare(right.name);
}

function sortTree(nodes: AssetTreeNode[], sortMode: AssetSortMode): void {
  nodes.sort((left, right) => compareTreeNode(left, right, sortMode));
  for (const node of nodes) {
    if (node.kind === "folder") sortTree(node.children, sortMode);
  }
}

export function filterAssetsByQuery(assets: WorkspaceAsset[], query: string, mode: AssetQueryMode = "all"): WorkspaceAsset[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return assets;
  return assets.filter(
    (asset) => {
      const nameMatch = asset.name.toLowerCase().includes(normalized);
      const pathMatch = asset.path.toLowerCase().includes(normalized);
      const kindMatch =
        asset.kind.toLowerCase().includes(normalized) ||
        asset.extension.toLowerCase().includes(normalized);

      if (mode === "name") return nameMatch;
      if (mode === "path") return pathMatch;
      if (mode === "kind") return kindMatch;
      return nameMatch || pathMatch || kindMatch;
    }
  );
}

export function flattenUiViewportNodes(roots: UiHierarchyNode[], stageWidth: number, stageHeight: number): UiViewportNode[] {
  const output: UiViewportNode[] = [];

  const walk = (treeNode: UiHierarchyNode, parentCenterX: number, parentCenterY: number, depth: number): void => {
    const node = treeNode.node;
    const width = Math.max(12, Math.round(node.w ?? 80));
    const height = Math.max(12, Math.round(node.h ?? 40));
    const anchorX = clamp(node.ax ?? 0.5, 0, 1);
    const anchorY = clamp(node.ay ?? 0.5, 0, 1);
    const x = Math.round(node.x ?? 0);
    const y = Math.round(node.y ?? 0);
    const centerX = parentCenterX + x;
    const centerY = parentCenterY - y;
    const left = centerX - width * anchorX;
    const top = centerY - height * (1 - anchorY);
    output.push({
      centerX,
      centerY,
      depth,
      height,
      id: node.id,
      label: describeLegacyNode(node),
      left,
      node,
      top,
      width
    });
    for (const child of treeNode.children) {
      walk(child, centerX, centerY, depth + 1);
    }
  };

  for (const root of roots) {
    walk(root, stageWidth / 2, stageHeight / 2, 0);
  }
  return output;
}

export function describeLegacyNode(node: LegacyUILayoutNode): string {
  const name = typeof node.n === "string" && node.n.trim() ? node.n : `Node${node.id}`;
  const typeName = describeLegacyNodeType(node.type);
  return `${name} · ${typeName}`;
}

export function describeLegacyNodeType(type: number): string {
  switch (type) {
    case 1:
      return "Panel";
    case 2:
      return "Button";
    case 3:
      return "Text";
    case 4:
      return "Image";
    case 5:
      return "List";
    default:
      return `Type ${type}`;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
