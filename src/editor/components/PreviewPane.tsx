import type { MouseEvent } from "react";

import { getAtlasFrameBySelection, getBizFileBySelection, getBizFrameBySelection, type MapCell } from "../app-utils";
import { useTranslation } from "../i18n/useTranslation";
import { findBizFileById, resolveAvatarFileCandidates } from "../legacy-labs";
import type { EditorDocument, GenericTextDocument, LegacyUILayoutNode, WorkspaceAsset } from "../types";
import { AvatarPreviewCanvas } from "./AvatarPreviewCanvas";
import { EmptyState } from "./EmptyState";
import { EffectPreviewCanvas } from "./EffectPreviewCanvas";
import { LegacyUiLayoutViewport } from "./LegacyUiLayoutViewport";
import { MapDocumentCanvas } from "./MapDocumentCanvas";

type PreviewPaneProps = {
  activeDocument: EditorDocument;
  assets: WorkspaceAsset[];
  atlasFrameSelection: string | null;
  bizFileIndex: number;
  bizFrameId: number | null;
  mapCellSelection: MapCell | null;
  stageMode: "scene" | "preview";
  sceneTool: "hand" | "move" | "rotate" | "scale" | "rect";
  sceneZoom: "fit" | "100";
  onAtlasFrameSelect: (frameName: string) => void;
  onBizFileSelect: (fileIndex: number) => void;
  onBizFrameSelect: (frameId: number) => void;
  onChangeAvatarDocument: (patch: { cloth?: number; weapon?: number; dir?: number; state?: number }) => void;
  onChangeEffectDocument: (patch: { fileId?: number; dir?: number; delay?: number; loop?: boolean }) => void;
  onChangeTextDocument: (text: string) => void;
  onMapPaint: (x: number, y: number) => void;
  onSceneContextMenu?: (e: MouseEvent) => void;
  onSelectUiNode: (nodeId: number) => void;
  selectedUiNodeId: number | null;
  onBeginUiDrag: (
    node: LegacyUILayoutNode,
    mode: "move" | "rect" | "scale" | "rotate",
    event: MouseEvent<HTMLElement>,
    scale: number
  ) => void;
};

export function PreviewPane({
  activeDocument,
  assets,
  atlasFrameSelection,
  bizFileIndex,
  bizFrameId,
  mapCellSelection,
  stageMode,
  sceneTool,
  sceneZoom,
  onAtlasFrameSelect,
  onBizFileSelect,
  onBizFrameSelect,
  onChangeAvatarDocument,
  onChangeEffectDocument,
  onChangeTextDocument,
  onMapPaint,
  onSceneContextMenu,
  onSelectUiNode,
  selectedUiNodeId,
  onBeginUiDrag
}: PreviewPaneProps) {
  const { t } = useTranslation();

  if (activeDocument.kind === "ui-layout") {
    return (
      <div className="workspace-surface workspace-surface--scene">
        <div className="workspace-surface__header workspace-surface__header--scene">
          <div>
            <span className="workspace-surface__eyebrow">{t('preview.sceneLabel')}</span>
            <h3>{t('preview.legacyLayoutPreview')}</h3>
            <p>
              {stageMode === "scene"
                ? sceneTool === "hand"
                  ? t('preview.handModeDesc')
                  : sceneTool === "rect"
                    ? t('preview.rectModeDesc')
                    : sceneTool === "scale"
                      ? t('preview.scaleModeDesc')
                      : sceneTool === "rotate"
                        ? t('preview.rotateModeDesc')
                        : t('preview.moveModeDesc')
                : t('preview.previewModeDesc')}
            </p>
          </div>
          <div className="workspace-surface__scene-metrics">
            <span>{stageMode === "scene" ? t('scene.editMode') : t('scene.previewModeLabel')}</span>
            <span>{sceneTool.toUpperCase()}</span>
            <span>{sceneZoom.toUpperCase()}</span>
          </div>
        </div>
        <LegacyUiLayoutViewport
          document={activeDocument}
          assets={assets}
          interactionMode={stageMode}
          sceneTool={sceneTool}
          selectedNodeId={selectedUiNodeId}
          zoomMode={sceneZoom}
          onContextMenu={onSceneContextMenu}
          onSelectNode={onSelectUiNode}
          onBeginDrag={onBeginUiDrag}
        />
      </div>
    );
  }

  if (activeDocument.kind === "atlas") {
    const selectedFrame = getAtlasFrameBySelection(activeDocument, atlasFrameSelection);
    return (
      <div className="workspace-surface workspace-surface--split">
        <div className="workspace-surface__canvas">
          <div className="workspace-surface__header">
            <h3>{t('preview.atlasPlistPreview')}</h3>
            <p>{t('preview.atlasPlistDesc')}</p>
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
            <EmptyState title={t('preview.noTexture')} body={t('preview.noTextureBody')} />
          )}
        </div>
        <div className="workspace-surface__sidebar">
          <div className="workspace-surface__header">
            <h3>{t('preview.framesLabel')}</h3>
            <p>{activeDocument.frames.length} {t('preview.entriesCount')}</p>
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

  if (activeDocument.kind === "bitmap-font") {
    const glyphs = Array.from(activeDocument.font.chars.values()).sort((left, right) => left.id - right.id);
    return (
      <div className="workspace-surface workspace-surface--split">
        <div className="workspace-surface__canvas">
          <div className="workspace-surface__header">
            <h3>{t('preview.bitmapFontPreview')}</h3>
            <p>{t('preview.bitmapFontDesc')}</p>
          </div>
          {activeDocument.imageUrl ? (
            <div className="bitmap-font-preview" data-bitmap-font-preview={activeDocument.name}>
              <div className="bitmap-font-preview__sheet">
                <img src={activeDocument.imageUrl} alt={activeDocument.name} />
              </div>
              <div className="bitmap-font-preview__sample">
                <strong>{t('preview.sample')}</strong>
                <div className="bitmap-font-preview__sample-text">{buildBitmapFontSample(glyphs)}</div>
              </div>
            </div>
          ) : (
            <EmptyState
              title={t('preview.noBitmapSheet')}
              body={t('preview.noBitmapSheetBody')}
            />
          )}
        </div>
        <div className="workspace-surface__sidebar">
          <div className="workspace-surface__header">
            <h3>{t('preview.glyphsLabel')}</h3>
            <p>{glyphs.length} {t('preview.entriesCount')}</p>
          </div>
          <ul className="frame-list">
            {glyphs.slice(0, 48).map((glyph) => (
              <li key={glyph.id}>
                <div className="frame-list__meta" data-bitmap-char={glyph.id}>
                  <strong>{describeBitmapChar(glyph.id)}</strong>
                  <span>
                    {glyph.width} × {glyph.height}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  if (activeDocument.kind === "avatar-preview") {
    const isPlayer = activeDocument.cloth > 0 && activeDocument.cloth < 30000;
    const resolvedClothFileId =
      resolveAvatarFileCandidates(activeDocument.cloth, activeDocument.state, isPlayer).find((fileId) =>
        Boolean(findBizFileById(activeDocument.clothBank, fileId) || activeDocument.clothImageAssets[String(fileId)])
      ) ?? 0;
    const resolvedWeaponFileId =
      resolveAvatarFileCandidates(activeDocument.weapon, activeDocument.state, isPlayer).find((fileId) =>
        Boolean((activeDocument.weaponBank && findBizFileById(activeDocument.weaponBank, fileId)) || activeDocument.weaponImageAssets[String(fileId)])
      ) ?? 0;

    return (
      <div className="workspace-surface workspace-surface--split">
        <div className="workspace-surface__canvas">
          <div className="workspace-surface__header">
            <h3>{t('preview.avatarPreviewLab')}</h3>
            <p>{t('preview.avatarLabDesc')}</p>
          </div>
          <div className="workspace-surface__toolbar workspace-surface__toolbar--wrap">
            <DirectionStrip value={activeDocument.dir} onChange={(dir) => onChangeAvatarDocument({ dir })} />
            <StateStrip value={activeDocument.state} onChange={(state) => onChangeAvatarDocument({ state })} />
          </div>
          {activeDocument.sourcePath ? (
            <div className="workspace-surface__notice">{t('preview.linkedSource')} {activeDocument.sourcePath}</div>
          ) : null}
          <div className="animated-preview-stage">
            <AvatarPreviewCanvas document={activeDocument} />
          </div>
        </div>
        <div className="workspace-surface__sidebar">
          <div className="workspace-surface__header">
            <h3>{t('preview.resources')}</h3>
            <p>{Object.keys(activeDocument.clothImageAssets).length} {t('preview.clothCount')} · {Object.keys(activeDocument.weaponImageAssets).length} {t('preview.weaponLabel')}</p>
          </div>
          <ul className="frame-list">
            <li>
              <div className="frame-list__meta">
                <strong>{t('inspector.cloth')}</strong>
                <span>{activeDocument.cloth} · file {resolvedClothFileId || t('preview.fileNA')}</span>
              </div>
            </li>
            <li>
              <div className="frame-list__meta">
                <strong>{t('inspector.weapon')}</strong>
                <span>{activeDocument.weapon} · file {resolvedWeaponFileId || t('preview.fileNA')}</span>
              </div>
            </li>
            <li>
              <div className="frame-list__meta">
                <strong>{t('inspector.state')}</strong>
                <span>{activeDocument.state}</span>
              </div>
            </li>
            <li>
              <div className="frame-list__meta">
                <strong>{t('inspector.dir')}</strong>
                <span>{activeDocument.dir}</span>
              </div>
            </li>
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
            <h3>{t('preview.bizAnimationBank')}</h3>
            <p>{t('preview.bizBankDesc')}</p>
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
              title={t('preview.noSheetTexture')}
              body={t('preview.noSheetTextureBody')}
            />
          )}
        </div>
        <div className="workspace-surface__sidebar">
          <div className="workspace-surface__header">
            <h3>{t('preview.filesLabel')}</h3>
            <p>{activeDocument.files.length} {t('preview.fileGroups')}</p>
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
                    {file.dirCount} {t('preview.dir')} · {file.frames.length} {t('inspector.frames')}
                  </small>
                </button>
              </li>
            ))}
          </ul>
          {selectedFile ? (
            <>
              <div className="workspace-surface__header">
                <h3>{t('preview.framesLabel')}</h3>
                <p>{selectedFile.frames.length} {t('preview.entriesCount')}</p>
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

  if (activeDocument.kind === "effect-preview") {
    return (
      <div className="workspace-surface workspace-surface--split">
        <div className="workspace-surface__canvas">
          <div className="workspace-surface__header">
            <h3>{t('preview.effectPreviewLab')}</h3>
            <p>{t('preview.effectLabDesc')}</p>
          </div>
          <div className="workspace-surface__toolbar workspace-surface__toolbar--wrap">
            <DirectionStrip value={activeDocument.dir} onChange={(dir) => onChangeEffectDocument({ dir })} />
            <ToggleChip value={activeDocument.loop} onChange={(loop) => onChangeEffectDocument({ loop })} />
          </div>
          {activeDocument.sourcePath ? (
            <div className="workspace-surface__notice">{t('preview.linkedSource')} {activeDocument.sourcePath}</div>
          ) : null}
          <div className="animated-preview-stage">
            <EffectPreviewCanvas document={activeDocument} />
          </div>
        </div>
        <div className="workspace-surface__sidebar">
          <div className="workspace-surface__header">
            <h3>{t('preview.resources')}</h3>
            <p>{Object.keys(activeDocument.effectImageAssets).length} {t('preview.effectSheets')}</p>
          </div>
          <ul className="frame-list">
            <li>
              <div className="frame-list__meta">
                <strong>{t('inspector.fileId')}</strong>
                <span>{activeDocument.fileId}</span>
              </div>
            </li>
            <li>
              <div className="frame-list__meta">
                <strong>{t('inspector.dir')}</strong>
                <span>{activeDocument.dir}</span>
              </div>
            </li>
            <li>
              <div className="frame-list__meta">
                <strong>{t('inspector.delay')}</strong>
                <span>{activeDocument.delay}</span>
              </div>
            </li>
            <li>
              <div className="frame-list__meta">
                <strong>{t('inspector.loop')}</strong>
                <span>{activeDocument.loop ? "true" : "false"}</span>
              </div>
            </li>
          </ul>
        </div>
      </div>
    );
  }

  if (activeDocument.kind === "map") {
    return (
      <div className="workspace-surface">
        <div className="workspace-surface__header">
          <h3>{t('preview.mapoBlockEditor')}</h3>
          <p>
            {stageMode === "scene"
              ? sceneTool === "hand"
                ? t('preview.mapHandModeDesc')
                : t('preview.mapPaintDesc')
              : t('preview.mapPreviewDesc')}
          </p>
        </div>
        <MapDocumentCanvas
          document={activeDocument}
          interactionMode={stageMode}
          sceneTool={sceneTool}
          selectedCell={mapCellSelection}
          zoomMode={sceneZoom}
          onPaint={onMapPaint}
        />
      </div>
    );
  }

  if (activeDocument.kind === "image") {
    return (
      <div className="workspace-surface">
        <div className="workspace-surface__header">
          <h3>{t('preview.imageViewer')}</h3>
          <p>{t('preview.imageViewerDesc')}</p>
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
        <h3>{t('preview.textMetaDocument')}</h3>
        <p>{t('preview.textMetaDesc')}</p>
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

function DirectionStrip({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const { t } = useTranslation();
  return (
    <div className="segmented-control" data-preview-dir-strip="">
      {Array.from({ length: 8 }, (_, index) => (
        <button
          key={index}
          type="button"
          className={`segmented-control__button${value === index ? " segmented-control__button--active" : ""}`}
          onClick={() => onChange(index)}
        >
          {t('preview.dir')} {index}
        </button>
      ))}
    </div>
  );
}

function StateStrip({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const { t } = useTranslation();
  const states = [
    { label: t('preview.stateIdle'), value: 0 },
    { label: t('preview.stateWalk'), value: 1 },
    { label: t('preview.stateRun'), value: 2 },
    { label: t('preview.stateAtk'), value: 4 },
    { label: t('preview.stateMagic'), value: 5 }
  ];
  return (
    <div className="segmented-control segmented-control--compact">
      {states.map((state) => (
        <button
          key={state.value}
          type="button"
          className={`segmented-control__button${value === state.value ? " segmented-control__button--active" : ""}`}
          onClick={() => onChange(state.value)}
        >
          {state.label}
        </button>
      ))}
    </div>
  );
}

function ToggleChip({ value, onChange }: { value: boolean; onChange: (value: boolean) => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className={`segmented-control__button${value ? " segmented-control__button--active" : ""}`}
      onClick={() => onChange(!value)}
    >
      {t('inspector.loop')} {value ? t('preview.loopOn') : t('preview.loopOff')}
    </button>
  );
}

function describeBitmapChar(id: number): string {
  if (id >= 32 && id <= 126) return `${String.fromCharCode(id)} · ${id}`;
  return `U+${id.toString(16).toUpperCase().padStart(4, "0")}`;
}

function buildBitmapFontSample(glyphs: Array<{ id: number }>): string {
  const asciiGlyphs = glyphs
    .map((glyph) => glyph.id)
    .filter((id) => id >= 32 && id <= 126)
    .slice(0, 16);
  if (asciiGlyphs.length <= 0) return "No printable glyphs";
  return asciiGlyphs.map((id) => String.fromCharCode(id)).join("");
}
