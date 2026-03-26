import { describeMapCellValue, type MapCell } from "../app-utils";
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
  if (!activeDocument) {
    return <EmptyState title="No selection" body="Open a document to inspect resource properties and edit metadata." />;
  }

  if (activeDocument.kind === "ui-layout") {
    return (
      <div className="inspector">
        <InspectorSection title="Document">
          <InspectorRow label="Format">
            <select
              value={activeDocument.sourceFormat}
              onChange={(event) => onChangeUiFormat(event.target.value as UiLayoutDocument["sourceFormat"])}
            >
              <option value="json">json</option>
              <option value="lua">lua</option>
            </select>
          </InspectorRow>
          <InspectorRow label="Nodes">{activeDocument.nodes.length}</InspectorRow>
          <InspectorRow label="Path">{activeDocument.sourcePath ?? "(unsaved)"}</InspectorRow>
        </InspectorSection>
        {selectedUiNode ? (
          <InspectorSection title={describeLegacyNode(selectedUiNode)}>
            <InspectorField
              label="Name"
              value={String(selectedUiNode.n ?? "")}
              onChange={(value) => onUpdateUiNode("n", value)}
            />
            <InspectorNumberField
              label="Type"
              value={Number(selectedUiNode.type)}
              onChange={(value) => onUpdateUiNode("type", value)}
            />
            <InspectorNumberField
              label="Parent"
              value={Number(selectedUiNode.parent)}
              onChange={(value) => onUpdateUiNode("parent", value)}
            />
            <InspectorNumberField
              label="X"
              value={Number(selectedUiNode.x ?? 0)}
              onChange={(value) => onUpdateUiNode("x", value)}
            />
            <InspectorNumberField
              label="Y"
              value={Number(selectedUiNode.y ?? 0)}
              onChange={(value) => onUpdateUiNode("y", value)}
            />
            <InspectorNumberField
              label="W"
              value={Number(selectedUiNode.w ?? 0)}
              onChange={(value) => onUpdateUiNode("w", value)}
            />
            <InspectorNumberField
              label="H"
              value={Number(selectedUiNode.h ?? 0)}
              onChange={(value) => onUpdateUiNode("h", value)}
            />
            <InspectorNumberField
              label="Anchor X"
              value={Number(selectedUiNode.ax ?? 0.5)}
              step={0.1}
              onChange={(value) => onUpdateUiNode("ax", value)}
            />
            <InspectorNumberField
              label="Anchor Y"
              value={Number(selectedUiNode.ay ?? 0.5)}
              step={0.1}
              onChange={(value) => onUpdateUiNode("ay", value)}
            />
            <InspectorField
              label="Resource"
              value={String(selectedUiNode.res ?? "")}
              onChange={(value) => onUpdateUiNode("res", value)}
            />
            <InspectorField
              label="Text"
              value={String(selectedUiNode.text ?? "")}
              onChange={(value) => onUpdateUiNode("text", value)}
            />
            <InspectorNumberField
              label="Font Size"
              value={Number(selectedUiNode.fs ?? 0)}
              onChange={(value) => onUpdateUiNode("fs", value)}
            />
            <InspectorField
              label="Color"
              value={String(selectedUiNode.color ?? "")}
              onChange={(value) => onUpdateUiNode("color", value)}
            />
            <InspectorToggle
              label="Visible"
              value={Boolean(selectedUiNode.v ?? true)}
              onChange={(value) => onUpdateUiNode("v", value)}
            />
          </InspectorSection>
        ) : null}
      </div>
    );
  }

  if (activeDocument.kind === "atlas") {
    return (
      <div className="inspector">
        <InspectorSection title="Atlas">
          <InspectorRow label="Frames">{activeDocument.frames.length}</InspectorRow>
          <InspectorRow label="Source">{activeDocument.sourcePath}</InspectorRow>
          <InspectorRow label="Image">{activeDocument.imagePath || "(missing)"}</InspectorRow>
        </InspectorSection>
        {selectedAtlasFrame ? (
          <InspectorSection title={selectedAtlasFrame.name}>
            <InspectorRow label="Frame">
              {selectedAtlasFrame.frame.x}, {selectedAtlasFrame.frame.y}, {selectedAtlasFrame.frame.w},{" "}
              {selectedAtlasFrame.frame.h}
            </InspectorRow>
            <InspectorRow label="Source Size">
              {selectedAtlasFrame.sourceSize.w} × {selectedAtlasFrame.sourceSize.h}
            </InspectorRow>
            <InspectorRow label="Sprite Offset">
              {selectedAtlasFrame.spriteSourceSize.x}, {selectedAtlasFrame.spriteSourceSize.y}
            </InspectorRow>
            <InspectorRow label="Rotated">{selectedAtlasFrame.rotated ? "true" : "false"}</InspectorRow>
            <InspectorRow label="Trimmed">{selectedAtlasFrame.trimmed ? "true" : "false"}</InspectorRow>
          </InspectorSection>
        ) : null}
      </div>
    );
  }

  if (activeDocument.kind === "avatar-preview") {
    const clothOptions = Array.from(new Set(Object.keys(activeDocument.clothImageAssets).map((value) => Math.floor(Number(value) / 100)))).sort((left, right) => left - right);
    const weaponOptions = Array.from(new Set(Object.keys(activeDocument.weaponImageAssets).map((value) => Math.floor(Number(value) / 100)))).sort((left, right) => left - right);
    return (
      <div className="inspector">
        <InspectorSection title="Avatar Lab">
          <InspectorRow label="Cloth">
            <select value={activeDocument.cloth} onChange={(event) => onChangeAvatarDocument({ cloth: Number(event.target.value) })}>
              {clothOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </InspectorRow>
          <InspectorRow label="Weapon">
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
          <InspectorRow label="State">
            <select value={activeDocument.state} onChange={(event) => onChangeAvatarDocument({ state: Number(event.target.value) })}>
              {LEGACY_STATE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </InspectorRow>
          <InspectorRow label="Dir">
            <select value={activeDocument.dir} onChange={(event) => onChangeAvatarDocument({ dir: Number(event.target.value) })}>
              {Array.from({ length: 8 }, (_, index) => (
                <option key={index} value={index}>
                  {index}
                </option>
              ))}
            </select>
          </InspectorRow>
        </InspectorSection>
        <InspectorSection title="Meta">
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
        <InspectorSection title="Biz Bank">
          <InspectorRow label="Files">{activeDocument.files.length}</InspectorRow>
          <InspectorRow label="Source">{activeDocument.sourcePath}</InspectorRow>
          <InspectorRow label="Image">{activeDocument.imagePath || "(missing)"}</InspectorRow>
        </InspectorSection>
        {selectedBizDocumentFile ? (
          <InspectorSection title={`File ${selectedBizDocumentFile.fileId}`}>
            <InspectorRow label="Canvas">
              {selectedBizDocumentFile.fileW} × {selectedBizDocumentFile.fileH}
            </InspectorRow>
            <InspectorRow label="Dirs">{selectedBizDocumentFile.dirCount}</InspectorRow>
            <InspectorRow label="Frames">{selectedBizDocumentFile.frames.length}</InspectorRow>
          </InspectorSection>
        ) : null}
        {selectedBizFrame ? (
          <InspectorSection title={`Frame ${selectedBizFrame.frameId}`}>
            <InspectorRow label="Rect">
              {selectedBizFrame.x}, {selectedBizFrame.y}, {selectedBizFrame.w}, {selectedBizFrame.h}
            </InspectorRow>
            <InspectorRow label="Origin">
              {selectedBizFrame.ox}, {selectedBizFrame.oy}
            </InspectorRow>
            <InspectorRow label="Source">
              {selectedBizFrame.sourceW} × {selectedBizFrame.sourceH}
            </InspectorRow>
            <InspectorRow label="Rotated">{selectedBizFrame.rotated ? "true" : "false"}</InspectorRow>
          </InspectorSection>
        ) : null}
      </div>
    );
  }

  if (activeDocument.kind === "effect-preview") {
    const effectOptions = Object.keys(activeDocument.effectImageAssets).map(Number).sort((left, right) => left - right);
    return (
      <div className="inspector">
        <InspectorSection title="Effect Lab">
          <InspectorRow label="FileId">
            <select value={activeDocument.fileId} onChange={(event) => onChangeEffectDocument({ fileId: Number(event.target.value) })}>
              {effectOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </InspectorRow>
          <InspectorRow label="Dir">
            <select value={activeDocument.dir} onChange={(event) => onChangeEffectDocument({ dir: Number(event.target.value) })}>
              {Array.from({ length: 8 }, (_, index) => (
                <option key={index} value={index}>
                  {index}
                </option>
              ))}
            </select>
          </InspectorRow>
          <InspectorNumberField
            label="Delay"
            value={activeDocument.delay}
            onChange={(value) => onChangeEffectDocument({ delay: value })}
          />
          <InspectorToggle
            label="Loop"
            value={activeDocument.loop}
            onChange={(value) => onChangeEffectDocument({ loop: value })}
          />
        </InspectorSection>
        <InspectorSection title="Meta">
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
        <InspectorSection title="Map">
          <InspectorRow label="Version">{activeDocument.version}</InspectorRow>
          <InspectorRow label="Ground">
            {activeDocument.groundWidth} × {activeDocument.groundHeight}
          </InspectorRow>
          <InspectorRow label="Logic">
            {activeDocument.logicWidth} × {activeDocument.logicHeight}
          </InspectorRow>
          <InspectorRow label="Ground Dir">{activeDocument.groundDir}</InspectorRow>
          <InspectorRow label="MapId">{activeDocument.metadata?.mapId ?? "(unmatched)"}</InspectorRow>
          <InspectorRow label="File">{activeDocument.metadata?.file ?? activeDocument.name}</InspectorRow>
        </InspectorSection>
        <InspectorSection title="Brush">
          <InspectorRow label="Paint Value">
            <select value={mapBrushValue} onChange={(event) => onChangeMapBrush(Number(event.target.value))}>
              <option value={0}>0 · Walkable</option>
              <option value={1}>1 · Block</option>
              <option value={2}>2 · Marker</option>
              <option value={3}>3 · Water</option>
            </select>
          </InspectorRow>
          <InspectorRow label="Selected Cell">{describeMapCellValue(activeDocument, selectedMapCell)}</InspectorRow>
        </InspectorSection>
        <InspectorSection title="Overlays">
          <InspectorRow label="NPC">{activeDocument.overlaySummary.npc}</InspectorRow>
          <InspectorRow label="Teleport">{activeDocument.overlaySummary.teleport}</InspectorRow>
          <InspectorRow label="Monster">{activeDocument.overlaySummary.monster}</InspectorRow>
        </InspectorSection>
      </div>
    );
  }

  if (activeDocument.kind === "image") {
    return (
      <div className="inspector">
        <InspectorSection title="Image">
          <InspectorRow label="Path">{activeDocument.sourcePath}</InspectorRow>
        </InspectorSection>
      </div>
    );
  }

  return (
    <div className="inspector">
      <InspectorSection title="Text Document">
        <InspectorRow label="Path">{activeDocument.sourcePath}</InspectorRow>
        <InspectorRow label="Length">{activeDocument.text.length}</InspectorRow>
      </InspectorSection>
      <InspectorSection title="Edit">
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
  onChange
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <InspectorRow label={label}>
      <label className="toggle">
        <input type="checkbox" checked={value} onChange={(event) => onChange(event.target.checked)} />
        <span>{value ? "true" : "false"}</span>
      </label>
    </InspectorRow>
  );
}
