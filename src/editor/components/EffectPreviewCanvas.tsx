import { useEffect, useMemo, useRef, useState } from "react";

import {
  findBizFileById,
  getBizFrameWithFallback,
  LEGACY_RENDER_TICK,
  resolveEffectDir,
  resolveEffectObjInfo
} from "../legacy-labs";
import type { EffectPreviewDocument } from "../types";
import { createAssetObjectUrl } from "../workspace";

type EffectPart = {
  frame: ReturnType<typeof getBizFrameWithFallback> extends infer T ? Exclude<T, null> : never;
  dx: number;
  dy: number;
  dw: number;
  dh: number;
};

type Props = {
  document: EffectPreviewDocument;
};

export function EffectPreviewCanvas({ document }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [imageState, setImageState] = useState<{ assetId: string | null; image: HTMLImageElement | null }>({
    assetId: null,
    image: null
  });

  const selectedImageAsset = document.effectImageAssets[String(document.fileId)] ?? null;
  const image = imageState.assetId === selectedImageAsset?.id ? imageState.image : null;

  useEffect(() => {
    let cancelled = false;
    let url = "";
    if (!selectedImageAsset) return;

    void (async () => {
      url = await createAssetObjectUrl(selectedImageAsset);
      const loaded = await loadImage(url);
      if (cancelled) return;
      setImageState({ assetId: selectedImageAsset.id, image: loaded });
    })();

    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [selectedImageAsset]);

  const data = useMemo(() => {
    if (!image || document.fileId <= 0) return null;

    const file = findBizFileById(document.effectBank, document.fileId);
    if (!file) return null;

    const effectId = Math.floor(document.fileId / 100);
    const dirInfo = resolveEffectDir(effectId, document.dir, document.noDirIds);
    const info = resolveEffectObjInfo(document.gameInfo, effectId, document.fileId, dirInfo.dir);
    const scale = info?.scale && info.scale !== 0 ? info.scale : 1;
    const offX = info?.offX ?? 0;
    const offY = info?.offY ?? 0;
    const effectEntry = document.effectInfo.find((entry) => entry.id === effectId) ?? null;
    const sequence = effectEntry?.frames.length
      ? effectEntry.frames
      : Array.from({ length: Math.max(file.frameCount, 1) }, (_, index) => index);

    const frames: EffectPart[] = [];
    let minX = 0;
    let minY = 0;
    let maxX = 0;
    let maxY = 0;
    let first = true;

    for (const index of sequence) {
      const frame = getBizFrameWithFallback(file, dirInfo.dir, index);
      if (!frame) continue;
      const dw = frame.w * scale;
      const dh = frame.h * scale;
      const dx = frame.ox * scale + offX;
      const dy = frame.oy * scale - offY;
      frames.push({ dh, dw, dx, dy, frame });

      if (first) {
        minX = dx;
        minY = dy;
        maxX = dx + dw;
        maxY = dy + dh;
        first = false;
      } else {
        minX = Math.min(minX, dx);
        minY = Math.min(minY, dy);
        maxX = Math.max(maxX, dx + dw);
        maxY = Math.max(maxY, dy + dh);
      }
    }

    if (frames.length === 0) return null;

    return {
      flip: dirInfo.flip,
      frames,
      height: Math.max(1, Math.ceil(Math.max(maxY, 0) - Math.min(minY, 0))),
      image,
      minX: Math.min(minX, 0),
      minY: Math.min(minY, 0),
      tickMs: (1000 / LEGACY_RENDER_TICK) * Math.max(1, document.delay || 1),
      width: Math.max(1, Math.ceil(Math.max(maxX, 0) - Math.min(minX, 0)))
    };
  }, [document, image]);

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
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.imageSmoothingEnabled = false;

    let raf = 0;
    const startedAt = performance.now();

    const draw = (now: number) => {
      const frameIndex = Math.floor((now - startedAt) / data.tickMs) % data.frames.length;
      const current = data.frames[frameIndex];
      if (!current) return;

      context.clearRect(0, 0, data.width, data.height);
      const dx = current.dx - data.minX;
      const dy = current.dy - data.minY;

      context.save();
      if (data.flip) {
        context.translate(dx + current.dw, dy);
        context.scale(-1, 1);
        if (!current.frame.rotated) {
          context.drawImage(data.image, current.frame.x, current.frame.y, current.frame.w, current.frame.h, 0, 0, current.dw, current.dh);
          context.restore();
          raf = requestAnimationFrame(draw);
          return;
        }
        context.translate(current.dw / 2, current.dh / 2);
        context.rotate(-Math.PI / 2);
        context.drawImage(
          data.image,
          current.frame.x,
          current.frame.y,
          current.frame.h,
          current.frame.w,
          -current.dh / 2,
          -current.dw / 2,
          current.dh,
          current.dw
        );
        context.restore();
        raf = requestAnimationFrame(draw);
        return;
      }

      if (!current.frame.rotated) {
        context.drawImage(
          data.image,
          current.frame.x,
          current.frame.y,
          current.frame.w,
          current.frame.h,
          dx,
          dy,
          current.dw,
          current.dh
        );
        context.restore();
        raf = requestAnimationFrame(draw);
        return;
      }

      context.translate(dx + current.dw / 2, dy + current.dh / 2);
      context.rotate(-Math.PI / 2);
      context.drawImage(
        data.image,
        current.frame.x,
        current.frame.y,
        current.frame.h,
        current.frame.w,
        -current.dh / 2,
        -current.dw / 2,
        current.dh,
        current.dw
      );
      context.restore();
      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [data]);

  return data ? <canvas ref={canvasRef} className="preview-canvas" /> : <div className="preview-placeholder">Effect assets not resolved.</div>;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    image.src = url;
  });
}
