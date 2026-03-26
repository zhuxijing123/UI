import luaparse from "luaparse";

import type {
  AtlasDocument,
  AtlasFrameDocument,
  BizDocument,
  BizFileDocument,
  BizFrame,
  LegacyUILayoutNode,
  MapDocument,
  UiHierarchyNode
} from "./types";

type LuaChunk = {
  body?: Array<{
    type?: string;
    variables?: Array<{ type?: string; name?: string }>;
    init?: LuaExpression[];
  }>;
};

type LuaExpression =
  | {
      type: "NumericLiteral";
      value: number;
    }
  | {
      type: "StringLiteral";
      value?: string | null;
      raw?: string;
    }
  | {
      type: "BooleanLiteral";
      value: boolean;
    }
  | {
      type: "NilLiteral";
    }
  | {
      type: "UnaryExpression";
      operator: string;
      argument: LuaExpression;
    }
  | {
      type: "TableConstructorExpression";
      fields: Array<
        | { type: "TableValue"; value: LuaExpression }
        | { type: "TableKeyString"; key: { name: string }; value: LuaExpression }
        | { type: "TableKey"; key: LuaExpression; value: LuaExpression }
      >;
    };

type PlistScalar = string | number | boolean | null;
interface PlistDict {
  [key: string]: PlistValue;
}
type PlistValue = PlistScalar | PlistDict | PlistValue[];

function parseLuaStringLiteral(node: Extract<LuaExpression, { type: "StringLiteral" }>): string {
  if (typeof node.value === "string") return node.value;
  const raw = typeof node.raw === "string" ? node.raw : "";
  if (!raw) return "";
  const long = raw.match(/^\[(=*)\[/);
  if (long) {
    const eq = long[1] ?? "";
    const end = `]${eq}]`;
    if (raw.endsWith(end)) {
      return raw.slice(2 + eq.length, raw.length - end.length);
    }
  }
  const q = raw[0];
  if ((q === "\"" || q === "'") && raw.endsWith(q)) {
    return raw.slice(1, -1).replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\t/g, "\t").replace(/\\\\/g, "\\");
  }
  return raw;
}

function luaToValue(node: LuaExpression): unknown {
  switch (node.type) {
    case "NumericLiteral":
      return node.value;
    case "StringLiteral":
      return parseLuaStringLiteral(node);
    case "BooleanLiteral":
      return node.value;
    case "NilLiteral":
      return null;
    case "UnaryExpression":
      if (node.operator === "-" && node.argument.type === "NumericLiteral") {
        return -node.argument.value;
      }
      throw new Error(`Unsupported unary expression: ${node.operator}`);
    case "TableConstructorExpression": {
      const arr: unknown[] = [];
      const obj: Record<string, unknown> = {};
      let keyed = false;
      for (const field of node.fields) {
        if (field.type === "TableValue") {
          arr.push(luaToValue(field.value));
          continue;
        }
        keyed = true;
        if (field.type === "TableKeyString") {
          obj[field.key.name] = luaToValue(field.value);
          continue;
        }
        const key = luaToValue(field.key);
        obj[String(key)] = luaToValue(field.value);
      }
      if (keyed && arr.length > 0) obj.__array = arr;
      return keyed ? obj : arr;
    }
    default:
      throw new Error(`Unsupported Lua node: ${(node as { type?: string }).type ?? "unknown"}`);
  }
}

function findLuaRet(ast: LuaChunk): unknown {
  for (const statement of ast.body ?? []) {
    if (statement.type !== "AssignmentStatement") continue;
    const variables = statement.variables ?? [];
    const init = statement.init ?? [];
    for (let index = 0; index < variables.length; index += 1) {
      const variable = variables[index];
      if (variable?.type !== "Identifier" || variable.name !== "LUA_RET") continue;
      const value = init[index];
      if (!value) throw new Error("LUA_RET assignment missing value");
      return luaToValue(value);
    }
  }
  throw new Error("Missing LUA_RET assignment");
}

export function parseLegacyUILayoutText(text: string, format: "json" | "lua"): LegacyUILayoutNode[] {
  if (format === "json") {
    const value = JSON.parse(text) as unknown;
    if (!Array.isArray(value)) throw new Error("UI layout JSON root must be an array");
    return value as LegacyUILayoutNode[];
  }
  const ast = luaparse.parse(text, {
    comments: false,
    luaVersion: "5.1",
    scope: false
  }) as LuaChunk;
  const value = findLuaRet(ast);
  if (!Array.isArray(value)) throw new Error("LUA_RET root must be an array");
  return value as LegacyUILayoutNode[];
}

function quoteLuaString(value: string): string {
  return `'${value
    .replace(/\\/g, "\\\\")
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n")
    .replace(/\t/g, "\\t")
    .replace(/'/g, "\\'")}'`;
}

function serializeLuaValue(value: unknown): string {
  if (value === null || value === undefined) return "nil";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "0";
  if (typeof value === "string") return quoteLuaString(value);
  if (Array.isArray(value)) {
    return `{${value.map((entry) => serializeLuaValue(entry)).join(",")}}`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([key]) => key !== "__array")
      .map(([key, entry]) => `${key}=${serializeLuaValue(entry)}`);
    const extras = Array.isArray((value as { __array?: unknown[] }).__array)
      ? (value as { __array?: unknown[] }).__array!.map((entry) => serializeLuaValue(entry))
      : [];
    return `{${[...entries, ...extras].join(",")}}`;
  }
  return quoteLuaString(String(value));
}

export function serializeLegacyUILayout(document: LegacyUILayoutNode[], format: "json" | "lua"): string {
  if (format === "json") return `${JSON.stringify(document, null, 2)}\n`;
  return `LUA_RET=${serializeLuaValue(document)}\n`;
}

export function buildUiHierarchy(nodes: LegacyUILayoutNode[]): UiHierarchyNode[] {
  const wrapped = new Map<number, UiHierarchyNode>();
  for (const node of nodes) {
    wrapped.set(node.id, { node, children: [] });
  }
  const roots: UiHierarchyNode[] = [];
  for (const node of nodes) {
    const current = wrapped.get(node.id);
    if (!current) continue;
    if (node.parent === 0) {
      roots.push(current);
      continue;
    }
    const parent = wrapped.get(node.parent);
    if (parent) parent.children.push(current);
    else roots.push(current);
  }
  return roots;
}

export function parseBizDocument(
  id: string,
  name: string,
  sourcePath: string,
  buffer: ArrayBuffer,
  imageHandle: FileSystemFileHandle | null,
  imagePath: string | null,
  imageUrl: string | null
): BizDocument {
  const view = new DataView(buffer);
  let offset = 0;
  const canRead = (size: number) => offset + size <= view.byteLength;
  const readI32 = (): number => {
    if (!canRead(4)) throw new Error(`biz overflow at ${offset}`);
    const value = view.getInt32(offset, true);
    offset += 4;
    return value;
  };
  const readI16 = (): number => {
    if (!canRead(2)) throw new Error(`biz overflow at ${offset}`);
    const value = view.getInt16(offset, true);
    offset += 2;
    return value;
  };
  const readU16 = (): number => {
    if (!canRead(2)) throw new Error(`biz overflow at ${offset}`);
    const value = view.getUint16(offset, true);
    offset += 2;
    return value;
  };

  const fileCount = readI32();
  const files: BizFileDocument[] = [];
  for (let fileIndex = 0; fileIndex < fileCount; fileIndex += 1) {
    if (!canRead(4)) break;
    const fileId = readI32();
    if (fileId <= 0) continue;
    const fileW = readI16();
    const fileH = readI16();
    const frameNum = readU16();
    let dirCount = readU16();
    const frameCount = readU16();
    if (dirCount === 1) dirCount = 5;
    const frames: BizFrame[] = [];
    for (let frameCursor = 0; frameCursor < frameNum; frameCursor += 1) {
      const frameId = readI32();
      const x = readI16();
      const y = readI16();
      const w = readI16();
      const h = readI16();
      const ox = readI16();
      const oy = readI16();
      const sourceW = readI16();
      const sourceH = readI16();
      const rotatedFlag = readI16();
      const dir = Math.floor(frameId / 10000);
      const frameIndexValue = frameId % 10000;
      frames.push({
        dir,
        fileId,
        frameId,
        frameIndex: frameIndexValue,
        h,
        ox,
        oy,
        rotated: rotatedFlag > 0,
        sourceH,
        sourceW,
        w,
        x,
        y
      });
    }
    files.push({
      dirCount,
      fileH,
      fileId,
      fileW,
      frameCount,
      frames
    });
  }
  return { kind: "biz", id, name, sourcePath, imageHandle, imagePath, imageUrl, files };
}

export function parseMapDocument(id: string, name: string, sourcePath: string, buffer: ArrayBuffer): MapDocument {
  const view = new DataView(buffer);
  let offset = 0;
  const readI16 = (): number => {
    const value = view.getInt16(offset, true);
    offset += 2;
    return value;
  };
  const readU8 = (): number => {
    const value = view.getUint8(offset);
    offset += 1;
    return value;
  };
  const version = readI16();
  if (version !== 4) throw new Error(`Unsupported mapo version: ${version}`);
  const groundWidth = readI16();
  const groundHeight = readI16();
  const logicWidth = readI16();
  const logicHeight = readI16();
  const groundDir = readU8();
  const total = logicWidth * logicHeight;
  const blockData = new Uint8Array(total);
  let cursor = 0;
  while (cursor < total && offset < view.byteLength) {
    const value = readU8();
    const count = readU8();
    blockData.fill(value, cursor, cursor + count);
    cursor += count;
  }
  return {
    blockData,
    groundDir,
    groundHeight,
    groundWidth,
    id,
    kind: "map",
    logicHeight,
    logicWidth,
    name,
    sourcePath,
    version
  };
}

export function serializeMapDocument(document: MapDocument): Uint8Array {
  const header = new Uint8Array(11);
  const view = new DataView(header.buffer);
  view.setInt16(0, document.version, true);
  view.setInt16(2, document.groundWidth, true);
  view.setInt16(4, document.groundHeight, true);
  view.setInt16(6, document.logicWidth, true);
  view.setInt16(8, document.logicHeight, true);
  view.setUint8(10, document.groundDir);
  const encoded: number[] = [];
  for (let index = 0; index < document.blockData.length; ) {
    const value = document.blockData[index] ?? 0;
    let run = 1;
    while (index + run < document.blockData.length && document.blockData[index + run] === value && run < 255) {
      run += 1;
    }
    encoded.push(value, run);
    index += run;
  }
  const output = new Uint8Array(header.length + encoded.length);
  output.set(header, 0);
  output.set(encoded, header.length);
  return output;
}

function parsePlistXml(xml: string): PlistDict {
  class Parser {
    private readonly xmlText: string;
    private position = 0;

    constructor(text: string) {
      this.xmlText = text;
    }

    private skipWhitespace(): void {
      while (this.position < this.xmlText.length && /\s/.test(this.xmlText[this.position] ?? "")) {
        this.position += 1;
      }
    }

    private readTag(): { name: string; closing: boolean; raw: string } | null {
      const start = this.xmlText.indexOf("<", this.position);
      if (start < 0) return null;
      const end = this.xmlText.indexOf(">", start + 1);
      if (end < 0) throw new Error("Malformed plist tag");
      this.position = end + 1;
      const raw = this.xmlText.slice(start + 1, end).trim();
      if (!raw || raw.startsWith("?") || raw.startsWith("!")) return this.readTag();
      const closing = raw.startsWith("/");
      const name = (closing ? raw.slice(1) : raw).split(/\s+/)[0]?.replace(/\/$/, "") ?? "";
      return { closing, name, raw };
    }

    private readText(): string {
      const start = this.position;
      const end = this.xmlText.indexOf("<", start);
      if (end < 0) throw new Error("Malformed plist text");
      this.position = end;
      return this.xmlText.slice(start, end).trim();
    }

    private parseArray(): PlistValue[] {
      const values: PlistValue[] = [];
      while (true) {
        this.skipWhitespace();
        const next = this.readTag();
        if (!next) throw new Error("Unexpected EOF in plist array");
        if (next.closing && next.name === "array") break;
        this.position -= next.raw.length + 2;
        values.push(this.parseValue());
      }
      return values;
    }

    private parseDict(): PlistDict {
      const value: PlistDict = {};
      while (true) {
        this.skipWhitespace();
        const keyTag = this.readTag();
        if (!keyTag) throw new Error("Unexpected EOF in plist dict");
        if (keyTag.closing && keyTag.name === "dict") break;
        if (keyTag.name !== "key" || keyTag.closing) throw new Error("Expected plist key");
        const key = decodeXml(this.readText());
        const endKey = this.readTag();
        if (!endKey || endKey.name !== "key" || !endKey.closing) throw new Error("Malformed plist key");
        value[key] = this.parseValue();
      }
      return value;
    }

    parseValue(): PlistValue {
      this.skipWhitespace();
      const tag = this.readTag();
      if (!tag) throw new Error("Unexpected EOF in plist");
      if (!tag.closing && tag.name === "dict") return this.parseDict();
      if (!tag.closing && tag.name === "array") return this.parseArray();
      if (!tag.closing && tag.name === "string") {
        const text = decodeXml(this.readText());
        const endTag = this.readTag();
        if (!endTag || endTag.name !== "string" || !endTag.closing) throw new Error("Malformed plist string");
        return text;
      }
      if (!tag.closing && tag.name === "integer") {
        const value = Number(this.readText());
        const endTag = this.readTag();
        if (!endTag || endTag.name !== "integer" || !endTag.closing) throw new Error("Malformed plist integer");
        return value;
      }
      if (tag.name === "true" || tag.name === "false") return tag.name === "true";
      throw new Error(`Unsupported plist tag ${tag.raw}`);
    }
  }

  const parser = new Parser(xml);
  while (true) {
    const tag = parser["readTag"]();
    if (!tag) throw new Error("Missing plist root");
    if (!tag.closing && tag.name === "dict") {
      parser["position"] -= tag.raw.length + 2;
      const value = parser.parseValue();
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid plist root");
      return value;
    }
  }
}

function decodeXml(value: string): string {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", "\"")
    .replaceAll("&apos;", "'");
}

function extractNumbers(input: string): number[] {
  return (input.match(/-?\d+(?:\.\d+)?/g) ?? []).map((value) => Math.round(Number(value)));
}

function parseRect(input: string): { x: number; y: number; w: number; h: number } {
  const values = extractNumbers(input);
  if (values.length < 4) throw new Error(`Invalid rect ${input}`);
  return { x: values[0] ?? 0, y: values[1] ?? 0, w: values[2] ?? 0, h: values[3] ?? 0 };
}

function parseSize(input: string): { w: number; h: number } {
  const values = extractNumbers(input);
  if (values.length < 2) throw new Error(`Invalid size ${input}`);
  return { w: values[0] ?? 0, h: values[1] ?? 0 };
}

function isPlistDict(value: PlistValue | undefined): value is PlistDict {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseAtlasDocument(
  id: string,
  name: string,
  sourcePath: string,
  text: string,
  imageHandle: FileSystemFileHandle | null,
  imageUrl: string | null
): AtlasDocument {
  const raw = sourcePath.endsWith(".plist")
    ? { kind: "plist" as const, data: parsePlistXml(text) }
    : {
        kind: "json" as const,
        data: JSON.parse(text) as { frames?: Record<string, unknown>; meta?: { image?: string } }
      };

  const framesSource =
    raw.kind === "plist"
      ? (isPlistDict(raw.data.frames) ? raw.data.frames : undefined)
      : raw.data.frames;
  if (!framesSource) throw new Error("Atlas document missing frames");

  const frames: AtlasFrameDocument[] = [];
  for (const [frameName, frameValue] of Object.entries(framesSource)) {
    if (!frameValue || typeof frameValue !== "object") continue;
    if (raw.kind === "plist") {
      const frameDict = frameValue as PlistDict;
      const frame = parseRect(String(frameDict.frame ?? "{{0,0},{0,0}}"));
      const sourceSize = parseSize(String(frameDict.sourceSize ?? "{0,0}"));
      const sourceColorRect = parseRect(String(frameDict.sourceColorRect ?? "{{0,0},{0,0}}"));
      const rotated = Boolean(frameDict.rotated);
      frames.push({
        frame,
        name: frameName,
        rotated,
        sourceSize,
        spriteSourceSize: {
          x: sourceColorRect.x,
          y: sourceColorRect.y,
          w: sourceColorRect.w || frame.w,
          h: sourceColorRect.h || frame.h
        },
        trimmed:
          sourceColorRect.x !== 0 ||
          sourceColorRect.y !== 0 ||
          sourceColorRect.w !== sourceSize.w ||
          sourceColorRect.h !== sourceSize.h
      });
      continue;
    }
    const frameDict = frameValue as {
      frame: { x: number; y: number; w: number; h: number };
      rotated: boolean;
      trimmed: boolean;
      spriteSourceSize: { x: number; y: number; w: number; h: number };
      sourceSize: { w: number; h: number };
    };
    frames.push({
      frame: frameDict.frame,
      name: frameName,
      rotated: frameDict.rotated,
      sourceSize: frameDict.sourceSize,
      spriteSourceSize: frameDict.spriteSourceSize,
      trimmed: frameDict.trimmed
    });
  }

  const imagePath =
    imageHandle?.name ??
    (raw.kind === "json" && typeof raw.data.meta?.image === "string"
      ? raw.data.meta.image
      : "");

  return {
    frames: frames.sort((left, right) => left.name.localeCompare(right.name)),
    id,
    imageHandle,
    imagePath,
    imageUrl,
    kind: "atlas",
    name,
    sourcePath
  };
}
