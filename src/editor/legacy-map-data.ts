import type { MapDocument, MapInfoEntry, MapOverlayEntry, MapOverlaySummary } from "./types";

type LegacyNpcEntry = {
  id: number;
  mapId: string;
  name: string;
  script: string;
  x: number;
  y: number;
  talkId: number;
  openUi: string;
  teleportMapId: string;
  teleportX: number;
  teleportY: number;
  teleportRange: number;
};

type LegacyMonsterEntry = {
  mapId: string;
  monsterId: number;
  x: number;
  y: number;
  radius: number;
  count: number;
  respawnSeconds: number;
};

type LegacyMonsterDefEntry = {
  id: number;
  model: number;
  name: string;
};

type ParsedCsv = {
  headers: string[];
  rows: string[][];
};

export function buildEmptyMapOverlaySummary(): MapOverlaySummary {
  return {
    monster: 0,
    npc: 0,
    teleport: 0
  };
}

export function parseLegacyMapInfoText(text: string): MapInfoEntry[] {
  const table = parseLegacyCsv(text);
  return table.rows
    .map((row) => ({
      file: getCsvValue(table.headers, row, "file", 2),
      id: parseIntSafe(getCsvValue(table.headers, row, "id", 0)),
      mapId: getCsvValue(table.headers, row, "mapid", 1),
      mapName: getCsvValue(table.headers, row, "mapname", 3),
      minimap: getCsvValue(table.headers, row, "minimap", 4)
    }))
    .filter((entry) => entry.id > 0 && entry.mapId.length > 0);
}

export function parseLegacyNpcText(text: string): LegacyNpcEntry[] {
  const table = parseLegacyCsv(text);
  return table.rows
    .map((row) => ({
      id: parseIntSafe(getCsvValue(table.headers, row, "id", 0)),
      mapId: getCsvValue(table.headers, row, "mapid", 4),
      name: getCsvValue(table.headers, row, "name", 1),
      script: getCsvValue(table.headers, row, "script", 2),
      openUi: getCsvValue(table.headers, row, "openui", 16),
      talkId: parseIntSafe(getCsvValue(table.headers, row, "talkid", 14)),
      teleportMapId: getCsvValue(table.headers, row, "transmapid", 17),
      teleportRange: parseIntSafe(getCsvValue(table.headers, row, "transrange", 20)),
      teleportX: parseIntSafe(getCsvValue(table.headers, row, "transx", 18)),
      teleportY: parseIntSafe(getCsvValue(table.headers, row, "transy", 19)),
      x: parseIntSafe(getCsvValue(table.headers, row, "x", 5)),
      y: parseIntSafe(getCsvValue(table.headers, row, "y", 6))
    }))
    .filter((entry) => entry.id > 0 && entry.mapId.length > 0);
}

export function parseLegacyMonsterText(text: string): LegacyMonsterEntry[] {
  const table = parseLegacyCsv(text);
  return table.rows
    .map((row) => ({
      count: parseIntSafe(getCsvValue(table.headers, row, "count", 5)),
      mapId: getCsvValue(table.headers, row, "mapid", 0),
      monsterId: parseIntSafe(getCsvValue(table.headers, row, "monid", 3)),
      radius: Math.max(1, parseIntSafe(getCsvValue(table.headers, row, "range", 4), 1)),
      respawnSeconds: parseIntSafe(getCsvValue(table.headers, row, "time", 6)),
      x: parseIntSafe(getCsvValue(table.headers, row, "x", 1)),
      y: parseIntSafe(getCsvValue(table.headers, row, "y", 2))
    }))
    .filter((entry) => entry.mapId.length > 0 && entry.monsterId > 0);
}

export function parseLegacyMonsterDefText(text: string): LegacyMonsterDefEntry[] {
  const table = parseLegacyCsv(text);
  return table.rows
    .map((row) => ({
      id: parseIntSafe(getCsvValue(table.headers, row, "id", 0)),
      model: parseIntSafe(getCsvValue(table.headers, row, "model", 1)),
      name: getCsvValue(table.headers, row, "name", 4)
    }))
    .filter((entry) => entry.id > 0);
}

export function attachLegacyMapData(
  document: MapDocument,
  mapInfoEntries: MapInfoEntry[],
  npcEntries: LegacyNpcEntry[],
  monsterEntries: LegacyMonsterEntry[],
  monsterDefEntries: LegacyMonsterDefEntry[]
): MapDocument {
  const metadata = resolveMapInfo(document, mapInfoEntries);
  const matchKeys = buildMapMatchKeys(document, metadata);
  const overlays: MapOverlayEntry[] = [];
  const monsterDefMap = new Map(monsterDefEntries.map((entry) => [entry.id, entry]));
  const mapInfoByMapId = new Map(mapInfoEntries.map((entry) => [normalizeMapKey(entry.mapId), entry]));

  for (const npc of npcEntries) {
    if (!matchKeys.has(normalizeMapKey(npc.mapId))) continue;
    const npcDetails = buildNpcDetails(npc);
    overlays.push({
      details: npcDetails,
      id: `npc:${npc.id}`,
      kind: "npc",
      label: npc.name || `NPC ${npc.id}`,
      radius: 1,
      sourceId: npc.id,
      subtitle: npc.openUi || (npc.talkId > 0 ? `Talk ${npc.talkId}` : "NPC"),
      targetMapId: null,
      targetMapName: null,
      x: npc.x,
      y: npc.y
    });
    if (npc.teleportMapId && npc.teleportMapId !== "0") {
      const targetMap = mapInfoByMapId.get(normalizeMapKey(npc.teleportMapId)) ?? null;
      const targetLabel = targetMap?.mapName || targetMap?.minimap || npc.teleportMapId;
      const teleportDetails = buildTeleportDetails(npc, targetLabel);
      overlays.push({
        details: teleportDetails,
        id: `teleport:${npc.id}`,
        kind: "teleport",
        label: npc.name || `Teleport ${npc.id}`,
        radius: Math.max(1, npc.teleportRange),
        sourceId: npc.id,
        subtitle:
          npc.teleportX > 0 || npc.teleportY > 0
            ? `${targetLabel} -> ${npc.teleportX}, ${npc.teleportY}`
            : targetLabel,
        targetMapId: npc.teleportMapId,
        targetMapName: targetMap?.mapName ?? targetMap?.minimap ?? null,
        x: npc.x,
        y: npc.y
      });
    }
  }

  for (const monster of monsterEntries) {
    if (!matchKeys.has(normalizeMapKey(monster.mapId))) continue;
    const monsterDef = monsterDefMap.get(monster.monsterId);
    overlays.push({
      details: buildMonsterDetails(monster, monsterDef),
      id: `monster:${monster.monsterId}:${monster.x}:${monster.y}`,
      kind: "monster",
      label: monsterDef?.name || `MON ${monster.monsterId}`,
      radius: Math.max(1, monster.radius),
      sourceId: monster.monsterId,
      subtitle:
        monster.count > 0
          ? `${monster.count} spawn · ${monster.respawnSeconds || 0}s${monsterDef?.model ? ` · model ${monsterDef.model}` : ""}`
          : `${monster.respawnSeconds || 0}s respawn${monsterDef?.model ? ` · model ${monsterDef.model}` : ""}`,
      targetMapId: null,
      targetMapName: null,
      x: monster.x,
      y: monster.y
    });
  }

  return {
    ...document,
    metadata,
    overlays,
    overlaySummary: summarizeMapOverlays(overlays)
  };
}

function summarizeMapOverlays(overlays: MapOverlayEntry[]): MapOverlaySummary {
  const summary = buildEmptyMapOverlaySummary();
  for (const overlay of overlays) {
    summary[overlay.kind] += 1;
  }
  return summary;
}

function buildNpcDetails(npc: LegacyNpcEntry): string[] {
  const details: string[] = [];
  if (npc.script) details.push(`script: ${npc.script}`);
  if (npc.openUi) details.push(`openUI: ${npc.openUi}`);
  if (npc.talkId > 0) details.push(`talk: ${npc.talkId}`);
  return details;
}

function buildTeleportDetails(npc: LegacyNpcEntry, targetLabel: string): string[] {
  const details = buildNpcDetails(npc);
  details.unshift(
    npc.teleportX > 0 || npc.teleportY > 0
      ? `target: ${targetLabel} (${npc.teleportMapId}) -> ${npc.teleportX}, ${npc.teleportY}`
      : `target: ${targetLabel} (${npc.teleportMapId})`
  );
  if (npc.teleportRange > 0) details.push(`range: ${npc.teleportRange}`);
  return details;
}

function buildMonsterDetails(monster: LegacyMonsterEntry, monsterDef: LegacyMonsterDefEntry | undefined): string[] {
  const details: string[] = [];
  if (monster.count > 0) details.push(`spawn: ${monster.count}`);
  if (monster.respawnSeconds > 0) details.push(`respawn: ${monster.respawnSeconds}s`);
  if (monsterDef?.model) details.push(`model: ${monsterDef.model}`);
  if (monster.radius > 0) details.push(`range: ${monster.radius}`);
  return details;
}

function resolveMapInfo(document: MapDocument, mapInfoEntries: MapInfoEntry[]): MapInfoEntry | null {
  const basename = normalizeMapKey(stripExtension(document.name));
  const basenameNumber = numericAlias(basename);

  let bestEntry: MapInfoEntry | null = null;
  let bestScore = -1;

  for (const entry of mapInfoEntries) {
    const fileKey = normalizeMapKey(entry.file);
    const mapIdKey = normalizeMapKey(entry.mapId);
    const minimapKey = normalizeMapKey(entry.minimap);
    const fileNumber = numericAlias(fileKey);
    const minimapNumber = numericAlias(minimapKey);

    let score = -1;
    if (fileKey === basename) score = 100;
    else if (mapIdKey === basename) score = 90;
    else if (minimapKey === basename) score = 80;
    else if (basenameNumber.length > 0 && fileNumber.some((value) => basenameNumber.includes(value))) score = 70;
    else if (basenameNumber.length > 0 && minimapNumber.some((value) => basenameNumber.includes(value))) score = 60;

    if (score > bestScore) {
      bestEntry = entry;
      bestScore = score;
    }
  }

  return bestEntry;
}

function buildMapMatchKeys(document: MapDocument, metadata: MapInfoEntry | null): Set<string> {
  const keys = new Set<string>();
  const push = (value: string | null | undefined) => {
    const normalized = normalizeMapKey(value);
    if (normalized) keys.add(normalized);
    for (const alias of numericAlias(normalized)) keys.add(alias);
  };

  push(stripExtension(document.name));
  if (metadata) {
    push(metadata.mapId);
    push(metadata.file);
    push(metadata.minimap);
  }
  return keys;
}

function parseLegacyCsv(text: string): ParsedCsv {
  const lines = stripBom(text).split(/\r?\n/);
  let headers: string[] = [];
  const rows: string[][] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith("#")) {
      if (line.includes(",") && /[a-z]/i.test(line)) {
        const nextHeaders = parseCsvLine(line.slice(1)).map((value) => normalizeHeader(value));
        if (nextHeaders.some((value) => value.length > 0 && !/^(int|string|stirng|null|int\[\])$/i.test(value))) {
          headers = nextHeaders;
        }
      }
      continue;
    }
    rows.push(parseCsvLine(rawLine));
  }

  return { headers, rows };
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index] ?? "";
    if (char === "\"") {
      const nextChar = line[index + 1] ?? "";
      if (quoted && nextChar === "\"") {
        current += "\"";
        index += 1;
        continue;
      }
      quoted = !quoted;
      continue;
    }
    if (char === "," && !quoted) {
      out.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  out.push(current.trim());
  return out;
}

function getCsvValue(headers: string[], row: string[], headerName: string, fallbackIndex: number): string {
  const normalizedTarget = normalizeHeader(headerName);
  const headerIndex = headers.findIndex((value) => value === normalizedTarget);
  return (row[headerIndex >= 0 ? headerIndex : fallbackIndex] ?? "").trim();
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

function normalizeMapKey(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\\/g, "/");
}

function numericAlias(value: string): string[] {
  if (!/^\d+$/.test(value)) return [];
  const numericValue = Number(value);
  const out = [String(numericValue)];
  if (numericValue > 30000) out.push(String(numericValue - 30000));
  return out;
}

function parseIntSafe(raw: string, fallback = 0): number {
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? value : fallback;
}

function stripExtension(value: string): string {
  return value.replace(/\.[^.]+$/, "");
}

function stripBom(text: string): string {
  return text.replace(/^\uFEFF+/, "");
}
