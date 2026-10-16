// Store icon, adaptive-icon layers and splash: a heron's shadow on a paper screen by lamplight.
import * as A from '../src/game/art';
import { FIGURES } from '../src/game/figures';
import { qAxis, qMul, qRot, sculpt, shadow, qId, VIEW, type Q } from '../src/game/geo';

const M = A.MOODS[0];
function shade(g: CanvasRenderingContext2D, fig: string, cx: number, cy: number, s: number, q: Q, color: string, alpha: number, blur = 0) {
  const polys = shadow(sculpt(FIGURES[fig], 11), q);
  g.save(); g.fillStyle = color; g.globalAlpha = alpha; g.filter = blur ? `blur(${blur}px)` : 'none';
  g.beginPath(); for (const p of polys) { p.forEach(([x, y], k) => (k ? g.lineTo(cx + x * s, cy + y * s) : g.moveTo(cx + x * s, cy + y * s))); g.closePath(); }
  g.fill(); g.restore();
}
/** The sculpture itself, flat-shaded, seen from our side. */
function sculpture(g: CanvasRenderingContext2D, fig: string, cx: number, cy: number, s: number, q: Q, mood: A.Mood) {
  const slabs = sculpt(FIGURES[fig], 11), faces: { pts: number[][]; d: number; l: number; tone: number }[] = [];
  const cam = (v: [number, number, number]) => qRot(VIEW, qRot(q, v)), o = cam([0, 0, 0]);
  const lit = (n: number[]) => Math.max(0, ((n[0] - o[0]) * -0.35 + (n[1] - o[1]) * -0.62 + (n[2] - o[2]) * 0.7) / 1.02);
  for (const sl of slabs) {
    const f = sl.pts.map(([x, y]) => cam([x, y, sl.z + sl.t / 2])), b = sl.pts.map(([x, y]) => cam([x, y, sl.z - sl.t / 2]));
    const nf = cam([0, 0, 1]); if (nf[2] - o[2] > 0) faces.push({ pts: f, d: f.reduce((a, v) => a + v[2], 0) / f.length, l: lit(nf), tone: sl.tone });
    const nb = cam([0, 0, -1]); if (nb[2] - o[2] > 0) faces.push({ pts: b, d: b.reduce((a, v) => a + v[2], 0) / b.length, l: lit(nb), tone: sl.tone });
    const n = sl.pts.length; let area = 0; for (let k = 0; k < n; k++) { const a = sl.pts[k], c = sl.pts[(k + 1) % n]; area += a[0] * c[1] - c[0] * a[1]; }
    for (let k = 0; k < n; k++) {
      const a = sl.pts[k], c = sl.pts[(k + 1) % n], sg = area >= 0 ? 1 : -1, nx = (c[1] - a[1]) * sg, ny = -(c[0] - a[0]) * sg, nl = Math.hypot(nx, ny);
      const nn = cam([nx / nl, ny / nl, 0]); if (nn[2] - o[2] <= 0) continue;
      const qd = [f[k], f[(k + 1) % n], b[(k + 1) % n], b[k]];
      faces.push({ pts: qd, d: qd.reduce((x, v) => x + v[2], 0) / 4, l: lit(nn) - 0.08, tone: sl.tone });
    }
  }
  faces.sort((a, b) => a.d - b.d);
  for (const fc of faces) {
    const [r, gg, b] = A.rgb(mood.mat[Math.floor(fc.tone * mood.mat.length) % mood.mat.length]), k = 0.55 + fc.l * 0.6;
    g.fillStyle = `rgb(${Math.min(255, r * k)},${Math.min(255, gg * k)},${Math.min(255, b * k)})`; g.strokeStyle = mood.edge; g.lineWidth = s * 0.008;
    g.beginPath(); fc.pts.forEach((v, i) => (i ? g.lineTo(cx + v[0] * s, cy + v[1] * s) : g.moveTo(cx + v[0] * s, cy + v[1] * s))); g.closePath(); g.fill(); g.stroke();
  }
}
function scene(W: number, H: number, panel: { x: number; y: number; w: number; h: number }, title?: string) {
  const { c, g } = A.canvas(W, H);
  g.drawImage(A.backdrop(M, W, H, 1, panel, 9), 0, 0);
  const gl = A.glow(512, M.glow); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.35; g.drawImage(gl, panel.x - panel.w * 0.15, panel.y, panel.w * 1.3, panel.h * 1.2); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  shade(g, 'heron', panel.x + panel.w / 2, panel.y + panel.h * 0.47, panel.w * 0.38, qId(), M.shadow, 0.9);
  g.drawImage(A.frame(M, W, H, 1, panel, 9), 0, 0);
  g.drawImage(A.vignette(W, H, 1, W / 2, panel.y + panel.h * 0.6, 0.7), 0, 0);
  if (title) {
    g.textAlign = 'center'; g.font = `${Math.round(W * 0.15)}px Marcellus, serif`; g.fillStyle = '#f3e6cc'; g.shadowColor = 'rgba(242,180,90,0.45)'; g.shadowBlur = 40; g.fillText(title, W / 2, panel.y - W * 0.16); g.shadowBlur = 0;
    g.font = `600 ${Math.round(W * 0.036)}px Karla, sans-serif`; g.fillStyle = '#e8b86a'; try { g.letterSpacing = `${Math.round(W * 0.024)}px`; } catch { /* */ }
    g.fillText('PRIME', W / 2 + W * 0.012, panel.y - W * 0.075); try { g.letterSpacing = '0px'; } catch { /* */ }
  }
  return { c, g };
}
export function icon() { const { c } = scene(1024, 1024, { x: 120, y: 110, w: 784, h: 804 }); return c; }
export function adaptive() {
  const { c, g } = A.canvas(1024, 1024);
  shade(g, 'heron', 512, 500, 330, qId(), M.shadow, 0.92);
  return c;
}
export function adaptiveBg() {
  const { c, g } = A.canvas(1024, 1024);
  const gr = g.createRadialGradient(512, 560, 20, 512, 560, 720); gr.addColorStop(0, M.paperHi); gr.addColorStop(0.6, M.paper); gr.addColorStop(1, '#a8885a');
  g.fillStyle = gr; g.fillRect(0, 0, 1024, 1024);
  return c;
}
export function splash() {
  const W = 1284, H = 2778, panel = { x: 180, y: 760, w: 924, h: 1016 };
  const { c, g } = scene(W, H, panel, 'Umbra');
  sculpture(g, 'heron', W / 2, 2240, 230, qMul(qAxis([0, 1, 0], 0), qId()), A.MOODS[1]);
  return c;
}
export function feature() {
  const W = 1024, H = 500, panel = { x: 600, y: 52, w: 330, h: 380 };
  const { c, g } = A.canvas(W, H);
  g.drawImage(A.backdrop(M, W, H, 1, panel, 9), 0, 0);
  const gl = A.glow(512, M.glow); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.4; g.drawImage(gl, panel.x - panel.w * 0.3, panel.y - 40, panel.w * 1.6, panel.h * 1.3); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  shade(g, 'heron', panel.x + panel.w / 2, panel.y + panel.h * 0.47, panel.w * 0.4, qId(), M.shadow, 0.9);
  g.drawImage(A.frame(M, W, H, 1, panel, 9), 0, 0);
  // the jumbled sculpture in front of the screen, mid-turn
  sculpture(g, 'heron', 492, 292, 92, qMul(qAxis([0, 1, 0], 0.9), qAxis([1, 0, 0], 0.35)), A.MOODS[1]);
  const v = g.createLinearGradient(0, 0, 560, 0); v.addColorStop(0, 'rgba(12,8,5,0.92)'); v.addColorStop(0.75, 'rgba(12,8,5,0.55)'); v.addColorStop(1, 'rgba(12,8,5,0)');
  g.fillStyle = v; g.fillRect(0, 0, 560, H);
  g.drawImage(A.vignette(W, H, 1, W * 0.62, H * 0.5, 0.75), 0, 0);
  g.textAlign = 'left'; g.fillStyle = '#f3e6cc'; g.shadowColor = 'rgba(242,180,90,0.5)'; g.shadowBlur = 26;
  g.font = '112px Marcellus, serif'; try { g.letterSpacing = '10px'; } catch { /* */ } g.fillText('Umbra', 58, 214); g.shadowBlur = 0;
  g.font = '600 26px Karla, sans-serif'; g.fillStyle = '#e8b86a'; try { g.letterSpacing = '17px'; } catch { /* */ } g.fillText('PRIME', 64, 262);
  try { g.letterSpacing = '0px'; } catch { /* */ }
  g.fillStyle = '#e8b86a'; g.fillRect(62, 292, 46, 2);
  g.font = '400 30px Karla, sans-serif'; g.fillStyle = 'rgba(243,230,204,0.92)'; g.fillText('Turn the light.', 62, 344); g.fillText('Find the shape.', 62, 384);
  g.globalAlpha = 0.9; g.drawImage(A.seal(M, 'U', 96, 'Marcellus, serif'), panel.x + panel.w - 66, panel.y + panel.h - 66, 44, 44); g.globalAlpha = 1;
  return c;
}
(window as unknown as { brand: unknown }).brand = { icon, adaptive, adaptiveBg, splash, feature };
