import { parseAtlasDocument, parseBitmapFontText } from "./formats";
import type { AtlasFrameDocument, LegacyBitmapFont, WorkspaceAsset } from "./types";
import { createAssetObjectUrl, readAssetBuffer, readAssetText } from "./workspace";

export type LegacyLayoutResource = {
  kind: "atlas-frame" | "image";
  source: string;
  url: string;
};

export type LegacyBitmapFontResource = {
  font: LegacyBitmapFont;
  kind: "bitmap-font";
  source: string;
  url: string;
};

export async function buildLegacyLayoutResources(
  requestedResources: string[],
  assets: WorkspaceAsset[]
): Promise<{ cleanup: () => void; resources: Record<string, LegacyLayoutResource> }> {
  const resources: Record<string, LegacyLayoutResource> = {};
  const cleanupUrls: string[] = [];
  const atlasAssets = assets.filter((asset) => asset.kind === "atlas");
  const requestedSet = new Set(requestedResources.filter(Boolean));

  for (const request of requestedSet) {
    const imageAsset = findImageAssetForRequest(request, assets);
    if (imageAsset) {
      const objectUrl = await createAssetObjectUrl(imageAsset);
      cleanupUrls.push(objectUrl);
      resources[request] = {
        kind: "image",
        source: imageAsset.path,
        url: objectUrl
      };
      continue;
    }

    for (const atlasAsset of atlasAssets) {
      const atlasFrame = await findAtlasFrameForRequest(atlasAsset, request, assets);
      if (!atlasFrame) continue;
      resources[request] = atlasFrame;
      break;
    }
  }

  return {
    cleanup: () => {
      for (const url of cleanupUrls) URL.revokeObjectURL(url);
    },
    resources
  };
}

export async function buildLegacyBitmapFontResources(
  requestedFonts: string[],
  assets: WorkspaceAsset[]
): Promise<{ cleanup: () => void; resources: Record<string, LegacyBitmapFontResource> }> {
  const resources: Record<string, LegacyBitmapFontResource> = {};
  const requestedSet = new Set(requestedFonts.filter(Boolean));

  for (const request of requestedSet) {
    const fontAsset = findBitmapFontAssetForRequest(request, assets);
    if (!fontAsset) continue;

    const text = await readAssetText(fontAsset);
    const font = parseBitmapFontText(text);
    const imageAsset = findBitmapFontImageAsset(fontAsset, font, assets);
    if (!imageAsset) continue;

    const objectUrl = await createAssetObjectUrl(imageAsset);
    resources[request] = {
      font,
      kind: "bitmap-font",
      source: `${fontAsset.path}#${font.font || request}`,
      url: objectUrl
    };
  }

  return {
    // Bitmap-font glyph backgrounds may still resolve after the viewport unmounts.
    // Eager revocation causes spurious blob request failures during sequential smoke runs.
    cleanup: () => undefined,
    resources
  };
}

function findImageAssetForRequest(request: string, assets: WorkspaceAsset[]): WorkspaceAsset | null {
  const normalized = request.trim().toLowerCase();
  if (!normalized) return null;

  const directCandidates = [normalized];
  if (!/\.(png|jpg|jpeg|webp)$/i.test(normalized)) {
    directCandidates.push(`${normalized}.png`, `${normalized}.jpg`, `${normalized}.jpeg`, `${normalized}.webp`);
  }
  const tailCandidates = directCandidates.map((candidate) => candidate.split("/").pop() ?? candidate);

  return (
    assets.find(
      (asset) =>
        asset.kind === "image" &&
        (directCandidates.includes(asset.path.toLowerCase()) ||
          directCandidates.includes(asset.name.toLowerCase()) ||
          tailCandidates.includes(asset.name.toLowerCase()) ||
          tailCandidates.some((candidate) => asset.path.toLowerCase().endsWith(`/${candidate}`)))
    ) ?? null
  );
}

function findBitmapFontAssetForRequest(request: string, assets: WorkspaceAsset[]): WorkspaceAsset | null {
  const normalized = request.trim().toLowerCase();
  if (!normalized) return null;

  const directCandidates = [normalized];
  if (!normalized.endsWith(".fnt")) directCandidates.push(`${normalized}.fnt`);
  const tailCandidates = directCandidates.map((candidate) => candidate.split("/").pop() ?? candidate);

  return (
    assets.find((asset) => {
      const path = asset.path.toLowerCase();
      const name = asset.name.toLowerCase();
      return (
        asset.extension === ".fnt" &&
        (directCandidates.includes(path) ||
          directCandidates.includes(name) ||
          tailCandidates.includes(name) ||
          tailCandidates.some((candidate) => path.endsWith(`/${candidate}`)))
      );
    }) ?? null
  );
}

async function findAtlasFrameForRequest(
  atlasAsset: WorkspaceAsset,
  request: string,
  assets: WorkspaceAsset[]
): Promise<LegacyLayoutResource | null> {
  const imageAsset = findSiblingImageAsset(atlasAsset, assets);
  if (!imageAsset) return null;

  const text = await readAssetText(atlasAsset);
  const atlasDoc = parseAtlasDocument("layout-atlas", atlasAsset.name, atlasAsset.path, text, null, null);
  const frame = atlasDoc.frames.find((entry) => entry.name.toLowerCase() === request.toLowerCase());
  if (!frame) return null;

  const url = await extractAtlasFrameDataUrl(imageAsset, frame);
  return {
    kind: "atlas-frame",
    source: `${atlasAsset.path}#${frame.name}`,
    url
  };
}

function findSiblingImageAsset(asset: WorkspaceAsset, assets: WorkspaceAsset[]): WorkspaceAsset | null {
  const basePath = asset.path.slice(0, Math.max(0, asset.path.lastIndexOf(".")));
  const candidates = [`${basePath}.png`, `${basePath}.jpg`, `${basePath}.webp`];
  return assets.find((candidate) => candidates.includes(candidate.path)) ?? null;
}

function findBitmapFontImageAsset(
  fontAsset: WorkspaceAsset,
  font: LegacyBitmapFont,
  assets: WorkspaceAsset[]
): WorkspaceAsset | null {
  const basePath = fontAsset.path.includes("/") ? fontAsset.path.slice(0, fontAsset.path.lastIndexOf("/")) : "";
  const directPath = basePath ? `${basePath}/${font.image}` : font.image;
  const normalizedDirectPath = directPath.toLowerCase();
  const normalizedImageName = font.image.toLowerCase();

  return (
    assets.find(
      (candidate) =>
        candidate.kind === "image" &&
        (candidate.path.toLowerCase() === normalizedDirectPath ||
          candidate.name.toLowerCase() === normalizedImageName ||
          candidate.path.toLowerCase().endsWith(`/${normalizedImageName}`))
    ) ?? null
  );
}

async function extractAtlasFrameDataUrl(imageAsset: WorkspaceAsset, frame: AtlasFrameDocument): Promise<string> {
  const bytes = await readAssetBuffer(imageAsset);
  const blob = new Blob([bytes]);
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, frame.frame.w);
    canvas.height = Math.max(1, frame.frame.h);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D context unavailable for atlas extraction.");
    context.drawImage(
      bitmap,
      frame.frame.x,
      frame.frame.y,
      frame.frame.w,
      frame.frame.h,
      0,
      0,
      frame.frame.w,
      frame.frame.h
    );
    return canvas.toDataURL();
  } finally {
    bitmap.close();
  }
}
