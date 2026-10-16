import { useEffect, useRef } from 'react';
import { canvas, MOODS } from '../game/art';
import type { Level } from '../game/levels';
import { qId, shadow } from '../game/geo';

const cache = new Map<string, HTMLCanvasElement>();

/** A small paper screen with the sculpture's shadow on it: the picture once found, a jumble before. */
export function Postcard({ level, solved, locked, width }: { level: Level; solved: boolean; locked: boolean; width: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const height = Math.round(width * 1.15);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const key = `${level.id}|${solved}|${locked}|${width}|${dpr}`;
    let src = cache.get(key);
    if (!src) {
      const m = MOODS[level.chapter], { c, g } = canvas(width * dpr, height * dpr);
      g.scale(dpr, dpr);
      g.save(); g.beginPath(); g.roundRect(0, 0, width, height, 6); g.clip();
      const pg = g.createRadialGradient(width / 2, height * 0.6, 4, width / 2, height * 0.6, width * 0.9);
      pg.addColorStop(0, m.paperHi); pg.addColorStop(0.6, m.paper); pg.addColorStop(1, m.room);
      g.fillStyle = pg; g.fillRect(0, 0, width, height);
      if (!locked) {
        const polys = shadow(level.slabs, solved ? qId() : level.start.q), s = width * 0.36, cx = width / 2, cy = height * 0.48;
        g.fillStyle = m.shadow; g.globalAlpha = solved ? 0.9 : 0.55; g.filter = solved ? 'none' : 'blur(1px)';
        g.beginPath();
        for (const p of polys) { p.forEach(([x, y], k) => (k ? g.lineTo(cx + x * s, cy + y * s) : g.moveTo(cx + x * s, cy + y * s))); g.closePath(); }
        g.fill(); g.filter = 'none'; g.globalAlpha = 1;
        if (solved) { g.fillStyle = m.seal; g.fillRect(width - 14, height - 14, 8, 8); }
      }
      if (level.chapter === 0) { g.strokeStyle = m.frame; g.globalAlpha = 0.6; g.lineWidth = 1; for (const f of [1 / 3, 2 / 3]) { g.beginPath(); g.moveTo(width * f, 0); g.lineTo(width * f, height); g.stroke(); g.beginPath(); g.moveTo(0, height * f); g.lineTo(width, height * f); g.stroke(); } g.globalAlpha = 1; }
      g.restore();
      src = c; cache.set(key, src);
    }
    el.width = src.width; el.height = src.height;
    el.getContext('2d')!.drawImage(src, 0, 0);
  }, [level, solved, locked, width, height]);
  return <canvas ref={ref} className="postcard" style={{ width, height }} aria-hidden />;
}
