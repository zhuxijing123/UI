import { useEffect, useMemo, useRef, useState } from "react";

import {
  createAssetObjectUrl
} from "../workspace";
import type { AvatarPreviewDocument, BizFrame } from "../types";
import {
  LEGACY_GHOST_PLAYER,
  LEGACY_PERF_CLOTH,
  LEGACY_RENDER_TICK,
  computeAvatarFileId,
  findBizFileById,
  getBizFrameWithFallback,
  normalizeAvatarDir,
  resolveAvatarAction,
  resolveAvatarFileCandidates,
  resolveAvatarObjInfo
} from "../legacy-labs";

type PreviewPart = {
  kind: "cloth" | "weapon";
  frame: BizFrame;
  image: HTMLImageElement;
  x: number;
  y: number;
  width: number;
  height: number;
  flip: boolean;
};

type PreviewFrame = {
  parts: PreviewPart[];
};

type Props = {
  document: AvatarPreviewDocument;
};

const Z_ORDER_TABLE: Array<Array<"cloth" | "weapon">> = [
  ["weapon", "cloth"],
  ["cloth", "weapon"],
  ["cloth", "weapon"],
  ["cloth", "weapon"],
  ["cloth", "weapon"],
  ["cloth", "weapon"],
  ["cloth", "weapon"],
  ["cloth", "weapon"]
];

export function AvatarPreviewCanvas({ document }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [clothImageState, setClothImageState] = useState<{ assetId: string | null; image: HTMLImageElement | null }>({
    assetId: null,
    image: null
  });
  const [weaponImageState, setWeaponImageState] = useState<{ assetId: string | null; image: HTMLImageElement | null }>({
    assetId: null,
    image: null
  });

  const isPlayer = document.cloth > 0 && document.cloth < 30000;
  const selectedClothFileId =
    resolveAvatarFileCandidates(document.cloth, document.state, isPlayer).find((fileId) =>
      Boolean(document.clothImageAssets[String(fileId)])
    ) ?? computeAvatarFileId(document.cloth, 0, isPlayer);
  const selectedWeaponFileId =
    resolveAvatarFileCandidates(document.weapon, document.state, isPlayer).find((fileId) =>
      Boolean(document.weaponImageAssets[String(fileId)])
    ) ?? computeAvatarFileId(document.weapon, 0, isPlayer);

  const selectedClothAsset = document.clothImageAssets[String(selectedClothFileId)] ?? null;
  const selectedWeaponAsset = document.weaponImageAssets[String(selectedWeaponFileId)] ?? null;

  useObjectImage(selectedClothAsset, setClothImageState);
  useObjectImage(selectedWeaponAsset, setWeaponImageState);

  const clothImage = clothImageState.assetId === selectedClothAsset?.id ? clothImageState.image : null;
  const weaponImage = weaponImageState.assetId === selectedWeaponAsset?.id ? weaponImageState.image : null;

  const actionEntry = useMemo(() => {
    return resolveAvatarAction(
      document.actionInfo,
      document.cloth,
      document.cloth > 0 ? document.cloth : LEGACY_PERF_CLOTH,
      document.state,
      isPlayer
    );
  }, [document.actionInfo, document.cloth, document.state, isPlayer]);

  const data = useMemo(() => {
    if (!clothImage && !weaponImage) return null;
    const residFrames = actionEntry?.frames.length ? actionEntry.frames : [0];
    const dirInfo = normalizeAvatarDir(document.dir);
    const clothFileId =
      resolveAvatarFileCandidates(document.cloth, document.state, isPlayer).find((fileId) =>
        Boolean(findBizFileById(document.clothBank, fileId))
      ) ?? computeAvatarFileId(document.cloth, 0, isPlayer);
    const weaponFileId =
      resolveAvatarFileCandidates(document.weapon, document.state, isPlayer).find((fileId) =>
        document.weaponBank ? Boolean(findBizFileById(document.weaponBank, fileId)) : false
      ) ?? computeAvatarFileId(document.weapon, 0, isPlayer);

    const clothFile = findBizFileById(document.clothBank, clothFileId);
    const weaponFile = document.weaponBank ? findBizFileById(document.weaponBank, weaponFileId) : null;
    const baseScale =
      document.gameInfo.find((entry) => entry.id === LEGACY_GHOST_PLAYER)?.scale ||
      1;

    const frames: PreviewFrame[] = [];
    let minX = 0;
    let minY = 0;
    let maxX = 0;
    let maxY = 0;
    let first = true;

    for (const resid of residFrames) {
      const parts: PreviewPart[] = [];
      const clothPart = buildPreviewPart(
        "cloth",
        document.cloth,
        clothFile,
        clothImage,
        document.gameInfo,
        dirInfo,
        resid,
        baseScale
      );
      const weaponPart = buildPreviewPart(
        "weapon",
        document.weapon,
        weaponFile,
        weaponImage,
        document.gameInfo,
        dirInfo,
        resid,
        baseScale
      );

      if (clothPart) parts.push(clothPart);
      if (weaponPart) parts.push(weaponPart);
      parts.sort((left, right) => avatarPartRank(dirInfo.dir, left.kind) - avatarPartRank(dirInfo.dir, right.kind));
      frames.push({ parts });

      for (const part of parts) {
        if (first) {
          minX = part.x;
          minY = part.y;
          maxX = part.x + part.width;
          maxY = part.y + part.height;
          first = false;
        } else {
          minX = Math.min(minX, part.x);
          minY = Math.min(minY, part.y);
          maxX = Math.max(maxX, part.x + part.width);
          maxY = Math.max(maxY, part.y + part.height);
        }
      }
    }

    if (frames.length === 0) return null;

    return {
      frames,
      height: Math.max(1, Math.ceil(Math.max(maxY, 0) - Math.min(minY, 0))),
      minX: Math.min(minX, 0),
      minY: Math.min(minY, 0),
      tickMs: 1000 / LEGACY_RENDER_TICK,
      width: Math.max(1, Math.ceil(Math.max(maxX, 0) - Math.min(minX, 0)))
    };
  }, [actionEntry, clothImage, document, isPlayer, weaponImage]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.ceil(data.width * dpr));
    canvas.height = Math.max(1, Math.ceil(data.height * dpr));
    canvas.style.width = `${data.width}px`;
    canvas.style.height = `${data.height}px`;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.imageSmoothingEnabled = false;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);

    let raf = 0;
    const startedAt = performance.now();

    const draw = (now: number) => {
      const frameIndex = Math.floor((now - startedAt) / data.tickMs) % data.frames.length;
      context.clearRect(0, 0, data.width, data.height);
      for (const part of data.frames[frameIndex]?.parts ?? []) {
        const dx = part.x - data.minX;
        const dy = part.y - data.minY;

        context.save();
        if (part.flip) {
          context.translate(dx + part.width, dy);
          context.scale(-1, 1);
          if (!part.frame.rotated) {
            context.drawImage(
              part.image,
              part.frame.x,
              part.frame.y,
              part.frame.w,
              part.frame.h,
              0,
              0,
              part.width,
              part.height
            );
            context.restore();
            continue;
          }
          context.translate(part.width / 2, part.height / 2);
          context.rotate(-Math.PI / 2);
          context.drawImage(
            part.image,
            part.frame.x,
            part.frame.y,
            part.frame.h,
            part.frame.w,
            -part.height / 2,
            -part.width / 2,
            part.height,
            part.width
          );
          context.restore();
          continue;
        }

        if (!part.frame.rotated) {
          context.drawImage(
            part.image,
            part.frame.x,
            part.frame.y,
            part.frame.w,
            part.frame.h,
            dx,
            dy,
            part.width,
            part.height
          );
          context.restore();
          continue;
        }

        context.translate(dx + part.width / 2, dy + part.height / 2);
        context.rotate(-Math.PI / 2);
        context.drawImage(
          part.image,
          part.frame.x,
          part.frame.y,
          part.frame.h,
          part.frame.w,
          -part.height / 2,
          -part.width / 2,
          part.height,
          part.width
        );
        context.restore();
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [data]);

  return data ? <canvas ref={canvasRef} className="preview-canvas" /> : <div className="preview-placeholder">Avatar assets not resolved.</div>;
}

function buildPreviewPart(
  kind: "cloth" | "weapon",
  lookId: number,
  file: ReturnType<typeof findBizFileById>,
  image: HTMLImageElement | null,
  gameInfo: AvatarPreviewDocument["gameInfo"],
  dirInfo: { dir: number; flip: boolean },
  resid: number,
  baseScale: number
): PreviewPart | null {
  if (!file || !image || lookId <= 0) return null;
  const frame = getBizFrameWithFallback(file, dirInfo.dir, resid);
  if (!frame) return null;
  const info = resolveAvatarObjInfo(kind, lookId, dirInfo.flip ? 8 - dirInfo.dir : dirInfo.dir, gameInfo);
  const scale = info?.scale && info.scale !== 0 ? info.scale : baseScale;
  const width = frame.w * scale;
  const height = frame.h * scale;
  const x = dirInfo.flip ? -frame.ox * scale - width + (info?.offX ?? 0) : frame.ox * scale + (info?.offX ?? 0);
  const y = frame.oy * scale - (info?.offY ?? 0);
  return {
    flip: dirInfo.flip,
    frame,
    height,
    image,
    kind,
    width,
    x,
    y
  };
}

function avatarPartRank(dir: number, kind: "cloth" | "weapon"): number {
  const order = Z_ORDER_TABLE[dir] ?? Z_ORDER_TABLE[4];
  const index = order.indexOf(kind);
  return index >= 0 ? index : 0;
}

function useObjectImage(
  asset: AvatarPreviewDocument["clothImageAssets"][string] | null,
  setImageState: (state: { assetId: string | null; image: HTMLImageElement | null }) => void
) {
  useEffect(() => {
    let cancelled = false;
    let url = "";
    if (!asset) return;

    void (async () => {
      url = await createAssetObjectUrl(asset);
      const image = await loadImage(url);
      if (cancelled) return;
      setImageState({ assetId: asset.id, image });
    })();

    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [asset, setImageState]);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    image.src = url;
  });
}
