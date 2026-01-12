"use client";

import { useEffect, useRef } from "react";

interface EKGDisplayProps {
  volume: number;
  threshold: number;
  calibrationVolume: number;
  showThreshold: boolean;
}

const HISTORY_LENGTH = 150;
const HEIGHT = 120;

export function EKGDisplay({ volume, threshold, calibrationVolume, showThreshold }: EKGDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const historyRef = useRef<number[]>([]);

  useEffect(() => {
    // Add current volume to history
    historyRef.current.push(volume);
    if (historyRef.current.length > HISTORY_LENGTH) {
      historyRef.current.shift();
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Scale based on calibration volume (with some headroom)
    // Use calibration volume * 1.3 as max, or 100 if not calibrated
    const maxScale = calibrationVolume > 0 ? calibrationVolume * 1.3 : 100;

    // Clear canvas
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, width, height);

    // Draw grid lines
    ctx.strokeStyle = "#2d2d44";
    ctx.lineWidth = 1;
    for (let y = 0; y < height; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    for (let x = 0; x < width; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Draw threshold line
    if (showThreshold && threshold > 0) {
      const thresholdY = height - (threshold / maxScale) * height;
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(0, thresholdY);
      ctx.lineTo(width, thresholdY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Threshold label
      ctx.fillStyle = "#fbbf24";
      ctx.font = "12px monospace";
      ctx.fillText(`Threshold: ${threshold.toFixed(1)}`, 5, Math.max(15, thresholdY - 5));
    }

    // Draw volume line
    const history = historyRef.current;
    if (history.length < 2) return;

    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 2;
    ctx.beginPath();

    const stepX = width / HISTORY_LENGTH;
    const startX = width - history.length * stepX;

    for (let i = 0; i < history.length; i++) {
      const x = startX + i * stepX;
      const y = height - Math.min(1, history[i] / maxScale) * height;

      // Color red if above threshold
      if (showThreshold && history[i] > threshold) {
        ctx.stroke();
        ctx.beginPath();
        ctx.strokeStyle = "#ef4444";
        ctx.moveTo(x, y);
      } else if (i > 0 && history[i - 1] > threshold && history[i] <= threshold) {
        ctx.stroke();
        ctx.beginPath();
        ctx.strokeStyle = "#22c55e";
        ctx.moveTo(x, y);
      }

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Draw current value
    ctx.fillStyle = "#ffffff";
    ctx.font = "14px monospace";
    ctx.fillText(`Vol: ${volume.toFixed(1)}`, width - 80, 20);
  }, [volume, threshold, calibrationVolume, showThreshold]);

  return (
    <div className="w-full">
      <canvas
        ref={canvasRef}
        width={600}
        height={HEIGHT}
        className="w-full rounded-lg border border-gray-700"
        style={{ imageRendering: "pixelated" }}
      />
    </div>
  );
}
