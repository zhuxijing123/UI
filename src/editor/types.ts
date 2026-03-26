export type LegacyUILayoutNode = {
  id: number;
  parent: number;
  type: number;
  n?: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  ax?: number;
  ay?: number;
  r?: number;
  res?: string;
  sel?: string;
  dis?: string;
  nbf?: string;
  nnf?: string;
  text?: string;
  fs?: number;
  color?: string;
  tcolor?: string;
  fr?: string;
  fntf?: string;
  v?: boolean;
  t?: boolean;
  c?: boolean;
  ss?: boolean;
  sx?: number;
  sy?: number;
  sw?: number;
  sh?: number;
  ud?: string;
  skX?: number;
  skY?: number;
  zo?: number;
  ht?: number;
  vt?: number;
  [key: string]: unknown;
};

export type WorkspaceAssetKind =
  | "ui-layout"
  | "atlas"
  | "biz"
  | "map"
  | "image"
  | "text"
  | "unknown";

export type WorkspaceAsset = {
  id: string;
  path: string;
  name: string;
  extension: string;
  kind: WorkspaceAssetKind;
  handle: FileSystemFileHandle;
};

export type AtlasFrameDocument = {
  name: string;
  frame: { x: number; y: number; w: number; h: number };
  rotated: boolean;
  trimmed: boolean;
  spriteSourceSize: { x: number; y: number; w: number; h: number };
  sourceSize: { w: number; h: number };
};

export type AtlasDocument = {
  kind: "atlas";
  id: string;
  name: string;
  sourcePath: string;
  imagePath: string;
  imageHandle: FileSystemFileHandle | null;
  imageUrl: string | null;
  frames: AtlasFrameDocument[];
};

export type BizFrame = {
  fileId: number;
  frameId: number;
  dir: number;
  frameIndex: number;
  x: number;
  y: number;
  w: number;
  h: number;
  ox: number;
  oy: number;
  sourceW: number;
  sourceH: number;
  rotated: boolean;
};

export type BizFileDocument = {
  fileId: number;
  fileW: number;
  fileH: number;
  dirCount: number;
  frameCount: number;
  frames: BizFrame[];
};

export type BizDocument = {
  kind: "biz";
  id: string;
  name: string;
  sourcePath: string;
  imagePath: string | null;
  imageHandle: FileSystemFileHandle | null;
  imageUrl: string | null;
  files: BizFileDocument[];
};

export type MapDocument = {
  kind: "map";
  id: string;
  name: string;
  sourcePath: string;
  version: number;
  groundWidth: number;
  groundHeight: number;
  logicWidth: number;
  logicHeight: number;
  groundDir: number;
  blockData: Uint8Array;
};

export type UiLayoutDocument = {
  kind: "ui-layout";
  id: string;
  name: string;
  sourcePath: string | null;
  sourceFormat: "lua" | "json";
  nodes: LegacyUILayoutNode[];
};

export type GenericTextDocument = {
  kind: "text";
  id: string;
  name: string;
  sourcePath: string;
  text: string;
};

export type ImageDocument = {
  kind: "image";
  id: string;
  name: string;
  sourcePath: string;
  imageUrl: string;
};

export type EditorDocument =
  | AtlasDocument
  | BizDocument
  | GenericTextDocument
  | ImageDocument
  | MapDocument
  | UiLayoutDocument;

export type DocumentTab = {
  document: EditorDocument;
  asset: WorkspaceAsset | null;
  dirty: boolean;
};

export type UiHierarchyNode = {
  node: LegacyUILayoutNode;
  children: UiHierarchyNode[];
};

export type AppLogLevel = "info" | "warn" | "error";

export type AppLogEntry = {
  id: string;
  level: AppLogLevel;
  message: string;
};
