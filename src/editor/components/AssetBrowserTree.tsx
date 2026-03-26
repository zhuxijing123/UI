import type { WorkspaceAsset } from "../types";
import type { AssetTreeNode } from "../view-model";

type AssetBrowserTreeProps = {
  nodes: AssetTreeNode[];
  selectedAssetId: string | null;
  onOpenAsset: (asset: WorkspaceAsset) => void;
  onSelectAsset: (assetId: string) => void;
};

export function AssetBrowserTree({
  nodes,
  selectedAssetId,
  onOpenAsset,
  onSelectAsset
}: AssetBrowserTreeProps) {
  return (
    <ul className="tree">
      {nodes.map((node) =>
        node.kind === "folder" ? (
          <li key={node.id} className="tree__item">
            <details open className="tree__folder">
              <summary>
                <span>{node.name}</span>
                <small>{node.children.length}</small>
              </summary>
              <AssetBrowserTree
                nodes={node.children}
                selectedAssetId={selectedAssetId}
                onOpenAsset={onOpenAsset}
                onSelectAsset={onSelectAsset}
              />
            </details>
          </li>
        ) : (
          <li key={node.id} className="tree__item">
            <button
              type="button"
              className={`tree__asset${selectedAssetId === node.asset.id ? " tree__asset--selected" : ""}`}
              onClick={() => onSelectAsset(node.asset.id)}
              onDoubleClick={() => onOpenAsset(node.asset)}
              title={node.asset.path}
            >
              <span>{node.asset.name}</span>
              <small>{node.asset.kind}</small>
            </button>
          </li>
        )
      )}
    </ul>
  );
}
