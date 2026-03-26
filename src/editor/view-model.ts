import type { LegacyUILayoutNode, UiHierarchyNode, WorkspaceAsset } from "./types";

export type AssetTreeNode =
  | {
      kind: "folder";
      id: string;
      name: string;
      path: string;
      children: AssetTreeNode[];
    }
  | {
      kind: "asset";
      id: string;
      name: string;
      path: string;
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

export function createAssetTree(assets: WorkspaceAsset[]): AssetTreeNode[] {
  const roots: AssetTreeNode[] = [];

  const ensureFolder = (children: AssetTreeNode[], folderName: string, folderPath: string): Extract<AssetTreeNode, { kind: "folder" }> => {
    const existing = children.find((child) => child.kind === "folder" && child.path === folderPath);
    if (existing && existing.kind === "folder") return existing;
    const created: Extract<AssetTreeNode, { kind: "folder" }> = {
      children: [],
      id: `folder:${folderPath}`,
      kind: "folder",
      name: folderName,
      path: folderPath
    };
    children.push(created);
    return created;
  };

  for (const asset of assets) {
    const parts = asset.path.split("/");
    let children = roots;
    let currentPath = "";
    for (let index = 0; index < parts.length - 1; index += 1) {
      const part = parts[index] ?? "";
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const folder = ensureFolder(children, part, currentPath);
      children = folder.children;
    }
    children.push({
      asset,
      id: asset.id,
      kind: "asset",
      name: asset.name,
      path: asset.path
    });
  }

  sortTree(roots);
  return roots;
}

function compareTreeNode(left: AssetTreeNode, right: AssetTreeNode): number {
  if (left.kind !== right.kind) return left.kind === "folder" ? -1 : 1;
  return left.name.localeCompare(right.name);
}

function sortTree(nodes: AssetTreeNode[]): void {
  nodes.sort(compareTreeNode);
  for (const node of nodes) {
    if (node.kind === "folder") sortTree(node.children);
  }
}

export function filterAssetsByQuery(assets: WorkspaceAsset[], query: string): WorkspaceAsset[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return assets;
  return assets.filter(
    (asset) =>
      asset.path.toLowerCase().includes(normalized) ||
      asset.kind.toLowerCase().includes(normalized) ||
      asset.extension.toLowerCase().includes(normalized)
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
