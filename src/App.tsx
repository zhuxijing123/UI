import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import "./App.css";

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
import { WelcomeHome } from "./editor/components/WelcomeHome";
import { buildUiHierarchy, serializeLegacyUILayout, serializeMapDocument } from "./editor/formats";
import { createAvatarPreviewDocument, createEffectPreviewDocument } from "./editor/legacy-labs";
import { createStarterUiLayoutDocument } from "./editor/presets";
import type { AppLogEntry, DocumentTab, EditorDocument, LegacyUILayoutNode, WorkspaceAsset } from "./editor/types";
import { createAssetTree, describeLegacyNode, filterAssetsByQuery } from "./editor/view-model";
import { openAssetDocument, openWorkspaceDirectory, openWorkspaceFiles, scanWorkspace, writeBinaryFile, writeTextFile } from "./editor/workspace";

type DragState = {
  docId: string;
  nodeId: number;
  originX: number;
  originY: number;
  pointerStartX: number;
  pointerStartY: number;
};

function App() {
  const [rootHandle, setRootHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [workspaceLabel, setWorkspaceLabel] = useState<string | null>(null);
  const [assets, setAssets] = useState<WorkspaceAsset[]>([]);
  const [tabs, setTabs] = useState<DocumentTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [assetQuery, setAssetQuery] = useState("");
  const [logs, setLogs] = useState<AppLogEntry[]>([
    createLogEntry("info", "BRM UI Studio ready. Open a workspace to begin editing legacy assets.")
  ]);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [selectedUiNodeIdByDoc, setSelectedUiNodeIdByDoc] = useState<Record<string, number | null>>({});
  const [selectedAtlasFrameByDoc, setSelectedAtlasFrameByDoc] = useState<Record<string, string | null>>({});
  const [selectedBizFileByDoc, setSelectedBizFileByDoc] = useState<Record<string, number>>({});
  const [selectedBizFrameByDoc, setSelectedBizFrameByDoc] = useState<Record<string, number | null>>({});
  const [selectedMapCellByDoc, setSelectedMapCellByDoc] = useState<Record<string, MapCell | null>>({});
  const [mapBrushValue, setMapBrushValue] = useState(1);
  const [dragState, setDragState] = useState<DragState | null>(null);

  const newLayoutSeedRef = useRef(1);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const deferredAssetQuery = useDeferredValue(assetQuery);

  const activeTab = useMemo(() => tabs.find((tab) => tab.document.id === activeTabId) ?? null, [activeTabId, tabs]);
  const activeDocument = activeTab?.document ?? null;
  const filteredAssets = useMemo(() => filterAssetsByQuery(assets, deferredAssetQuery), [assets, deferredAssetQuery]);
  const assetTree = useMemo(() => createAssetTree(filteredAssets), [filteredAssets]);
  const uiHierarchy = useMemo(
    () => (activeDocument?.kind === "ui-layout" ? buildUiHierarchy(activeDocument.nodes) : []),
    [activeDocument]
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

  const appendLog = (level: AppLogEntry["level"], message: string): void => {
    setLogs((current) => [...current.slice(-199), createLogEntry(level, message)]);
  };

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
    if (!dragState) return;
    const handlePointerMove = (event: PointerEvent) => {
      setTabs((current) =>
        current.map((tab) => {
          if (tab.document.id !== dragState.docId || tab.document.kind !== "ui-layout") return tab;
          return {
            ...tab,
            dirty: true,
            document: {
              ...tab.document,
              nodes: tab.document.nodes.map((node) =>
                node.id === dragState.nodeId
                  ? {
                      ...node,
                      x: Math.round(dragState.originX + (event.clientX - dragState.pointerStartX)),
                      y: Math.round(dragState.originY - (event.clientY - dragState.pointerStartY))
                    }
                  : node
              )
            }
          };
        })
      );
    };
    const handlePointerUp = () => setDragState(null);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [dragState]);

  useEffect(() => {
    const api = window as Window & { advanceTime?: (ms: number) => void; render_game_to_text?: () => string };
    api.advanceTime = () => undefined;
    api.render_game_to_text = () =>
      JSON.stringify({
        activeDocument: activeDocument ? { dirty: activeTab?.dirty ?? false, kind: activeDocument.kind, name: activeDocument.name } : null,
        assetCount: assets.length,
        dirtyTabs: tabs.filter((tab) => tab.dirty).map((tab) => tab.document.name),
        logs: logs.slice(-5).map((entry) => `${entry.level}:${entry.message}`),
        selectedAssetId,
        selectedUiNode: selectedUiNode ? describeLegacyNode(selectedUiNode) : null,
        workspace: workspaceLabel
      });
    return () => {
      api.advanceTime = undefined;
      api.render_game_to_text = undefined;
    };
  }, [activeDocument, activeTab?.dirty, assets.length, logs, selectedAssetId, selectedUiNode, tabs, workspaceLabel]);

  const replaceDocument = (documentId: string, updater: (document: EditorDocument) => EditorDocument): void => {
    setTabs((current) =>
      current.map((tab) => (tab.document.id === documentId ? { ...tab, dirty: true, document: updater(tab.document) } : tab))
    );
  };

  const handleOpenWorkspace = async (): Promise<void> => {
    setBusyAction("Open Workspace");
    try {
      const result = await openWorkspaceDirectory();
      startTransition(() => {
        setRootHandle(result.rootHandle);
        setWorkspaceLabel(result.label);
        setAssets(result.assets);
        setSelectedAssetId(result.assets[0]?.id ?? null);
      });
      appendLog("info", `Workspace loaded: ${result.label} (${result.assets.length} assets)`);
    } catch (error) {
      appendLog("error", `Open workspace failed: ${formatErrorMessage(error)}`);
    } finally {
      setBusyAction(null);
    }
  };

  const handleImportWorkspaceFiles = async (files: FileList | null): Promise<void> => {
    if (!files || files.length <= 0) return;
    setBusyAction("Import Folder");
    try {
      const result = await openWorkspaceFiles(files);
      startTransition(() => {
        setRootHandle(null);
        setWorkspaceLabel(result.label);
        setAssets(result.assets);
        setSelectedAssetId(result.assets[0]?.id ?? null);
      });
      appendLog("info", `Imported folder: ${result.label} (${result.assets.length} assets, read-only)`);
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
    setBusyAction("Rescan Workspace");
    try {
      const result = await scanWorkspace(rootHandle);
      startTransition(() => setAssets(result.assets));
      appendLog("info", `Workspace rescanned: ${result.assets.length} assets`);
    } catch (error) {
      appendLog("error", `Rescan failed: ${formatErrorMessage(error)}`);
    } finally {
      setBusyAction(null);
    }
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
      const document = await openAssetDocument(asset, assets);
      setTabs((current) => [...current, { asset, dirty: false, document }]);
      setActiveTabId(document.id);
      appendLog("info", `Opened ${asset.kind} asset: ${asset.path}`);
    } catch (error) {
      appendLog("error", `Open asset failed for ${asset.path}: ${formatErrorMessage(error)}`);
    } finally {
      setBusyAction(null);
    }
  };

  const handleCloseTab = (documentId: string): void => {
    const closingIndex = tabs.findIndex((tab) => tab.document.id === documentId);
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
    setSelectedUiNodeIdByDoc((current) => ({ ...current, [document.id]: document.nodes[0]?.id ?? null }));
    appendLog("info", `Created new UI layout document: ${document.name}`);
  };

  const handleOpenAvatarLab = async (): Promise<void> => {
    const existing = tabs.find((tab) => tab.document.kind === "avatar-preview");
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
    const existing = tabs.find((tab) => tab.document.kind === "effect-preview");
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

  const handleSaveActiveDocument = async (): Promise<void> => {
    if (!activeTab) {
      appendLog("warn", "Save ignored because there is no active document.");
      return;
    }
    const currentDocument = activeTab.document;
    if (currentDocument.kind !== "ui-layout" && currentDocument.kind !== "map" && currentDocument.kind !== "text") {
      appendLog("warn", `${currentDocument.kind} is currently read-only in the editor shell.`);
      return;
    }
    setBusyAction(`Save ${currentDocument.name}`);
    try {
      const existingHandle = activeTab.asset?.handle ?? null;
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
      if (currentDocument.kind === "ui-layout") await writeTextFile(pickedHandle, serializeLegacyUILayout(currentDocument.nodes, currentDocument.sourceFormat));
      if (currentDocument.kind === "map") await writeBinaryFile(pickedHandle, serializeMapDocument(currentDocument));
      if (currentDocument.kind === "text") await writeTextFile(pickedHandle, currentDocument.text);
      setTabs((current) => current.map((tab) => tab.document.id === currentDocument.id ? {
        ...tab,
        asset: tab.asset ? { ...tab.asset, handle: pickedHandle, name: pickedHandle.name } : tab.asset,
        dirty: false
      } : tab));
      appendLog("info", `Saved document: ${currentDocument.name}`);
      if (rootHandle) setAssets((await scanWorkspace(rootHandle)).assets);
    } catch (error) {
      appendLog("error", `Save failed: ${formatErrorMessage(error)}`);
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

  return (
    <div className="studio-shell">
      <header className="toolbar">
        <div className="toolbar__brand"><div className="toolbar__badge">BRM</div><div><strong>UI Studio</strong><p>Legacy UI / Atlas / BIZ / MAPO integrated editor</p></div></div>
        <div className="toolbar__actions">
          <button type="button" className="toolbar__button toolbar__button--primary" onClick={handleOpenWorkspace}>Open Workspace</button>
          <button type="button" className="toolbar__button" onClick={() => uploadInputRef.current?.click()}>Import Folder</button>
          <button type="button" className="toolbar__button" onClick={handleRescanWorkspace}>Rescan</button>
          <button type="button" className="toolbar__button" onClick={handleCreateUiDocument}>New UI Layout</button>
          <button type="button" className="toolbar__button" disabled={assets.length <= 0} onClick={() => { void handleOpenAvatarLab(); }}>Avatar Lab</button>
          <button type="button" className="toolbar__button" disabled={assets.length <= 0} onClick={() => { void handleOpenEffectLab(); }}>Effect Lab</button>
          <button type="button" className="toolbar__button" onClick={handleSaveActiveDocument}>Save</button>
        </div>
        <div className="toolbar__status"><span>{workspaceLabel ? `Workspace: ${workspaceLabel}` : "No workspace mounted"}</span><span>{assets.length} assets</span><span>{busyAction ?? "Idle"}</span></div>
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
      <main className="workspace-grid">
        <section className="panel panel--asset-browser">
          <div className="panel__header"><div><h2>Assets</h2><p>Browse legacy resources and open documents.</p></div><span className="panel__meta">{filteredAssets.length}</span></div>
          <div className="panel__toolbar"><input value={assetQuery} onChange={(event) => setAssetQuery(event.target.value)} className="panel__search" placeholder="Search path, kind or extension" /></div>
          <div className="panel__body panel__body--scroll">{assetTree.length > 0 ? <AssetBrowserTree nodes={assetTree} selectedAssetId={selectedAssetId} onOpenAsset={(asset) => { void handleOpenAsset(asset); }} onSelectAsset={setSelectedAssetId} /> : <EmptyState title="Workspace not loaded" body="Use Open Workspace and pick a project root containing legacy ui, biz, uipic, map and script assets." />}</div>
        </section>
        <section className="panel panel--center">
          <div className="tabs">{tabs.length > 0 ? tabs.map((tab) => <button key={tab.document.id} type="button" className={`tab${tab.document.id === activeTabId ? " tab--active" : ""}`} onClick={() => setActiveTabId(tab.document.id)}><span>{tab.document.name}</span>{tab.dirty ? <span className="tab__dirty">•</span> : null}<span className="tab__close" role="button" tabIndex={0} onClick={(event) => { event.stopPropagation(); handleCloseTab(tab.document.id); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); handleCloseTab(tab.document.id); } }}>×</span></button>) : <div className="tabs__placeholder">No document open</div>}</div>
          <div className="panel__body panel__body--workspace">{activeDocument ? <PreviewPane activeDocument={activeDocument} assets={assets} atlasFrameSelection={activeDocument.kind === "atlas" ? selectedAtlasFrame?.name ?? null : null} bizFileIndex={activeDocument.kind === "biz" ? selectedBizFileByDoc[activeDocument.id] ?? 0 : 0} bizFrameId={activeDocument.kind === "biz" ? selectedBizFrame?.frameId ?? null : null} mapCellSelection={activeDocument.kind === "map" ? selectedMapCell : null} onAtlasFrameSelect={(frameName) => activeDocument.kind === "atlas" ? setSelectedAtlasFrameByDoc((current) => ({ ...current, [activeDocument.id]: frameName })) : undefined} onBizFileSelect={(fileIndex) => activeDocument.kind === "biz" ? setSelectedBizFileByDoc((current) => ({ ...current, [activeDocument.id]: fileIndex })) : undefined} onBizFrameSelect={(frameId) => activeDocument.kind === "biz" ? setSelectedBizFrameByDoc((current) => ({ ...current, [activeDocument.id]: frameId })) : undefined} onChangeTextDocument={(text) => activeDocument.kind === "text" ? replaceDocument(activeDocument.id, (document) => document.kind === "text" ? { ...document, text } : document) : undefined} onMapPaint={(x, y) => { if (activeDocument.kind !== "map") return; const index = y * activeDocument.logicWidth + x; if (index < 0 || index >= activeDocument.blockData.length) return; setSelectedMapCellByDoc((current) => ({ ...current, [activeDocument.id]: { x, y } })); replaceDocument(activeDocument.id, (document) => document.kind === "map" ? (() => { const next = new Uint8Array(document.blockData); next[index] = mapBrushValue; return { ...document, blockData: next }; })() : document); }} onSelectUiNode={(nodeId) => activeDocument.kind === "ui-layout" ? setSelectedUiNodeIdByDoc((current) => ({ ...current, [activeDocument.id]: nodeId })) : undefined} selectedUiNodeId={activeDocument.kind === "ui-layout" ? selectedUiNode?.id ?? null : null} onBeginUiDrag={(node, event) => { if (activeDocument.kind !== "ui-layout") return; event.preventDefault(); setSelectedUiNodeIdByDoc((current) => ({ ...current, [activeDocument.id]: node.id })); setDragState({ docId: activeDocument.id, nodeId: node.id, originX: typeof node.x === "number" ? node.x : 0, originY: typeof node.y === "number" ? node.y : 0, pointerStartX: event.clientX, pointerStartY: event.clientY }); }} /> : <WelcomeHome onCreateUiDocument={handleCreateUiDocument} />}</div>
        </section>
        <section className="panel panel--hierarchy">
          <div className="panel__header"><div><h2>Hierarchy</h2><p>Node tree and document structure.</p></div>{activeDocument?.kind === "ui-layout" ? <div className="panel__actions"><button type="button" className="chip" onClick={() => { const parentId = selectedUiNode?.id ?? activeDocument.nodes[0]?.id ?? 0; const nextId = Math.max(0, ...activeDocument.nodes.map((node) => node.id)) + 1; replaceDocument(activeDocument.id, (document) => document.kind === "ui-layout" ? { ...document, nodes: [...document.nodes, { id: nextId, parent: parentId, type: 1, n: `Node${nextId}`, x: 24, y: -24, w: 120, h: 48, ax: 0.5, ay: 0.5, color: "#2E4B6B" }] } : document); setSelectedUiNodeIdByDoc((current) => ({ ...current, [activeDocument.id]: nextId })); appendLog("info", `Added child node ${nextId} under ${parentId}`); }}>Add Child</button><button type="button" className="chip chip--danger" onClick={() => { if (!selectedUiNode || selectedUiNode.parent === 0) { appendLog("warn", "Root UI node cannot be removed."); return; } const removedIds = collectDescendantIds(activeDocument.nodes, selectedUiNode.id); replaceDocument(activeDocument.id, (document) => document.kind === "ui-layout" ? { ...document, nodes: document.nodes.filter((node) => !removedIds.has(node.id)) } : document); setSelectedUiNodeIdByDoc((current) => ({ ...current, [activeDocument.id]: activeDocument.nodes.find((node) => !removedIds.has(node.id))?.id ?? null })); appendLog("info", `Removed ${removedIds.size} UI node(s) from layout.`); }}>Remove</button></div> : null}</div>
          <div className="panel__body panel__body--scroll">{activeDocument?.kind === "ui-layout" ? <HierarchyTree roots={uiHierarchy} selectedNodeId={selectedUiNode?.id ?? null} onSelectNode={(nodeId) => setSelectedUiNodeIdByDoc((current) => ({ ...current, [activeDocument.id]: nodeId }))} /> : <EmptyState title="Hierarchy unavailable" body="Open a UI layout document to inspect node relationships and edit the scene graph." />}</div>
        </section>
        <section className="panel panel--inspector">
          <div className="panel__header"><div><h2>Inspector</h2><p>Document metadata and editable properties.</p></div>{activeDocument ? <span className="panel__meta">{activeDocument.kind}</span> : null}</div>
          <div className="panel__body panel__body--scroll"><InspectorPane activeDocument={activeDocument} mapBrushValue={mapBrushValue} onChangeMapBrush={setMapBrushValue} onChangeTextDocument={(text) => activeDocument?.kind === "text" ? replaceDocument(activeDocument.id, (document) => document.kind === "text" ? { ...document, text } : document) : undefined} onChangeAvatarDocument={(patch) => activeDocument?.kind === "avatar-preview" ? replaceDocument(activeDocument.id, (document) => document.kind === "avatar-preview" ? { ...document, ...patch } : document) : undefined} onChangeEffectDocument={(patch) => activeDocument?.kind === "effect-preview" ? replaceDocument(activeDocument.id, (document) => document.kind === "effect-preview" ? { ...document, ...patch } : document) : undefined} onChangeUiFormat={(format) => activeDocument?.kind === "ui-layout" ? replaceDocument(activeDocument.id, (document) => document.kind === "ui-layout" ? { ...document, sourceFormat: format } : document) : undefined} onUpdateUiNode={handleUpdateUiNode} selectedAtlasFrame={selectedAtlasFrame} selectedBizDocumentFile={selectedBizFile} selectedBizFrame={selectedBizFrame} selectedMapCell={selectedMapCell} selectedUiNode={selectedUiNode} /></div>
        </section>
        <section className="panel panel--logs">
          <div className="panel__header"><div><h2>Logs</h2><p>Build, parsing and workflow events.</p></div><button type="button" className="chip" onClick={() => setLogs([])}>Clear</button></div>
          <div className="panel__body panel__body--scroll">{logs.length > 0 ? <ul className="log-list">{logs.map((entry) => <li key={entry.id} className={`log-list__item log-list__item--${entry.level}`}><span>{entry.level.toUpperCase()}</span><p>{entry.message}</p></li>)}</ul> : <EmptyState title="No logs" body="Editor events and parser diagnostics will appear here." />}</div>
        </section>
      </main>
    </div>
  );
}

export default App;
