/**
 * Umbra art: a dark room, a paper screen lit by a lamp, and on the screen the sculpture's shadow. First a
 * shoji of washi paper in a wooden lattice by candlelight; then a clay wall under a hanging lamp, framed in
 * bamboo blinds; then an indigo theatre screen under the moon.
 */
export function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
  return { c, g: c.getContext('2d')! };
}
export function rng(seed: number) {
  let s = Math.imul(seed + 0x9e3779b9, 2654435761) >>> 0 || 1;
  const next = () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  for (let k = 0; k < 8; k++) next();
  return next;
}
export const rgb = (hex: string): [number, number, number] => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
export function mix(a: string, b: string, t: number) {
  const [r1, g1, b1] = rgb(a), [r2, g2, b2] = rgb(b);
  const f = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
  return `#${f(r1, r2)}${f(g1, g2)}${f(b1, b2)}`;
}
export const hexNum = (h: string) => parseInt(h.slice(1), 16);

export type Mood = {
  name: string; bg: string; room: string; paper: string; paperHi: string; frame: string; glow: string; shadow: string;
  mat: string[]; edge: string; rim: string; seal: string;
};
export const MOODS: Mood[] = [
  { name: 'lantern', bg: '#140e0a', room: '#1d140d', paper: '#e9d6ad', paperHi: '#fff1cc', frame: '#3a2516', glow: '#ffb85c', shadow: '#2a1a10',
    mat: ['#f2e6cb', '#ead9b4', '#f6ecd6', '#e3cfa6'], edge: '#b9a179', rim: '#fff7e6', seal: '#b8322a' },
  { name: 'bamboo', bg: '#11120c', room: '#1b1a12', paper: '#cdb593', paperHi: '#efdcb8', frame: '#4a3a1c', glow: '#ffc979', shadow: '#1f170e',
    mat: ['#b5783f', '#a36a36', '#c28a52', '#9a5f2e'], edge: '#6b4320', rim: '#e7b97c', seal: '#a8302a' },
  { name: 'moon', bg: '#070914', room: '#0c1024', paper: '#2c3a6a', paperHi: '#6f84c4', frame: '#0a0d1c', glow: '#cfe0ff', shadow: '#05060f',
    mat: ['#a8261e', '#962018', '#b83226', '#8a1c16'], edge: '#e3b55a', rim: '#ffd88a', seal: '#e8b04a' },
];

/** The room and the screen. Returns the backdrop; the screen panel is the box (px, py, pw, ph). */
export function backdrop(m: Mood, W: number, H: number, k: number, panel: { x: number; y: number; w: number; h: number }, seed: number) {
  const { c, g } = canvas(W * k, H * k), r = rng(seed);
  g.scale(k, k);
  g.fillStyle = m.room; g.fillRect(0, 0, W, H);
  const { x, y, w, h } = panel, cx = x + w / 2, cy = y + h * 0.58;
  if (m.name === 'bamboo') {
    // a clay wall, then bamboo blinds hanging either side
    g.fillStyle = mix(m.room, '#3a2c18', 0.5); g.fillRect(0, 0, W, H);
    for (let i = 0; i < 1600; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '255,230,190' : '0,0,0'},${0.03 + r() * 0.05})`; g.fillRect(r() * W, r() * H, 1 + r() * 3, 1 + r() * 2); }
  }
  // the screen
  const pg = g.createRadialGradient(cx, cy, 10, cx, cy, Math.max(w, h) * 0.75);
  pg.addColorStop(0, m.paperHi); pg.addColorStop(0.55, m.paper); pg.addColorStop(1, mix(m.paper, m.room, 0.55));
  g.fillStyle = pg; g.fillRect(x, y, w, h);
  // paper fibre
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  for (let i = 0; i < (w * h) / 26; i++) {
    const fx = x + r() * w, fy = y + r() * h, l = 2 + r() * 9, a = r() * Math.PI;
    g.strokeStyle = m.name === 'moon' ? `rgba(200,215,255,${0.03 + r() * 0.05})` : `rgba(${r() < 0.5 ? '255,255,240' : '120,80,30'},${0.04 + r() * 0.06})`;
    g.lineWidth = 0.5; g.beginPath(); g.moveTo(fx, fy); g.lineTo(fx + Math.cos(a) * l, fy + Math.sin(a) * l); g.stroke();
  }
  if (m.name === 'moon') {
    // the moon behind the screen
    const mg = g.createRadialGradient(x + w * 0.74, y + h * 0.2, 4, x + w * 0.74, y + h * 0.2, w * 0.3);
    mg.addColorStop(0, 'rgba(235,242,255,0.55)'); mg.addColorStop(0.25, 'rgba(200,215,255,0.25)'); mg.addColorStop(1, 'rgba(200,215,255,0)');
    g.fillStyle = mg; g.fillRect(x, y, w, h);
  }
  g.restore();
  return c;
}
/** What stands in front of the screen: its frame and lattice (shoji), blinds, or the theatre's curtains. */
export function frame(m: Mood, W: number, H: number, k: number, panel: { x: number; y: number; w: number; h: number }, seed: number) {
  const { c, g } = canvas(W * k, H * k), r = rng(seed + 1);
  g.scale(k, k);
  const { x, y, w, h } = panel;
  if (m.name === 'lantern') {
    g.strokeStyle = m.frame; g.lineCap = 'butt';
    g.lineWidth = 2; const cols = 4, rows = 6;
    for (let i = 1; i < cols; i++) { g.beginPath(); g.moveTo(x + (w * i) / cols, y); g.lineTo(x + (w * i) / cols, y + h); g.stroke(); }
    for (let j = 1; j < rows; j++) { g.beginPath(); g.moveTo(x, y + (h * j) / rows); g.lineTo(x + w, y + (h * j) / rows); g.stroke(); }
    g.lineWidth = 9; g.strokeRect(x - 4.5, y - 4.5, w + 9, h + 9);
    g.strokeStyle = 'rgba(255,220,170,0.12)'; g.lineWidth = 1; g.strokeRect(x - 8, y - 8, w + 16, h + 16);
  } else if (m.name === 'bamboo') {
    // a wooden frame, and rolled blinds above
    g.strokeStyle = m.frame; g.lineWidth = 8; g.strokeRect(x - 4, y - 4, w + 8, h + 8);
    for (let i = 0; i < 9; i++) { g.fillStyle = i % 2 ? '#7a6234' : '#8c733f'; g.fillRect(x - 10, y - 26 + i * 2.4, w + 20, 2.4); }
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x - 10, y - 4.4, w + 20, 3);
    for (const side of [0, 1]) for (let i = 0; i < 26; i++) {
      const bx = side ? x + w + 6 + i * 0.4 : x - 14 - i * 0.4;
      g.fillStyle = `rgba(${120 + r() * 30},${96 + r() * 20},${48 + r() * 16},0.9)`; g.fillRect(bx, y - 20 + i * ((h + 30) / 26), 8, (h + 30) / 26 - 1);
    }
  } else {
    // theatre curtains drawn back, and a dark proscenium
    g.fillStyle = m.frame; g.fillRect(x - 6, y - 6, w + 12, 6); g.fillRect(x - 6, y + h, w + 12, 6);
    for (const side of [0, 1]) {
      const cx = side ? x + w + 2 : x - 2, dir = side ? 1 : -1;
      for (let i = 0; i < 7; i++) {
        const gx = cx + dir * i * 5, gr = g.createLinearGradient(gx, 0, gx + dir * 5, 0);
        gr.addColorStop(0, '#5c1018'); gr.addColorStop(0.5, '#8a1c24'); gr.addColorStop(1, '#3c0a10');
        g.fillStyle = gr; g.fillRect(Math.min(gx, gx + dir * 5), y - 30, 5, h + 60);
      }
    }
    g.fillStyle = '#2a0a10'; g.fillRect(x - 40, y - 34, w + 80, 12);
    g.fillStyle = '#e3b55a'; g.fillRect(x - 40, y - 23, w + 80, 1.5);
  }
  return c;
}
/** A vignette: the room falls into darkness away from the lamp. */
export function vignette(W: number, H: number, k: number, cx: number, cy: number, strength: number) {
  const { c, g } = canvas(W * k, H * k);
  g.scale(k, k);
  const v = g.createRadialGradient(cx, cy, Math.min(W, H) * 0.25, cx, cy, Math.max(W, H) * 0.85);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(0,0,0,${strength})`);
  g.fillStyle = v; g.fillRect(0, 0, W, H);
  return c;
}
/** A soft round glow (for the lamp and for sparks). */
export function glow(px: number, color: string) {
  const { c, g } = canvas(px, px), gr = g.createRadialGradient(px / 2, px / 2, 0, px / 2, px / 2, px / 2);
  gr.addColorStop(0, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, px, px);
  return c;
}
/** A square seal stamped in red ink, with the figure's initial cut into it. */
export function seal(m: Mood, letter: string, px: number, font: string) {
  const { c, g } = canvas(px, px), r = rng(letter.charCodeAt(0));
  g.fillStyle = m.seal; g.beginPath(); g.roundRect(px * 0.06, px * 0.06, px * 0.88, px * 0.88, px * 0.08); g.fill();
  g.globalCompositeOperation = 'destination-out';
  g.lineWidth = px * 0.05; g.strokeStyle = '#000'; g.strokeRect(px * 0.16, px * 0.16, px * 0.68, px * 0.68);
  g.font = `${Math.round(px * 0.5)}px ${font}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#000'; g.fillText(letter, px / 2, px * 0.53);
  for (let i = 0; i < 90; i++) { g.globalAlpha = 0.3 + r() * 0.7; g.fillRect(r() * px, r() * px, 1 + r() * 2.5, 1 + r() * 2.5); }
  return c;
}
