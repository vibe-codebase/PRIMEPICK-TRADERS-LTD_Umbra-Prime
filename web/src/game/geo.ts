/**
 * A shadow sculpture. A figure (a bird, a cat, a teapot) is drawn as a few convex pieces: ellipses and
 * polygons. Each piece becomes a thick slab floating at its own depth, and a few hidden pieces float inside
 * the outline. Seen along the light, from the one right direction, the slabs line up and their shadow is the
 * figure; turned any other way, the shadow is a jumble.
 *
 * Coordinates: figures are drawn in a 100 × 100 box (y down). Sculpture space is that box centred and scaled
 * to [-1, 1], with z toward the light. The light shines along -z onto a wall in the x–y plane.
 */

export type Prim =
  | { e: [number, number, number, number, number?] } // ellipse: cx, cy, rx, ry, rotation (degrees)
  | { p: [number, number][] }; // convex polygon, any winding
export type Figure = Prim[];

export type V3 = [number, number, number];
export type Q = [number, number, number, number]; // w, x, y, z
export type Slab = { pts: [number, number][]; z: number; t: number; decoy: boolean; tone: number };

// ── quaternions ─────────────────────────────────────────────────────────────
export const qId = (): Q => [1, 0, 0, 0];
export function qAxis(ax: V3, a: number): Q {
  const l = Math.hypot(ax[0], ax[1], ax[2]) || 1, s = Math.sin(a / 2) / l;
  return [Math.cos(a / 2), ax[0] * s, ax[1] * s, ax[2] * s];
}
export function qMul(a: Q, b: Q): Q {
  return [a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3], a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2], a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1], a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0]];
}
export function qNorm(q: Q): Q { const l = Math.hypot(...q) || 1; return [q[0] / l, q[1] / l, q[2] / l, q[3] / l]; }
export function qRot(q: Q, v: V3): V3 {
  const [w, x, y, z] = q, [vx, vy, vz] = v;
  const tx = 2 * (y * vz - z * vy), ty = 2 * (z * vx - x * vz), tz = 2 * (x * vy - y * vx);
  return [vx + w * tx + (y * tz - z * ty), vy + w * ty + (z * tx - x * tz), vz + w * tz + (x * ty - y * tx)];
}
/** The angle (radians) between two orientations. */
export function qAngle(a: Q, b: Q) { const d = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]); return 2 * Math.acos(Math.min(1, d)); }
export function qSlerp(a: Q, b: Q, t: number): Q {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  const bb: Q = d < 0 ? [-b[0], -b[1], -b[2], -b[3]] : b;
  d = Math.abs(d);
  if (d > 0.9995) return qNorm([a[0] + (bb[0] - a[0]) * t, a[1] + (bb[1] - a[1]) * t, a[2] + (bb[2] - a[2]) * t, a[3] + (bb[3] - a[3]) * t]);
  const th = Math.acos(d), s = Math.sin(th), wa = Math.sin((1 - t) * th) / s, wb = Math.sin(t * th) / s;
  return [a[0] * wa + bb[0] * wb, a[1] * wa + bb[1] * wb, a[2] * wa + bb[2] * wb, a[3] * wa + bb[3] * wb];
}

// ── the figure and its slabs ────────────────────────────────────────────────
const toUnit = (x: number, y: number): [number, number] => [(x - 50) / 50, (y - 50) / 50];
export function primPolygon(pr: Prim, seg = 22): [number, number][] {
  if ('p' in pr) return hull(pr.p.map(([x, y]) => toUnit(x, y)));
  const [cx, cy, rx, ry, rot = 0] = pr.e, a0 = (rot * Math.PI) / 180, out: [number, number][] = [];
  for (let k = 0; k < seg; k++) {
    const a = (k / seg) * Math.PI * 2, x = Math.cos(a) * rx, y = Math.sin(a) * ry;
    out.push(toUnit(cx + x * Math.cos(a0) - y * Math.sin(a0), cy + x * Math.sin(a0) + y * Math.cos(a0)));
  }
  return out;
}
export function rng(seed: number) {
  let s = Math.imul(seed + 0x9e3779b9, 2654435761) >>> 0 || 1;
  const next = () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  for (let k = 0; k < 8; k++) next();
  return next;
}
/**
 * Turn a figure into slabs: every piece at its own depth (spread through the sculpture, neighbours kept apart)
 * and thickness, plus `decoys` smaller copies of pieces, shrunk toward their centre so they stay inside the
 * outline, floating elsewhere in depth.
 */
export function sculpt(fig: Figure, seed: number, depth = 0.85, decoys = 2): Slab[] {
  const r = rng(seed), n = fig.length;
  // depths: an even spread, shuffled, with a little jitter
  const zs = Array.from({ length: n }, (_, i) => -depth + (2 * depth * (i + 0.5)) / n).sort(() => r() - 0.5).map((z) => z + (r() - 0.5) * (depth / n));
  const slabs: Slab[] = fig.map((pr, i) => ({ pts: primPolygon(pr), z: zs[i], t: 0.12 + r() * 0.3, decoy: false, tone: r() }));
  for (let k = 0; k < decoys; k++) {
    const src = slabs[Math.floor(r() * n)], c = centroid(src.pts), s = 0.35 + r() * 0.25;
    slabs.push({ pts: src.pts.map(([x, y]) => [c[0] + (x - c[0]) * s, c[1] + (y - c[1]) * s]), z: (r() * 2 - 1) * depth * 1.1, t: 0.25 + r() * 0.35, decoy: true, tone: r() });
  }
  return slabs;
}
export function centroid(p: [number, number][]): [number, number] { let x = 0, y = 0; for (const q of p) { x += q[0]; y += q[1]; } return [x / p.length, y / p.length]; }

/** Convex hull (monotone chain), counter-clockwise. */
export function hull(pts: [number, number][]): [number, number][] {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: [number, number][] = [], up: [number, number][] = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
/** The shadow each slab casts on the wall when the sculpture is turned by q: one convex polygon per slab. */
export function shadow(slabs: Slab[], q: Q): [number, number][][] {
  return slabs.map((s) => {
    const pts: [number, number][] = [];
    for (const [x, y] of s.pts) for (const z of [s.z - s.t / 2, s.z + s.t / 2]) { const v = qRot(q, [x, y, z]); pts.push([v[0], v[1]]); }
    return hull(pts);
  });
}

// ── matching ────────────────────────────────────────────────────────────────
export const GRID = 56;
const SPAN = 1.3;
/** Rasterise convex polygons onto the GRID × GRID matching grid. */
export function raster(polys: [number, number][][], out: Uint8Array = new Uint8Array(GRID * GRID)) {
  out.fill(0);
  for (const poly of polys) {
    if (poly.length < 3) continue;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [x, y] of poly) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    const cell = (2 * SPAN) / GRID;
    const i0 = Math.max(0, Math.floor((minX + SPAN) / cell)), i1 = Math.min(GRID - 1, Math.ceil((maxX + SPAN) / cell));
    const j0 = Math.max(0, Math.floor((minY + SPAN) / cell)), j1 = Math.min(GRID - 1, Math.ceil((maxY + SPAN) / cell));
    // winding of this polygon
    let area = 0; for (let k = 0; k < poly.length; k++) { const a = poly[k], b = poly[(k + 1) % poly.length]; area += a[0] * b[1] - b[0] * a[1]; }
    const sg = area >= 0 ? 1 : -1;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const px = -SPAN + (i + 0.5) * cell, py = -SPAN + (j + 0.5) * cell;
      let inside = true;
      for (let k = 0; k < poly.length && inside; k++) { const a = poly[k], b = poly[(k + 1) % poly.length]; if (((b[0] - a[0]) * (py - a[1]) - (b[1] - a[1]) * (px - a[0])) * sg < 0) inside = false; }
      if (inside) out[j * GRID + i] = 1;
    }
  }
  return out;
}
/** Intersection over union of two rasters. */
export function iou(a: Uint8Array, b: Uint8Array) {
  let i = 0, u = 0;
  for (let k = 0; k < a.length; k++) { if (a[k] || b[k]) u++; if (a[k] && b[k]) i++; }
  return u ? i / u : 0;
}
export const target = (fig: Figure) => raster(fig.map((p) => primPolygon(p)));
/** How well the shadow at orientation q matches the figure. */
export function match(slabs: Slab[], tgt: Uint8Array, q: Q, buf?: Uint8Array) { return iou(raster(shadow(slabs, q), buf), tgt); }
export const WIN = 0.86; // only for tools; the game settles by angle (see nearAnswer)

// ── how the sculpture may be turned in each chapter ─────────────────────────
export type Mode = 'yaw' | 'tilt' | 'free';
/** Orientation from yaw (about the vertical) then pitch (about the horizontal). */
export function euler(yaw: number, pitch: number): Q { return qMul(qAxis([1, 0, 0], pitch), qAxis([0, 1, 0], yaw)); }

/**
 * The orientations that show the figure: the answer itself, and the sculpture turned right round, whose
 * shadow is the same figure seen from behind (its mirror image), which counts just as well.
 */
export function answers(): Q[] { return [qId(), qAxis([0, 1, 0], Math.PI)]; }
/** How close (radians) an orientation must come to an answer before the sculpture settles into it. */
export const TOLERANCE: Record<Mode, number> = { yaw: 0.1, tilt: 0.14, free: 0.19 };
/** The answer within tolerance of q, or null. */
export function nearAnswer(q: Q, ans: Q[], mode: Mode) {
  let best: Q | null = null, bd = TOLERANCE[mode];
  for (const a of ans) { const d = qAngle(q, a); if (d < bd) { bd = d; best = a; } }
  return best;
}

/** We look at the sculpture from up and to the right of the lamp, so it does not simply show us its answer. */
export const VIEW: Q = qNorm(qMul(qAxis([1, 0, 0], -0.5), qAxis([0, 1, 0], 0.72)));
