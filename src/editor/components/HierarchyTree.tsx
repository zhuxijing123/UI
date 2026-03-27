import { useEffect, useRef, useState } from "react";

import type { UiHierarchyNode } from "../types";
import { describeLegacyNode, describeLegacyNodeType } from "../view-model";
import { useTranslation } from "../i18n/useTranslation";

type HierarchyTreeProps = {
  expandSignal: number;
  forceExpanded: boolean;
  roots: UiHierarchyNode[];
  selectedNodeId: number | null;
  onSelectNode: (nodeId: number) => void;
  onDeleteNode?: (nodeId: number) => void;
  onToggleVisibility?: (nodeId: number) => void;
  onToggleLock?: (nodeId: number) => void;
  onContextMenu?: (e: React.MouseEvent, nodeId: number) => void;
  onEmptyContextMenu?: (e: React.MouseEvent) => void;
};

export function HierarchyTree({
  expandSignal,
  forceExpanded,
  roots,
  selectedNodeId,
  onSelectNode,
  onDeleteNode,
  onToggleVisibility,
  onToggleLock,
  onContextMenu,
  onEmptyContextMenu
}: HierarchyTreeProps) {
  return (
    <ul className="tree" onContextMenu={onEmptyContextMenu}>
      {roots.map((root) => (
        <HierarchyTreeNode
          expandSignal={expandSignal}
          forceExpanded={forceExpanded}
          key={root.node.id}
          node={root}
          selectedNodeId={selectedNodeId}
          onSelectNode={onSelectNode}
          onDeleteNode={onDeleteNode}
          onToggleVisibility={onToggleVisibility}
          onToggleLock={onToggleLock}
          onContextMenu={onContextMenu}
        />
      ))}
    </ul>
  );
}

function HierarchyTreeNode({
  expandSignal,
  forceExpanded,
  node,
  selectedNodeId,
  onSelectNode,
  onDeleteNode,
  onToggleVisibility,
  onToggleLock,
  onContextMenu
}: {
  expandSignal: number;
  forceExpanded: boolean;
  node: UiHierarchyNode;
  selectedNodeId: number | null;
  onSelectNode: (nodeId: number) => void;
  onDeleteNode?: (nodeId: number) => void;
  onToggleVisibility?: (nodeId: number) => void;
  onToggleLock?: (nodeId: number) => void;
  onContextMenu?: (e: React.MouseEvent, nodeId: number) => void;
}) {
  const { t } = useTranslation();
  const detailsRef = useRef<HTMLDetailsElement | null>(null);
  const label = typeof node.node.n === "string" && node.node.n.trim() ? node.node.n : `Node${node.node.id}`;
  const nodeType = describeLegacyNodeType(node.node.type);
  const nodeTypeAbbr = nodeType.slice(0, 3).toUpperCase();

  const [isVisible, setIsVisible] = useState(true);
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    if (!detailsRef.current) return;
    detailsRef.current.open = forceExpanded;
  }, [expandSignal, forceExpanded]);

  const handleToggleVisibility = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsVisible(!isVisible);
    onToggleVisibility?.(node.node.id);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDeleteNode?.(node.node.id);
  };

  const handleToggleLock = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsLocked(!isLocked);
    onToggleLock?.(node.node.id);
  };

  const renderActions = () => (
    <div className="tree__actions">
      <button
        type="button"
        className={`tree__action-btn tree__action-btn--visibility${!isVisible ? " tree__action-btn--disabled" : ""}`}
        onClick={handleToggleVisibility}
        title={t('hierarchy.toggleVisibility')}
        aria-label={t('hierarchy.toggleVisibility')}
      >
        {isVisible ? "\u{1F441}" : "\u{1F576}"}
      </button>
      <button
        type="button"
        className="tree__action-btn tree__action-btn--delete"
        onClick={handleDelete}
        title={t('hierarchy.deleteNode')}
        aria-label={t('hierarchy.deleteNode')}
      >
        {"\u{1F5D1}"}
      </button>
      <button
        type="button"
        className={`tree__action-btn tree__action-btn--lock${isLocked ? " tree__action-btn--active" : ""}`}
        onClick={handleToggleLock}
        title={isLocked ? t('hierarchy.unlockNode') : t('hierarchy.lockNode')}
        aria-label={isLocked ? t('hierarchy.unlockNode') : t('hierarchy.lockNode')}
      >
        {isLocked ? "\u{1F512}" : "\u{1F513}"}
      </button>
    </div>
  );

  const content = (
    <button
      type="button"
      className={`tree__asset tree__asset--hierarchy${selectedNodeId === node.node.id ? " tree__asset--selected" : ""}`}
      onClick={() => onSelectNode(node.node.id)}
      onContextMenu={(e) => onContextMenu?.(e, node.node.id)}
      title={`${label} (${nodeType})`}
    >
      <div className="tree__entry-main">
        <span className="tree__icon tree__icon--asset" title={`${t('hierarchy.nodeType')}: ${nodeType}`}>{nodeTypeAbbr}</span>
        <div className="tree__entry-copy">
          <span className="tree__entry-label">{label}</span>
        </div>
      </div>
      {renderActions()}
    </button>
  );

  if (node.children.length === 0) {
    return <li className="tree__item">{content}</li>;
  }

  return (
    <li className="tree__item">
      <details ref={detailsRef} open={forceExpanded} className="tree__folder">
        <summary
          className="tree__summary tree__summary--hierarchy"
          title={`${label} (${nodeType})`}
          onClick={() => onSelectNode(node.node.id)}
          onContextMenu={(e) => onContextMenu?.(e, node.node.id)}
        >
          <div className="tree__entry-main">
            <span className="tree__caret">{">"}</span>
            <span className="tree__icon tree__icon--asset" title={`${t('hierarchy.nodeType')}: ${nodeType}`}>{nodeTypeAbbr}</span>
            <div className="tree__entry-copy">
              <span className="tree__entry-label">{label}</span>
            </div>
          </div>
          <div className="tree__entry-side">
            <small className="tree__count">{node.children.length}</small>
            {renderActions()}
          </div>
        </summary>
        <div className="tree__children">
          <ul className="tree">
            {node.children.map((child) => (
              <HierarchyTreeNode
                expandSignal={expandSignal}
                forceExpanded={forceExpanded}
                key={child.node.id}
                node={child}
                selectedNodeId={selectedNodeId}
                onSelectNode={onSelectNode}
                onDeleteNode={onDeleteNode}
                onToggleVisibility={onToggleVisibility}
                onToggleLock={onToggleLock}
                onContextMenu={onContextMenu}
              />
            ))}
          </ul>
        </div>
      </details>
    </li>
  );
}
