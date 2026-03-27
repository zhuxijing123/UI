import { useTranslation } from "../i18n/useTranslation";
import { LEGACY_STATE_OPTIONS } from "../legacy-labs";
import { describeLegacyNode } from "../view-model";
import type { AtlasDocument, BizDocument, EditorDocument, LegacyUILayoutNode, UiLayoutDocument } from "../types";
import { EmptyState } from "./EmptyState";

type InspectorPaneProps = {
  activeDocument: EditorDocument | null;
  selectedUiNode: LegacyUILayoutNode | null;
  selectedAtlasFrame: AtlasDocument["frames"][number] | null;
  selectedBizDocumentFile: BizDocument["files"][number] | null;
  selectedBizFrame: BizDocument["files"][number]["frames"][number] | null;
  selectedMapCell: MapCell | null;
  mapBrushValue: number;
  onChangeMapBrush: (value: number) => void;
  onChangeTextDocument: (text: string) => void;
  onChangeAvatarDocument: (patch: { cloth?: number; weapon?: number; dir?: number; state?: number }) => void;
  onChangeEffectDocument: (patch: { fileId?: number; dir?: number; delay?: number; loop?: boolean }) => void;
  onChangeUiFormat: (format: UiLayoutDocument["sourceFormat"]) => void;
  onUpdateUiNode: (key: keyof LegacyUILayoutNode, value: string | number | boolean) => void;
};

export function InspectorPane({
  activeDocument,
  selectedUiNode,
  selectedAtlasFrame,
  selectedBizDocumentFile,
  selectedBizFrame,
  selectedMapCell,
  mapBrushValue,
  onChangeMapBrush,
  onChangeTextDocument,
  onChangeAvatarDocument,
  onChangeEffectDocument,
  onChangeUiFormat,
  onUpdateUiNode
}: InspectorPaneProps) {
  const { t } = useTranslation();

  if (!activeDocument) {
    return <EmptyState title={t('inspector.noSelection.title')} body={t('inspector.noSelection.body')} />;
  }

  if (activeDocument.kind === "ui-layout") {
    return (
      <div className="inspector">
        <InspectorSection title={t('inspector.document')}>
          <InspectorRow label={t('inspector.format')}>
            <select
              value={activeDocument.sourceFormat}
              onChange={(event) => onChangeUiFormat(event.target.value as UiLayoutDocument["sourceFormat"])}
            >
              <option value="json">json</option>
              <option value="lua">lua</option>
            </select>
          </InspectorRow>
          <InspectorRow label={t('hierarchy.nodes')}>{activeDocument.nodes.length}</InspectorRow>
          <InspectorRow label={t('inspector.path')}>{activeDocument.sourcePath ?? t('inspector.unsaved')}</InspectorRow>
        </InspectorSection>
        {selectedUiNode ? (
          <>
          <InspectorSection title={t('inspector.node')}>
            <InspectorField
              label={t('inspector.name')}
              value={String(selectedUiNode.n ?? "")}
              onChange={(value) => onUpdateUiNode("n", value)}
            />
            <InspectorNumberField
              label={t('inspector.type')}
              value={Number(selectedUiNode.type)}
              onChange={(value) => onUpdateUiNode("type", value)}
            />
            <InspectorNumberField
              label={t('inspector.parent')}
              value={Number(selectedUiNode.parent)}
              onChange={(value) => onUpdateUiNode("parent", value)}
            />
            <InspectorRow label={t('inspector.kind')}>{describeLegacyNode(selectedUiNode)}</InspectorRow>
          </InspectorSection>
          <InspectorSection title={t('inspector.transform')}>
            <InspectorNumberField
              label={t('inspector.x')}
              value={Number(selectedUiNode.x ?? 0)}
              onChange={(value) => onUpdateUiNode("x", value)}
            />
            <InspectorNumberField
              label={t('inspector.y')}
              value={Number(selectedUiNode.y ?? 0)}
              onChange={(value) => onUpdateUiNode("y", value)}
            />
            <InspectorNumberField
              label={t('inspector.w')}
              value={Number(selectedUiNode.w ?? 0)}
              onChange={(value) => onUpdateUiNode("w", value)}
            />
            <InspectorNumberField
              label={t('inspector.h')}
              value={Number(selectedUiNode.h ?? 0)}
              onChange={(value) => onUpdateUiNode("h", value)}
            />
            <InspectorNumberField
              label={t('inspector.anchorX')}
              value={Number(selectedUiNode.ax ?? 0.5)}
              step={0.1}
              onChange={(value) => onUpdateUiNode("ax", value)}
            />
            <InspectorNumberField
              label={t('inspector.anchorY')}
              value={Number(selectedUiNode.ay ?? 0.5)}
              step={0.1}
              onChange={(value) => onUpdateUiNode("ay", value)}
            />
            <InspectorNumberField
              label={t('inspector.rotation')}
              value={Number(selectedUiNode.r ?? 0)}
              onChange={(value) => onUpdateUiNode("r", value)}
            />
            <InspectorNumberField
              label={t('inspector.scaleX')}
              value={Number(selectedUiNode.sx ?? 1)}
              step={0.1}
              onChange={(value) => onUpdateUiNode("sx", value)}
            />
            <InspectorNumberField
              label={t('inspector.scaleY')}
              value={Number(selectedUiNode.sy ?? 1)}
              step={0.1}
              onChange={(value) => onUpdateUiNode("sy", value)}
            />
          </InspectorSection>
          <InspectorSection title={t('inspector.content')}>
            <InspectorField
              label={t('inspector.resource')}
              value={String(selectedUiNode.res ?? "")}
              onChange={(value) => onUpdateUiNode("res", value)}
            />
            <InspectorField
              label={t('inspector.text')}
              value={String(selectedUiNode.text ?? "")}
              onChange={(value) => onUpdateUiNode("text", value)}
            />
            <InspectorNumberField
              label={t('inspector.fontSize')}
              value={Number(selectedUiNode.fs ?? 0)}
              onChange={(value) => onUpdateUiNode("fs", value)}
            />
            <InspectorField
              label={t('inspector.color')}
              value={String(selectedUiNode.color ?? "")}
              onChange={(value) => onUpdateUiNode("color", value)}
            />
            <InspectorToggle
              label={t('inspector.visible')}
              value={Boolean(selectedUiNode.v ?? true)}
              onChange={(value) => onUpdateUiNode("v", value)}
            />
          </InspectorSection>
          </>
        ) : null}
      </div>
    );
  }

  if (activeDocument.kind === "atlas") {
    return (
      <div className="inspector">
        <InspectorSection title={t('inspector.atlas')}>
          <InspectorRow label={t('inspector.frames')}>{activeDocument.frames.length}</InspectorRow>
          <InspectorRow label={t('inspector.source')}>{activeDocument.sourcePath}</InspectorRow>
          <InspectorRow label={t('inspector.image')}>{activeDocument.imagePath || t('inspector.missing')}</InspectorRow>
        </InspectorSection>
        {selectedAtlasFrame ? (
          <InspectorSection title={selectedAtlasFrame.name}>
            <InspectorRow label={t('inspector.frame')}>
              {selectedAtlasFrame.frame.x}, {selectedAtlasFrame.frame.y}, {selectedAtlasFrame.frame.w},{" "}
              {selectedAtlasFrame.frame.h}
            </InspectorRow>
            <InspectorRow label={t('inspector.sourceSize')}>
              {selectedAtlasFrame.sourceSize.w} x {selectedAtlasFrame.sourceSize.h}
            </InspectorRow>
            <InspectorRow label={t('inspector.spriteOffset')}>
              {selectedAtlasFrame.spriteSourceSize.x}, {selectedAtlasFrame.spriteSourceSize.y}
            </InspectorRow>
            <InspectorRow label={t('inspector.rotated')}>{selectedAtlasFrame.rotated ? t('inspector.true') : t('inspector.false')}</InspectorRow>
            <InspectorRow label={t('inspector.trimmed')}>{selectedAtlasFrame.trimmed ? t('inspector.true') : t('inspector.false')}</InspectorRow>
          </InspectorSection>
        ) : null}
      </div>
    );
  }

  if (activeDocument.kind === "bitmap-font") {
    return (
      <div className="inspector">
        <InspectorSection title={t('inspector.bitmapFont')}>
          <InspectorRow label={t('inspector.face')}>{activeDocument.font.font || t('inspector.unnamed')}</InspectorRow>
          <InspectorRow label={t('inspector.glyphs')}>{activeDocument.font.chars.size}</InspectorRow>
          <InspectorRow label={t('inspector.lineHeight')}>{activeDocument.font.lineHeight}</InspectorRow>
          <InspectorRow label={t('inspector.scale')}>
            {activeDocument.font.scaleW} x {activeDocument.font.scaleH}
          </InspectorRow>
          <InspectorRow label={t('inspector.image')}>{activeDocument.imagePath || activeDocument.font.image}</InspectorRow>
        </InspectorSection>
        <InspectorSection title={t('inspector.source')}>
          <InspectorRow label={t('inspector.path')}>{activeDocument.sourcePath}</InspectorRow>
          <InspectorRow label={t('inspector.pageFile')}>{activeDocument.font.image}</InspectorRow>
        </InspectorSection>
      </div>
    );
  }

  if (activeDocument.kind === "avatar-preview") {
    const clothOptions = Array.from(new Set(Object.keys(activeDocument.clothImageAssets).map((value) => Math.floor(Number(value) / 100)))).sort((left, right) => left - right);
    const weaponOptions = Array.from(new Set(Object.keys(activeDocument.weaponImageAssets).map((value) => Math.floor(Number(value) / 100)))).sort((left, right) => left - right);
    return (
      <div className="inspector">
        <InspectorSection title={t('inspector.avatarLab')}>
          <InspectorRow label={t('inspector.cloth')}>
            <select value={activeDocument.cloth} onChange={(event) => onChangeAvatarDocument({ cloth: Number(event.target.value) })}>
              {clothOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </InspectorRow>
          <InspectorRow label={t('inspector.weapon')}>
            <select value={activeDocument.weapon} onChange={(event) => onChangeAvatarDocument({ weapon: Number(event.target.value) })}>
              {weaponOptions.length > 0 ? (
                weaponOptions.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))
              ) : (
                <option value={0}>0</option>
              )}
            </select>
          </InspectorRow>
          <InspectorRow label={t('inspector.state')}>
            <select value={activeDocument.state} onChange={(event) => onChangeAvatarDocument({ state: Number(event.target.value) })}>
              {LEGACY_STATE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </InspectorRow>
          <InspectorRow label={t('inspector.dir')}>
            <select value={activeDocument.dir} onChange={(event) => onChangeAvatarDocument({ dir: Number(event.target.value) })}>
              {Array.from({ length: 8 }, (_, index) => (
                <option key={index} value={index}>
                  {index}
                </option>
              ))}
            </select>
          </InspectorRow>
        </InspectorSection>
        <InspectorSection title={t('inspector.meta')}>
          <InspectorRow label="gameinfo">{activeDocument.gameInfo.length}</InspectorRow>
          <InspectorRow label="action">{activeDocument.actionInfo.length}</InspectorRow>
          <InspectorRow label="cloth.biz">{activeDocument.clothBank.files.length}</InspectorRow>
          <InspectorRow label="weapon.biz">{activeDocument.weaponBank?.files.length ?? 0}</InspectorRow>
        </InspectorSection>
      </div>
    );
  }

  if (activeDocument.kind === "biz") {
    return (
      <div className="inspector">
        <InspectorSection title={t('inspector.bizBank')}>
          <InspectorRow label={t('inspector.files')}>{activeDocument.files.length}</InspectorRow>
          <InspectorRow label={t('inspector.source')}>{activeDocument.sourcePath}</InspectorRow>
          <InspectorRow label={t('inspector.image')}>{activeDocument.imagePath || t('inspector.missing')}</InspectorRow>
        </InspectorSection>
        {selectedBizDocumentFile ? (
          <InspectorSection title={`${t('inspector.file')} ${selectedBizDocumentFile.fileId}`}>
            <InspectorRow label={t('inspector.canvas')}>
              {selectedBizDocumentFile.fileW} x {selectedBizDocumentFile.fileH}
            </InspectorRow>
            <InspectorRow label={t('inspector.dirs')}>{selectedBizDocumentFile.dirCount}</InspectorRow>
            <InspectorRow label={t('inspector.frames')}>{selectedBizDocumentFile.frames.length}</InspectorRow>
          </InspectorSection>
        ) : null}
        {selectedBizFrame ? (
          <InspectorSection title={`${t('inspector.frame')} ${selectedBizFrame.frameId}`}>
            <InspectorRow label={t('inspector.rect')}>
              {selectedBizFrame.x}, {selectedBizFrame.y}, {selectedBizFrame.w}, {selectedBizFrame.h}
            </InspectorRow>
            <InspectorRow label={t('inspector.origin')}>
              {selectedBizFrame.ox}, {selectedBizFrame.oy}
            </InspectorRow>
            <InspectorRow label={t('inspector.source')}>
              {selectedBizFrame.sourceW} x {selectedBizFrame.sourceH}
            </InspectorRow>
            <InspectorRow label={t('inspector.rotated')}>{selectedBizFrame.rotated ? t('inspector.true') : t('inspector.false')}</InspectorRow>
          </InspectorSection>
        ) : null}
      </div>
    );
  }

  if (activeDocument.kind === "effect-preview") {
    const effectOptions = Object.keys(activeDocument.effectImageAssets).map(Number).sort((left, right) => left - right);
    return (
      <div className="inspector">
        <InspectorSection title={t('inspector.effectLab')}>
          <InspectorRow label={t('inspector.fileId')}>
            <select value={activeDocument.fileId} onChange={(event) => onChangeEffectDocument({ fileId: Number(event.target.value) })}>
              {effectOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </InspectorRow>
          <InspectorRow label={t('inspector.dir')}>
            <select value={activeDocument.dir} onChange={(event) => onChangeEffectDocument({ dir: Number(event.target.value) })}>
              {Array.from({ length: 8 }, (_, index) => (
                <option key={index} value={index}>
                  {index}
                </option>
              ))}
            </select>
          </InspectorRow>
          <InspectorNumberField
            label={t('inspector.delay')}
            value={activeDocument.delay}
            onChange={(value) => onChangeEffectDocument({ delay: value })}
          />
          <InspectorToggle
            label={t('inspector.loop')}
            value={activeDocument.loop}
            onChange={(value) => onChangeEffectDocument({ loop: value })}
          />
        </InspectorSection>
        <InspectorSection title={t('inspector.meta')}>
          <InspectorRow label="gameinfo">{activeDocument.gameInfo.length}</InspectorRow>
          <InspectorRow label="effect">{activeDocument.effectInfo.length}</InspectorRow>
          <InspectorRow label="nodir">{activeDocument.noDirIds.length}</InspectorRow>
          <InspectorRow label="effect.biz">{activeDocument.effectBank.files.length}</InspectorRow>
        </InspectorSection>
      </div>
    );
  }

  if (activeDocument.kind === "map") {
    return (
      <div className="inspector">
        <InspectorSection title={t('inspector.map')}>
          <InspectorRow label={t('inspector.version')}>{activeDocument.version}</InspectorRow>
          <InspectorRow label={t('inspector.ground')}>
            {activeDocument.groundWidth} x {activeDocument.groundHeight}
          </InspectorRow>
          <InspectorRow label={t('inspector.logic')}>
            {activeDocument.logicWidth} x {activeDocument.logicHeight}
          </InspectorRow>
          <InspectorRow label={t('inspector.groundDir')}>{activeDocument.groundDir}</InspectorRow>
          <InspectorRow label={t('inspector.mapId')}>{activeDocument.metadata?.mapId ?? t('inspector.unmatched')}</InspectorRow>
          <InspectorRow label={t('inspector.file')}>{activeDocument.metadata?.file ?? activeDocument.name}</InspectorRow>
        </InspectorSection>
        <InspectorSection title={t('inspector.brush')}>
          <InspectorRow label={t('inspector.paintValue')}>
            <select value={mapBrushValue} onChange={(event) => onChangeMapBrush(Number(event.target.value))}>
              <option value={0}>0 · {t('inspector.walkable')}</option>
              <option value={1}>1 · {t('inspector.block')}</option>
              <option value={2}>2 · {t('inspector.marker')}</option>
              <option value={3}>3 · {t('inspector.water')}</option>
            </select>
          </InspectorRow>
          <InspectorRow label={t('inspector.selectedCell')}>{describeMapCellValue(activeDocument, selectedMapCell)}</InspectorRow>
        </InspectorSection>
        <InspectorSection title={t('inspector.overlays')}>
          <InspectorRow label={t('inspector.npc')}>{activeDocument.overlaySummary.npc}</InspectorRow>
          <InspectorRow label={t('inspector.teleport')}>{activeDocument.overlaySummary.teleport}</InspectorRow>
          <InspectorRow label={t('inspector.monster')}>{activeDocument.overlaySummary.monster}</InspectorRow>
        </InspectorSection>
      </div>
    );
  }

  if (activeDocument.kind === "image") {
    return (
      <div className="inspector">
        <InspectorSection title={t('inspector.imageSection')}>
          <InspectorRow label={t('inspector.path')}>{activeDocument.sourcePath}</InspectorRow>
        </InspectorSection>
      </div>
    );
  }

  return (
    <div className="inspector">
      <InspectorSection title={t('inspector.textDocument')}>
        <InspectorRow label={t('inspector.path')}>{activeDocument.sourcePath}</InspectorRow>
        <InspectorRow label={t('inspector.length')}>{activeDocument.text.length}</InspectorRow>
      </InspectorSection>
      <InspectorSection title={t('inspector.edit')}>
        <textarea
          className="inspector__textarea"
          value={activeDocument.text}
          onChange={(event) => onChangeTextDocument(event.target.value)}
        />
      </InspectorSection>
    </div>
  );
}

function InspectorSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="inspector__section">
      <h3>{title}</h3>
      <div className="inspector__section-body">{children}</div>
    </section>
  );
}

function InspectorRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="inspector__row">
      <span>{label}</span>
      <div>{children}</div>
    </div>
  );
}

function InspectorField({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <InspectorRow label={label}>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </InspectorRow>
  );
}

function InspectorNumberField({
  label,
  value,
  step,
  onChange
}: {
  label: string;
  value: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <InspectorRow label={label}>
      <input
        type="number"
        step={step ?? 1}
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </InspectorRow>
  );
}

function InspectorToggle({
  label,
  value,
  onChange,
  trueLabel,
  falseLabel
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  trueLabel?: string;
  falseLabel?: string;
}) {
  return (
    <InspectorRow label={label}>
      <label className="toggle">
        <input type="checkbox" checked={value} onChange={(event) => onChange(event.target.checked)} />
        <span>{value ? (trueLabel ?? "true") : (falseLabel ?? "false")}</span>
      </label>
    </InspectorRow>
  );
}
