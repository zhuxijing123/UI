import { parseBizDocument } from "./formats";
import type {
  AvatarPreviewDocument,
  BizDocument,
  BizFileDocument,
  BizFrame,
  EffectPreviewDocument,
  LegacyGameInfoEntry,
  LegacySequenceEntry,
  WorkspaceAsset
} from "./types";
import { readAssetBuffer, readAssetText } from "./workspace";

export const LEGACY_STATE_OPTIONS = [
  { label: "Idle", value: 0 },
  { label: "Walk", value: 1 },
  { label: "Run", value: 2 },
  { label: "Prepare", value: 3 },
  { label: "Attack", value: 4 },
  { label: "Magic", value: 5 },
  { label: "Injury", value: 6 },
  { label: "Die", value: 7 }
] as const;

export const LEGACY_RENDER_TICK = 30;
export const LEGACY_GHOST_PLAYER = 501;
export const LEGACY_PERF_CLOTH = 20000;

export type LinkedLegacyPreviewIntent =
  | {
      kind: "avatar-preview";
      cloth?: number;
      weapon?: number;
      sourcePath: string;
    }
  | {
      kind: "effect-preview";
      fileId: number;
      sourcePath: string;
    };

export async function createAvatarPreviewDocument(assets: WorkspaceAsset[]): Promise<AvatarPreviewDocument> {
  const clothBizAsset = findAssetBySuffix(assets, "/biz/cloth.biz");
  const weaponBizAsset = findAssetBySuffix(assets, "/biz/weapon.biz");
  const gameInfoAsset = findAssetBySuffix(assets, "/biz/gameinfo.diz");
  const actionAsset = findAssetBySuffix(assets, "/biz/action.diz");

  if (!clothBizAsset || !gameInfoAsset || !actionAsset) {
    throw new Error("Avatar Lab requires biz/cloth.biz, biz/gameinfo.diz and biz/action.diz.");
  }

  const [clothBank, weaponBank, gameInfo, actionInfo] = await Promise.all([
    openBizBank(clothBizAsset, "avatar-cloth-bank"),
    weaponBizAsset ? openBizBank(weaponBizAsset, "avatar-weapon-bank") : Promise.resolve<BizDocument | null>(null),
    readAssetText(gameInfoAsset).then(parseLegacyGameInfoText),
    readAssetText(actionAsset).then(parseLegacySequenceText)
  ]);

  const clothImageAssets = buildNumericImageAssetMap(assets, "/cloth/");
  const weaponImageAssets = buildNumericImageAssetMap(assets, "/weapon/");
  const clothOptions = buildLookOptions(clothImageAssets);
  const weaponOptions = buildLookOptions(weaponImageAssets);

  return {
    actionInfo,
    cloth: clothOptions[0] ?? 0,
    clothBank,
    clothImageAssets,
    dir: 4,
    gameInfo,
    id: "avatar-lab",
    kind: "avatar-preview",
    name: "Avatar Lab",
    sourcePath: null,
    state: 0,
    weapon: weaponOptions[0] ?? 0,
    weaponBank,
    weaponImageAssets
  };
}

export async function createEffectPreviewDocument(assets: WorkspaceAsset[]): Promise<EffectPreviewDocument> {
  const effectBizAsset = findAssetBySuffix(assets, "/biz/effect.biz");
  const gameInfoAsset = findAssetBySuffix(assets, "/biz/gameinfo.diz");
  const effectInfoAsset = findAssetBySuffix(assets, "/biz/effect.tiz");
  const noDirAsset = findAssetBySuffix(assets, "/biz/nodir.diz");

  if (!effectBizAsset || !gameInfoAsset || !effectInfoAsset || !noDirAsset) {
    throw new Error("Effect Lab requires biz/effect.biz, biz/gameinfo.diz, biz/effect.tiz and biz/nodir.diz.");
  }

  const [effectBank, gameInfo, effectInfo, noDirIds] = await Promise.all([
    openBizBank(effectBizAsset, "effect-bank"),
    readAssetText(gameInfoAsset).then(parseLegacyGameInfoText),
    readAssetText(effectInfoAsset).then(parseLegacySequenceText),
    readAssetText(noDirAsset).then(parseLegacyIdSetText)
  ]);

  const effectImageAssets = buildNumericImageAssetMap(assets, "/effect/");
  const effectOptions = Object.keys(effectImageAssets).map(Number).sort((left, right) => left - right);

  return {
    delay: 1,
    dir: 4,
    effectBank,
    effectImageAssets,
    effectInfo,
    fileId: effectOptions[0] ?? 0,
    gameInfo,
    id: "effect-lab",
    kind: "effect-preview",
    loop: true,
    name: "Effect Lab",
    noDirIds,
    sourcePath: null
  };
}

export function inferLinkedLegacyPreviewIntent(asset: WorkspaceAsset): LinkedLegacyPreviewIntent | null {
  if (asset.kind !== "image") return null;
  const normalized = asset.path.replace(/\\/g, "/").toLowerCase();
  const fileId = Number.parseInt(asset.name.replace(/\.[^.]+$/, ""), 10);
  if (!Number.isFinite(fileId) || fileId <= 0) return null;

  if (normalized.includes("/cloth/")) {
    return {
      cloth: Math.floor(fileId / 100),
      kind: "avatar-preview",
      sourcePath: asset.path
    };
  }

  if (normalized.includes("/weapon/")) {
    return {
      kind: "avatar-preview",
      sourcePath: asset.path,
      weapon: Math.floor(fileId / 100)
    };
  }

  if (normalized.includes("/effect/")) {
    return {
      fileId,
      kind: "effect-preview",
      sourcePath: asset.path
    };
  }

  return null;
}

export async function createLinkedLegacyPreviewDocument(
  intent: LinkedLegacyPreviewIntent,
  assets: WorkspaceAsset[]
): Promise<AvatarPreviewDocument | EffectPreviewDocument> {
  if (intent.kind === "avatar-preview") {
    const document = await createAvatarPreviewDocument(assets);
    const nextCloth = normalizePositiveInt(intent.cloth ?? document.cloth) || document.cloth;
    const nextWeapon = normalizePositiveInt(intent.weapon ?? document.weapon) || document.weapon;
    return {
      ...document,
      cloth: nextCloth,
      id: `avatar-preview-${nextCloth || nextWeapon || "default"}`,
      name: buildAvatarPreviewName(nextCloth, nextWeapon),
      sourcePath: intent.sourcePath,
      weapon: nextWeapon
    };
  }

  const document = await createEffectPreviewDocument(assets);
  return {
    ...document,
    fileId: normalizePositiveInt(intent.fileId) || document.fileId,
    id: `effect-preview-${normalizePositiveInt(intent.fileId) || document.fileId || "default"}`,
    name: `Effect ${normalizePositiveInt(intent.fileId) || document.fileId || "Preview"}`,
    sourcePath: intent.sourcePath
  };
}

async function openBizBank(asset: WorkspaceAsset, id: string): Promise<BizDocument> {
  return parseBizDocument(id, asset.name, asset.path, await readAssetBuffer(asset), asset.handle, null, null);
}

function findAssetBySuffix(assets: WorkspaceAsset[], suffix: string): WorkspaceAsset | null {
  const target = suffix.toLowerCase();
  return assets.find((asset) => asset.path.toLowerCase().endsWith(target)) ?? null;
}

function buildNumericImageAssetMap(assets: WorkspaceAsset[], folderToken: string): Record<string, WorkspaceAsset> {
  const out: Record<string, WorkspaceAsset> = {};
  for (const asset of assets) {
    if (asset.kind !== "image") continue;
    const normalized = asset.path.toLowerCase();
    if (!normalized.includes(folderToken)) continue;
    const fileId = Number.parseInt(asset.name.replace(/\.[^.]+$/, ""), 10);
    if (!Number.isFinite(fileId) || fileId <= 0) continue;
    out[String(fileId)] = asset;
  }
  return out;
}

function buildLookOptions(imageAssets: Record<string, WorkspaceAsset>): number[] {
  const out = new Set<number>();
  for (const fileIdText of Object.keys(imageAssets)) {
    const fileId = Number.parseInt(fileIdText, 10);
    if (!Number.isFinite(fileId) || fileId <= 0) continue;
    out.add(Math.floor(fileId / 100));
  }
  return Array.from(out).sort((left, right) => left - right);
}

function buildAvatarPreviewName(cloth: number, weapon: number): string {
  if (cloth > 0) return `Avatar ${cloth}`;
  if (weapon > 0) return `Weapon ${weapon}`;
  return "Avatar Lab";
}

export function parseLegacyGameInfoText(text: string): LegacyGameInfoEntry[] {
  const entries: LegacyGameInfoEntry[] = [];
  const lines = stripBom(text).split(/\r?\n/);
  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const hashIndex = trimmed.indexOf("#");
    const line = hashIndex >= 0 ? trimmed.slice(0, hashIndex).trim() : trimmed;
    if (!line || !line.includes(",")) continue;
    const parts = line.split(",").map((part) => part.trim());
    if (parts.length < 5) continue;
    const id = Number.parseInt(parts[0] || "0", 10);
    if (!Number.isFinite(id) || id <= 0) continue;
    entries.push({
      id,
      nameY: parseFloatSafe(parts[2]),
      offX: parseFloatSafe(parts[3]),
      offY: parseFloatSafe(parts[4]),
      scale: parseFloatSafe(parts[1], 1)
    });
  }
  return entries.sort((left, right) => left.id - right.id);
}

export function parseLegacySequenceText(text: string): LegacySequenceEntry[] {
  const entries: LegacySequenceEntry[] = [];
  const lines = stripBom(text).split(/\r?\n/);
  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const line = trimmed.split("#")[0]?.trim() ?? "";
    if (!line) continue;
    const parts = line.split(",").map((part) => part.trim());
    if (parts.length < 3) continue;
    const id = Number.parseInt(parts[0] || "0", 10);
    if (!Number.isFinite(id) || id <= 0) continue;
    entries.push({
      frameCount: Number.parseInt(parts[2] || "0", 10) || 0,
      frames: parts.slice(3).map((value) => Number.parseInt(value || "0", 10) || 0),
      id,
      resCount: Number.parseInt(parts[1] || "0", 10) || 0
    });
  }
  return entries.sort((left, right) => left.id - right.id);
}

export function parseLegacyIdSetText(text: string): number[] {
  return stripBom(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .map((line) => Number.parseInt(line, 10))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((left, right) => left - right);
}

export function normalizeAvatarDir(dir: number): { dir: number; flip: boolean } {
  let next = dir | 0;
  let flip = false;
  if (next === 5 || next === 6 || next === 7) {
    next = 8 - next;
    flip = true;
  }
  return { dir: next, flip };
}

export function computeAvatarFileId(lookId: number, state: number, isPlayer: boolean): number {
  const normalizedLookId = normalizePositiveInt(lookId);
  if (normalizedLookId <= 0) return 0;
  let nextState = state | 0;
  if (!isPlayer && nextState === 2) nextState = 1;
  let id = normalizedLookId * 100 + nextState;
  if (isPlayer && nextState === 1) id += 1;
  return id;
}

export function resolveAvatarStateCandidates(state: number): number[] {
  const out: number[] = [];
  const push = (value: number) => {
    const normalized = value | 0;
    if (!out.includes(normalized)) out.push(normalized);
  };
  push(state);
  switch (state | 0) {
    case 2:
      push(1);
      push(0);
      break;
    case 1:
      push(2);
      push(0);
      break;
    case 5:
    case 6:
    case 3:
      push(4);
      push(0);
      break;
    case 4:
      push(5);
      push(0);
      break;
    case 7:
      push(6);
      push(0);
      break;
    default:
      break;
  }
  return out;
}

export function resolveAvatarFileCandidates(lookId: number, state: number, isPlayer: boolean): number[] {
  const out: number[] = [];
  for (const candidateState of resolveAvatarStateCandidates(state)) {
    const fileId = computeAvatarFileId(lookId, candidateState, isPlayer);
    if (fileId > 0 && !out.includes(fileId)) out.push(fileId);
  }
  return out;
}

export function resolveAvatarAction(
  actionEntries: LegacySequenceEntry[],
  clothLookId: number,
  lookId: number,
  state: number,
  isPlayer: boolean
): LegacySequenceEntry | null {
  const actionMap = new Map(actionEntries.map((entry) => [entry.id, entry]));
  for (const fileId of resolveAvatarFileCandidates(lookId, state, isPlayer)) {
    const direct = actionMap.get(fileId);
    if (direct) return direct;
  }
  if (isPlayer) {
    for (const candidateState of resolveAvatarStateCandidates(state)) {
      const fallback = actionMap.get(computeAvatarFileId(LEGACY_PERF_CLOTH, candidateState, true));
      if (fallback) return fallback;
    }
  }
  return actionMap.get(computeAvatarFileId(clothLookId, 0, isPlayer)) ?? null;
}

export function resolveAvatarObjInfo(
  kind: "cloth" | "weapon",
  lookId: number,
  dirRaw: number,
  gameInfoEntries: LegacyGameInfoEntry[]
): LegacyGameInfoEntry | null {
  const infoMap = new Map(gameInfoEntries.map((entry) => [entry.id, entry]));
  if (kind === "cloth" || kind === "weapon") {
    const byDir = infoMap.get(lookId * 10 + dirRaw);
    if (byDir) return byDir;
  }
  return infoMap.get(lookId) ?? infoMap.get(LEGACY_GHOST_PLAYER) ?? null;
}

export function findBizFileById(document: BizDocument, fileId: number): BizFileDocument | null {
  return document.files.find((file) => file.fileId === fileId) ?? null;
}

export function getBizFrameWithFallback(file: BizFileDocument, dir: number, idx: number): BizFrame | null {
  const direct = file.frames.find((frame) => frame.dir === dir && frame.frameIndex === idx);
  if (direct) return direct;

  const candidateDirs = uniqueInts([dir, 0]);
  const candidateIndices = collectFrameFallbackIndices(file.frameCount, idx);
  for (const candidateDir of candidateDirs) {
    for (const candidateIndex of candidateIndices) {
      const fallback = file.frames.find((frame) => frame.dir === candidateDir && frame.frameIndex === candidateIndex);
      if (fallback) return fallback;
    }
  }
  return null;
}

export function resolveEffectDir(effectId: number, dirRaw: number, noDirIds: number[]): { dir: number; flip: boolean } {
  if (noDirIds.includes(effectId)) return { dir: 4, flip: false };
  return normalizeAvatarDir(dirRaw);
}

export function resolveEffectObjInfo(
  gameInfoEntries: LegacyGameInfoEntry[],
  effectId: number,
  fileId: number,
  dir: number
): LegacyGameInfoEntry | null {
  const infoMap = new Map(gameInfoEntries.map((entry) => [entry.id, entry]));
  return infoMap.get(fileId + dir) ?? infoMap.get(effectId) ?? null;
}

function collectFrameFallbackIndices(frameCount: number, idx: number): number[] {
  const out: number[] = [];
  const push = (value: number): void => {
    const normalized = Math.trunc(value);
    if (normalized < 0 || out.includes(normalized)) return;
    out.push(normalized);
  };

  push(idx);
  if (frameCount > 0) {
    push(idx % frameCount);
    push(Math.min(idx, frameCount - 1));
    for (let candidate = Math.min(idx, frameCount - 1); candidate >= 0; candidate -= 1) {
      push(candidate);
    }
  }
  return out;
}

function normalizePositiveInt(value: number): number {
  const normalized = Math.trunc(value);
  return Number.isFinite(normalized) && normalized > 0 ? normalized : 0;
}

function parseFloatSafe(raw: string | undefined, fallback = 0): number {
  const value = Number.parseFloat(raw?.trim() ?? "");
  return Number.isFinite(value) ? value : fallback;
}

function stripBom(text: string): string {
  return text.replace(/^\uFEFF+/, "");
}

function uniqueInts(values: number[]): number[] {
  const out: number[] = [];
  for (const value of values) {
    const normalized = Math.trunc(value);
    if (!out.includes(normalized)) out.push(normalized);
  }
  return out;
}
