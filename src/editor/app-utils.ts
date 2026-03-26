import type {
  AppLogEntry,
  AtlasDocument,
  BizDocument,
  LegacyUILayoutNode,
  MapDocument,
  UiLayoutDocument
} from "./types";

export type MapCell = {
  x: number;
  y: number;
};

export function createLogEntry(level: AppLogEntry["level"], message: string): AppLogEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    level,
    message
  };
}

export function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export function collectDescendantIds(nodes: LegacyUILayoutNode[], rootId: number): Set<number> {
  const childMap = new Map<number, number[]>();
  for (const node of nodes) {
    if (node.parent === 0) continue;
    const siblings = childMap.get(node.parent) ?? [];
    siblings.push(node.id);
    childMap.set(node.parent, siblings);
  }
  const ids = new Set<number>([rootId]);
  const stack = [rootId];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined) continue;
    for (const childId of childMap.get(current) ?? []) {
      if (ids.has(childId)) continue;
      ids.add(childId);
      stack.push(childId);
    }
  }
  return ids;
}

export function getFirstNodeId(document: UiLayoutDocument): number | null {
  return document.nodes[0]?.id ?? null;
}

export function getAtlasFrameBySelection(document: AtlasDocument, frameName: string | null) {
  return document.frames.find((frame) => frame.name === frameName) ?? document.frames[0] ?? null;
}

export function getBizFileBySelection(document: BizDocument, fileIndex: number) {
  return document.files[fileIndex] ?? document.files[0] ?? null;
}

export function getBizFrameBySelection(
  file: BizDocument["files"][number] | null,
  frameId: number | null
): BizDocument["files"][number]["frames"][number] | null {
  if (!file) return null;
  return file.frames.find((frame) => frame.frameId === frameId) ?? file.frames[0] ?? null;
}

export function getMapColor(value: number): string {
  switch (value) {
    case 1:
      return "#7d2b2b";
    case 2:
      return "#326fa8";
    case 3:
      return "#1e8b72";
    default:
      return "#223347";
  }
}

export function describeMapCellValue(document: MapDocument, cell: MapCell | null): string {
  if (!cell) return "None";
  const value = document.blockData[cell.y * document.logicWidth + cell.x] ?? 0;
  return `${cell.x}, ${cell.y} = ${value}`;
}
