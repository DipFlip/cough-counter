"use client";

import { useEffect, useRef } from "react";

interface EKGDisplayProps {
  /** Loudness in dB above the background noise floor */
  volume: number;
}

const HISTORY_LENGTH = 150;
const HEIGHT = 120;
const MAX_DB = 40;

export function EKGDisplay({ volume }: EKGDisplayProps) {
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
      const y = height - Math.min(1, history[i] / MAX_DB) * height;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  }, [volume]);

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
