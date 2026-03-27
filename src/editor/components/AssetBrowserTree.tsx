import { useEffect, useRef } from "react";

import type { MouseEvent } from "react";

import type { WorkspaceAsset } from "../types";
import type { AssetTreeNode } from "../view-model";

type AssetBrowserTreeProps = {
  expandSignal: number;
  forceExpanded: boolean;
  nodes: AssetTreeNode[];
  selectedAssetId: string | null;
  onOpenAsset: (asset: WorkspaceAsset) => void;
  onAssetContextMenu: (e: MouseEvent, assetOrFolder: { asset: WorkspaceAsset } | { path: string; name: string; kind: "folder" }) => void;
  onSelectAsset: (assetId: string) => void;
  onEmptyContextMenu?: (e: React.MouseEvent) => void;
};

// Icon mapping for asset kinds - using Unicode symbols for compact display
const ASSET_KIND_ICONS: Record<string, string> = {
  "ui-layout": "\u{1F4CA}", // chart (UI layout)
  "atlas": "\u{1F3A8}", // palette (atlas)
  "bitmap-font": "\u{1F524}", // abc (font)
  "biz": "\u{1F4C1}", // file folder (biz data)
  "map": "\u{1F5FA}", // map (map)
  "image": "\u{1F5BC}", // framed picture (image)
  "text": "\u{1F4C4}" // page facing up (text)
};

// Simple folder icon for all folders
const FOLDER_ICON = "\u{1F4C1}"; // 📁

function getAssetIcon(kind: string, iconCode: string): string {
  return ASSET_KIND_ICONS[kind] || iconCode;
}

export function AssetBrowserTree({
  expandSignal,
  forceExpanded,
  nodes,
  selectedAssetId,
  onOpenAsset,
  onAssetContextMenu,
  onSelectAsset,
  onEmptyContextMenu
}: AssetBrowserTreeProps) {
  return (
    <ul className="tree" onContextMenu={onEmptyContextMenu}>
      {nodes.map((node) =>
        node.kind === "folder" ? (
          <AssetFolderNode
            expandSignal={expandSignal}
            forceExpanded={forceExpanded}
            key={node.id}
            node={node}
            selectedAssetId={selectedAssetId}
            onOpenAsset={onOpenAsset}
            onAssetContextMenu={onAssetContextMenu}
            onSelectAsset={onSelectAsset}
          />
        ) : (
          <li key={node.id} className="tree__item">
            <button
              type="button"
              className={`tree__asset tree__asset--compact${selectedAssetId === node.asset.id ? " tree__asset--selected" : ""}`}
              onClick={() => onSelectAsset(node.asset.id)}
              onDoubleClick={() => onOpenAsset(node.asset)}
              onContextMenu={(e) => onAssetContextMenu(e, { asset: node.asset })}
              title={`${node.asset.name}\n${node.asset.path}\n${node.kindLabel}`}
            >
              <div className="tree__entry-main">
                <span className="tree__icon tree__icon--emoji" title={node.kindLabel}>
                  {getAssetIcon(node.asset.kind, node.icon)}
                </span>
                <span className="tree__entry-label">{node.asset.name}</span>
              </div>
              <div className="tree__badges tree__badges--compact">
                {node.familyLabel ? (
                  <span className="tree__badge-icon" title={node.familyLabel}>
                    {node.familyLabel.slice(0, 2)}
                  </span>
                ) : null}
                <span className="tree__badge-icon tree__badge-icon--muted" title={node.extensionLabel}>
                  {node.extensionLabel.slice(0, 3)}
                </span>
              </div>
            </button>
          </li>
        )
      )}
    </ul>
  );
}

function AssetFolderNode({
  expandSignal,
  forceExpanded,
  node,
  selectedAssetId,
  onOpenAsset,
  onAssetContextMenu,
  onSelectAsset
}: {
  expandSignal: number;
  forceExpanded: boolean;
  node: Extract<AssetTreeNode, { kind: "folder" }>;
  selectedAssetId: string | null;
  onOpenAsset: (asset: WorkspaceAsset) => void;
  onAssetContextMenu: (e: MouseEvent, assetOrFolder: { asset: WorkspaceAsset } | { path: string; name: string; kind: "folder" }) => void;
  onSelectAsset: (assetId: string) => void;
}) {
  const detailsRef = useRef<HTMLDetailsElement | null>(null);

  useEffect(() => {
    if (!detailsRef.current) return;
    detailsRef.current.open = forceExpanded;
  }, [expandSignal, forceExpanded]);

  return (
    <li className="tree__item">
      <details ref={detailsRef} className="tree__folder" open={forceExpanded}>
        <summary
          className="tree__summary tree__summary--compact"
          title={`${node.name}\n${node.meta || node.path}\n${node.assetCount} items`}
          onContextMenu={(e) => onAssetContextMenu(e, { kind: "folder", name: node.name, path: node.path })}
        >
          <div className="tree__entry-main">
            <span className="tree__caret">{">"}</span>
            <span className="tree__icon tree__icon--emoji" title="Folder">
              {FOLDER_ICON}
            </span>
            <span className="tree__entry-label">{node.name}</span>
          </div>
          <div className="tree__entry-side">
            <small className="tree__count">{node.assetCount}</small>
          </div>
        </summary>
        <div className="tree__children">
          <AssetBrowserTree
            expandSignal={expandSignal}
            forceExpanded={forceExpanded}
            nodes={node.children}
            selectedAssetId={selectedAssetId}
            onOpenAsset={onOpenAsset}
            onAssetContextMenu={onAssetContextMenu}
            onSelectAsset={onSelectAsset}
          />
        </div>
      </details>
    </li>
  );
}
