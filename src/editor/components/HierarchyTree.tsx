import type { UiHierarchyNode } from "../types";
import { describeLegacyNode, describeLegacyNodeType } from "../view-model";

type HierarchyTreeProps = {
  roots: UiHierarchyNode[];
  selectedNodeId: number | null;
  onSelectNode: (nodeId: number) => void;
};

export function HierarchyTree({ roots, selectedNodeId, onSelectNode }: HierarchyTreeProps) {
  return (
    <ul className="tree">
      {roots.map((root) => (
        <HierarchyTreeNode
          key={root.node.id}
          node={root}
          selectedNodeId={selectedNodeId}
          onSelectNode={onSelectNode}
        />
      ))}
    </ul>
  );
}

function HierarchyTreeNode({
  node,
  selectedNodeId,
  onSelectNode
}: {
  node: UiHierarchyNode;
  selectedNodeId: number | null;
  onSelectNode: (nodeId: number) => void;
}) {
  const content = (
    <button
      type="button"
      className={`tree__asset${selectedNodeId === node.node.id ? " tree__asset--selected" : ""}`}
      onClick={() => onSelectNode(node.node.id)}
      title={describeLegacyNode(node.node)}
    >
      <span>{typeof node.node.n === "string" && node.node.n.trim() ? node.node.n : `Node${node.node.id}`}</span>
      <small>{describeLegacyNodeType(node.node.type)}</small>
    </button>
  );

  if (node.children.length === 0) {
    return <li className="tree__item">{content}</li>;
  }

  return (
    <li className="tree__item">
      <details open className="tree__folder">
        <summary>{content}</summary>
        <ul className="tree">
          {node.children.map((child) => (
            <HierarchyTreeNode
              key={child.node.id}
              node={child}
              selectedNodeId={selectedNodeId}
              onSelectNode={onSelectNode}
            />
          ))}
        </ul>
      </details>
    </li>
  );
}
