import type { EditorDocument, ImageDocument, UiLayoutDocument, WorkspaceAsset, WorkspaceAssetKind } from "./types";
import { parseAtlasDocument, parseBizDocument, parseLegacyUILayoutText, parseMapDocument } from "./formats";

export type WorkspaceScanResult = {
  assets: WorkspaceAsset[];
  rootHandle: FileSystemDirectoryHandle | null;
  label: string;
  writable: boolean;
};

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/");
}

function detectAssetKind(path: string, extension: string): WorkspaceAssetKind {
  const normalized = normalizePath(path).toLowerCase();
  if (normalized.includes("/uilayout/")) return "ui-layout";
  if (normalized.includes("/uilayout-json/") && extension === ".json") return "ui-layout";
  if (extension === ".plist" || normalized.includes("/uipic/")) return "atlas";
  if (extension === ".biz") return "biz";
  if (extension === ".mapo") return "map";
  if ([".png", ".jpg", ".jpeg", ".webp"].includes(extension)) return "image";
  if ([".txt", ".json", ".ini", ".csv", ".md", ".lua", ".diz", ".tiz", ".xml"].includes(extension)) return "text";
  return "unknown";
}

async function* walkDirectory(handle: FileSystemDirectoryHandle, prefix = ""): AsyncGenerator<WorkspaceAsset> {
  for await (const [entryName, entryHandle] of handle.entries()) {
    const relativePath = prefix ? `${prefix}/${entryName}` : entryName;
    if (entryHandle.kind === "directory") {
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

export async function scanWorkspace(rootHandle: FileSystemDirectoryHandle): Promise<WorkspaceScanResult> {
  const assets: WorkspaceAsset[] = [];
  for await (const asset of walkDirectory(rootHandle)) {
    const normalized = asset.path.toLowerCase();
    if (
      normalized.includes("/node_modules/") ||
      normalized.includes("/.git/") ||
      normalized.includes("/dist/") ||
      normalized.includes("/.next/")
    ) {
      continue;
    }
    assets.push(asset);
  }
  assets.sort((left, right) => left.path.localeCompare(right.path));
  return { assets, label: rootHandle.name, rootHandle, writable: true };
}

export async function openWorkspaceDirectory(): Promise<WorkspaceScanResult> {
  if (!window.showDirectoryPicker) throw new Error("当前浏览器不支持目录选择 API，请使用桌面版 Edge/Chrome。");
  const rootHandle = await window.showDirectoryPicker({ id: "brm-ui-studio-workspace" });
  if (rootHandle.requestPermission) {
    const permission = await rootHandle.requestPermission({ mode: "readwrite" });
    if (permission !== "granted") throw new Error("未授予工作区读写权限。");
  }
  return scanWorkspace(rootHandle);
}

async function getAssetFile(asset: WorkspaceAsset): Promise<File> {
  if (asset.file) return asset.file;
  if (asset.handle) return asset.handle.getFile();
  throw new Error(`Asset file unavailable: ${asset.path}`);
}

export async function openWorkspaceFiles(fileList: FileList | File[], label?: string): Promise<WorkspaceScanResult> {
  const files = Array.from(fileList);
  const assets: WorkspaceAsset[] = files
    .map((file) => {
      const relativePath = normalizePath(file.webkitRelativePath || file.name);
      const extension = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")).toLowerCase() : "";
      return {
        extension,
        file,
        handle: null,
        id: relativePath,
        kind: detectAssetKind(relativePath, extension),
        name: file.name,
        path: relativePath,
        source: "upload" as const,
        writable: false
      };
    })
    .filter((asset) => {
      const normalized = asset.path.toLowerCase();
      return (
        !normalized.includes("/node_modules/") &&
        !normalized.includes("/.git/") &&
        !normalized.includes("/dist/") &&
        !normalized.includes("/.next/")
      );
    })
    .sort((left, right) => left.path.localeCompare(right.path));

  const derivedLabel =
    label ||
    (() => {
      const firstPath = assets[0]?.path ?? "";
      return firstPath.includes("/") ? firstPath.split("/")[0] || "Imported Folder" : "Imported Folder";
    })();

  return {
    assets,
    label: derivedLabel,
    rootHandle: null,
    writable: false
  };
}

export async function readAssetText(asset: WorkspaceAsset): Promise<string> {
  const file = await getAssetFile(asset);
  return file.text();
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
    return parseMapDocument(id, asset.name, asset.path, await readAssetBuffer(asset));
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
