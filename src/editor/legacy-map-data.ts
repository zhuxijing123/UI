import type { MapDocument, MapInfoEntry, MapOverlayEntry, MapOverlaySummary } from "./types";

type LegacyNpcEntry = {
  id: number;
  mapId: string;
  name: string;
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

export function attachLegacyMapData(
  document: MapDocument,
  mapInfoEntries: MapInfoEntry[],
  npcEntries: LegacyNpcEntry[],
  monsterEntries: LegacyMonsterEntry[]
): MapDocument {
  const metadata = resolveMapInfo(document, mapInfoEntries);
  const matchKeys = buildMapMatchKeys(document, metadata);
  const overlays: MapOverlayEntry[] = [];

  for (const npc of npcEntries) {
    if (!matchKeys.has(normalizeMapKey(npc.mapId))) continue;
    overlays.push({
      id: `npc:${npc.id}`,
      kind: "npc",
      label: npc.name || `NPC ${npc.id}`,
      radius: 1,
      sourceId: npc.id,
      subtitle: npc.openUi || (npc.talkId > 0 ? `Talk ${npc.talkId}` : "NPC"),
      targetMapId: null,
      x: npc.x,
      y: npc.y
    });
    if (npc.teleportMapId && npc.teleportMapId !== "0") {
      overlays.push({
        id: `teleport:${npc.id}`,
        kind: "teleport",
        label: npc.name || `Teleport ${npc.id}`,
        radius: Math.max(1, npc.teleportRange),
        sourceId: npc.id,
        subtitle:
          npc.teleportX > 0 || npc.teleportY > 0
            ? `${npc.teleportMapId} -> ${npc.teleportX}, ${npc.teleportY}`
            : npc.teleportMapId,
        targetMapId: npc.teleportMapId,
        x: npc.x,
        y: npc.y
      });
    }
  }

  for (const monster of monsterEntries) {
    if (!matchKeys.has(normalizeMapKey(monster.mapId))) continue;
    overlays.push({
      id: `monster:${monster.monsterId}:${monster.x}:${monster.y}`,
      kind: "monster",
      label: `MON ${monster.monsterId}`,
      radius: Math.max(1, monster.radius),
      sourceId: monster.monsterId,
      subtitle:
        monster.count > 0
          ? `${monster.count} spawn · ${monster.respawnSeconds || 0}s`
          : `${monster.respawnSeconds || 0}s respawn`,
      targetMapId: null,
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
