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
  | "bitmap-font"
  | "biz"
  | "map"
  | "image"
  | "text"
  | "unknown";

export type WorkspaceAssetSource = "fs-access" | "upload";

export type WorkspaceAsset = {
  id: string;
  path: string;
  name: string;
  extension: string;
  kind: WorkspaceAssetKind;
  source: WorkspaceAssetSource;
  writable: boolean;
  handle: FileSystemFileHandle | null;
  file: File | null;
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

export type LegacyBitmapFontChar = {
  height: number;
  id: number;
  width: number;
  x: number;
  xadvance: number;
  xoffset: number;
  y: number;
  yoffset: number;
};

export type LegacyBitmapFont = {
  chars: Map<number, LegacyBitmapFontChar>;
  font: string;
  image: string;
  lineHeight: number;
  scaleH: number;
  scaleW: number;
};

export type BitmapFontDocument = {
  kind: "bitmap-font";
  id: string;
  imagePath: string | null;
  imageUrl: string | null;
  name: string;
  sourcePath: string;
  font: LegacyBitmapFont;
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
  metadata: MapInfoEntry | null;
  overlays: MapOverlayEntry[];
  overlaySummary: MapOverlaySummary;
};

export type MapInfoEntry = {
  id: number;
  mapId: string;
  file: string;
  mapName: string;
  minimap: string;
};

export type MapOverlayKind = "npc" | "monster" | "teleport";

export type MapOverlayEntry = {
  id: string;
  kind: MapOverlayKind;
  x: number;
  y: number;
  label: string;
  subtitle: string;
  details: string[];
  radius: number;
  targetMapId: string | null;
  targetMapName: string | null;
  sourceId: number;
};

export type MapOverlaySummary = {
  npc: number;
  monster: number;
  teleport: number;
};

export type UiLayoutDocument = {
  kind: "ui-layout";
  id: string;
  name: string;
  sourcePath: string | null;
  sourceFormat: "lua" | "json";
  nodes: LegacyUILayoutNode[];
};

export type LegacyGameInfoEntry = {
  id: number;
  scale: number;
  nameY: number;
  offX: number;
  offY: number;
};

export type LegacySequenceEntry = {
  id: number;
  resCount: number;
  frameCount: number;
  frames: number[];
};

export type AvatarPreviewDocument = {
  kind: "avatar-preview";
  id: string;
  name: string;
  sourcePath: string | null;
  cloth: number;
  weapon: number;
  dir: number;
  state: number;
  gameInfo: LegacyGameInfoEntry[];
  actionInfo: LegacySequenceEntry[];
  clothBank: BizDocument;
  weaponBank: BizDocument | null;
  clothImageAssets: Record<string, WorkspaceAsset>;
  weaponImageAssets: Record<string, WorkspaceAsset>;
};

export type EffectPreviewDocument = {
  kind: "effect-preview";
  id: string;
  name: string;
  sourcePath: string | null;
  fileId: number;
  dir: number;
  delay: number;
  loop: boolean;
  gameInfo: LegacyGameInfoEntry[];
  effectInfo: LegacySequenceEntry[];
  noDirIds: number[];
  effectBank: BizDocument;
  effectImageAssets: Record<string, WorkspaceAsset>;
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
  | AvatarPreviewDocument
  | BitmapFontDocument
  | BizDocument
  | EffectPreviewDocument
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
