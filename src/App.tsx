import type { CSSProperties, Dispatch, SetStateAction } from "react";
import { startTransition, useDeferredValue, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";

import "./App.css";
import { useContextMenu, type ContextMenuItem } from "./editor/components/ContextMenu";
import { useTranslation } from "./editor/i18n/useTranslation";

import {
  collectDescendantIds,
  createLogEntry,
  formatErrorMessage,
  getAtlasFrameBySelection,
  getBizFileBySelection,
  getBizFrameBySelection,
  getFirstNodeId,
  type MapCell
} from "./editor/app-utils";
import { AssetBrowserTree } from "./editor/components/AssetBrowserTree";
import { EmptyState } from "./editor/components/EmptyState";
import { HierarchyTree } from "./editor/components/HierarchyTree";
import { InspectorPane } from "./editor/components/InspectorPane";
import { PreviewPane } from "./editor/components/PreviewPane";
import { SettingsPanel } from "./editor/components/SettingsPanel";
import { WelcomeHome } from "./editor/components/WelcomeHome";
import { buildUiHierarchy, serializeLegacyUILayout, serializeMapDocument } from "./editor/formats";
import {
  createAvatarPreviewDocument,
  createEffectPreviewDocument,
  createLinkedLegacyPreviewDocument,
  inferLinkedLegacyPreviewIntent
} from "./editor/legacy-labs";
import {
  clearCachedWorkspaceRecord,
  loadCachedWorkspaceRecord,
  loadCachedWorkspaceRecords,
  removeCachedWorkspaceRecord,
  saveCachedWorkspaceRecord
} from "./editor/project-cache";
import { createStarterUiLayoutDocument } from "./editor/presets";
import type { AppLogEntry, AtlasDocument, BizDocument, DocumentTab, EditorDocument, LegacyUILayoutNode, UiHierarchyNode, WorkspaceAsset } from "./editor/types";
import { createAssetTree, describeLegacyNode, describeLegacyNodeType, filterAssetsByQuery, type AssetQueryMode, type AssetSortMode } from "./editor/view-model";
import type { WorkspaceProgressSnapshot, WorkspaceScanResult } from "./editor/workspace";
import {
  openAssetDocument,
  openWorkspaceDirectory,
  openWorkspaceFiles,
  scanWorkspace,
  writeBinaryFile,
  writeTextFile
} from "./editor/workspace";

type DragState =
  | {
      mode: "move";
      docId: string;
      nodeId: number;
      originX: number;
      originY: number;
      pointerStartX: number;
      pointerStartY: number;
      scale: number;
    }
  | {
      mode: "rect";
      docId: string;
      nodeId: number;
      widthStart: number;
      heightStart: number;
      pointerStartX: number;
      pointerStartY: number;
      scale: number;
    }
  | {
      mode: "scale";
      docId: string;
      nodeId: number;
      widthStart: number;
      heightStart: number;
      scaleXStart: number;
      scaleYStart: number;
      pointerStartX: number;
      pointerStartY: number;
      scale: number;
    }
  | {
      mode: "rotate";
      docId: string;
      nodeId: number;
      rotationStart: number;
      centerClientX: number;
      centerClientY: number;
      pointerStartAngle: number;
    };

type RecentWorkspaceSummary = {
  id: string;
  label: string;
  rootName: string;
  savedAt: number;
};

type WorkspaceProgressState = WorkspaceProgressSnapshot & {
  percent: number | null;
};

type WorkspaceProfile = "full-project" | "client-only" | "server-only" | "generic";
type AssetWorkbenchFilter = "all" | "ui" | "avatar" | "map" | "data";
type StageWorkbenchMode = "scene" | "preview";
type BottomDockTab = "console" | "selection" | "project";
type InspectorDockTab = "properties" | "document";
type SceneTool = "hand" | "move" | "rotate" | "scale" | "rect";
type SceneZoom = "fit" | "100";
type AppMenu = "file" | "edit" | "node" | "project" | "panel" | "extension" | "developer" | "help";
type SplitterKind = "left-width" | "right-width" | "bottom-height" | "hierarchy-height";
type HierarchyQueryMode = "all" | "name" | "type" | "text" | "resource";

type InspectorSnapshot = {
  activeDocument: EditorDocument | null;
  selectedAtlasFrame: AtlasDocument["frames"][number] | null;
  selectedBizDocumentFile: BizDocument["files"][number] | null;
  selectedBizFrame: BizDocument["files"][number]["frames"][number] | null;
  selectedMapCell: MapCell | null;
  selectedUiNode: LegacyUILayoutNode | null;
};

type SplitterState = {
  kind: SplitterKind;
  pointerStart: number;
  sizeStart: number;
};

type SaveDocumentResult = "saved" | "skipped" | "failed";
type DirtyActionChoice = "save" | "discard" | "cancel";
type DirtyActionPromptMode = "close-tab" | "workspace-switch";
type SaveTabsSummary = {
  failedCount: number;
  savedCount: number;
  skippedCount: number;
};
type SavableDocument = Extract<EditorDocument, { kind: "map" | "text" | "ui-layout" }>;

type DirtyActionPromptState = {
  actionLabel: string;
  cancelLabel: string;
  dirtyTabs: Array<{
    id: string;
    kind: EditorDocument["kind"];
    name: string;
    savable: boolean;
  }>;
  discardLabel: string;
  mode: DirtyActionPromptMode;
  saveLabel: string;
};

type EditorLayoutState = {
  assetWorkbenchFilter: AssetWorkbenchFilter;
  bottomDockCollapsed: boolean;
  bottomDockHeight: number;
  bottomDockTab: BottomDockTab;
  hierarchyPaneHeight: number;
  inspectorDockTab: InspectorDockTab;
  leftColumnWidth: number;
  leftDockCollapsed: boolean;
  rightColumnWidth: number;
  rightDockCollapsed: boolean;
  sceneFocusMode: boolean;
  sceneTool: SceneTool;
  sceneZoom: SceneZoom;
  stageWorkbenchMode: StageWorkbenchMode;
};

const EDITOR_LAYOUT_STORAGE_KEY = "brm-ui-studio-layout-v1";
const LEFT_DOCK_RAIL_WIDTH = 44;
const RIGHT_DOCK_RAIL_WIDTH = 44;
const DEFAULT_EDITOR_LAYOUT: EditorLayoutState = {
  assetWorkbenchFilter: "all",
  bottomDockCollapsed: false,
  bottomDockHeight: 230,
  bottomDockTab: "console",
  hierarchyPaneHeight: 280,
  inspectorDockTab: "properties",
  leftColumnWidth: 300,
  leftDockCollapsed: false,
  rightColumnWidth: 330,
  rightDockCollapsed: false,
  sceneFocusMode: false,
  sceneTool: "move",
  sceneZoom: "fit",
  stageWorkbenchMode: "scene"
};

function readEnumValue<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && allowed.includes(value as T) ? (value as T) : fallback;
}

function readNumberValue(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? clampNumber(parsed, min, max) : fallback;
}

function parseStoredEditorLayout(): EditorLayoutState {
  if (typeof window === "undefined") return DEFAULT_EDITOR_LAYOUT;

  try {
    const raw = window.localStorage.getItem(EDITOR_LAYOUT_STORAGE_KEY);
    if (!raw) return DEFAULT_EDITOR_LAYOUT;
    const parsed = JSON.parse(raw) as Partial<Record<keyof EditorLayoutState, unknown>>;
    return {
      assetWorkbenchFilter: readEnumValue(parsed.assetWorkbenchFilter, ["all", "ui", "avatar", "map", "data"], DEFAULT_EDITOR_LAYOUT.assetWorkbenchFilter),
      bottomDockCollapsed: parsed.bottomDockCollapsed === true,
      bottomDockHeight: readNumberValue(parsed.bottomDockHeight, DEFAULT_EDITOR_LAYOUT.bottomDockHeight, 170, 420),
      bottomDockTab: readEnumValue(parsed.bottomDockTab, ["console", "selection", "project"], DEFAULT_EDITOR_LAYOUT.bottomDockTab),
      hierarchyPaneHeight: readNumberValue(parsed.hierarchyPaneHeight, DEFAULT_EDITOR_LAYOUT.hierarchyPaneHeight, 180, 520),
      inspectorDockTab: readEnumValue(parsed.inspectorDockTab, ["properties", "document"], DEFAULT_EDITOR_LAYOUT.inspectorDockTab),
      leftColumnWidth: readNumberValue(parsed.leftColumnWidth, DEFAULT_EDITOR_LAYOUT.leftColumnWidth, 250, 420),
      leftDockCollapsed: parsed.leftDockCollapsed === true,
      rightColumnWidth: readNumberValue(parsed.rightColumnWidth, DEFAULT_EDITOR_LAYOUT.rightColumnWidth, 280, 440),
      rightDockCollapsed: parsed.rightDockCollapsed === true,
      sceneFocusMode: parsed.sceneFocusMode === true,
      sceneTool: readEnumValue(parsed.sceneTool, ["hand", "move", "rotate", "scale", "rect"], DEFAULT_EDITOR_LAYOUT.sceneTool),
      sceneZoom: readEnumValue(parsed.sceneZoom, ["fit", "100"], DEFAULT_EDITOR_LAYOUT.sceneZoom),
      stageWorkbenchMode: readEnumValue(parsed.stageWorkbenchMode, ["scene", "preview"], DEFAULT_EDITOR_LAYOUT.stageWorkbenchMode)
    };
  } catch {
    return DEFAULT_EDITOR_LAYOUT;
  }
}

function appendLogMessage(
  setLogs: Dispatch<SetStateAction<AppLogEntry[]>>,
  level: AppLogEntry["level"],
  message: string
): void {
  setLogs((current) => [...current.slice(-199), createLogEntry(level, message)]);
}

function detectWorkspaceProfile(assets: WorkspaceAsset[]): WorkspaceProfile {
  const hasPathSegment = (assetPath: string, prefix: string): boolean => {
    const normalized = assetPath.replace(/\\/g, "/");
    return normalized.startsWith(prefix) || normalized.includes(`/${prefix}`);
  };
  const hasClientResources = assets.some((asset) =>
    hasPathSegment(asset.path, "packages/client/public/res/")
  );
  const hasServerData = assets.some((asset) =>
    hasPathSegment(asset.path, "backend/runtime/gameserver/data/")
  );
  if (hasClientResources && hasServerData) return "full-project";
  if (hasClientResources) return "client-only";
  if (hasServerData) return "server-only";
  return "generic";
}

function describeWorkspaceProfile(profile: WorkspaceProfile): string | null {
  switch (profile) {
    case "full-project":
      return "Detected full BRM project workspace: client resources and server data are both available.";
    case "client-only":
      return "Detected client resource workspace.";
    case "server-only":
      return "Detected server data workspace.";
    default:
      return null;
  }
}

function toRecentWorkspaceSummary(record: {
  id: string;
  label: string;
  rootName: string;
  savedAt: number;
}): RecentWorkspaceSummary {
  return {
    id: record.id,
    label: record.label,
    rootName: record.rootName,
    savedAt: record.savedAt
  };
}

function matchesHierarchyQuery(node: LegacyUILayoutNode, query: string, mode: HierarchyQueryMode): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  const name = String(node.n ?? "").toLowerCase();
  const type = describeLegacyNodeType(node.type).toLowerCase();
  const text = String(node.text ?? "").toLowerCase();
  const resource = String(node.res ?? "").toLowerCase();

  if (mode === "name") return name.includes(normalized);
  if (mode === "type") return type.includes(normalized);
  if (mode === "text") return text.includes(normalized);
  if (mode === "resource") return resource.includes(normalized);
  return name.includes(normalized) || type.includes(normalized) || text.includes(normalized) || resource.includes(normalized);
}

function filterUiHierarchyNodes(nodes: UiHierarchyNode[], query: string, mode: HierarchyQueryMode): UiHierarchyNode[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return nodes;

  return nodes.flatMap((entry) => {
    const filteredChildren = filterUiHierarchyNodes(entry.children, query, mode);
    if (matchesHierarchyQuery(entry.node, normalized, mode) || filteredChildren.length > 0) {
      return [{ ...entry, children: filteredChildren }];
    }
    return [];
  });
}

function toWorkspaceProgressState(progress: WorkspaceProgressSnapshot): WorkspaceProgressState {
  return {
    ...progress,
    percent:
      progress.totalCount && progress.totalCount > 0
        ? Math.max(0, Math.min(100, Math.round((progress.processedCount / progress.totalCount) * 100)))
        : null
  };
}

function matchesAssetWorkbenchFilter(asset: WorkspaceAsset, filter: AssetWorkbenchFilter): boolean {
  if (filter === "all") return true;
  const normalized = asset.path.replace(/\\/g, "/").toLowerCase();
  switch (filter) {
    case "ui":
      return asset.kind === "ui-layout" || asset.kind === "atlas" || asset.kind === "bitmap-font" || normalized.includes("/uipic/");
    case "avatar":
      return normalized.includes("/cloth/") || normalized.includes("/weapon/") || normalized.includes("/effect/") || normalized.includes("/biz/");
    case "map":
      return asset.kind === "map" || normalized.includes("/map/") || normalized.includes("/long/");
    case "data":
      return asset.kind === "text" || normalized.includes("/config/") || normalized.includes("/script/");
    default:
      return true;
  }
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isEditableEventTarget(target: EventTarget | null): boolean {
  const element = target instanceof HTMLElement ? target : null;
  if (!element) return false;
  const tagName = element.tagName.toLowerCase();
  return element.isContentEditable || tagName === "input" || tagName === "select" || tagName === "textarea";
}

function canSaveDocument(document: EditorDocument): document is SavableDocument {
  return document.kind === "ui-layout" || document.kind === "map" || document.kind === "text";
}

function App() {
  const { t } = useTranslation();
  const persistedLayout = useMemo(() => parseStoredEditorLayout(), []);
  const [rootHandle, setRootHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [workspaceLabel, setWorkspaceLabel] = useState<string | null>(null);
  const [workspaceWritable, setWorkspaceWritable] = useState(false);
  const [recentWorkspaces, setRecentWorkspaces] = useState<RecentWorkspaceSummary[]>([]);
  const [assets, setAssets] = useState<WorkspaceAsset[]>([]);
  const [tabs, setTabs] = useState<DocumentTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [assetQuery, setAssetQuery] = useState("");
  const [assetQueryMode, setAssetQueryMode] = useState<AssetQueryMode>("all");
  const [assetSortMode, setAssetSortMode] = useState<AssetSortMode>("name");
  const [assetTreeExpanded, setAssetTreeExpanded] = useState(true);
  const [assetTreeExpandSignal, setAssetTreeExpandSignal] = useState(0);
  const [assetSearchVisible, setAssetSearchVisible] = useState(false);
  const [hierarchyQuery, setHierarchyQuery] = useState("");
  const [hierarchyQueryMode, setHierarchyQueryMode] = useState<HierarchyQueryMode>("all");
  const [hierarchyTreeExpanded, setHierarchyTreeExpanded] = useState(true);
  const [hierarchyTreeExpandSignal, setHierarchyTreeExpandSignal] = useState(0);
  const [hierarchySearchVisible, setHierarchySearchVisible] = useState(false);
  const [assetWorkbenchFilter, setAssetWorkbenchFilter] = useState<AssetWorkbenchFilter>(persistedLayout.assetWorkbenchFilter);
  const [logs, setLogs] = useState<AppLogEntry[]>([
    createLogEntry("info", "BRM UI Studio ready. Open a workspace to begin editing legacy assets.")
  ]);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [workspaceProgress, setWorkspaceProgress] = useState<WorkspaceProgressState | null>(null);
  const [stageWorkbenchMode, setStageWorkbenchMode] = useState<StageWorkbenchMode>(persistedLayout.stageWorkbenchMode);
  const [bottomDockTab, setBottomDockTab] = useState<BottomDockTab>(persistedLayout.bottomDockTab);
  const [inspectorDockTab, setInspectorDockTab] = useState<InspectorDockTab>(persistedLayout.inspectorDockTab);
  const [sceneTool, setSceneTool] = useState<SceneTool>(persistedLayout.sceneTool);
  const [sceneZoom, setSceneZoom] = useState<SceneZoom>(persistedLayout.sceneZoom);
  const [openMenu, setOpenMenu] = useState<AppMenu | null>(null);
  const [leftColumnWidth, setLeftColumnWidth] = useState(persistedLayout.leftColumnWidth);
  const [rightColumnWidth, setRightColumnWidth] = useState(persistedLayout.rightColumnWidth);
  const [bottomDockHeight, setBottomDockHeight] = useState(persistedLayout.bottomDockHeight);
  const [hierarchyPaneHeight, setHierarchyPaneHeight] = useState(persistedLayout.hierarchyPaneHeight);
  const [leftDockCollapsed, setLeftDockCollapsed] = useState(persistedLayout.leftDockCollapsed);
  const [bottomDockCollapsed, setBottomDockCollapsed] = useState(persistedLayout.bottomDockCollapsed);
  const [rightDockCollapsed, setRightDockCollapsed] = useState(persistedLayout.rightDockCollapsed);
  const [sceneFocusMode, setSceneFocusMode] = useState(persistedLayout.sceneFocusMode);
  const [dirtyActionPrompt, setDirtyActionPrompt] = useState<DirtyActionPromptState | null>(null);
  const [splitterState, setSplitterState] = useState<SplitterState | null>(null);
  const [selectedUiNodeIdByDoc, setSelectedUiNodeIdByDoc] = useState<Record<string, number | null>>({});
  const [selectedAtlasFrameByDoc, setSelectedAtlasFrameByDoc] = useState<Record<string, string | null>>({});
  const [selectedBizFileByDoc, setSelectedBizFileByDoc] = useState<Record<string, number>>({});
  const [selectedBizFrameByDoc, setSelectedBizFrameByDoc] = useState<Record<string, number | null>>({});
  const [selectedMapCellByDoc, setSelectedMapCellByDoc] = useState<Record<string, MapCell | null>>({});
  const [mapBrushValue, setMapBrushValue] = useState(1);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [inspectorLocked, setInspectorLocked] = useState(false);
  const [lockedInspectorSnapshot, setLockedInspectorSnapshot] = useState<InspectorSnapshot | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Context menu hooks
  const hierarchyContextMenu = useContextMenu();
  const assetContextMenu = useContextMenu();
  const tabContextMenu = useContextMenu();
  const panelContextMenu = useContextMenu();
  const inspectorContextMenu = useContextMenu();
  const consoleContextMenu = useContextMenu();
  const sceneContextMenu = useContextMenu();

  const newLayoutSeedRef = useRef(1);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const menuBarRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const dirtyActionResolverRef = useRef<((choice: DirtyActionChoice) => void) | null>(null);
  const deferredAssetQuery = useDeferredValue(assetQuery);

  const activeTab = useMemo(() => tabs.find((tab) => tab.document.id === activeTabId) ?? null, [activeTabId, tabs]);
  const activeDocument = activeTab?.document ?? null;
  const selectedAsset = useMemo(() => assets.find((asset) => asset.id === selectedAssetId) ?? null, [assets, selectedAssetId]);
  const filteredAssets = useMemo(
    () => filterAssetsByQuery(
      assets.filter((asset) => matchesAssetWorkbenchFilter(asset, assetWorkbenchFilter)),
      deferredAssetQuery,
      assetQueryMode
    ),
    [assetQueryMode, assetWorkbenchFilter, assets, deferredAssetQuery]
  );
  const assetTree = useMemo(() => createAssetTree(filteredAssets, assetSortMode), [assetSortMode, filteredAssets]);
  const workspaceProfile = useMemo(() => detectWorkspaceProfile(assets), [assets]);
  const latestCachedWorkspace = recentWorkspaces[0] ?? null;
  const uiHierarchy = useMemo(
    () => (activeDocument?.kind === "ui-layout" ? buildUiHierarchy(activeDocument.nodes) : []),
    [activeDocument]
  );
  const filteredUiHierarchy = useMemo(
    () => filterUiHierarchyNodes(uiHierarchy, hierarchyQuery, hierarchyQueryMode),
    [hierarchyQuery, hierarchyQueryMode, uiHierarchy]
  );
  const selectedUiNode = useMemo(() => {
    if (activeDocument?.kind !== "ui-layout") return null;
    const selectedId = selectedUiNodeIdByDoc[activeDocument.id] ?? getFirstNodeId(activeDocument);
    return activeDocument.nodes.find((node) => node.id === selectedId) ?? null;
  }, [activeDocument, selectedUiNodeIdByDoc]);

  const selectedAtlasFrame = useMemo(() => {
    if (activeDocument?.kind !== "atlas") return null;
    return getAtlasFrameBySelection(activeDocument, selectedAtlasFrameByDoc[activeDocument.id] ?? null);
  }, [activeDocument, selectedAtlasFrameByDoc]);

  const selectedBizFile = useMemo(() => {
    if (activeDocument?.kind !== "biz") return null;
    return getBizFileBySelection(activeDocument, selectedBizFileByDoc[activeDocument.id] ?? 0);
  }, [activeDocument, selectedBizFileByDoc]);

  const selectedBizFrame = useMemo(() => {
    if (activeDocument?.kind !== "biz") return null;
    return getBizFrameBySelection(selectedBizFile, selectedBizFrameByDoc[activeDocument.id] ?? null);
  }, [activeDocument, selectedBizFile, selectedBizFrameByDoc]);

  const selectedMapCell = useMemo(() => {
    if (activeDocument?.kind !== "map") return null;
    return selectedMapCellByDoc[activeDocument.id] ?? null;
  }, [activeDocument, selectedMapCellByDoc]);
  const liveInspectorSnapshot = useMemo<InspectorSnapshot>(() => ({
    activeDocument,
    selectedAtlasFrame,
    selectedBizDocumentFile: selectedBizFile,
    selectedBizFrame,
    selectedMapCell,
    selectedUiNode
  }), [activeDocument, selectedAtlasFrame, selectedBizFile, selectedBizFrame, selectedMapCell, selectedUiNode]);
  const inspectorSnapshot = inspectorLocked && lockedInspectorSnapshot ? lockedInspectorSnapshot : liveInspectorSnapshot;

  const appendLog = (level: AppLogEntry["level"], message: string): void => {
    appendLogMessage(setLogs, level, message);
  };

  const beginResize = (kind: SplitterKind, pointerStart: number, sizeStart: number): void => {
    setOpenMenu(null);
    setSplitterState({ kind, pointerStart, sizeStart });
  };

  const revealLeftDock = (): void => {
    setLeftDockCollapsed(false);
    setSplitterState(null);
  };

  const revealBottomDock = (tab?: BottomDockTab): void => {
    setBottomDockCollapsed(false);
    setSplitterState(null);
    if (tab) {
      setBottomDockTab(tab);
    }
  };

  const revealRightDock = (tab?: InspectorDockTab): void => {
    setRightDockCollapsed(false);
    setSplitterState(null);
    if (tab) {
      setInspectorDockTab(tab);
    }
  };

  const toggleLeftDock = (): void => {
    setSplitterState(null);
    setLeftDockCollapsed((current) => !current);
  };

  const toggleBottomDock = (tab?: BottomDockTab): void => {
    setSplitterState(null);
    setBottomDockCollapsed((current) => {
      const next = !current;
      if (!next && tab) {
        setBottomDockTab(tab);
      }
      return next;
    });
  };

  const toggleRightDock = (tab?: InspectorDockTab): void => {
    setSplitterState(null);
    setRightDockCollapsed((current) => {
      const next = !current;
      if (!next && tab) {
        setInspectorDockTab(tab);
      }
      return next;
    });
  };

  const toggleHierarchyTreeExpansion = (expanded: boolean): void => {
    setHierarchyTreeExpanded(expanded);
    setHierarchyTreeExpandSignal((current) => current + 1);
  };

  const toggleAssetTreeExpansion = (expanded: boolean): void => {
    setAssetTreeExpanded(expanded);
    setAssetTreeExpandSignal((current) => current + 1);
  };

  const toggleInspectorLock = (): void => {
    setInspectorLocked((current) => {
      const next = !current;
      setLockedInspectorSnapshot(next ? liveInspectorSnapshot : null);
      appendLog("info", next ? "Inspector locked to the current selection." : "Inspector unlocked.");
      return next;
    });
  };

  const toggleSceneFocusMode = (): void => {
    setSplitterState(null);
    setSceneFocusMode((current) => {
      const next = !current;
      appendLog("info", next ? "Scene panel maximized." : "Scene panel restored.");
      return next;
    });
  };

  const resetWorkspaceLayout = (): void => {
    setSplitterState(null);
    setAssetWorkbenchFilter(DEFAULT_EDITOR_LAYOUT.assetWorkbenchFilter);
    setBottomDockCollapsed(DEFAULT_EDITOR_LAYOUT.bottomDockCollapsed);
    setBottomDockHeight(DEFAULT_EDITOR_LAYOUT.bottomDockHeight);
    setBottomDockTab(DEFAULT_EDITOR_LAYOUT.bottomDockTab);
    setHierarchyPaneHeight(DEFAULT_EDITOR_LAYOUT.hierarchyPaneHeight);
    setInspectorDockTab(DEFAULT_EDITOR_LAYOUT.inspectorDockTab);
    setLeftColumnWidth(DEFAULT_EDITOR_LAYOUT.leftColumnWidth);
    setLeftDockCollapsed(DEFAULT_EDITOR_LAYOUT.leftDockCollapsed);
    setRightColumnWidth(DEFAULT_EDITOR_LAYOUT.rightColumnWidth);
    setRightDockCollapsed(DEFAULT_EDITOR_LAYOUT.rightDockCollapsed);
    setSceneFocusMode(DEFAULT_EDITOR_LAYOUT.sceneFocusMode);
    setSceneTool(DEFAULT_EDITOR_LAYOUT.sceneTool);
    setSceneZoom(DEFAULT_EDITOR_LAYOUT.sceneZoom);
    setStageWorkbenchMode(DEFAULT_EDITOR_LAYOUT.stageWorkbenchMode);
    appendLog("info", "Workspace layout reset to the default Creator-style dock arrangement.");
  };

  const resetEditorSession = (): void => {
    startTransition(() => {
      setTabs([]);
      setActiveTabId(null);
      setSelectedAssetId(null);
      setSelectedUiNodeIdByDoc({});
      setSelectedAtlasFrameByDoc({});
      setSelectedBizFileByDoc({});
      setSelectedBizFrameByDoc({});
      setSelectedMapCellByDoc({});
      setInspectorLocked(false);
      setLockedInspectorSnapshot(null);
    });
  };

  const applyWorkspaceResult = (result: WorkspaceScanResult): void => {
    resetEditorSession();
    startTransition(() => {
      setRootHandle(result.rootHandle);
      setWorkspaceLabel(result.label);
      setWorkspaceWritable(result.writable);
      setAssets(result.assets);
      setSelectedAssetId((current) =>
        current && result.assets.some((asset) => asset.id === current) ? current : (result.assets[0]?.id ?? null)
      );
    });
  };

  const announceWorkspaceProfile = (workspaceAssets: WorkspaceAsset[]): void => {
    const message = describeWorkspaceProfile(detectWorkspaceProfile(workspaceAssets));
    if (message) {
      appendLog("info", message);
    }
  };

  const applyWorkspaceProgress = (progress: WorkspaceProgressSnapshot): void => {
    setWorkspaceProgress(toWorkspaceProgressState(progress));
  };

  const resolveDirtyActionPrompt = (choice: DirtyActionChoice): void => {
    const resolver = dirtyActionResolverRef.current;
    dirtyActionResolverRef.current = null;
    setDirtyActionPrompt(null);
    resolver?.(choice);
  };

  const requestDirtyActionPrompt = (prompt: DirtyActionPromptState): Promise<DirtyActionChoice> => {
    if (dirtyActionResolverRef.current) {
      dirtyActionResolverRef.current("cancel");
    }
    setOpenMenu(null);
    setDirtyActionPrompt(prompt);
    return new Promise((resolve) => {
      dirtyActionResolverRef.current = resolve;
    });
  };

  const runDirtyTabsSaveFlow = async (dirtyTabs: DocumentTab[]): Promise<SaveTabsSummary> => {
    let savedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (const dirtyTab of dirtyTabs) {
      const result = await saveDocumentTab(dirtyTab);
      if (result === "saved") savedCount += 1;
      if (result === "skipped") skippedCount += 1;
      if (result === "failed") failedCount += 1;
    }

    if (rootHandle && savedCount > 0) {
      setAssets((await scanWorkspace(rootHandle)).assets);
    }

    return { failedCount, savedCount, skippedCount };
  };

  const resolveDirtyAction = async (
    actionLabel: string,
    mode: DirtyActionPromptMode,
    dirtyTabs: DocumentTab[]
  ): Promise<boolean> => {
    if (dirtyTabs.length <= 0) return true;

    const choice = await requestDirtyActionPrompt({
      actionLabel,
      cancelLabel: t('dirty.cancelLabel'),
      dirtyTabs: dirtyTabs.map((tab) => ({
        id: tab.document.id,
        kind: tab.document.kind,
        name: tab.document.name,
        savable: canSaveDocument(tab.document)
      })),
      discardLabel: mode === "close-tab" ? t('dirty.closeWithoutSaving') : t('dirty.discardLabel'),
      mode,
      saveLabel: dirtyTabs.length === 1 ? t('dirty.saveLabel') : `${t('file.saveAll')} (${dirtyTabs.length})`
    });

    if (choice === "cancel") {
      if (mode === "close-tab" && dirtyTabs.length === 1) {
        appendLog("info", `Close cancelled for dirty tab: ${dirtyTabs[0].document.name}`);
      } else {
        appendLog("info", `${actionLabel} cancelled because there are unsaved documents.`);
      }
      return false;
    }

    if (choice === "discard") {
      if (mode === "close-tab" && dirtyTabs.length === 1) {
        appendLog("warn", `Closed dirty tab without saving: ${dirtyTabs[0].document.name}`);
      } else {
        appendLog("warn", `${actionLabel} discarded unsaved changes in ${dirtyTabs.length} tab(s).`);
      }
      return true;
    }

    setBusyAction(dirtyTabs.length === 1 ? `Save ${dirtyTabs[0].document.name}` : `Save All (${dirtyTabs.length})`);
    try {
      const summary = await runDirtyTabsSaveFlow(dirtyTabs);
      if (dirtyTabs.length > 1) {
        appendLog("info", `Save All finished: ${summary.savedCount} saved, ${summary.skippedCount} skipped, ${summary.failedCount} failed.`);
      }
      if (summary.skippedCount > 0 || summary.failedCount > 0) {
        appendLog("warn", `${actionLabel} could not continue because ${summary.skippedCount + summary.failedCount} document(s) remain unsaved.`);
        return false;
      }
      if (mode === "close-tab" && dirtyTabs.length === 1) {
        appendLog("info", `Closed dirty tab after saving: ${dirtyTabs[0].document.name}`);
      } else {
        appendLog("info", `${actionLabel} will continue after saving ${summary.savedCount} document(s).`);
      }
      return true;
    } finally {
      setBusyAction(null);
    }
  };

  const refreshRecentWorkspaces = async (): Promise<void> => {
    try {
      const records = await loadCachedWorkspaceRecords();
      setRecentWorkspaces(records.map(toRecentWorkspaceSummary));
    } catch (error) {
      appendLog("warn", `Load recent projects failed: ${formatErrorMessage(error)}`);
    }
  };

  const rememberWorkspace = async (handle: FileSystemDirectoryHandle, label: string): Promise<void> => {
    try {
      const record = await saveCachedWorkspaceRecord(handle, label);
      await refreshRecentWorkspaces();
      appendLog("info", `Cached workspace: ${record.label}`);
    } catch (error) {
      appendLog("warn", `Workspace cache unavailable: ${formatErrorMessage(error)}`);
    }
  };

  const handleRestoreCachedWorkspace = async (workspaceId?: string): Promise<void> => {
    if (!(await resolveDirtyAction("Restore cached workspace", "workspace-switch", tabs.filter((tab) => tab.dirty)))) {
      return;
    }
    setBusyAction(workspaceId ? "Open Project Card" : "Restore Cached Project");
    try {
      const record = await loadCachedWorkspaceRecord(workspaceId);
      if (!record) {
        await refreshRecentWorkspaces();
        appendLog("warn", "No cached project is available.");
        return;
      }

      if (!record.handle) {
        appendLog("warn", `Cached project handle is unavailable: ${record.label}`);
        return;
      }

      let permission: PermissionState = "granted";
      if (record.handle.queryPermission) {
        permission = await record.handle.queryPermission({ mode: "readwrite" });
      }
      if (permission !== "granted" && record.handle.requestPermission) {
        permission = await record.handle.requestPermission({ mode: "readwrite" });
      }
      if (permission !== "granted") {
        appendLog("warn", `Permission was not granted for cached project: ${record.label}`);
        return;
      }

      const result = await scanWorkspace(record.handle, { onProgress: applyWorkspaceProgress });
      applyWorkspaceResult(result);
      await rememberWorkspace(record.handle, record.label);
      appendLog("info", `Restored cached workspace: ${record.label} (${result.assets.length} assets)`);
      announceWorkspaceProfile(result.assets);
    } catch (error) {
      appendLog("error", `Restore cached workspace failed: ${formatErrorMessage(error)}`);
    } finally {
      setBusyAction(null);
    }
  };

  const handleForgetCachedWorkspace = async (workspaceId?: string): Promise<void> => {
    setBusyAction(workspaceId ? "Remove Project Card" : "Forget Cached Project");
    try {
      if (workspaceId) {
        await removeCachedWorkspaceRecord(workspaceId);
        appendLog("info", "Project card removed from cache.");
      } else {
        await clearCachedWorkspaceRecord();
        appendLog("info", "All cached project records removed.");
      }
      await refreshRecentWorkspaces();
    } catch (error) {
      appendLog("error", `Forget cached workspace failed: ${formatErrorMessage(error)}`);
    } finally {
      setBusyAction(null);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const restoreCachedWorkspaceOnBoot = async (): Promise<void> => {
      try {
        const records = await loadCachedWorkspaceRecords();
        if (cancelled) return;
        setRecentWorkspaces(records.map(toRecentWorkspaceSummary));

        const record = records[0] ?? null;
        if (cancelled || !record) return;

        if (!record.handle) {
          appendLogMessage(setLogs, "warn", `Cached project handle is unavailable: ${record.label}`);
          return;
        }

        let permission: PermissionState = "granted";
        if (record.handle.queryPermission) {
          permission = await record.handle.queryPermission({ mode: "readwrite" });
        }
        if (cancelled) return;

        if (permission !== "granted") {
          appendLogMessage(setLogs, "info", `Cached project ready: ${record.label}. Use Restore Cached Project to reopen it.`);
          return;
        }

        setBusyAction("Restore Cached Project");
        try {
          const result = await scanWorkspace(record.handle, {
            onProgress: (progress) => {
              if (!cancelled) {
                setWorkspaceProgress(toWorkspaceProgressState(progress));
              }
            }
          });
          if (cancelled) return;
          startTransition(() => {
            setRootHandle(result.rootHandle);
            setWorkspaceLabel(result.label);
            setWorkspaceWritable(result.writable);
            setAssets(result.assets);
            setSelectedAssetId((current) =>
              current && result.assets.some((asset) => asset.id === current) ? current : (result.assets[0]?.id ?? null)
            );
          });
          appendLogMessage(setLogs, "info", `Restored cached workspace: ${record.label} (${result.assets.length} assets)`);
          const message = describeWorkspaceProfile(detectWorkspaceProfile(result.assets));
          if (message) {
            appendLogMessage(setLogs, "info", message);
          }
        } catch (error) {
          if (!cancelled) {
            appendLogMessage(setLogs, "error", `Auto-restore failed: ${formatErrorMessage(error)}`);
          }
        } finally {
          if (!cancelled) {
            setBusyAction(null);
          }
        }
      } catch (error) {
        if (!cancelled) {
          appendLogMessage(setLogs, "error", `Load cached workspace failed: ${formatErrorMessage(error)}`);
        }
      }
    };

    void restoreCachedWorkspaceOnBoot();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!openMenu) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (menuBarRef.current?.contains(event.target as Node)) return;
      setOpenMenu(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenMenu(null);
      }
    };
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [openMenu]);

  useEffect(() => {
    if (!dirtyActionPrompt) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        resolveDirtyActionPrompt("cancel");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [dirtyActionPrompt]);

  useEffect(() => () => {
    if (dirtyActionResolverRef.current) {
      dirtyActionResolverRef.current("cancel");
      dirtyActionResolverRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!splitterState) return;
    const isVertical = splitterState.kind === "left-width" || splitterState.kind === "right-width";
    const handlePointerMove = (event: PointerEvent) => {
      const delta = (isVertical ? event.clientX : event.clientY) - splitterState.pointerStart;
      if (splitterState.kind === "left-width") {
        setLeftColumnWidth(clampNumber(splitterState.sizeStart + delta, 250, 420));
        return;
      }
      if (splitterState.kind === "right-width") {
        setRightColumnWidth(clampNumber(splitterState.sizeStart - delta, 280, 440));
        return;
      }
      if (splitterState.kind === "bottom-height") {
        setBottomDockHeight(clampNumber(splitterState.sizeStart - delta, 170, 420));
        return;
      }
      setHierarchyPaneHeight(clampNumber(splitterState.sizeStart + delta, 180, 520));
    };
    const handlePointerUp = () => setSplitterState(null);
    const previousUserSelect = document.body.style.userSelect;
    const previousCursor = document.body.style.cursor;
    document.body.style.userSelect = "none";
    document.body.style.cursor = isVertical ? "col-resize" : "row-resize";
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      document.body.style.userSelect = previousUserSelect;
      document.body.style.cursor = previousCursor;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [splitterState]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const nextLayout: EditorLayoutState = {
      assetWorkbenchFilter,
      bottomDockCollapsed,
      bottomDockHeight,
      bottomDockTab,
      hierarchyPaneHeight,
      inspectorDockTab,
      leftColumnWidth,
      leftDockCollapsed,
      rightColumnWidth,
      rightDockCollapsed,
      sceneFocusMode,
      sceneTool,
      sceneZoom,
      stageWorkbenchMode
    };
    try {
      window.localStorage.setItem(EDITOR_LAYOUT_STORAGE_KEY, JSON.stringify(nextLayout));
    } catch {
      // Ignore layout persistence failures so the editor remains usable in restricted browsers.
    }
  }, [
    assetWorkbenchFilter,
    bottomDockCollapsed,
    bottomDockHeight,
    bottomDockTab,
    hierarchyPaneHeight,
    inspectorDockTab,
    leftColumnWidth,
    leftDockCollapsed,
    rightColumnWidth,
    rightDockCollapsed,
    sceneFocusMode,
    sceneTool,
    sceneZoom,
    stageWorkbenchMode
  ]);

  useEffect(() => {
    if (!activeDocument) return;
    if (activeDocument.kind === "ui-layout" && selectedUiNodeIdByDoc[activeDocument.id] === undefined) {
      setSelectedUiNodeIdByDoc((current) => ({ ...current, [activeDocument.id]: getFirstNodeId(activeDocument) }));
    }
    if (activeDocument.kind === "atlas" && selectedAtlasFrameByDoc[activeDocument.id] === undefined) {
      setSelectedAtlasFrameByDoc((current) => ({ ...current, [activeDocument.id]: activeDocument.frames[0]?.name ?? null }));
    }
    if (activeDocument.kind === "biz" && selectedBizFileByDoc[activeDocument.id] === undefined) {
      setSelectedBizFileByDoc((current) => ({ ...current, [activeDocument.id]: 0 }));
      setSelectedBizFrameByDoc((current) => ({
        ...current,
        [activeDocument.id]: activeDocument.files[0]?.frames[0]?.frameId ?? null
      }));
    }
    if (activeDocument.kind === "map" && selectedMapCellByDoc[activeDocument.id] === undefined) {
      setSelectedMapCellByDoc((current) => ({ ...current, [activeDocument.id]: null }));
    }
  }, [activeDocument, selectedAtlasFrameByDoc, selectedBizFileByDoc, selectedMapCellByDoc, selectedUiNodeIdByDoc]);

  useEffect(() => {
    dragStateRef.current = dragState;
  }, [dragState]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const currentDragState = dragStateRef.current;
      if (!currentDragState) return;
      setTabs((current) =>
        current.map((tab) => {
          if (tab.document.id !== currentDragState.docId || tab.document.kind !== "ui-layout") return tab;
          const nextNodes = tab.document.nodes.map((node) => {
            if (node.id !== currentDragState.nodeId) return node;

            if (currentDragState.mode === "move") {
              return {
                ...node,
                x: Math.round(currentDragState.originX + (event.clientX - currentDragState.pointerStartX) / currentDragState.scale),
                y: Math.round(currentDragState.originY - (event.clientY - currentDragState.pointerStartY) / currentDragState.scale)
              };
            }

            if (currentDragState.mode === "rect") {
              const nextWidth = Math.max(12, Math.round(currentDragState.widthStart + (event.clientX - currentDragState.pointerStartX) / currentDragState.scale));
              const nextHeight = Math.max(12, Math.round(currentDragState.heightStart - (event.clientY - currentDragState.pointerStartY) / currentDragState.scale));
              return {
                ...node,
                h: nextHeight,
                w: nextWidth
              };
            }

            if (currentDragState.mode === "scale") {
              const nextScaleX = clampNumber(currentDragState.scaleXStart + (event.clientX - currentDragState.pointerStartX) / Math.max(24, currentDragState.widthStart * currentDragState.scale), 0.1, 6);
              const nextScaleY = clampNumber(currentDragState.scaleYStart - (event.clientY - currentDragState.pointerStartY) / Math.max(24, currentDragState.heightStart * currentDragState.scale), 0.1, 6);
              return {
                ...node,
                sx: Number(nextScaleX.toFixed(2)),
                sy: Number(nextScaleY.toFixed(2))
              };
            }

            const currentAngle = Math.atan2(event.clientY - currentDragState.centerClientY, event.clientX - currentDragState.centerClientX);
            const nextRotation = currentDragState.rotationStart + ((currentAngle - currentDragState.pointerStartAngle) * 180) / Math.PI;
            return {
              ...node,
              r: Math.round(nextRotation)
            };
          });
          return {
            ...tab,
            dirty: true,
            document: {
              ...tab.document,
              nodes: nextNodes
            }
          };
        })
      );
    };
    const handlePointerUp = () => {
      dragStateRef.current = null;
      setDragState(null);
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, []);

  useEffect(() => {
    const api = window as Window & { advanceTime?: (ms: number) => void; render_game_to_text?: () => string };
    api.advanceTime = () => undefined;
    api.render_game_to_text = () =>
      JSON.stringify({
        activeDocument: activeDocument ? { dirty: activeTab?.dirty ?? false, kind: activeDocument.kind, name: activeDocument.name } : null,
        assetCount: assets.length,
        dragStateMode: dragState?.mode ?? null,
        dirtyActionPrompt: dirtyActionPrompt
          ? {
              actionLabel: dirtyActionPrompt.actionLabel,
              dirtyCount: dirtyActionPrompt.dirtyTabs.length,
              mode: dirtyActionPrompt.mode,
              savableCount: dirtyActionPrompt.dirtyTabs.filter((tab) => tab.savable).length
            }
          : null,
        dirtyTabs: tabs.filter((tab) => tab.dirty).map((tab) => tab.document.name),
        logs: logs.slice(-5).map((entry) => `${entry.level}:${entry.message}`),
        mapOverlayPreview:
          activeDocument?.kind === "map"
            ? activeDocument.overlays.slice(0, 6).map((overlay) => ({
                details: overlay.details,
                kind: overlay.kind,
                label: overlay.label,
                subtitle: overlay.subtitle,
                targetMapId: overlay.targetMapId,
                targetMapName: overlay.targetMapName,
                x: overlay.x,
                y: overlay.y
              }))
            : [],
        mapOverlaySummary: activeDocument?.kind === "map" ? activeDocument.overlaySummary : null,
        mapSelection:
          activeDocument?.kind === "map" && selectedMapCell
            ? {
                value:
                  activeDocument.blockData[selectedMapCell.y * activeDocument.logicWidth + selectedMapCell.x] ?? null,
                x: selectedMapCell.x,
                y: selectedMapCell.y
              }
            : null,
        selectedAssetId,
        selectedUiNode: selectedUiNode
          ? {
              description: describeLegacyNode(selectedUiNode),
              h: Number(selectedUiNode.h ?? 0),
              id: selectedUiNode.id,
              parent: selectedUiNode.parent,
              r: Number(selectedUiNode.r ?? 0),
              sx: Number(selectedUiNode.sx ?? 1),
              sy: Number(selectedUiNode.sy ?? 1),
              w: Number(selectedUiNode.w ?? 0),
              x: Number(selectedUiNode.x ?? 0),
              y: Number(selectedUiNode.y ?? 0)
            }
          : null,
        rememberedWorkspace: latestCachedWorkspace ? { label: latestCachedWorkspace.label, savedAt: latestCachedWorkspace.savedAt } : null,
        recentWorkspaceCount: recentWorkspaces.length,
        assetWorkbenchFilter,
        assetQueryMode,
        assetSortMode,
        bottomDockCollapsed,
        dashboardMode: !workspaceLabel && !activeDocument,
        hierarchyQueryMode,
        inspectorLocked,
        sceneTool,
        sceneZoom,
        sceneFocusMode,
        stageWorkbenchMode,
        bottomDockTab,
        inspectorDockTab,
        leftColumnWidth,
        leftDockCollapsed,
        rightColumnWidth,
        rightDockCollapsed,
        bottomDockHeight,
        hierarchyPaneHeight,
        workspace: workspaceLabel,
        workspaceProgress,
        workspaceProfile,
        workspaceWritable
      });
    return () => {
      api.advanceTime = undefined;
      api.render_game_to_text = undefined;
    };
  }, [activeDocument, activeTab?.dirty, assetQueryMode, assetSortMode, assetWorkbenchFilter, assets.length, bottomDockCollapsed, bottomDockHeight, bottomDockTab, dirtyActionPrompt, dragState?.mode, hierarchyPaneHeight, hierarchyQueryMode, inspectorDockTab, inspectorLocked, latestCachedWorkspace, leftColumnWidth, leftDockCollapsed, logs, recentWorkspaces.length, rightColumnWidth, rightDockCollapsed, sceneFocusMode, sceneTool, sceneZoom, selectedAssetId, selectedMapCell, selectedUiNode, stageWorkbenchMode, tabs, workspaceLabel, workspaceProgress, workspaceProfile, workspaceWritable]);

  const replaceDocument = (documentId: string, updater: (document: EditorDocument) => EditorDocument): void => {
    setTabs((current) =>
      current.map((tab) => (tab.document.id === documentId ? { ...tab, dirty: true, document: updater(tab.document) } : tab))
    );
  };

  const handleOpenWorkspace = async (): Promise<void> => {
    if (!(await resolveDirtyAction("Open workspace", "workspace-switch", tabs.filter((tab) => tab.dirty)))) {
      return;
    }
    setBusyAction("Open Workspace");
    try {
      const result = await openWorkspaceDirectory({ onProgress: applyWorkspaceProgress });
      applyWorkspaceResult(result);
      appendLog("info", `Workspace loaded: ${result.label} (${result.assets.length} assets)`);
      announceWorkspaceProfile(result.assets);
      if (result.rootHandle) {
        void rememberWorkspace(result.rootHandle, result.label);
      }
    } catch (error) {
      appendLog("error", `Open workspace failed: ${formatErrorMessage(error)}`);
    } finally {
      setBusyAction(null);
    }
  };

  const handleImportWorkspaceFiles = async (files: FileList | null): Promise<void> => {
    if (!files || files.length <= 0) return;
    if (!(await resolveDirtyAction("Import folder", "workspace-switch", tabs.filter((tab) => tab.dirty)))) {
      if (uploadInputRef.current) uploadInputRef.current.value = "";
      return;
    }
    setBusyAction("Import Folder");
    try {
      const result = await openWorkspaceFiles(files, undefined, { onProgress: applyWorkspaceProgress });
      applyWorkspaceResult(result);
      appendLog("info", `Imported folder: ${result.label} (${result.assets.length} assets, read-only)`);
      appendLog("info", "Imported folders are session-only. Use Open Workspace to persist a project root.");
      announceWorkspaceProfile(result.assets);
    } catch (error) {
      appendLog("error", `Import folder failed: ${formatErrorMessage(error)}`);
    } finally {
      if (uploadInputRef.current) uploadInputRef.current.value = "";
      setBusyAction(null);
    }
  };

  const handleRescanWorkspace = async (): Promise<void> => {
    if (!rootHandle) {
      appendLog("warn", "Rescan ignored because no workspace is open.");
      return;
    }
    if (!(await resolveDirtyAction("Rescan workspace", "workspace-switch", tabs.filter((tab) => tab.dirty)))) {
      return;
    }
    setBusyAction("Rescan Workspace");
    try {
      const result = await scanWorkspace(rootHandle, { onProgress: applyWorkspaceProgress });
      applyWorkspaceResult(result);
      appendLog("info", `Workspace rescanned: ${result.assets.length} assets`);
      announceWorkspaceProfile(result.assets);
    } catch (error) {
      appendLog("error", `Rescan failed: ${formatErrorMessage(error)}`);
    } finally {
      setBusyAction(null);
    }
  };

  const handleCloseWorkspace = async (): Promise<void> => {
    if (!workspaceLabel && !rootHandle) {
      return;
    }
    if (!(await resolveDirtyAction("Close workspace", "workspace-switch", tabs.filter((tab) => tab.dirty)))) {
      return;
    }
    startTransition(() => {
      resetEditorSession();
      setRootHandle(null);
      setWorkspaceLabel(null);
      setWorkspaceWritable(false);
      setAssets([]);
    });
    appendLog("info", "Workspace closed. Returning to welcome page.");
  };

  const handleOpenAsset = async (asset: WorkspaceAsset): Promise<void> => {
    setSelectedAssetId(asset.id);
    const existingTab = tabs.find((tab) => tab.asset?.id === asset.id);
    if (existingTab) {
      setActiveTabId(existingTab.document.id);
      appendLog("info", `Focused existing tab: ${asset.path}`);
      return;
    }
    setBusyAction(`Open ${asset.name}`);
    try {
      const linkedIntent = inferLinkedLegacyPreviewIntent(asset);
      const document = linkedIntent
        ? await createLinkedLegacyPreviewDocument(linkedIntent, assets)
        : await openAssetDocument(asset, assets);
      setTabs((current) => [...current, { asset, dirty: false, document }]);
      setActiveTabId(document.id);
      appendLog(
        "info",
        linkedIntent
          ? `Opened linked preview for ${asset.path} -> ${document.name}`
          : `Opened ${asset.kind} asset: ${asset.path}`
      );
    } catch (error) {
      appendLog("error", `Open asset failed for ${asset.path}: ${formatErrorMessage(error)}`);
    } finally {
      setBusyAction(null);
    }
  };

  const handleCloseTab = async (documentId: string): Promise<void> => {
    const closingIndex = tabs.findIndex((tab) => tab.document.id === documentId);
    if (closingIndex < 0) return;

    const closingTab = tabs[closingIndex];
    if (closingTab.dirty && !(await resolveDirtyAction(`Close ${closingTab.document.name}`, "close-tab", [closingTab]))) {
      return;
    }

    const nextActive = tabs[closingIndex + 1] ?? tabs[closingIndex - 1] ?? null;
    setTabs((current) => current.filter((tab) => tab.document.id !== documentId));
    if (activeTabId === documentId) setActiveTabId(nextActive?.document.id ?? null);
  };

  const handleCreateUiDocument = (): void => {
    const seed = newLayoutSeedRef.current;
    newLayoutSeedRef.current += 1;
    const document = createStarterUiLayoutDocument(seed);
    setTabs((current) => [...current, { asset: null, dirty: true, document }]);
    setActiveTabId(document.id);
    setSelectedUiNodeIdByDoc((current) => ({ ...current, [document.id]: document.nodes[1]?.id ?? document.nodes[0]?.id ?? null }));
    appendLog("info", `Created new UI layout document: ${document.name}`);
  };

  const handleAddUiChild = (): void => {
    if (activeDocument?.kind !== "ui-layout") {
      appendLog("warn", "Add Child is only available for UI layout documents.");
      return;
    }
    const parentNode = selectedUiNode ?? activeDocument.nodes[0] ?? null;
    const parentId = parentNode?.id ?? 0;
    const nextId = Math.max(0, ...activeDocument.nodes.map((node) => node.id)) + 1;
    const parentWidth = Math.max(120, Number(parentNode?.w ?? 240));
    const parentHeight = Math.max(80, Number(parentNode?.h ?? 120));
    const childWidth = 120;
    const childHeight = 48;
    replaceDocument(activeDocument.id, (document) => document.kind === "ui-layout" ? {
      ...document,
      nodes: [...document.nodes, {
        id: nextId,
        parent: parentId,
        type: 1,
        n: `Node${nextId}`,
        x: Math.round(parentWidth / 2),
        y: Math.round(parentHeight / 2),
        w: childWidth,
        h: childHeight,
        ax: 0.5,
        ay: 0.5,
        color: "#2E4B6B"
      }]
    } : document);
    setSelectedUiNodeIdByDoc((current) => ({ ...current, [activeDocument.id]: nextId }));
    appendLog("info", `Added child node ${nextId} under ${parentId}`);
  };

  const handleRemoveSelectedUiNode = (): void => {
    if (activeDocument?.kind !== "ui-layout" || !selectedUiNode) {
      appendLog("warn", "Remove is only available when a UI node is selected.");
      return;
    }
    if (selectedUiNode.parent === 0) {
      appendLog("warn", "Root UI node cannot be removed.");
      return;
    }
    const removedIds = collectDescendantIds(activeDocument.nodes, selectedUiNode.id);
    replaceDocument(activeDocument.id, (document) => document.kind === "ui-layout" ? {
      ...document,
      nodes: document.nodes.filter((node) => !removedIds.has(node.id))
    } : document);
    setSelectedUiNodeIdByDoc((current) => ({
      ...current,
      [activeDocument.id]: activeDocument.nodes.find((node) => !removedIds.has(node.id))?.id ?? null
    }));
    appendLog("info", `Removed ${removedIds.size} UI node(s) from layout.`);
  };

  const handleDuplicateSelectedUiNode = (): void => {
    if (activeDocument?.kind !== "ui-layout" || !selectedUiNode) {
      appendLog("warn", "Duplicate is only available when a UI node is selected.");
      return;
    }
    if (selectedUiNode.parent === 0) {
      appendLog("warn", "Root UI node cannot be duplicated directly.");
      return;
    }
    const nextId = Math.max(0, ...activeDocument.nodes.map((node) => node.id)) + 1;
    const baseName = typeof selectedUiNode.n === "string" && selectedUiNode.n.trim() ? selectedUiNode.n.trim() : `Node${selectedUiNode.id}`;
    replaceDocument(activeDocument.id, (document) => document.kind === "ui-layout" ? {
      ...document,
      nodes: [...document.nodes, {
        ...selectedUiNode,
        id: nextId,
        n: `${baseName}Copy`,
        x: Number(selectedUiNode.x ?? 0) + 24,
        y: Number(selectedUiNode.y ?? 0) - 24,
        zo: typeof selectedUiNode.zo === "number" ? selectedUiNode.zo + 1 : nextId
      }]
    } : document);
    setSelectedUiNodeIdByDoc((current) => ({ ...current, [activeDocument.id]: nextId }));
    appendLog("info", `Duplicated UI node ${selectedUiNode.id} as ${nextId}.`);
  };

  const handleOpenAvatarLab = async (): Promise<void> => {
    const existing = tabs.find((tab) => tab.document.kind === "avatar-preview" && tab.document.sourcePath === null);
    if (existing) {
      setActiveTabId(existing.document.id);
      return;
    }
    setBusyAction("Open Avatar Lab");
    try {
      const document = await createAvatarPreviewDocument(assets);
      setTabs((current) => [...current, { asset: null, dirty: false, document }]);
      setActiveTabId(document.id);
      appendLog("info", "Avatar Lab opened from current workspace assets.");
    } catch (error) {
      appendLog("error", `Avatar Lab failed: ${formatErrorMessage(error)}`);
    } finally {
      setBusyAction(null);
    }
  };

  const handleOpenEffectLab = async (): Promise<void> => {
    const existing = tabs.find((tab) => tab.document.kind === "effect-preview" && tab.document.sourcePath === null);
    if (existing) {
      setActiveTabId(existing.document.id);
      return;
    }
    setBusyAction("Open Effect Lab");
    try {
      const document = await createEffectPreviewDocument(assets);
      setTabs((current) => [...current, { asset: null, dirty: false, document }]);
      setActiveTabId(document.id);
      appendLog("info", "Effect Lab opened from current workspace assets.");
    } catch (error) {
      appendLog("error", `Effect Lab failed: ${formatErrorMessage(error)}`);
    } finally {
      setBusyAction(null);
    }
  };

  const saveDocumentTab = async (tab: DocumentTab): Promise<SaveDocumentResult> => {
    const currentDocument = tab.document;
    if (!canSaveDocument(currentDocument)) {
      appendLog("warn", `${currentDocument.kind} is currently read-only in the editor shell.`);
      return "skipped";
    }

    const existingHandle = tab.asset?.handle ?? null;
    if (!existingHandle && tab.asset?.source === "upload" && !window.showSaveFilePicker) {
      appendLog("warn", `${currentDocument.name} cannot be saved from an imported folder in this browser. Use Open Workspace or a browser with Save As support.`);
      return "skipped";
    }
    if (!existingHandle && tab.asset?.source === "upload") {
      appendLog("info", `Read-only import detected for ${currentDocument.name}. Save will use Save As.`);
    }

    try {
      const pickedHandle = existingHandle ?? (window.showSaveFilePicker ? await window.showSaveFilePicker({
        id: "brm-ui-studio-save",
        suggestedName: currentDocument.name,
        types: [{
          accept: currentDocument.kind === "map"
            ? { "application/octet-stream": [".mapo"] }
            : { "text/plain": [currentDocument.kind === "ui-layout" ? `.${currentDocument.sourceFormat}` : ".txt"] },
          description: "BRM UI Studio document"
        }]
      }) : null);
      if (!pickedHandle) throw new Error("Browser does not support save picker.");

      if (currentDocument.kind === "ui-layout") {
        await writeTextFile(pickedHandle, serializeLegacyUILayout(currentDocument.nodes, currentDocument.sourceFormat));
      }
      if (currentDocument.kind === "map") {
        await writeBinaryFile(pickedHandle, serializeMapDocument(currentDocument));
      }
      if (currentDocument.kind === "text") {
        await writeTextFile(pickedHandle, currentDocument.text);
      }

      setTabs((current) => current.map((currentTab) => currentTab.document.id === currentDocument.id ? {
        ...currentTab,
        asset: currentTab.asset
          ? {
              ...currentTab.asset,
              handle: pickedHandle,
              id: currentTab.asset.source === "upload" ? pickedHandle.name : currentTab.asset.id,
              name: pickedHandle.name,
              path: currentTab.asset.source === "upload" ? pickedHandle.name : (currentTab.asset.path || pickedHandle.name),
              source: currentTab.asset.source === "upload" ? "fs-access" : currentTab.asset.source,
              writable: true
            }
          : {
              extension: pickedHandle.name.includes(".") ? pickedHandle.name.slice(pickedHandle.name.lastIndexOf(".")).toLowerCase() : "",
              file: null,
              handle: pickedHandle,
              id: pickedHandle.name,
              kind: currentDocument.kind,
              name: pickedHandle.name,
              path: pickedHandle.name,
              source: "fs-access",
              writable: true
            },
        dirty: false
      } : currentTab));
      appendLog("info", `Saved document: ${currentDocument.name}`);
      return "saved";
    } catch (error) {
      appendLog("error", `Save failed: ${formatErrorMessage(error)}`);
      return "failed";
    }
  };

  const handleSaveActiveDocument = async (): Promise<void> => {
    if (!activeTab) {
      appendLog("warn", "Save ignored because there is no active document.");
      return;
    }
    setBusyAction(`Save ${activeTab.document.name}`);
    try {
      const result = await saveDocumentTab(activeTab);
      if (result === "saved" && rootHandle) {
        setAssets((await scanWorkspace(rootHandle)).assets);
      }
    } finally {
      setBusyAction(null);
    }
  };

  const handleSaveAllDocuments = async (): Promise<void> => {
    const dirtyTabs = tabs.filter((tab) => tab.dirty);
    if (dirtyTabs.length <= 0) {
      appendLog("warn", "Save All ignored because there are no dirty documents.");
      return;
    }

    setBusyAction(`Save All (${dirtyTabs.length})`);
    try {
      const summary = await runDirtyTabsSaveFlow(dirtyTabs);
      appendLog("info", `Save All finished: ${summary.savedCount} saved, ${summary.skippedCount} skipped, ${summary.failedCount} failed.`);
    } finally {
      setBusyAction(null);
    }
  };

  const handleUpdateUiNode = (key: keyof LegacyUILayoutNode, rawValue: string | number | boolean): void => {
    if (activeDocument?.kind !== "ui-layout" || !selectedUiNode) return;
    replaceDocument(activeDocument.id, (document) => document.kind === "ui-layout" ? {
      ...document,
      nodes: document.nodes.map((node) => node.id === selectedUiNode.id ? { ...node, [key]: rawValue } : node)
    } : document);
  };

  const handleKeyboardShortcut = useEffectEvent((event: KeyboardEvent) => {
    if (isEditableEventTarget(event.target)) return;

    const command = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();

    if (event.shiftKey && event.code === "Space") {
      event.preventDefault();
      toggleSceneFocusMode();
      return;
    }

    if (command && key === "o") {
      event.preventDefault();
      void handleOpenWorkspace();
      return;
    }

    if (command && event.shiftKey && key === "n") {
      event.preventDefault();
      handleAddUiChild();
      return;
    }

    if (command && key === "n") {
      event.preventDefault();
      handleCreateUiDocument();
      return;
    }

    if (command && key === "s") {
      event.preventDefault();
      if (event.shiftKey) {
        void handleSaveAllDocuments();
        return;
      }
      void handleSaveActiveDocument();
      return;
    }

    if (command && key === "0") {
      event.preventDefault();
      setSceneZoom("fit");
      appendLog("info", "Scene zoom set to Fit.");
      return;
    }

    if (command && key === "1") {
      event.preventDefault();
      setSceneZoom("100");
      appendLog("info", "Scene zoom set to 100%.");
      return;
    }

    if (command && key === "w") {
      event.preventDefault();
      if (activeTab) {
        void handleCloseTab(activeTab.document.id);
      }
      return;
    }

    if (activeDocument?.kind !== "ui-layout") return;

    if (command && key === "d") {
      event.preventDefault();
      handleDuplicateSelectedUiNode();
      return;
    }

    if (selectedUiNode && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
      event.preventDefault();
      if (sceneTool === "rect") {
        const step = event.shiftKey ? 10 : 1;
        if (event.key === "ArrowUp") handleUpdateUiNode("h", Math.max(12, Number(selectedUiNode.h ?? 0) + step));
        if (event.key === "ArrowDown") handleUpdateUiNode("h", Math.max(12, Number(selectedUiNode.h ?? 0) - step));
        if (event.key === "ArrowLeft") handleUpdateUiNode("w", Math.max(12, Number(selectedUiNode.w ?? 0) - step));
        if (event.key === "ArrowRight") handleUpdateUiNode("w", Math.max(12, Number(selectedUiNode.w ?? 0) + step));
        return;
      }

      if (sceneTool === "scale") {
        const step = event.shiftKey ? 0.25 : 0.1;
        if (event.key === "ArrowUp") handleUpdateUiNode("sy", Number(clampNumber(Number(selectedUiNode.sy ?? 1) + step, 0.1, 6).toFixed(2)));
        if (event.key === "ArrowDown") handleUpdateUiNode("sy", Number(clampNumber(Number(selectedUiNode.sy ?? 1) - step, 0.1, 6).toFixed(2)));
        if (event.key === "ArrowLeft") handleUpdateUiNode("sx", Number(clampNumber(Number(selectedUiNode.sx ?? 1) - step, 0.1, 6).toFixed(2)));
        if (event.key === "ArrowRight") handleUpdateUiNode("sx", Number(clampNumber(Number(selectedUiNode.sx ?? 1) + step, 0.1, 6).toFixed(2)));
        return;
      }

      if (sceneTool === "rotate") {
        const step = event.shiftKey ? 15 : 5;
        if (event.key === "ArrowLeft" || event.key === "ArrowDown") handleUpdateUiNode("r", Number(selectedUiNode.r ?? 0) - step);
        if (event.key === "ArrowRight" || event.key === "ArrowUp") handleUpdateUiNode("r", Number(selectedUiNode.r ?? 0) + step);
        return;
      }

      const step = event.shiftKey ? 10 : 1;
      if (event.key === "ArrowUp") handleUpdateUiNode("y", Number(selectedUiNode.y ?? 0) + step);
      if (event.key === "ArrowDown") handleUpdateUiNode("y", Number(selectedUiNode.y ?? 0) - step);
      if (event.key === "ArrowLeft") handleUpdateUiNode("x", Number(selectedUiNode.x ?? 0) - step);
      if (event.key === "ArrowRight") handleUpdateUiNode("x", Number(selectedUiNode.x ?? 0) + step);
      return;
    }

    if ((event.key === "Delete" || event.key === "Backspace") && selectedUiNode?.parent !== 0) {
      event.preventDefault();
      handleRemoveSelectedUiNode();
    }
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => handleKeyboardShortcut(event);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Context menu handlers
  const handleHierarchyContextMenu = (e: React.MouseEvent, nodeId?: number): void => {
    if (activeDocument?.kind !== "ui-layout") return;
    const targetNodeId = nodeId ?? selectedUiNode?.id;
    if (targetNodeId === undefined) return;
    const items: ContextMenuItem[] = [
      { id: "copy", label: t('context.copy'), onClick: () => appendLog("info", "Copy node (not implemented)") },
      { id: "paste", label: t('context.paste'), onClick: () => appendLog("info", "Paste node (not implemented)") },
      { id: "duplicate", label: t('context.duplicate'), onClick: handleDuplicateSelectedUiNode },
      { id: "delete", label: t('context.delete'), danger: true, onClick: handleRemoveSelectedUiNode },
      { id: "divider1", label: "", divider: true },
      { id: "addChild", label: t('context.addChild'), onClick: handleAddUiChild },
      { id: "rename", label: t('context.rename'), onClick: () => appendLog("info", "Rename node (not implemented)") }
    ];
    hierarchyContextMenu.showContextMenu(e, items);
  };

  const handleAssetContextMenu = (e: React.MouseEvent, assetOrFolder: { asset: WorkspaceAsset } | { path: string; name: string; kind: "folder" }): void => {
    e.preventDefault();
    if ("asset" in assetOrFolder) {
      const asset = assetOrFolder.asset;
      const items: ContextMenuItem[] = [
        { id: "open", label: t('context.open'), onClick: () => { void handleOpenAsset(asset); } },
        { id: "copyPath", label: t('context.copyPath'), onClick: () => { void navigator.clipboard.writeText(asset.path); appendLog("info", `Copied path: ${asset.path}`); } },
        { id: "delete", label: t('context.delete'), danger: true, onClick: () => appendLog("warn", `Delete asset: ${asset.path} (not implemented)`) },
        { id: "divider1", label: "", divider: true },
        { id: "openInExplorer", label: t('context.openInExplorer'), disabled: !rootHandle, onClick: () => appendLog("info", "Open in Explorer (not implemented in web)") }
      ];
      assetContextMenu.showContextMenu(e, items);
    } else {
      const folder = assetOrFolder;
      const items: ContextMenuItem[] = [
        { id: "copyPath", label: t('context.copyPath'), onClick: () => { void navigator.clipboard.writeText(folder.path); appendLog("info", `Copied folder path: ${folder.path}`); } },
        { id: "divider1", label: "", divider: true },
        { id: "expandAll", label: t('context.expandAll'), onClick: () => toggleAssetTreeExpansion(true) },
        { id: "collapseAll", label: t('context.collapseAll'), onClick: () => toggleAssetTreeExpansion(false) },
        { id: "divider2", label: "", divider: true },
        { id: "refresh", label: t('context.refresh'), disabled: !rootHandle, onClick: () => { void handleRescanWorkspace(); } }
      ];
      assetContextMenu.showContextMenu(e, items);
    }
  };

  const handleAssetEmptyContextMenu = (e: React.MouseEvent): void => {
    e.preventDefault();
    const items: ContextMenuItem[] = [
      { id: "refresh", label: t('context.refresh'), disabled: !rootHandle, onClick: () => { void handleRescanWorkspace(); } },
      { id: "divider1", label: "", divider: true },
      { id: "expandAll", label: t('context.expandAll'), onClick: () => toggleAssetTreeExpansion(true) },
      { id: "collapseAll", label: t('context.collapseAll'), onClick: () => toggleAssetTreeExpansion(false) },
      { id: "divider2", label: "", divider: true },
      { id: "importFolder", label: t('file.importFolder'), onClick: () => uploadInputRef.current?.click() },
      { id: "openProject", label: t('file.openProject'), onClick: () => { void handleOpenWorkspace(); } }
    ];
    panelContextMenu.showContextMenu(e, items);
  };

  const handlePanelContextMenu = (e: React.MouseEvent, panelType: "hierarchy" | "asset"): void => {
    e.preventDefault();
    const items: ContextMenuItem[] = [
      { id: "refresh", label: t('context.refresh'), onClick: handleRescanWorkspace },
      { id: "expandAll", label: t('context.expandAll'), onClick: () => panelType === "hierarchy" ? toggleHierarchyTreeExpansion(true) : toggleAssetTreeExpansion(true) },
      { id: "collapseAll", label: t('context.collapseAll'), onClick: () => panelType === "hierarchy" ? toggleHierarchyTreeExpansion(false) : toggleAssetTreeExpansion(false) }
    ];
    panelContextMenu.showContextMenu(e, items);
  };

  const handleTabContextMenu = (e: React.MouseEvent, tabId: string): void => {
    e.preventDefault();
    const tab = tabs.find((tabItem) => tabItem.document.id === tabId);
    if (!tab) return;
    const items: ContextMenuItem[] = [
      { id: "close", label: t('common.close'), onClick: () => { void handleCloseTab(tabId); } },
      { id: "closeOthers", label: t('context.closeOthers'), onClick: () => { tabs.filter((otherTab) => otherTab.document.id !== tabId).forEach((otherTab) => { void handleCloseTab(otherTab.document.id); }); } },
      { id: "closeAll", label: t('context.closeAll'), onClick: () => { tabs.forEach((eachTab) => { void handleCloseTab(eachTab.document.id); }); } }
    ];
    tabContextMenu.showContextMenu(e, items);
  };

  const handleSceneContextMenu = (e: React.MouseEvent): void => {
    e.preventDefault();
    const items: ContextMenuItem[] = [
      { id: "addChild", label: t('context.addChild'), disabled: !canEditUiLayout, onClick: handleAddUiChild },
      { id: "duplicate", label: t('context.duplicate'), disabled: !canMutateUiNode || selectedUiNode?.parent === 0, onClick: handleDuplicateSelectedUiNode },
      { id: "delete", label: t('context.delete'), danger: true, disabled: !canMutateUiNode || selectedUiNode?.parent === 0, onClick: handleRemoveSelectedUiNode },
      { id: "divider1", label: "", divider: true },
      { id: "zoomFit", label: t('edit.zoomFit'), onClick: () => setSceneZoom("fit") },
      { id: "zoom100", label: t('edit.zoom100'), onClick: () => setSceneZoom("100") },
      { id: "divider2", label: "", divider: true },
      { id: "toggleFocus", label: sceneFocusMode ? t('edit.restoreScenePanel') : t('edit.maximizeScenePanel'), onClick: toggleSceneFocusMode }
    ];
    sceneContextMenu.showContextMenu(e, items);
  };

  const handleInspectorContextMenu = (e: React.MouseEvent): void => {
    e.preventDefault();
    const items: ContextMenuItem[] = [
      { id: "lock", label: inspectorLocked ? t('inspector.unlock') : t('inspector.lock'), onClick: toggleInspectorLock },
      { id: "divider1", label: "", divider: true },
      { id: "focusProperties", label: t('panel.focusPropertiesInspector'), onClick: () => { setInspectorDockTab("properties"); revealRightDock(); } },
      { id: "focusDocument", label: t('panel.focusDocumentInspector'), onClick: () => { setInspectorDockTab("document"); revealRightDock(); } }
    ];
    inspectorContextMenu.showContextMenu(e, items);
  };

  const handleConsoleContextMenu = (e: React.MouseEvent): void => {
    e.preventDefault();
    const items: ContextMenuItem[] = [
      { id: "clear", label: t('console.clear'), onClick: () => setLogs([]) },
      { id: "divider1", label: "", divider: true },
      { id: "focusConsole", label: t('panel.focusConsoleTab'), onClick: () => revealBottomDock("console") },
      { id: "focusSelection", label: t('panel.focusSelectionTab'), onClick: () => revealBottomDock("selection") },
      { id: "focusProject", label: t('panel.focusProjectTab'), onClick: () => revealBottomDock("project") }
    ];
    consoleContextMenu.showContextMenu(e, items);
  };

  const rememberedWorkspace = latestCachedWorkspace
    ? { label: latestCachedWorkspace.label, savedAt: latestCachedWorkspace.savedAt }
    : null;
  const isWorkspaceBusy = Boolean(
    busyAction &&
    ["Open Workspace", "Import Folder", "Rescan Workspace", "Restore Cached Project", "Open Project Card"].includes(busyAction)
  );
  const activeWorkspaceProgress = workspaceProgress && isWorkspaceBusy && workspaceProgress.phase !== "complete"
    ? workspaceProgress
    : null;
  const workspaceProgressCaption = activeWorkspaceProgress
    ? activeWorkspaceProgress.percent !== null
      ? `${activeWorkspaceProgress.message} · ${activeWorkspaceProgress.percent}%`
      : `${activeWorkspaceProgress.message} · ${activeWorkspaceProgress.processedCount}`
    : null;
  const workspaceActivityLabel = activeWorkspaceProgress
    ? workspaceProgressCaption ?? t('status.running')
    : workspaceLabel
      ? t('status.ready')
      : t('status.idle');
  const isDashboardMode = !workspaceLabel && !activeDocument;
  const activeDocumentSummary = activeDocument
    ? `${activeDocument.kind} · ${activeDocument.name}`
    : "No document selected";
  const selectedNodeSummary = selectedUiNode ? describeLegacyNode(selectedUiNode) : "No node selected";
  const selectedMapSummary = selectedMapCell ? `${selectedMapCell.x}, ${selectedMapCell.y}` : "No map cell selected";
  const dirtyTabCount = tabs.filter((tab) => tab.dirty).length;

  useEffect(() => {
    if (dirtyTabCount <= 0) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [dirtyTabCount]);

  const canEditUiLayout = activeDocument?.kind === "ui-layout";
  const canMutateUiNode = canEditUiLayout && Boolean(selectedUiNode);
  const workspaceGridStyle = {
    "--workspace-left-width": `${sceneFocusMode ? 0 : leftDockCollapsed ? LEFT_DOCK_RAIL_WIDTH : leftColumnWidth}px`,
    "--workspace-left-splitter-width": sceneFocusMode || leftDockCollapsed ? "0px" : "6px",
    "--workspace-right-splitter-width": sceneFocusMode || rightDockCollapsed ? "0px" : "6px",
    "--workspace-right-width": `${sceneFocusMode ? 0 : rightDockCollapsed ? RIGHT_DOCK_RAIL_WIDTH : rightColumnWidth}px`
  } as CSSProperties;
  const leftColumnStyle = {
    gridTemplateRows: leftDockCollapsed ? "minmax(0, 1fr)" : `minmax(180px, ${hierarchyPaneHeight}px) 6px minmax(0, 1fr)`
  } as CSSProperties;
  const centerColumnStyle = {
    gridTemplateRows: sceneFocusMode
      ? "minmax(0, 1fr) 0px 0px"
      : bottomDockCollapsed
        ? "minmax(0, 1fr) 0px auto"
        : `minmax(0, 1fr) 6px minmax(170px, ${bottomDockHeight}px)`
  } as CSSProperties;
  const toolbarWindowTitle = workspaceLabel ? `${workspaceLabel} · BRM UI Studio` : `BRM UI Studio · ${t('window.noProject')}`;
  const menuDefinitions: Record<AppMenu, Array<{
    disabled?: boolean;
    label: string;
    onSelect: () => void;
    shortcut?: string;
    tone?: "danger";
  }>> = {
    file: [
      { label: t('file.openProject'), onSelect: () => { void handleOpenWorkspace(); }, shortcut: "Ctrl+O" },
      { label: t('file.importFolder'), onSelect: () => uploadInputRef.current?.click() },
      { disabled: !latestCachedWorkspace, label: t('file.openLatest'), onSelect: () => { void handleRestoreCachedWorkspace(); } },
      { label: t('file.newUiLayout'), onSelect: handleCreateUiDocument, shortcut: "Ctrl+N" },
      { label: t('file.save'), onSelect: () => { void handleSaveActiveDocument(); }, shortcut: "Ctrl+S" },
      { disabled: dirtyTabCount <= 0, label: t('file.saveAll'), onSelect: () => { void handleSaveAllDocuments(); }, shortcut: "Ctrl+Shift+S" },
      { disabled: !activeTab, label: t('file.closeTab'), onSelect: () => { if (activeTab) void handleCloseTab(activeTab.document.id); }, shortcut: "Ctrl+W" },
      { disabled: !workspaceLabel && !rootHandle, label: t('file.closeProject'), onSelect: () => { void handleCloseWorkspace(); } }
    ],
    edit: [
      { label: t('edit.zoomFit'), onSelect: () => setSceneZoom("fit"), shortcut: "Ctrl+0" },
      { label: t('edit.zoom100'), onSelect: () => setSceneZoom("100"), shortcut: "Ctrl+1" },
      { label: stageWorkbenchMode === "scene" ? t('edit.switchToPreview') : t('edit.switchToScene'), onSelect: () => setStageWorkbenchMode((current) => current === "scene" ? "preview" : "scene") },
      { label: sceneFocusMode ? t('edit.restoreScenePanel') : t('edit.maximizeScenePanel'), onSelect: toggleSceneFocusMode, shortcut: "Shift+Space" }
    ],
    node: [
      { disabled: !canEditUiLayout, label: t('node.addChild'), onSelect: handleAddUiChild, shortcut: "Ctrl+Shift+N" },
      { disabled: !canMutateUiNode || selectedUiNode?.parent === 0, label: t('node.duplicateSelected'), onSelect: handleDuplicateSelectedUiNode, shortcut: "Ctrl+D" },
      { disabled: !canMutateUiNode || selectedUiNode?.parent === 0, label: t('node.deleteSelected'), onSelect: handleRemoveSelectedUiNode, shortcut: "Delete", tone: "danger" }
    ],
    project: [
      { disabled: !rootHandle, label: t('project.rescan'), onSelect: () => { void handleRescanWorkspace(); } },
      { disabled: !latestCachedWorkspace, label: t('project.restoreCached'), onSelect: () => { void handleRestoreCachedWorkspace(); } },
      { disabled: recentWorkspaces.length <= 0, label: t('project.clearRecentProjects'), onSelect: () => { void handleForgetCachedWorkspace(); }, tone: "danger" }
    ],
    panel: [
      { label: leftDockCollapsed ? t('panel.showLeftDock') : t('panel.hideLeftDock'), onSelect: toggleLeftDock },
      { label: bottomDockCollapsed ? t('panel.showBottomDock') : t('panel.hideBottomDock'), onSelect: () => toggleBottomDock() },
      { label: rightDockCollapsed ? t('panel.showInspectorDock') : t('panel.hideInspectorDock'), onSelect: () => toggleRightDock() },
      { label: t('panel.sceneStage'), onSelect: () => setStageWorkbenchMode("scene") },
      { label: t('panel.previewStage'), onSelect: () => setStageWorkbenchMode("preview") },
      { label: t('panel.focusConsoleTab'), onSelect: () => revealBottomDock("console") },
      { label: t('panel.focusSelectionTab'), onSelect: () => revealBottomDock("selection") },
      { label: t('panel.focusProjectTab'), onSelect: () => revealBottomDock("project") },
      { label: t('panel.focusPropertiesInspector'), onSelect: () => revealRightDock("properties") },
      { label: t('panel.focusDocumentInspector'), onSelect: () => revealRightDock("document") },
      { label: t('panel.resetLayout'), onSelect: resetWorkspaceLayout }
    ],
    extension: [
      { disabled: assets.length <= 0, label: t('extension.avatarLab'), onSelect: () => { void handleOpenAvatarLab(); } },
      { disabled: assets.length <= 0, label: t('extension.effectLab'), onSelect: () => { void handleOpenEffectLab(); } }
    ],
    developer: [
      { disabled: !rootHandle, label: t('project.rescan'), onSelect: () => { void handleRescanWorkspace(); } },
      { label: t('panel.resetLayout'), onSelect: resetWorkspaceLayout },
      {
        label: t('panel.focusProjectPanel'),
        onSelect: () => {
          revealBottomDock("project");
          revealRightDock("document");
        }
      }
    ],
    help: [
      {
        label: t('help.showShortcuts'),
        onSelect: () => {
          setBottomDockTab("console");
          appendLog("info", "Shortcuts: Ctrl+O open workspace, Ctrl+N new layout, Ctrl+W close tab, Ctrl+S save, Ctrl+Shift+S save all, Ctrl+0 fit, Ctrl+1 100%, Shift+Space maximize scene, Ctrl+D duplicate node, Ctrl+Shift+N add child, Delete remove node, Arrow keys transform according to Move/Rect/Scale/Rotate.");
        }
      },
      {
        label: t('help.settings'),
        onSelect: () => {
          setSettingsOpen(true);
        }
      }
    ]
  };
  const dirtyActionSavableCount = dirtyActionPrompt ? dirtyActionPrompt.dirtyTabs.filter((tab) => tab.savable).length : 0;
  const dirtyActionUnsavableCount = dirtyActionPrompt ? dirtyActionPrompt.dirtyTabs.length - dirtyActionSavableCount : 0;

  return (
    <div className="studio-shell" onContextMenu={(e) => e.preventDefault()}>
      <header className="toolbar">
        <div className="toolbar__menubar">
          <div className="toolbar__lead">
            <div className="toolbar__brand">
              <div className="toolbar__badge">{t('brand.badge')}</div>
              <div>
                <strong>{t('brand.title')}</strong>
                <p>{t('brand.subtitle')}</p>
              </div>
            </div>
            <div ref={menuBarRef} className="toolbar__menus" aria-label="app menu">
              {([
                ["file", t('menu.file')],
                ["edit", t('menu.edit')],
                ["node", t('menu.node')],
                ["project", t('menu.project')],
                ["panel", t('menu.panel')],
                ["extension", t('menu.extension')],
                ["developer", t('menu.developer')],
                ["help", t('menu.help')]
              ] as Array<[AppMenu, string]>).map(([menuId, label]) => (
                <div key={menuId} className="toolbar__menu">
                  <button
                    type="button"
                    className={`toolbar__menu-button${openMenu === menuId ? " toolbar__menu-button--active" : ""}`}
                    onClick={() => setOpenMenu((current) => current === menuId ? null : menuId)}
                  >
                    {label}
                  </button>
                  {openMenu === menuId ? (
                    <div className="toolbar__menu-popover" role="menu" aria-label={label}>
                      {menuDefinitions[menuId].map((item) => (
                        <button
                          key={`${menuId}-${item.label}`}
                          type="button"
                          role="menuitem"
                          className={`toolbar__menu-item${item.tone === "danger" ? " toolbar__menu-item--danger" : ""}`}
                          disabled={item.disabled}
                          onClick={() => {
                            setOpenMenu(null);
                            item.onSelect();
                          }}
                        >
                          <span className="toolbar__menu-item-copy">{item.label}</span>
                          {item.shortcut ? <small className="toolbar__menu-shortcut">{item.shortcut}</small> : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
          <div className="toolbar__window" aria-label="window title">
            <span>{toolbarWindowTitle}</span>
          </div>
        </div>
        <div className="toolbar__workbar">
          <div className="toolbar__actions">
            <div className="toolbar__action-group">
              <button type="button" className="toolbar__button toolbar__button--primary" onClick={handleOpenWorkspace}>
                {t('toolbar.openProject')}
              </button>
              <button type="button" className="toolbar__button" onClick={() => uploadInputRef.current?.click()}>
                {t('toolbar.importFolder')}
              </button>
              <button type="button" className="toolbar__button" onClick={handleRescanWorkspace}>
                {t('toolbar.rescan')}
              </button>
            </div>
            <div className="toolbar__action-group">
              <button type="button" className={`toolbar__button${activeDocument?.kind === 'ui-layout' ? ' toolbar__button--active' : ''}`} onClick={handleCreateUiDocument}>
                {t('toolbar.newUiLayout')}
              </button>
              {!isDashboardMode && assets.length > 0 ? (
                <>
                  <button
                    type="button"
                    className={`toolbar__button${activeDocument?.kind === 'avatar-preview' ? ' toolbar__button--active' : ''}`}
                    onClick={() => {
                      void handleOpenAvatarLab();
                    }}
                  >
                    {t('toolbar.avatarLab')}
                  </button>
                  <button
                    type="button"
                    className={`toolbar__button${activeDocument?.kind === 'effect-preview' ? ' toolbar__button--active' : ''}`}
                    onClick={() => {
                      void handleOpenEffectLab();
                    }}
                  >
                    {t('toolbar.effectLab')}
                  </button>
                </>
              ) : null}
            </div>
            {!isDashboardMode ? (
              <div className="toolbar__action-group">
                <button type="button" className="toolbar__button" disabled={!activeTab} onClick={handleSaveActiveDocument}>
                  {t('toolbar.save')}
                </button>
                <button
                  type="button"
                  className="toolbar__button"
                  disabled={dirtyTabCount <= 0}
                  onClick={() => {
                    void handleSaveAllDocuments();
                  }}
                >
                  {dirtyTabCount > 0 ? `${t('toolbar.saveAll')} ${dirtyTabCount}` : t('toolbar.saveAll')}
                </button>
              </div>
            ) : null}
          </div>
          <div className="toolbar__status">
            <span className="toolbar__status-pill">{workspaceLabel ? `${t('status.workspace')}: ${workspaceLabel}` : t('status.noWorkspace')}</span>
            <span className="toolbar__status-pill">{workspaceLabel ? (workspaceWritable ? t('status.writable') : t('status.readonly')) : t('status.detached')}</span>
            {workspaceLabel ? <span className="toolbar__status-pill">{workspaceProfile}</span> : null}
            {assets.length > 0 ? <span className="toolbar__status-pill">{assets.length} {t('status.assets')}</span> : null}
            {dirtyTabCount > 0 ? <span className="toolbar__status-pill">{dirtyTabCount} {t('status.dirty')}</span> : null}
            <span className="toolbar__status-pill">{workspaceActivityLabel}</span>
          </div>
        </div>
        <input
          ref={uploadInputRef}
          id="workspace-upload"
          hidden
          multiple
          type="file"
          onChange={(event) => { void handleImportWorkspaceFiles(event.target.files); }}
          {...({ webkitdirectory: "" } as { webkitdirectory: string })}
        />
      </header>
      {isDashboardMode ? (
        <main className="dashboard-layout">
          <WelcomeHome
            currentWorkspaceLabel={workspaceLabel}
            currentWorkspaceProfile={workspaceProfile}
            onCreateUiDocument={handleCreateUiDocument}
            onForgetCachedWorkspace={() => {
              void handleForgetCachedWorkspace();
            }}
            onImportWorkspace={() => uploadInputRef.current?.click()}
            onOpenWorkspace={handleOpenWorkspace}
            onRemoveRecentWorkspace={(workspaceId) => {
              void handleForgetCachedWorkspace(workspaceId);
            }}
            onRestoreCachedWorkspace={(workspaceId) => {
              void handleRestoreCachedWorkspace(workspaceId);
            }}
            recentWorkspaces={recentWorkspaces}
            rememberedWorkspace={rememberedWorkspace}
            workspaceProgress={activeWorkspaceProgress}
          />
        </main>
      ) : (
      <main className="workspace-grid" style={workspaceGridStyle}>
        <aside className={`workspace-column workspace-column--left${leftDockCollapsed ? " workspace-column--collapsed" : ""}${sceneFocusMode ? " workspace-column--hidden" : ""}`} style={leftColumnStyle}>
          {sceneFocusMode ? null : leftDockCollapsed ? (
            <div className="panel-rail panel-rail--vertical" data-panel-rail="left">
              <button type="button" className="panel-rail__button" onClick={revealLeftDock}>
                {t('label.hierarchy')}
              </button>
              <button type="button" className="panel-rail__button" onClick={revealLeftDock}>
                {t('label.assets')}
              </button>
            </div>
          ) : (
            <>
              <section className="panel panel--hierarchy">
                <div className="panel__dock">
                  <span>
                    {t('hierarchy.title')}
                    {activeDocument?.kind === "ui-layout" ? <small className="panel__dock-count">{activeDocument.nodes.length} {t('hierarchy.nodes')}</small> : null}
                  </span>
                  <div className="panel__dock-actions">
                    <select className="panel__inline-select panel__inline-select--compact" value={hierarchyQueryMode} onChange={(event) => setHierarchyQueryMode(event.target.value as HierarchyQueryMode)} title={t('hierarchy.all')}>
                      <option value="all">{t('hierarchy.all')}</option>
                      <option value="name">{t('hierarchy.name')}</option>
                      <option value="type">{t('hierarchy.type')}</option>
                      <option value="text">{t('hierarchy.text')}</option>
                      <option value="resource">{t('hierarchy.resource')}</option>
                    </select>
                    <button type="button" className="panel__dock-button" title={t('hierarchy.toggleSearch')} onClick={() => setHierarchySearchVisible(!hierarchySearchVisible)}>
                      {hierarchySearchVisible ? 'x' : '?'}
                    </button>
                    <button type="button" className="panel__dock-button" title={t('hierarchy.expand')} onClick={() => toggleHierarchyTreeExpansion(true)} disabled={filteredUiHierarchy.length <= 0}>
                      +
                    </button>
                    <button type="button" className="panel__dock-button" title={t('hierarchy.collapse')} onClick={() => toggleHierarchyTreeExpansion(false)} disabled={filteredUiHierarchy.length <= 0}>
                      -
                    </button>
                    <button type="button" className="panel__dock-button" aria-label={t('toolbar.collapseLeftDock')} onClick={toggleLeftDock}>
                      &lt;
                    </button>
                  </div>
                </div>
                {hierarchySearchVisible ? (
                  <div className="panel__toolbar panel__toolbar--controls panel__toolbar--compact">
                    <input
                      value={hierarchyQuery}
                      onChange={(event) => setHierarchyQuery(event.target.value)}
                      className="panel__search panel__search--full"
                      placeholder={t('hierarchy.searchPlaceholder')}
                    />
                  </div>
                ) : null}
                <div className="panel__body panel__body--scroll">
                  {activeDocument?.kind === "ui-layout" ? (
                    <HierarchyTree
                      expandSignal={hierarchyTreeExpandSignal}
                      forceExpanded={hierarchyTreeExpanded}
                      roots={filteredUiHierarchy}
                      selectedNodeId={selectedUiNode?.id ?? null}
                      onSelectNode={(nodeId) => setSelectedUiNodeIdByDoc((current) => ({ ...current, [activeDocument.id]: nodeId }))}
                      onDeleteNode={handleRemoveSelectedUiNode}
                      onContextMenu={(e, nodeId) => {
                        setSelectedUiNodeIdByDoc((current) => ({ ...current, [activeDocument.id]: nodeId }));
                        handleHierarchyContextMenu(e, nodeId);
                      }}
                      onEmptyContextMenu={(e) => handlePanelContextMenu(e, "hierarchy")}
                    />
                  ) : (
                    <EmptyState
                      title={t('hierarchy.unavailable.title')}
                      body={t('hierarchy.unavailable.body')}
                    />
                  )}
                </div>
              </section>

              <div
                className="splitter splitter--horizontal"
                aria-hidden="true"
                onPointerDown={(event) => beginResize("hierarchy-height", event.clientY, hierarchyPaneHeight)}
              />

              <section className="panel panel--asset-browser">
                <div className="panel__dock">
                  <span>
                    {t('asset.title')} <small className="panel__dock-count">{filteredAssets.length} {t('hierarchy.nodes')}</small>
                  </span>
                  <div className="panel__dock-actions">
                    <button type="button" className="panel__dock-button" title={t('asset.expand')} onClick={() => toggleAssetTreeExpansion(true)} disabled={assetTree.length <= 0}>
                      +
                    </button>
                    <button type="button" className="panel__dock-button" title={t('asset.collapse')} onClick={() => toggleAssetTreeExpansion(false)} disabled={assetTree.length <= 0}>
                      -
                    </button>
                    <button type="button" className="panel__dock-button" title={t('asset.searchPlaceholder')} onClick={() => setAssetSearchVisible(!assetSearchVisible)}>
                      {assetSearchVisible ? 'x' : '?'}
                    </button>
                    <button type="button" className="panel__dock-button" aria-label={t('toolbar.collapseLeftDock')} onClick={toggleLeftDock}>
                      &lt;
                    </button>
                  </div>
                </div>
                <div className="panel__toolbar panel__toolbar--controls panel__toolbar--compact">
                  <div className="panel__toolbar-group panel__toolbar-group--icons">
                    <select className="panel__inline-select panel__inline-select--compact" value={assetWorkbenchFilter} onChange={(event) => setAssetWorkbenchFilter(event.target.value as AssetWorkbenchFilter)} title={t('asset.all')}>
                      <option value="all">{t('asset.all')}</option>
                      <option value="ui">{t('asset.ui')}</option>
                      <option value="avatar">{t('asset.avatar')}</option>
                      <option value="map">{t('asset.map')}</option>
                      <option value="data">{t('asset.data')}</option>
                    </select>
                    <select className="panel__inline-select panel__inline-select--compact" value={assetQueryMode} onChange={(event) => setAssetQueryMode(event.target.value as AssetQueryMode)} title={t('hierarchy.type')}>
                      <option value="all">{t('hierarchy.all')}</option>
                      <option value="name">{t('hierarchy.name')}</option>
                      <option value="kind">{t('hierarchy.type')}</option>
                      <option value="path">{t('inspector.path')}</option>
                    </select>
                    <select className="panel__inline-select panel__inline-select--compact" value={assetSortMode} onChange={(event) => setAssetSortMode(event.target.value as AssetSortMode)} title={t('asset.sortType')}>
                      <option value="name">A-Z</option>
                      <option value="type">{t('hierarchy.type')}</option>
                    </select>
                    <button type="button" className="panel__icon-button" title={t('asset.import')} onClick={() => uploadInputRef.current?.click()}>
                      +
                    </button>
                    <button type="button" className="panel__icon-button" title={t('asset.refresh')} onClick={handleRescanWorkspace} disabled={!rootHandle}>
                      R
                    </button>
                  </div>
                  {assetSearchVisible ? (
                    <input
                      value={assetQuery}
                      onChange={(event) => setAssetQuery(event.target.value)}
                      className="panel__search panel__search--compact"
                      placeholder={t('asset.searchPlaceholder')}
                      autoFocus
                    />
                  ) : null}
                </div>
                <div className="panel__body panel__body--scroll">
                  {activeWorkspaceProgress ? (
                    <div className="panel__loading">
                      <strong>{activeWorkspaceProgress.message}</strong>
                      <span>{activeWorkspaceProgress.currentPath ?? "Preparing workspace..."}</span>
                    </div>
                  ) : null}
                  {assetTree.length > 0 ? (
                    <AssetBrowserTree
                      expandSignal={assetTreeExpandSignal}
                      forceExpanded={assetTreeExpanded}
                      nodes={assetTree}
                      selectedAssetId={selectedAssetId}
                      onOpenAsset={(asset) => {
                        void handleOpenAsset(asset);
                      }}
                      onAssetContextMenu={(e, target) => handleAssetContextMenu(e, target)}
                      onEmptyContextMenu={handleAssetEmptyContextMenu}
                      onSelectAsset={setSelectedAssetId}
                    />
                  ) : (
                    <EmptyState
                      title={t('asset.notLoaded.workspaceNotLoaded')}
                      body={t('asset.notLoaded.workspaceHint')}
                    />
                  )}
                </div>
              </section>
            </>
          )}
        </aside>

        <div
          className={`splitter splitter--vertical${leftDockCollapsed || sceneFocusMode ? " splitter--hidden" : ""}`}
          aria-hidden="true"
          onPointerDown={(event) => beginResize("left-width", event.clientX, leftColumnWidth)}
        />

        <section className="workspace-column workspace-column--center" style={centerColumnStyle}>
          <section className="panel panel--center">
            <div className="panel__dock panel__dock--center">{t('scene.title')}</div>
            <div className="panel__toolbar panel__toolbar--stage">
              <div className="panel__toolbar-group">
                {([
                  ["hand", t('scene.hand')],
                  ["move", t('scene.move')],
                  ["rotate", t('scene.rotate')],
                  ["scale", t('scene.scale')],
                  ["rect", t('scene.rect')]
                ] as Array<[SceneTool, string]>).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={`dock-tab${sceneTool === value ? " dock-tab--active" : ""}`}
                    onClick={() => setSceneTool(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="panel__toolbar-group">
                <button
                  type="button"
                  className={`dock-tab${stageWorkbenchMode === "scene" ? " dock-tab--active" : ""}`}
                  onClick={() => setStageWorkbenchMode("scene")}
                >
                  {t('scene.scene')}
                </button>
                <button
                  type="button"
                  className={`dock-tab${stageWorkbenchMode === "preview" ? " dock-tab--active" : ""}`}
                  onClick={() => setStageWorkbenchMode("preview")}
                >
                  {t('scene.preview')}
                </button>
              </div>
              <div className="panel__toolbar-group">
                <span className="toolbar__status-pill">{t('scene.mode2d')}</span>
                <button
                  type="button"
                  className={`dock-tab${sceneZoom === "fit" ? " dock-tab--active" : ""}`}
                  onClick={() => setSceneZoom("fit")}
                >
                  {t('scene.fit')}
                </button>
                <button
                  type="button"
                  className={`dock-tab${sceneZoom === "100" ? " dock-tab--active" : ""}`}
                  onClick={() => setSceneZoom("100")}
                >
                  {t('scene.zoom100')}
                </button>
                <button
                  type="button"
                  className={`dock-tab${sceneFocusMode ? " dock-tab--active" : ""}`}
                  onClick={toggleSceneFocusMode}
                >
                  {sceneFocusMode ? t('scene.restore') : t('scene.maximize')}
                </button>
                {sceneFocusMode ? <span className="toolbar__status-pill">{t('status.focus')}</span> : null}
                {activeDocument ? <span className="toolbar__status-pill">{activeDocument.kind}</span> : null}
                {activeDocument ? <span className="toolbar__status-pill">{activeDocument.name}</span> : null}
              </div>
            </div>
            <div className="tabs" role="tablist" aria-label={t('scene.title')}>
              {tabs.length > 0 ? tabs.map((tab) => (
                <div
                  key={tab.document.id}
                  className={`tab${tab.document.id === activeTabId ? " tab--active" : ""}`}
                  role="tab"
                  aria-selected={tab.document.id === activeTabId}
                  onContextMenu={(e) => handleTabContextMenu(e, tab.document.id)}
                >
                  <button
                    type="button"
                    className="tab__select"
                    onClick={() => setActiveTabId(tab.document.id)}
                  >
                    <span className="tab__label">{tab.document.name}</span>
                    {tab.dirty ? <span className="tab__dirty">*</span> : null}
                  </button>
                  <button
                    type="button"
                    className="tab__close"
                    aria-label={`${t('tabs.close')} ${tab.document.name}`}
                  onClick={() => { void handleCloseTab(tab.document.id); }}
                  >
                    ×
                  </button>
                </div>
              )) : <div className="tabs__placeholder">{t('tabs.noDocument')}</div>}
            </div>
            <div className="panel__body panel__body--workspace">
              {activeDocument ? (
                <PreviewPane
                  activeDocument={activeDocument}
                  assets={assets}
                  atlasFrameSelection={activeDocument.kind === "atlas" ? selectedAtlasFrame?.name ?? null : null}
                  bizFileIndex={activeDocument.kind === "biz" ? selectedBizFileByDoc[activeDocument.id] ?? 0 : 0}
                  bizFrameId={activeDocument.kind === "biz" ? selectedBizFrame?.frameId ?? null : null}
                  mapCellSelection={activeDocument.kind === "map" ? selectedMapCell : null}
                  sceneTool={sceneTool}
                  sceneZoom={sceneZoom}
                  onSceneContextMenu={handleSceneContextMenu}
                  stageMode={stageWorkbenchMode}
                  onAtlasFrameSelect={(frameName) => activeDocument.kind === "atlas"
                    ? setSelectedAtlasFrameByDoc((current) => ({ ...current, [activeDocument.id]: frameName }))
                    : undefined}
                  onBizFileSelect={(fileIndex) => activeDocument.kind === "biz"
                    ? setSelectedBizFileByDoc((current) => ({ ...current, [activeDocument.id]: fileIndex }))
                    : undefined}
                  onBizFrameSelect={(frameId) => activeDocument.kind === "biz"
                    ? setSelectedBizFrameByDoc((current) => ({ ...current, [activeDocument.id]: frameId }))
                    : undefined}
                  onChangeAvatarDocument={(patch) => activeDocument.kind === "avatar-preview"
                    ? replaceDocument(activeDocument.id, (document) => document.kind === "avatar-preview" ? { ...document, ...patch } : document)
                    : undefined}
                  onChangeEffectDocument={(patch) => activeDocument.kind === "effect-preview"
                    ? replaceDocument(activeDocument.id, (document) => document.kind === "effect-preview" ? { ...document, ...patch } : document)
                    : undefined}
                  onChangeTextDocument={(text) => activeDocument.kind === "text"
                    ? replaceDocument(activeDocument.id, (document) => document.kind === "text" ? { ...document, text } : document)
                    : undefined}
                  onMapPaint={(x, y) => {
                    if (activeDocument.kind !== "map") return;
                    const index = y * activeDocument.logicWidth + x;
                    if (index < 0 || index >= activeDocument.blockData.length) return;
                    setSelectedMapCellByDoc((current) => ({ ...current, [activeDocument.id]: { x, y } }));
                    replaceDocument(activeDocument.id, (document) => document.kind === "map" ? (() => {
                      const next = new Uint8Array(document.blockData);
                      next[index] = mapBrushValue;
                      return { ...document, blockData: next };
                    })() : document);
                    appendLog("info", `Painted map cell ${x},${y} -> ${mapBrushValue}`);
                  }}
                  onSelectUiNode={(nodeId) => activeDocument.kind === "ui-layout"
                    ? setSelectedUiNodeIdByDoc((current) => ({ ...current, [activeDocument.id]: nodeId }))
                    : undefined}
                  selectedUiNodeId={activeDocument.kind === "ui-layout" ? selectedUiNode?.id ?? null : null}
                  onBeginUiDrag={(node, mode, event, scale) => {
                    if (activeDocument.kind !== "ui-layout") return;
                    event.preventDefault();
                    setSelectedUiNodeIdByDoc((current) => ({ ...current, [activeDocument.id]: node.id }));
                    if (mode === "move") {
                      const nextDragState: DragState = {
                        docId: activeDocument.id,
                        mode,
                        nodeId: node.id,
                        originX: typeof node.x === "number" ? node.x : 0,
                        originY: typeof node.y === "number" ? node.y : 0,
                        pointerStartX: event.clientX,
                        pointerStartY: event.clientY,
                        scale
                      };
                      dragStateRef.current = nextDragState;
                      setDragState(nextDragState);
                      return;
                    }
                    if (mode === "rect") {
                      const nextDragState: DragState = {
                        docId: activeDocument.id,
                        heightStart: Math.max(12, Number(node.h ?? 32)),
                        mode,
                        nodeId: node.id,
                        pointerStartX: event.clientX,
                        pointerStartY: event.clientY,
                        scale,
                        widthStart: Math.max(12, Number(node.w ?? 72))
                      };
                      dragStateRef.current = nextDragState;
                      setDragState(nextDragState);
                      return;
                    }
                    if (mode === "scale") {
                      const nextDragState: DragState = {
                        docId: activeDocument.id,
                        heightStart: Math.max(12, Number(node.h ?? 32)),
                        mode,
                        nodeId: node.id,
                        pointerStartX: event.clientX,
                        pointerStartY: event.clientY,
                        scale,
                        scaleXStart: Number(node.sx ?? 1),
                        scaleYStart: Number(node.sy ?? 1),
                        widthStart: Math.max(12, Number(node.w ?? 72))
                      };
                      dragStateRef.current = nextDragState;
                      setDragState(nextDragState);
                      return;
                    }
                    const bounds = event.currentTarget.getBoundingClientRect();
                    const centerClientX = bounds.left + bounds.width / 2;
                    const centerClientY = bounds.top + bounds.height / 2;
                    const nextDragState: DragState = {
                      centerClientX,
                      centerClientY,
                      docId: activeDocument.id,
                      mode,
                      nodeId: node.id,
                      pointerStartAngle: Math.atan2(event.clientY - centerClientY, event.clientX - centerClientX),
                      rotationStart: Number(node.r ?? 0)
                    };
                    dragStateRef.current = nextDragState;
                    setDragState(nextDragState);
                  }}
                />
              ) : (
                <WelcomeHome
                  currentWorkspaceLabel={workspaceLabel}
                  currentWorkspaceProfile={workspaceProfile}
                  onCreateUiDocument={handleCreateUiDocument}
                  onForgetCachedWorkspace={() => {
                    void handleForgetCachedWorkspace();
                  }}
                  onImportWorkspace={() => uploadInputRef.current?.click()}
                  onOpenWorkspace={handleOpenWorkspace}
                  onRemoveRecentWorkspace={(workspaceId) => {
                    void handleForgetCachedWorkspace(workspaceId);
                  }}
                  onRestoreCachedWorkspace={(workspaceId) => {
                    void handleRestoreCachedWorkspace(workspaceId);
                  }}
                  recentWorkspaces={recentWorkspaces}
                  rememberedWorkspace={rememberedWorkspace}
                  workspaceProgress={activeWorkspaceProgress}
                />
              )}
            </div>
          </section>

          {sceneFocusMode ? null : (
            <div
              className={`splitter splitter--horizontal${bottomDockCollapsed ? " splitter--hidden" : ""}`}
              aria-hidden="true"
              onPointerDown={(event) => beginResize("bottom-height", event.clientY, bottomDockHeight)}
            />
          )}

          {sceneFocusMode ? null : bottomDockCollapsed ? (
            <div className="panel-rail panel-rail--bottom" data-panel-rail="bottom">
              {([
                ["console", t('dock.console')],
                ["selection", t('dock.selection')],
                ["project", t('dock.project')]
              ] as Array<[BottomDockTab, string]>).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`panel-rail__button${bottomDockTab === value ? " panel-rail__button--active" : ""}`}
                  onClick={() => revealBottomDock(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : (
            <section className="panel panel--logs" onContextMenu={handleConsoleContextMenu}>
              <div className="panel__dock">
                <span>{t('console.title')}</span>
                <div className="panel__dock-actions">
                  <button type="button" className="panel__dock-button" aria-label={t('toolbar.collapseBottomDock')} onClick={() => toggleBottomDock()}>
                    -
                  </button>
                </div>
              </div>
              <div className="panel__subtabs">
                {([
                  ["console", t('dock.console')],
                  ["selection", t('dock.selection')],
                  ["project", t('dock.project')]
                ] as Array<[BottomDockTab, string]>).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={`dock-tab${bottomDockTab === value ? " dock-tab--active" : ""}`}
                    onClick={() => setBottomDockTab(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="panel__header">
                <div>
                  <h2>{bottomDockTab === "console" ? t('dock.console') : bottomDockTab === "selection" ? t('dock.selection') : t('dock.project')}</h2>
                  <p>
                    {bottomDockTab === "console"
                      ? t('dock.console')
                      : bottomDockTab === "selection"
                        ? t('dock.selection')
                        : t('dock.project')}
                  </p>
                </div>
                {bottomDockTab === "console" ? (
                  <button type="button" className="chip" onClick={() => setLogs([])}>
                    {t('console.clear')}
                  </button>
                ) : null}
              </div>
              <div className="panel__body panel__body--scroll">
                {bottomDockTab === "console" ? logs.length > 0 ? (
                  <ul className="log-list">
                    {logs.map((entry) => (
                      <li key={entry.id} className={`log-list__item log-list__item--${entry.level}`}>
                        <span>{entry.level.toUpperCase()}</span>
                        <p>{entry.message}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState title={t('console.noLogs.title')} body={t('console.noLogs.body')} />
                ) : bottomDockTab === "selection" ? (
                  <div className="dock-metrics">
                    <article className="dock-metric-card">
                      <span>{t('metrics.document')}</span>
                      <strong>{activeDocumentSummary}</strong>
                    </article>
                    <article className="dock-metric-card">
                      <span>{t('metrics.selectedAsset')}</span>
                      <strong>{selectedAsset?.path ?? t('metrics.noAssetSelected')}</strong>
                    </article>
                    <article className="dock-metric-card">
                      <span>{t('metrics.selectedNode')}</span>
                      <strong>{selectedNodeSummary}</strong>
                    </article>
                    <article className="dock-metric-card">
                      <span>{t('metrics.mapCell')}</span>
                      <strong>{selectedMapSummary}</strong>
                    </article>
                  </div>
                ) : (
                  <div className="dock-metrics">
                    <article className="dock-metric-card">
                      <span>{t('metrics.workspace')}</span>
                      <strong>{workspaceLabel ?? t('metrics.noWorkspaceMounted')}</strong>
                    </article>
                    <article className="dock-metric-card">
                      <span>{t('metrics.profile')}</span>
                      <strong>{workspaceProfile}</strong>
                    </article>
                    <article className="dock-metric-card">
                      <span>{t('metrics.recentProjects')}</span>
                      <strong>{recentWorkspaces.length}</strong>
                    </article>
                  <article className="dock-metric-card">
                    <span>{t('metrics.progress')}</span>
                    <strong>{workspaceActivityLabel}</strong>
                  </article>
                </div>
              )}
              </div>
            </section>
          )}
        </section>

        <div
          className={`splitter splitter--vertical${rightDockCollapsed || sceneFocusMode ? " splitter--hidden" : ""}`}
          aria-hidden="true"
          onPointerDown={(event) => beginResize("right-width", event.clientX, rightColumnWidth)}
        />

        <aside className={`workspace-column workspace-column--right${rightDockCollapsed ? " workspace-column--collapsed" : ""}${sceneFocusMode ? " workspace-column--hidden" : ""}`}>
          {sceneFocusMode ? null : rightDockCollapsed ? (
            <div className="panel-rail panel-rail--vertical panel-rail--right" data-panel-rail="right">
              {([
                ["properties", t('label.properties')],
                ["document", t('label.document')]
              ] as Array<[InspectorDockTab, string]>).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`panel-rail__button${inspectorDockTab === value ? " panel-rail__button--active" : ""}`}
                  onClick={() => revealRightDock(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : (
            <section className="panel panel--inspector" onContextMenu={handleInspectorContextMenu}>
              <div className="panel__dock">
                <span>{t('label.inspector')}</span>
                <div className="panel__dock-actions">
                  <button type="button" className="panel__dock-button" aria-label={t('toolbar.collapseInspectorDock')} onClick={() => toggleRightDock()}>
                    -
                  </button>
                </div>
              </div>
              <div className="panel__subtabs">
                {([
                  ["properties", t('label.properties')],
                  ["document", t('label.document')]
                ] as Array<[InspectorDockTab, string]>).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={`dock-tab${inspectorDockTab === value ? " dock-tab--active" : ""}`}
                    onClick={() => setInspectorDockTab(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="panel__header">
                <div>
                  <h2>{inspectorDockTab === "properties" ? t('label.properties') : t('label.document')}</h2>
                  <p>{inspectorDockTab === "properties" ? t('label.properties') : t('label.document')}</p>
                </div>
                <div className="panel__actions">
                  <button type="button" className="panel__tool-button" disabled>
                    ←
                  </button>
                  <button type="button" className="panel__tool-button" disabled>
                    →
                  </button>
                  <button type="button" className={`panel__tool-button${inspectorLocked ? " panel__tool-button--active" : ""}`} onClick={toggleInspectorLock}>
                    {t('inspector.lock')}
                  </button>
                  {activeDocument ? <span className="panel__meta">{activeDocument.kind}</span> : null}
                </div>
              </div>
              <div className="panel__body panel__body--scroll">
                {inspectorDockTab === "properties" ? (
                  <InspectorPane
                    activeDocument={inspectorSnapshot.activeDocument}
                    mapBrushValue={mapBrushValue}
                    onChangeMapBrush={setMapBrushValue}
                    onChangeTextDocument={(text) => activeDocument?.kind === "text"
                      ? replaceDocument(activeDocument.id, (document) => document.kind === "text" ? { ...document, text } : document)
                      : undefined}
                    onChangeAvatarDocument={(patch) => activeDocument?.kind === "avatar-preview"
                      ? replaceDocument(activeDocument.id, (document) => document.kind === "avatar-preview" ? { ...document, ...patch } : document)
                      : undefined}
                    onChangeEffectDocument={(patch) => activeDocument?.kind === "effect-preview"
                      ? replaceDocument(activeDocument.id, (document) => document.kind === "effect-preview" ? { ...document, ...patch } : document)
                      : undefined}
                    onChangeUiFormat={(format) => activeDocument?.kind === "ui-layout"
                      ? replaceDocument(activeDocument.id, (document) => document.kind === "ui-layout" ? { ...document, sourceFormat: format } : document)
                      : undefined}
                    onUpdateUiNode={handleUpdateUiNode}
                    selectedAtlasFrame={inspectorSnapshot.selectedAtlasFrame}
                    selectedBizDocumentFile={inspectorSnapshot.selectedBizDocumentFile}
                    selectedBizFrame={inspectorSnapshot.selectedBizFrame}
                    selectedMapCell={inspectorSnapshot.selectedMapCell}
                    selectedUiNode={inspectorSnapshot.selectedUiNode}
                  />
                ) : (
                  <div className="dock-metrics dock-metrics--stacked">
                    <article className="dock-metric-card">
                      <span>{t('metrics.activeDocument')}</span>
                      <strong>{activeDocumentSummary}</strong>
                    </article>
                    <article className="dock-metric-card">
                      <span>{t('metrics.selectedAsset')}</span>
                      <strong>{selectedAsset?.path ?? t('metrics.noAssetSelected')}</strong>
                    </article>
                    <article className="dock-metric-card">
                      <span>{t('metrics.workspace')}</span>
                      <strong>{workspaceLabel ?? t('metrics.noWorkspaceMounted')}</strong>
                    </article>
                    <article className="dock-metric-card">
                      <span>{t('status.writable')}</span>
                      <strong>{workspaceWritable ? "true" : "false"}</strong>
                    </article>
                  </div>
                )}
              </div>
            </section>
          )}
        </aside>
      </main>
      )}
      {dirtyActionPrompt ? (
        <div className="modal-backdrop" data-dirty-action-modal>
          <section className="modal-card modal-card--dirty-action" role="dialog" aria-modal="true" aria-labelledby="dirty-action-title">
            <header className="modal-card__header">
              <div>
                <p className="modal-card__eyebrow">{dirtyActionPrompt.mode === "close-tab" ? t('dirty.closeDocument') : t('dirty.workspaceTransition')}</p>
                <h2 id="dirty-action-title">{dirtyActionPrompt.actionLabel}</h2>
                <p>
                  {dirtyActionPrompt.mode === "close-tab"
                    ? t('dirty.unsavedChanges')
                    : t('dirty.unsavedChangesWorkspace')}
                </p>
              </div>
            </header>
            <div className="modal-card__body">
              <div className="modal-card__metrics">
                <span className="toolbar__status-pill">{dirtyActionPrompt.dirtyTabs.length} {t('status.dirty')}</span>
                <span className="toolbar__status-pill">{dirtyActionSavableCount} {t('dirty.savable')}</span>
                {dirtyActionUnsavableCount > 0 ? <span className="toolbar__status-pill">{dirtyActionUnsavableCount} {t('dirty.previewOnly')}</span> : null}
              </div>
              <ul className="modal-card__list">
                {dirtyActionPrompt.dirtyTabs.map((tab) => (
                  <li key={tab.id} className="modal-card__list-item">
                    <div>
                      <strong>{tab.name}</strong>
                      <small>{tab.kind}</small>
                    </div>
                    <span className={`modal-card__tag${tab.savable ? "" : " modal-card__tag--muted"}`}>
                      {tab.savable ? t('dirty.savable') : t('dirty.previewOnly')}
                    </span>
                  </li>
                ))}
              </ul>
              {dirtyActionUnsavableCount > 0 ? (
                <p className="modal-card__hint">
                  Some dirty tabs are preview-only and cannot be saved. Use {dirtyActionPrompt.discardLabel.toLowerCase()} if you want to continue without them.
                </p>
              ) : null}
            </div>
            <footer className="modal-card__footer">
              <button type="button" className="toolbar__button" onClick={() => resolveDirtyActionPrompt("cancel")}>
                {dirtyActionPrompt.cancelLabel}
              </button>
              <button type="button" className="toolbar__button" onClick={() => resolveDirtyActionPrompt("discard")}>
                {dirtyActionPrompt.discardLabel}
              </button>
              <button
                type="button"
                className="toolbar__button toolbar__button--primary"
                disabled={dirtyActionSavableCount <= 0}
                onClick={() => resolveDirtyActionPrompt("save")}
              >
                {dirtyActionPrompt.saveLabel}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
      {settingsOpen ? (
        <SettingsPanel onClose={() => setSettingsOpen(false)} />
      ) : null}
      {hierarchyContextMenu.contextMenu}
      {assetContextMenu.contextMenu}
      {tabContextMenu.contextMenu}
      {panelContextMenu.contextMenu}
      {inspectorContextMenu.contextMenu}
      {consoleContextMenu.contextMenu}
      {sceneContextMenu.contextMenu}
    </div>
  );
}

export default App;
