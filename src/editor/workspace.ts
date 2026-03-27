import type { EditorDocument, ImageDocument, UiLayoutDocument, WorkspaceAsset, WorkspaceAssetKind } from "./types";
import {
  parseAtlasDocument,
  parseBitmapFontDocument,
  parseBizDocument,
  parseLegacyUILayoutText,
  parseMapDocument
} from "./formats";
import {
  attachLegacyMapData,
  parseLegacyMapInfoText,
  parseLegacyMonsterDefText,
  parseLegacyMonsterText,
  parseLegacyNpcText
} from "./legacy-map-data";

export type WorkspaceScanResult = {
  assets: WorkspaceAsset[];
  rootHandle: FileSystemDirectoryHandle | null;
  label: string;
  writable: boolean;
};

export type WorkspaceProgressSnapshot = {
  phase: "prepare" | "scan" | "finalize" | "complete";
  source: "fs-access" | "upload";
  message: string;
  processedCount: number;
  totalCount: number | null;
  currentPath: string | null;
};

export type WorkspaceProgressOptions = {
  onProgress?: (progress: WorkspaceProgressSnapshot) => void;
};

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/");
}

// 需要跳过的目录名（不区分大小写）
const SKIP_DIRECTORY_NAMES = new Set([
  "node_modules",
  ".git",
  ".svn",
  ".hg",
  ".codex",
  ".vscode",
  ".idea",
  "dist",
  "build",
  "out",
  ".next",
  ".nuxt",
  ".cache",
  "__pycache__",
  ".DS_Store",
  "Thumbs.db"
]);

function shouldSkipDirectory(name: string): boolean {
  return SKIP_DIRECTORY_NAMES.has(name.toLowerCase()) || name.startsWith(".");
}

function detectAssetKind(path: string, extension: string): WorkspaceAssetKind {
  const normalized = normalizePath(path).toLowerCase();
  if ([".png", ".jpg", ".jpeg", ".webp"].includes(extension)) return "image";
  if (normalized.includes("/uilayout/")) return "ui-layout";
  if (normalized.includes("/uilayout-json/") && extension === ".json") return "ui-layout";
  if (extension === ".plist" || normalized.includes("/uipic/")) return "atlas";
  if (extension === ".fnt") return "bitmap-font";
  if (extension === ".biz") return "biz";
  if (extension === ".mapo") return "map";
  if ([".txt", ".json", ".ini", ".csv", ".md", ".lua", ".diz", ".tiz", ".xml"].includes(extension)) return "text";
  return "unknown";
}

async function* walkDirectory(handle: FileSystemDirectoryHandle, prefix = ""): AsyncGenerator<WorkspaceAsset> {
  for await (const [entryName, entryHandle] of handle.entries()) {
    const relativePath = prefix ? `${prefix}/${entryName}` : entryName;
    if (entryHandle.kind === "directory") {
      // 在目录级别就跳过不需要的文件夹，提高效率
      if (shouldSkipDirectory(entryName)) {
        continue;
      }
      yield* walkDirectory(entryHandle as FileSystemDirectoryHandle, relativePath);
      continue;
    }
    const fileHandle = entryHandle as FileSystemFileHandle;
    const extension = entryName.includes(".") ? entryName.slice(entryName.lastIndexOf(".")).toLowerCase() : "";
    yield {
      extension,
      file: null,
      handle: fileHandle,
      id: normalizePath(relativePath),
      kind: detectAssetKind(relativePath, extension),
      name: entryName,
      path: normalizePath(relativePath),
      source: "fs-access",
      writable: true
    };
  }
}

function emitWorkspaceProgress(
  options: WorkspaceProgressOptions | undefined,
  progress: WorkspaceProgressSnapshot
): void {
  options?.onProgress?.(progress);
}

export async function scanWorkspace(
  rootHandle: FileSystemDirectoryHandle,
  options?: WorkspaceProgressOptions
): Promise<WorkspaceScanResult> {
  const assets: WorkspaceAsset[] = [];
  let processedCount = 0;
  let lastEmitAt = 0;

  emitWorkspaceProgress(options, {
    currentPath: rootHandle.name,
    message: `Reading ${rootHandle.name}...`,
    phase: "prepare",
    processedCount: 0,
    source: "fs-access",
    totalCount: null
  });

  for await (const asset of walkDirectory(rootHandle)) {
    processedCount += 1;
    // 额外的文件级别过滤（目录已在 walkDirectory 中过滤）
    const normalized = asset.path.toLowerCase();
    if (
      normalized.includes("/node_modules/") ||
      normalized.includes("/.git/") ||
      normalized.includes("/.codex/") ||
      normalized.includes("/.vscode/") ||
      normalized.includes("/.idea/") ||
      normalized.includes("/dist/") ||
      normalized.includes("/build/") ||
      normalized.includes("/.next/")
    ) {
      continue;
    }
    assets.push(asset);

    const now = Date.now();
    if (processedCount <= 12 || processedCount % 25 === 0 || now - lastEmitAt >= 180) {
      lastEmitAt = now;
      emitWorkspaceProgress(options, {
        currentPath: asset.path,
        message: `Indexed ${assets.length} assets`,
        phase: "scan",
        processedCount,
        source: "fs-access",
        totalCount: null
      });
    }
  }
  assets.sort((left, right) => left.path.localeCompare(right.path));
  emitWorkspaceProgress(options, {
    currentPath: rootHandle.name,
    message: `Loaded ${assets.length} assets from ${rootHandle.name}`,
    phase: "complete",
    processedCount,
    source: "fs-access",
    totalCount: processedCount
  });
  return { assets, label: rootHandle.name, rootHandle, writable: true };
}

export async function openWorkspaceDirectory(options?: WorkspaceProgressOptions): Promise<WorkspaceScanResult> {
  if (!window.showDirectoryPicker) throw new Error("当前浏览器不支持目录选择 API，请使用桌面版 Edge/Chrome。");
  emitWorkspaceProgress(options, {
    currentPath: null,
    message: "Waiting for directory selection...",
    phase: "prepare",
    processedCount: 0,
    source: "fs-access",
    totalCount: null
  });
  const rootHandle = await window.showDirectoryPicker({ id: "brm-ui-studio-workspace" });
  if (rootHandle.requestPermission) {
    const permission = await rootHandle.requestPermission({ mode: "readwrite" });
    if (permission !== "granted") throw new Error("未授予工作区读写权限。");
  }
  return scanWorkspace(rootHandle, options);
}

async function getAssetFile(asset: WorkspaceAsset): Promise<File> {
  if (asset.file) return asset.file;
  if (asset.handle) return asset.handle.getFile();
  throw new Error(`Asset file unavailable: ${asset.path}`);
}

export async function openWorkspaceFiles(
  fileList: FileList | File[],
  label?: string,
  options?: WorkspaceProgressOptions
): Promise<WorkspaceScanResult> {
  const files = Array.from(fileList);
  const assets: WorkspaceAsset[] = [];

  emitWorkspaceProgress(options, {
    currentPath: null,
    message: `Preparing ${files.length} imported files...`,
    phase: "prepare",
    processedCount: 0,
    source: "upload",
    totalCount: files.length
  });

  for (const [index, file] of files.entries()) {
    const relativePath = normalizePath(file.webkitRelativePath || file.name);
    const extension = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")).toLowerCase() : "";
    const asset: WorkspaceAsset = {
      extension,
      file,
      handle: null,
      id: relativePath,
      kind: detectAssetKind(relativePath, extension),
      name: file.name,
      path: relativePath,
      source: "upload",
      writable: false
    };

    const normalized = asset.path.toLowerCase();
    if (
      !normalized.includes("/node_modules/") &&
      !normalized.includes("/.git/") &&
      !normalized.includes("/.codex/") &&
      !normalized.includes("/.vscode/") &&
      !normalized.includes("/.idea/") &&
      !normalized.includes("/dist/") &&
      !normalized.includes("/build/") &&
      !normalized.includes("/.next/")
    ) {
      assets.push(asset);
    }

    emitWorkspaceProgress(options, {
      currentPath: relativePath,
      message: `Imported ${index + 1} / ${files.length} files`,
      phase: "scan",
      processedCount: index + 1,
      source: "upload",
      totalCount: files.length
    });
  }

  assets.sort((left, right) => left.path.localeCompare(right.path));

  const derivedLabel =
    label ||
    (() => {
      const firstPath = assets[0]?.path ?? "";
      return firstPath.includes("/") ? firstPath.split("/")[0] || "Imported Folder" : "Imported Folder";
    })();

  emitWorkspaceProgress(options, {
    currentPath: derivedLabel,
    message: `Loaded ${assets.length} assets from ${derivedLabel}`,
    phase: "complete",
    processedCount: files.length,
    source: "upload",
    totalCount: files.length
  });

  return {
    assets,
    label: derivedLabel,
    rootHandle: null,
    writable: false
  };
}

export async function readAssetText(asset: WorkspaceAsset): Promise<string> {
  return decodeBufferToText(await readAssetBuffer(asset));
}

export async function readAssetBuffer(asset: WorkspaceAsset): Promise<ArrayBuffer> {
  const file = await getAssetFile(asset);
  return file.arrayBuffer();
}

export async function createAssetObjectUrl(asset: WorkspaceAsset): Promise<string> {
  const file = await getAssetFile(asset);
  return URL.createObjectURL(file);
}

export async function writeTextFile(handle: FileSystemFileHandle, text: string): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(text);
  await writable.close();
}

export async function writeBinaryFile(handle: FileSystemFileHandle, bytes: Uint8Array): Promise<void> {
  const writable = await handle.createWritable();
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  await writable.write(buffer);
  await writable.close();
}

function slugId(path: string): string {
  return path.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();
}

function findSiblingImageAsset(asset: WorkspaceAsset, assets: WorkspaceAsset[]): WorkspaceAsset | null {
  const basePath = asset.path.slice(0, Math.max(0, asset.path.lastIndexOf(".")));
  const candidates = [`${basePath}.png`, `${basePath}.jpg`, `${basePath}.webp`];
  return assets.find((candidate) => candidates.includes(candidate.path)) ?? null;
}

function findBitmapFontImageAsset(asset: WorkspaceAsset, imageName: string, assets: WorkspaceAsset[]): WorkspaceAsset | null {
  const normalizedImageName = normalizePath(imageName).toLowerCase();
  const folder = asset.path.includes("/") ? asset.path.slice(0, asset.path.lastIndexOf("/")) : "";
  const directPath = folder ? `${folder}/${normalizedImageName}` : normalizedImageName;

  return (
    assets.find(
      (candidate) =>
        candidate.kind === "image" &&
        (candidate.path.toLowerCase() === directPath ||
          candidate.name.toLowerCase() === normalizedImageName ||
          candidate.path.toLowerCase().endsWith(`/${normalizedImageName}`))
    ) ?? null
  );
}

function findLegacyDataAsset(assets: WorkspaceAsset[], suffix: string): WorkspaceAsset | null {
  const normalizedSuffix = normalizePath(suffix).toLowerCase();
  return (
    assets.find((candidate) => candidate.path.toLowerCase().endsWith(normalizedSuffix)) ??
    assets.find((candidate) => candidate.name.toLowerCase() === normalizedSuffix.split("/").pop()) ??
    null
  );
}

function decodeBufferToText(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder("utf-8").decode(bytes.subarray(3));
  }

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    try {
      return new TextDecoder("gb18030").decode(bytes);
    } catch {
      return new TextDecoder("utf-8").decode(bytes);
    }
  }
}

export async function openAssetDocument(asset: WorkspaceAsset, assets: WorkspaceAsset[]): Promise<EditorDocument> {
  const id = slugId(asset.path);
  if (asset.kind === "ui-layout") {
    const text = await readAssetText(asset);
    const sourceFormat = asset.extension === ".lua" ? "lua" : "json";
    const document: UiLayoutDocument = {
      id,
      kind: "ui-layout",
      name: asset.name,
      nodes: parseLegacyUILayoutText(text, sourceFormat),
      sourceFormat,
      sourcePath: asset.path
    };
    return document;
  }
  if (asset.kind === "atlas") {
    const text = await readAssetText(asset);
    const imageAsset = findSiblingImageAsset(asset, assets);
    const imageUrl = imageAsset ? await createAssetObjectUrl(imageAsset) : null;
    const atlas = parseAtlasDocument(id, asset.name, asset.path, text, imageAsset?.handle ?? null, imageUrl);
    return atlas;
  }
  if (asset.kind === "bitmap-font") {
    const text = await readAssetText(asset);
    const document = parseBitmapFontDocument(id, asset.name, asset.path, text, null, null);
    const imageAsset = findBitmapFontImageAsset(asset, document.font.image, assets);
    return {
      ...document,
      imagePath: imageAsset?.path ?? null,
      imageUrl: imageAsset ? await createAssetObjectUrl(imageAsset) : null
    };
  }
  if (asset.kind === "biz") {
    const imageAsset = findSiblingImageAsset(asset, assets);
    const imageUrl = imageAsset ? await createAssetObjectUrl(imageAsset) : null;
    return parseBizDocument(
      id,
      asset.name,
      asset.path,
      await readAssetBuffer(asset),
      imageAsset?.handle ?? null,
      imageAsset?.path ?? null,
      imageUrl
    );
  }
  if (asset.kind === "map") {
    let document = parseMapDocument(id, asset.name, asset.path, await readAssetBuffer(asset));
    const [mapInfoText, npcText, monsterText, monsterDefText] = await Promise.all([
      findLegacyDataAsset(assets, "/long/mapinfo.csv"),
      findLegacyDataAsset(assets, "/long/npcgen.csv"),
      findLegacyDataAsset(assets, "/long/mongen.csv"),
      findLegacyDataAsset(assets, "/long/mondef.csv")
    ].map(async (dataAsset) => (dataAsset ? readAssetText(dataAsset) : null)));
    if (mapInfoText || npcText || monsterText || monsterDefText) {
      document = attachLegacyMapData(
        document,
        mapInfoText ? parseLegacyMapInfoText(mapInfoText) : [],
        npcText ? parseLegacyNpcText(npcText) : [],
        monsterText ? parseLegacyMonsterText(monsterText) : [],
        monsterDefText ? parseLegacyMonsterDefText(monsterDefText) : []
      );
    }
    return document;
  }
  if (asset.kind === "image") {
    const document: ImageDocument = {
      id,
      imageUrl: await createAssetObjectUrl(asset),
      kind: "image",
      name: asset.name,
      sourcePath: asset.path
    };
    return document;
  }
  return {
    id,
    kind: "text",
    name: asset.name,
    sourcePath: asset.path,
    text: await readAssetText(asset)
  };
}
