import React, { useEffect, useRef } from 'react';
import type { PoolConfig, SwimPattern, Swimmer } from '../types/aquasentinel';

interface PoolCanvasProps {
  pool: PoolConfig;
  swimmers: Swimmer[];
  selectedId: string | null;
  swimPattern: SwimPattern;
  darkMode: boolean;
  onSelectSwimmer: (id: string) => void;
}

const MAX_POOL_LENGTH = 50;
const MAX_POOL_WIDTH = 25;

export const PoolCanvas: React.FC<PoolCanvasProps> = ({
  pool,
  swimmers,
  selectedId,
  swimPattern,
  darkMode,
  onSelectSwimmer,
}) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const metricsRef = useRef({ padX: 44, padY: 32, scale: 16 });
  const animatedDimsRef = useRef({
    length: pool.length,
    width: pool.width,
    minDepth: pool.minDepth,
    maxDepth: pool.maxDepth,
  });

  const stateRef = useRef({ pool, swimmers, selectedId, swimPattern, darkMode });
  stateRef.current = { pool, swimmers, selectedId, swimPattern, darkMode };

  useEffect(() => {
    let rafId = 0;

    const renderFrame = (now: number) => {
      const wrap = wrapRef.current;
      const canvas = canvasRef.current;
      if (wrap && canvas && wrap.clientWidth > 0 && wrap.clientHeight > 0) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const {
            pool: curPool,
            swimmers: curSwimmers,
            selectedId: curSelectedId,
            swimPattern: curPattern,
            darkMode: isDark,
          } = stateRef.current;
          const timeSec = now / 1000;

          // Smoothly animate pool size changes so adjusting sliders/presets visibly expands/shrinks the pool
          const anim = animatedDimsRef.current;
          anim.length += (curPool.length - anim.length) * 0.22;
          anim.width += (curPool.width - anim.width) * 0.22;
          anim.minDepth += (curPool.minDepth - anim.minDepth) * 0.22;
          anim.maxDepth += (curPool.maxDepth - anim.maxDepth) * 0.22;

          if (Math.abs(curPool.length - anim.length) < 0.01) anim.length = curPool.length;
          if (Math.abs(curPool.width - anim.width) < 0.01) anim.width = curPool.width;

          const padX = 44;
          const padY = 32;
          const availW = Math.max(240, wrap.clientWidth - 20 - padX * 2);
          const availH = Math.max(160, wrap.clientHeight - 20 - padY * 2);

          // Fixed world scale relative to maximum 50x25m pool so changing dimensions visibly expands/contracts the pool
          const scale = Math.min(availW / MAX_POOL_LENGTH, availH / MAX_POOL_WIDTH);
          const poolPxW = anim.length * scale;
          const poolPxH = anim.width * scale;
          const totalW = Math.round(poolPxW + padX * 2);
          const totalH = Math.round(poolPxH + padY * 2);

          const dpr = window.devicePixelRatio || 1;
          if (canvas.width !== totalW * dpr || canvas.height !== totalH * dpr) {
            canvas.width = totalW * dpr;
            canvas.height = totalH * dpr;
            canvas.style.width = `${totalW}px`;
            canvas.style.height = `${totalH}px`;
          }

          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          metricsRef.current = { padX, padY, scale };

          ctx.clearRect(0, 0, totalW, totalH);

          // Crystal-transparent frosted glass deck frame
          ctx.fillStyle = isDark ? 'rgba(12, 34, 66, 0.28)' : 'rgba(255, 255, 255, 0.25)';
          ctx.beginPath();
          ctx.roundRect(0, 0, totalW, totalH, 20);
          ctx.fill();
          ctx.strokeStyle = isDark ? 'rgba(125, 211, 252, 0.28)' : 'rgba(255, 255, 255, 0.75)';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // Crisp translucent white-blue pool rim
          ctx.save();
          ctx.shadowColor = isDark ? 'rgba(56, 189, 248, 0.45)' : 'rgba(14, 165, 233, 0.25)';
          ctx.shadowBlur = 14;
          ctx.fillStyle = isDark ? 'rgba(224, 242, 254, 0.85)' : 'rgba(255, 255, 255, 0.82)';
          ctx.beginPath();
          ctx.roundRect(padX - 5, padY - 5, poolPxW + 10, poolPxH + 10, 12);
          ctx.fill();
          ctx.restore();

          // Rounded water body (deep end intensifies subtly with maxDepth)
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(padX, padY, poolPxW, poolPxH, 8);
          ctx.clip();

          const depthFactor = Math.min(1, Math.max(0, (anim.maxDepth - 1.0) / 1.5));
          const waterGrad = ctx.createLinearGradient(padX, padY, padX + poolPxW, padY + poolPxH);
          if (isDark) {
            waterGrad.addColorStop(0, '#38bdf8');
            waterGrad.addColorStop(0.5, '#0284c7');
            waterGrad.addColorStop(1, depthFactor > 0.5 ? '#075985' : '#0369a1');
          } else {
            waterGrad.addColorStop(0, '#7dd3fc');
            waterGrad.addColorStop(0.45, '#38bdf8');
            waterGrad.addColorStop(1, depthFactor > 0.5 ? '#0369a1' : '#0284c7');
          }
          ctx.fillStyle = waterGrad;
          ctx.fillRect(padX, padY, poolPxW, poolPxH);

          // 1m Underwater tile grid
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
          ctx.lineWidth = 0.85;
          for (let mx = 1; mx < anim.length; mx++) {
            const px = padX + mx * scale;
            ctx.beginPath();
            ctx.moveTo(px, padY);
            ctx.lineTo(px, padY + poolPxH);
            ctx.stroke();
          }
          for (let my = 1; my < anim.width; my++) {
            const py = padY + my * scale;
            ctx.beginPath();
            ctx.moveTo(padX, py);
            ctx.lineTo(padX + poolPxW, py);
            ctx.stroke();
          }

          // Animated shimmering caustic waves
          ctx.lineCap = 'round';
          for (let band = 0; band < 6; band++) {
            ctx.beginPath();
            const baseY = padY + ((band + 0.5) / 6) * poolPxH;
            for (let stepX = 0; stepX <= poolPxW; stepX += 14) {
              const waveY =
                Math.sin(stepX * 0.025 + timeSec * 1.1 + band * 1.7) * 8 +
                Math.cos(stepX * 0.045 - timeSec * 0.8 + band) * 4;
              const px = padX + stepX;
              const py = baseY + waveY;
              if (stepX === 0) ctx.moveTo(px, py);
              else ctx.lineTo(px, py);
            }
            ctx.strokeStyle =
              band % 2 === 0 ? 'rgba(255, 255, 255, 0.22)' : 'rgba(224, 242, 254, 0.16)';
            ctx.lineWidth = 2;
            ctx.stroke();
          }

          // Optional lane ropes
          if (curPattern === 'lanes') {
            const laneH = poolPxH / curPool.lanes;
            for (let l = 1; l < curPool.lanes; l++) {
              const ly = padY + l * laneH;
              const fiveM = Math.min(5 * scale, poolPxW * 0.22);
              ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
              ctx.lineWidth = 1.6;
              ctx.beginPath();
              ctx.moveTo(padX, ly);
              ctx.lineTo(padX + poolPxW, ly);
              ctx.stroke();

              const step = Math.max(6, scale * 0.35);
              for (let fx = 4; fx < poolPxW - 4; fx += step) {
                const isEnd = fx < fiveM || fx > poolPxW - fiveM;
                ctx.fillStyle = isEnd
                  ? '#ef4444'
                  : Math.floor(fx / step) % 2 === 0
                  ? '#ffffff'
                  : '#0284c7';
                ctx.beginPath();
                ctx.roundRect(padX + fx - 2, ly - 2, 4, 4, 1.5);
                ctx.fill();
              }
            }
          }

          ctx.restore();

          // Dimension labels
          ctx.fillStyle = isDark ? '#bae6fd' : '#0369a1';
          ctx.font = '600 10px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          const step = anim.length > 30 ? 10 : 5;
          for (let m = 0; m <= curPool.length; m += step) {
            ctx.fillText(`${m}m`, padX + m * scale, padY - 11);
          }

          ctx.save();
          ctx.translate(padX - 15, padY + poolPxH / 2);
          ctx.rotate(-Math.PI / 2);
          ctx.textAlign = 'center';
          ctx.fillText(`${curPool.width.toFixed(1)}m`, 0, 0);
          ctx.restore();

          ctx.textAlign = 'left';
          ctx.fillText(`Nông ${anim.minDepth.toFixed(1)}m`, padX, padY + poolPxH + 17);
          ctx.textAlign = 'right';
          ctx.fillText(`Sâu ${anim.maxDepth.toFixed(1)}m`, padX + poolPxW, padY + poolPxH + 17);

          // Swimmers
          for (const s of curSwimmers) {
            const clampedX = Math.min(Math.max(s.x, 0.8), anim.length - 0.8);
            const clampedY = Math.min(Math.max(s.y, 0.8), anim.width - 0.8);
            const px = padX + clampedX * scale;
            const py = padY + clampedY * scale;
            const isSelected = s.id === curSelectedId;
            const statusColor =
              s.status === 'safe' ? '#10b981' : s.status === 'warn' ? '#f59e0b' : '#ef4444';

            if (s.status !== 'safe') {
              const pulse = (timeSec * (s.status === 'danger' ? 1.8 : 1.0)) % 1;
              ctx.beginPath();
              ctx.arc(px, py, 9 + pulse * Math.max(18, scale * 1.3), 0, Math.PI * 2);
              ctx.strokeStyle =
                s.status === 'danger'
                  ? `rgba(239, 68, 68, ${1 - pulse})`
                  : `rgba(245, 158, 11, ${1 - pulse})`;
              ctx.lineWidth = 2.2;
              ctx.stroke();
            }

            if (isSelected) {
              ctx.beginPath();
              ctx.arc(px, py, 15, 0, Math.PI * 2);
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 2;
              ctx.setLineDash([4, 3]);
              ctx.stroke();
              ctx.setLineDash([]);
            }

            ctx.save();
            ctx.translate(px, py);
            if (s.mode === 'thrashing') {
              ctx.rotate(s.angle + Math.sin(timeSec * 12) * 0.5);
            } else {
              ctx.rotate(s.angle);
            }

            ctx.fillStyle = 'rgba(15, 23, 42, 0.25)';
            ctx.beginPath();
            ctx.roundRect(-9, -3.5, 16, 9, 4.5);
            ctx.fill();

            ctx.fillStyle = '#0f172a';
            ctx.beginPath();
            ctx.roundRect(-9, -4.5, 14, 8.5, 4);
            ctx.fill();

            ctx.fillStyle = statusColor;
            ctx.fillRect(-1, -4.5, 4, 9);

            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(7, 0, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = statusColor;
            ctx.lineWidth = 1.6;
            ctx.stroke();
            ctx.restore();

            const tag = s.mode === 'sos' ? `${s.id} SOS` : s.id;
            ctx.font = '700 9.5px "JetBrains Mono", monospace';
            const tw = ctx.measureText(tag).width + 9;
            ctx.fillStyle = s.status === 'safe' ? 'rgba(255, 255, 255, 0.92)' : statusColor;
            ctx.beginPath();
            ctx.roundRect(px - tw / 2, py - 25, tw, 14, 6);
            ctx.fill();

            ctx.fillStyle = s.status === 'safe' ? '#0369a1' : '#ffffff';
            ctx.textAlign = 'center';
            ctx.fillText(tag, px, py - 15);
          }
        }
      }
      rafId = requestAnimationFrame(renderFrame);
    };

    rafId = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const { padX, padY, scale } = metricsRef.current;
    const mx = (e.clientX - rect.left - padX) / scale;
    const my = (e.clientY - rect.top - padY) / scale;

    let closest: Swimmer | null = null;
    let minDist = 2.0;
    for (const s of swimmers) {
      const d = Math.hypot(s.x - mx, s.y - my);
      if (d < minDist) {
        minDist = d;
        closest = s;
      }
    }
    if (closest) {
      onSelectSwimmer(closest.id);
    }
  };

  return (
    <div
      ref={wrapRef}
      className="flex-1 min-h-[240px] flex items-center justify-center p-2.5 overflow-hidden"
    >
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        className="block rounded-2xl cursor-pointer transition-shadow"
        title="Click người bơi để xem"
      />
    </div>
  );
};
