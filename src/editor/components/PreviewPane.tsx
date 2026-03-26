import type { PointerEvent } from "react";

import { getAtlasFrameBySelection, getBizFileBySelection, getBizFrameBySelection, type MapCell } from "../app-utils";
import { describeLegacyNodeType, type UiViewportNode } from "../view-model";
import type { EditorDocument, GenericTextDocument, LegacyUILayoutNode } from "../types";
import { EmptyState } from "./EmptyState";
import { MapDocumentCanvas } from "./MapDocumentCanvas";

type PreviewPaneProps = {
  activeDocument: EditorDocument;
  atlasFrameSelection: string | null;
  bizFileIndex: number;
  bizFrameId: number | null;
  mapCellSelection: MapCell | null;
  onAtlasFrameSelect: (frameName: string) => void;
  onBizFileSelect: (fileIndex: number) => void;
  onBizFrameSelect: (frameId: number) => void;
  onChangeTextDocument: (text: string) => void;
  onMapPaint: (x: number, y: number) => void;
  onSelectUiNode: (nodeId: number) => void;
  selectedUiNodeId: number | null;
  viewportNodes: UiViewportNode[];
  onBeginUiDrag: (node: LegacyUILayoutNode, event: PointerEvent<HTMLButtonElement>) => void;
};

export function PreviewPane({
  activeDocument,
  atlasFrameSelection,
  bizFileIndex,
  bizFrameId,
  mapCellSelection,
  onAtlasFrameSelect,
  onBizFileSelect,
  onBizFrameSelect,
  onChangeTextDocument,
  onMapPaint,
  onSelectUiNode,
  selectedUiNodeId,
  viewportNodes,
  onBeginUiDrag
}: PreviewPaneProps) {
  if (activeDocument.kind === "ui-layout") {
    return (
      <div className="workspace-surface">
        <div className="workspace-surface__header">
          <h3>UI Layout Viewport</h3>
          <p>Drag nodes directly on the stage, then fine tune values in the Inspector.</p>
        </div>
        <div className="viewport">
          <div className="viewport__stage">
            {viewportNodes.map((node) => (
              <button
                key={node.id}
                type="button"
                className={`viewport-node viewport-node--type-${node.node.type}${
                  selectedUiNodeId === node.id ? " viewport-node--selected" : ""
                }`}
                style={{
                  height: `${node.height}px`,
                  left: `${node.left}px`,
                  top: `${node.top}px`,
                  width: `${node.width}px`,
                  zIndex: 20 + node.depth
                }}
                onClick={() => onSelectUiNode(node.id)}
                onPointerDown={(event) => onBeginUiDrag(node.node, event)}
                title={`${describeLegacyNodeType(node.node.type)} · ${Math.round(node.node.x ?? 0)}, ${Math.round(
                  node.node.y ?? 0
                )}`}
              >
                <span>{typeof node.node.n === "string" && node.node.n.trim() ? node.node.n : `Node${node.id}`}</span>
                <small>{describeLegacyNodeType(node.node.type)}</small>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (activeDocument.kind === "atlas") {
    const selectedFrame = getAtlasFrameBySelection(activeDocument, atlasFrameSelection);
    return (
      <div className="workspace-surface workspace-surface--split">
        <div className="workspace-surface__canvas">
          <div className="workspace-surface__header">
            <h3>Atlas / Plist Preview</h3>
            <p>Inspect parsed frames and validate sprite sheet trimming metadata.</p>
          </div>
          {activeDocument.imageUrl ? (
            <div className="atlas-preview">
              <img src={activeDocument.imageUrl} alt={activeDocument.name} />
              {selectedFrame ? (
                <div
                  className="atlas-preview__frame"
                  style={{
                    height: `${selectedFrame.frame.h}px`,
                    left: `${selectedFrame.frame.x}px`,
                    top: `${selectedFrame.frame.y}px`,
                    width: `${selectedFrame.frame.w}px`
                  }}
                />
              ) : null}
            </div>
          ) : (
            <EmptyState title="No texture found" body="Place a sibling png/jpg/webp file next to the atlas to enable preview." />
          )}
        </div>
        <div className="workspace-surface__sidebar">
          <div className="workspace-surface__header">
            <h3>Frames</h3>
            <p>{activeDocument.frames.length} entries</p>
          </div>
          <ul className="frame-list">
            {activeDocument.frames.map((frame) => (
              <li key={frame.name}>
                <button
                  type="button"
                  className={`frame-list__button${selectedFrame?.name === frame.name ? " frame-list__button--selected" : ""}`}
                  onClick={() => onAtlasFrameSelect(frame.name)}
                >
                  <span>{frame.name}</span>
                  <small>
                    {frame.frame.w} × {frame.frame.h}
                  </small>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  if (activeDocument.kind === "biz") {
    const selectedFile = getBizFileBySelection(activeDocument, bizFileIndex);
    const selectedFrame = getBizFrameBySelection(selectedFile, bizFrameId);
    return (
      <div className="workspace-surface workspace-surface--split">
        <div className="workspace-surface__canvas">
          <div className="workspace-surface__header">
            <h3>BIZ Animation Bank</h3>
            <p>Inspect animation file groups, frame coordinates and optional sprite sheet alignment.</p>
          </div>
          {activeDocument.imageUrl ? (
            <div className="atlas-preview">
              <img src={activeDocument.imageUrl} alt={activeDocument.name} />
              {selectedFrame ? (
                <div
                  className="atlas-preview__frame"
                  style={{
                    height: `${selectedFrame.h}px`,
                    left: `${selectedFrame.x}px`,
                    top: `${selectedFrame.y}px`,
                    width: `${selectedFrame.w}px`
                  }}
                />
              ) : null}
            </div>
          ) : (
            <EmptyState
              title="No sheet texture attached"
              body="BIZ parsing is active. Add a sibling image next to the .biz file to overlay frame bounds."
            />
          )}
        </div>
        <div className="workspace-surface__sidebar">
          <div className="workspace-surface__header">
            <h3>Files</h3>
            <p>{activeDocument.files.length} file groups</p>
          </div>
          <ul className="frame-list">
            {activeDocument.files.map((file, index) => (
              <li key={`${file.fileId}-${index}`}>
                <button
                  type="button"
                  className={`frame-list__button${selectedFile?.fileId === file.fileId ? " frame-list__button--selected" : ""}`}
                  onClick={() => onBizFileSelect(index)}
                >
                  <span>{file.fileId}</span>
                  <small>
                    {file.dirCount} dir · {file.frames.length} frames
                  </small>
                </button>
              </li>
            ))}
          </ul>
          {selectedFile ? (
            <>
              <div className="workspace-surface__header">
                <h3>Frames</h3>
                <p>{selectedFile.frames.length} entries</p>
              </div>
              <ul className="frame-list">
                {selectedFile.frames.map((frame) => (
                  <li key={frame.frameId}>
                    <button
                      type="button"
                      className={`frame-list__button${selectedFrame?.frameId === frame.frameId ? " frame-list__button--selected" : ""}`}
                      onClick={() => onBizFrameSelect(frame.frameId)}
                    >
                      <span>
                        {frame.dir}:{frame.frameIndex}
                      </span>
                      <small>
                        {frame.w} × {frame.h}
                      </small>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      </div>
    );
  }

  if (activeDocument.kind === "map") {
    return (
      <div className="workspace-surface">
        <div className="workspace-surface__header">
          <h3>MAPO Block Editor</h3>
          <p>Paint logic cells directly and save the run-length encoded map back to disk.</p>
        </div>
        <MapDocumentCanvas document={activeDocument} selectedCell={mapCellSelection} onPaint={onMapPaint} />
      </div>
    );
  }

  if (activeDocument.kind === "image") {
    return (
      <div className="workspace-surface">
        <div className="workspace-surface__header">
          <h3>Image Viewer</h3>
          <p>Static preview of source texture or UI asset.</p>
        </div>
        <div className="image-preview">
          <img src={activeDocument.imageUrl} alt={activeDocument.name} />
        </div>
      </div>
    );
  }

  return (
    <div className="workspace-surface">
      <div className="workspace-surface__header">
        <h3>Text / Meta Document</h3>
        <p>Edit text-based resources such as diz, tiz, lua, ini, json and csv files.</p>
      </div>
      <textarea
        className="text-editor"
        value={activeDocument.text}
        onChange={(event) => onTextDocumentChange(activeDocument, event.target.value)}
      />
    </div>
  );

  function onTextDocumentChange(document: GenericTextDocument, text: string): void {
    if (document.kind !== "text") return;
    onChangeTextDocument(text);
  }
}
