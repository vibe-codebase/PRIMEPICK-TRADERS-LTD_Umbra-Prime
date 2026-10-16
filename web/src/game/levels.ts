import { FIGURES } from './figures';
import { answers, euler, match, qAngle, qAxis, qId, qMul, qNorm, rng, sculpt, target, VIEW, type Mode, type Q, type Slab } from './geo';

export type Spec = { id: string; name: string; fig: string; seed?: number; decoys?: number; depth?: number; hint?: string };
export type Level = Spec & { chapter: number; mode: Mode; slabs: Slab[]; target: Uint8Array; answers: Q[]; start: { yaw: number; pitch: number; q: Q } };

export const CHAPTERS = [
  { name: 'Paper Lantern', mode: 'yaw' as Mode, blurb: 'Folded paper by candlelight. Turn it left or right until its shadow becomes the picture.' },
  { name: 'Bamboo House', mode: 'tilt' as Mode, blurb: 'Carved wood under a hanging lamp. Now it turns and tips: drag any way.' },
  { name: 'Moon Theatre', mode: 'free' as Mode, blurb: 'Red lacquer and gold, free to turn in every direction.' },
];

const PAPER: Spec[] = [
  { id: 'p1', name: 'Mushroom', fig: 'mushroom', decoys: 1, hint: 'Drag left or right to turn the sculpture. Find the angle where its shadow becomes a mushroom.' },
  { id: 'p2', name: 'Fish', fig: 'fish', decoys: 1 },
  { id: 'p3', name: 'Cottage', fig: 'cottage', decoys: 2 },
  { id: 'p4', name: 'Teapot', fig: 'teapot', decoys: 2, hint: 'Stuck? The lamp shows the outline for a moment, at the cost of a star.' },
  { id: 'p5', name: 'Sailboat', fig: 'sailboat', decoys: 2 },
  { id: 'p6', name: 'Cat', fig: 'cat', decoys: 2 },
  { id: 'p7', name: 'Rabbit', fig: 'rabbit', decoys: 2 },
  { id: 'p8', name: 'Sparrow', fig: 'sparrow', decoys: 3 },
];
const WOOD: Spec[] = [
  { id: 'w1', name: 'Balloon', fig: 'balloon', decoys: 2, hint: 'Now the sculpture also tips toward you and away. Drag up and down as well as sideways.' },
  { id: 'w2', name: 'Whale', fig: 'whale', decoys: 2 },
  { id: 'w3', name: 'Umbrella', fig: 'umbrella', decoys: 2 },
  { id: 'w4', name: 'Snail', fig: 'snail', decoys: 2 },
  { id: 'w5', name: 'Butterfly', fig: 'butterfly', decoys: 3 },
  { id: 'w6', name: 'Heron', fig: 'heron', decoys: 3 },
  { id: 'w7', name: 'Fox', fig: 'fox', decoys: 3 },
  { id: 'w8', name: 'Deer', fig: 'deer', decoys: 3 },
];
const LACQUER: Spec[] = [
  { id: 'm1', name: 'Owl', fig: 'owl', decoys: 2, hint: 'Free to turn every way: drag across the sculpture to roll it like a ball.' },
  { id: 'm2', name: 'Turtle', fig: 'turtle', decoys: 2 },
  { id: 'm3', name: 'Squirrel', fig: 'squirrel', decoys: 3 },
  { id: 'm4', name: 'Crane', fig: 'crane', decoys: 3 },
  { id: 'm5', name: 'Elephant', fig: 'elephant', decoys: 3 },
  { id: 'm6', name: 'Horse', fig: 'horse', decoys: 3 },
  { id: 'm7', name: 'Pagoda', fig: 'pagoda', decoys: 3 },
  { id: 'm8', name: 'Lighthouse', fig: 'lighthouse', decoys: 4 },
];

function hashId(id: string) { let h = 17; for (const c of id) h = (h * 131 + c.charCodeAt(0)) >>> 0; return h; }
/** A starting orientation well away from the answer, whose shadow looks nothing like the figure. */
function startFor(sp: Spec, mode: Mode, slabs: Slab[], tgt: Uint8Array, ans: Q[]) {
  const r = rng(hashId(sp.id) + (sp.seed ?? 0) * 7919);
  for (let tries = 0; tries < 400; tries++) {
    const side = r() < 0.5 ? -1 : 1;
    const yaw = side * (1.0 + r() * 1.1);
    const pitch = mode === 'yaw' ? 0 : (r() < 0.5 ? -1 : 1) * (0.7 + r() * 0.9);
    let q: Q = mode === 'free' ? qNorm(qMul(qAxis([r() - 0.5, r() - 0.5, r() - 0.5], 1.6 + r() * 1.3), qId())) : euler(yaw, pitch);
    if (mode === 'free' && qAngle(q, qId()) < 1.4) continue;
    q = qNorm(q);
    if (ans.some((a) => qAngle(q, a) < 1.0)) continue;
    // nor should we, looking from our side, see the figure face-on
    const seen = qMul(VIEW, q);
    if (ans.some((a) => qAngle(seen, a) < 0.9)) continue;
    if (match(slabs, tgt, q) < 0.5) return { yaw, pitch, q };
  }
  throw new Error(`no start for ${sp.id}`);
}
function fin(d: Spec[], chapter: number): Level[] {
  const mode = CHAPTERS[chapter].mode;
  return d.map((sp) => {
    const fig = FIGURES[sp.fig];
    if (!fig) throw new Error(`no figure ${sp.fig}`);
    const slabs = sculpt(fig, hashId(sp.id) + (sp.seed ?? 0), sp.depth ?? 0.85, sp.decoys ?? 2), tgt = target(fig);
    const ans = answers();
    return { ...sp, chapter, mode, slabs, target: tgt, answers: ans, start: startFor(sp, mode, slabs, tgt, ans) };
  });
}
export const LEVELS: Level[] = [...fin(PAPER, 0), ...fin(WOOD, 1), ...fin(LACQUER, 2)];
export const levelIndex = (id: string) => LEVELS.findIndex((l) => l.id === id);
