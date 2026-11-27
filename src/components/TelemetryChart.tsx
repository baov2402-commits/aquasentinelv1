import React, { useEffect, useRef } from 'react';
import type { SafetyStatus } from '../types/aquasentinel';

interface TelemetryChartProps {
  data: number[];
  status: SafetyStatus;
  darkMode: boolean;
}

export const TelemetryChart: React.FC<TelemetryChartProps> = ({
  data,
  status,
  darkMode,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = darkMode ? 'rgba(125, 211, 252, 0.16)' : 'rgba(2, 132, 199, 0.14)';
    ctx.lineWidth = 1;
    for (let g = 1; g <= 3; g++) {
      const y = h - (g / 3.8) * h;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    const thY = h - (2.2 / 3.8) * h;
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(0, thY);
    ctx.lineTo(w, thY);
    ctx.stroke();
    ctx.setLineDash([]);

    if (data.length < 2) return;

    const lineColor =
      status === 'danger' ? '#ef4444' : status === 'warn' ? '#f59e0b' : '#0284c7';

    ctx.save();
    ctx.shadowColor = status === 'safe' ? 'rgba(14, 165, 233, 0.4)' : lineColor;
    ctx.shadowBlur = 6;
    ctx.strokeStyle = darkMode && status === 'safe' ? '#38bdf8' : lineColor;
    ctx.lineWidth = 2.2;
    ctx.beginPath();

    const stepX = w / 84;
    for (let i = 0; i < data.length; i++) {
      const x = i * stepX;
      const y = Math.max(3, Math.min(h - 3, h - (data[i] / 3.8) * h));
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  }, [data, status, darkMode]);

  return (
    <canvas
      ref={canvasRef}
      width={300}
      height={58}
      className="w-full h-14 block rounded-xl border border-white/60 dark:border-sky-300/20 bg-white/25 dark:bg-sky-950/25 backdrop-blur-sm"
    />
  );
};
