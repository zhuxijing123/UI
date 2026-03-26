import { useEffect, useMemo, useRef } from "react";

import { getMapColor, type MapCell } from "../app-utils";
import type { MapDocument } from "../types";

type MapCanvasProps = {
  document: MapDocument;
  selectedCell: MapCell | null;
  onPaint: (x: number, y: number) => void;
};

export function MapDocumentCanvas({ document, selectedCell, onPaint }: MapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cellSize = useMemo(() => {
    const maxWidth = 880;
    const maxHeight = 520;
    const widthSize = Math.floor(maxWidth / Math.max(1, document.logicWidth));
    const heightSize = Math.floor(maxHeight / Math.max(1, document.logicHeight));
    return Math.max(1, Math.min(16, widthSize, heightSize));
  }, [document.logicHeight, document.logicWidth]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = document.logicWidth * cellSize;
    const height = document.logicHeight * cellSize;
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, width, height);
    for (let y = 0; y < document.logicHeight; y += 1) {
      for (let x = 0; x < document.logicWidth; x += 1) {
        const value = document.blockData[y * document.logicWidth + x] ?? 0;
        context.fillStyle = getMapColor(value);
        context.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      }
    }
    context.strokeStyle = "rgba(255,255,255,0.08)";
    context.lineWidth = 1;
    for (let x = 0; x <= document.logicWidth; x += 1) {
      context.beginPath();
      context.moveTo(x * cellSize + 0.5, 0);
      context.lineTo(x * cellSize + 0.5, height);
      context.stroke();
    }
    for (let y = 0; y <= document.logicHeight; y += 1) {
      context.beginPath();
      context.moveTo(0, y * cellSize + 0.5);
      context.lineTo(width, y * cellSize + 0.5);
      context.stroke();
    }
    if (selectedCell) {
      context.strokeStyle = "#f9e39a";
      context.lineWidth = Math.max(2, Math.floor(cellSize / 3));
      context.strokeRect(selectedCell.x * cellSize, selectedCell.y * cellSize, cellSize, cellSize);
    }

    for (const overlay of document.overlays) {
      if (overlay.x < 0 || overlay.y < 0 || overlay.x >= document.logicWidth || overlay.y >= document.logicHeight) continue;
      const centerX = overlay.x * cellSize + cellSize / 2;
      const centerY = overlay.y * cellSize + cellSize / 2;
      const radius = Math.max(3, Math.min(10, Math.round(cellSize * 0.45)));
      context.save();
      if (overlay.kind === "npc") {
        context.fillStyle = "#f6c96d";
        context.strokeStyle = "rgba(0, 0, 0, 0.85)";
        context.lineWidth = 1.5;
        context.beginPath();
        context.arc(centerX, centerY, radius, 0, Math.PI * 2);
        context.fill();
        context.stroke();
      } else if (overlay.kind === "teleport") {
        context.fillStyle = "#5de1ff";
        context.strokeStyle = "rgba(0, 0, 0, 0.85)";
        context.lineWidth = 1.5;
        context.beginPath();
        context.moveTo(centerX, centerY - radius);
        context.lineTo(centerX + radius, centerY);
        context.lineTo(centerX, centerY + radius);
        context.lineTo(centerX - radius, centerY);
        context.closePath();
        context.fill();
        context.stroke();
      } else {
        context.fillStyle = "#ff7676";
        context.strokeStyle = "rgba(0, 0, 0, 0.85)";
        context.lineWidth = 1.5;
        context.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2);
        context.strokeRect(centerX - radius, centerY - radius, radius * 2, radius * 2);
      }

      if (cellSize >= 7) {
        context.fillStyle = "rgba(237, 242, 255, 0.92)";
        context.font = `${Math.max(10, Math.floor(cellSize * 0.95))}px Bahnschrift, sans-serif`;
        context.textBaseline = "top";
        context.fillText(overlay.label, centerX + radius + 2, centerY - radius);
      }
      context.restore();
    }
  }, [cellSize, document, selectedCell]);

  return (
    <div className="map-canvas">
      <canvas
        ref={canvasRef}
        data-logic-height={document.logicHeight}
        data-logic-width={document.logicWidth}
        data-map-name={document.name}
        onPointerDown={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const x = Math.floor((event.clientX - rect.left) / cellSize);
          const y = Math.floor((event.clientY - rect.top) / cellSize);
          onPaint(x, y);
        }}
      />
      <div className="map-canvas__summary">
        <div className="map-canvas__legend">
          <span className="map-canvas__legend-item map-canvas__legend-item--npc">NPC {document.overlaySummary.npc}</span>
          <span className="map-canvas__legend-item map-canvas__legend-item--teleport">
            Teleport {document.overlaySummary.teleport}
          </span>
          <span className="map-canvas__legend-item map-canvas__legend-item--monster">
            Monster {document.overlaySummary.monster}
          </span>
        </div>
        {document.metadata ? (
          <p className="map-canvas__meta">
            {document.metadata.mapId} · {document.metadata.file} · {document.metadata.mapName || document.metadata.minimap}
          </p>
        ) : (
          <p className="map-canvas__meta">No `mapinfo.csv` match found for this map file.</p>
        )}
      </div>
    </div>
  );
}
