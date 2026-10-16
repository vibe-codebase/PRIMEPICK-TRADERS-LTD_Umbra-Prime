import { describe, expect, it } from 'vitest';
import { CHAPTERS, LEVELS, levelIndex } from '../game/levels';
import { FIGURES } from '../game/figures';
import { euler, hull, iou, match, nearAnswer, qAngle, qAxis, qId, qMul, qNorm, qRot, qSlerp, raster, rng, sculpt, shadow, target, TOLERANCE, type Q } from '../game/geo';
import { starsFor } from '../game/scene.logic';
import { freshSave, isUnlocked, parseSave, recordResult, totalStars } from '../state/save';

describe('geometry', () => {
  it('quaternions turn vectors and compose', () => {
    const q = qAxis([0, 1, 0], Math.PI / 2), v = qRot(q, [0, 0, 1]);
    expect(v[0]).toBeCloseTo(1); expect(v[2]).toBeCloseTo(0);
    const r = qMul(q, q); expect(qRot(r, [0, 0, 1])[2]).toBeCloseTo(-1);
    expect(qAngle(qSlerp(qId(), q, 0.5), qAxis([0, 1, 0], Math.PI / 4))).toBeLessThan(1e-6);
  });
  it('the convex hull of a square and its centre is the square', () => {
    const h = hull([[0, 0], [1, 0], [1, 1], [0, 1], [0.5, 0.5]]);
    expect(h).toHaveLength(4);
  });
  it('a raster of a shape matches itself perfectly and an empty one not at all', () => {
    const a = raster([[[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]]);
    expect(iou(a, a)).toBe(1); expect(iou(a, raster([]))).toBe(0);
  });
  it('every figure is built of pieces inside the frame', () => {
    for (const [name, fig] of Object.entries(FIGURES)) {
      const t = target(fig); let n = 0; for (const v of t) n += v;
      expect(n, name).toBeGreaterThan(150);
      expect(fig.length, name).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('levels', () => {
  it('24 sculptures in three chapters of eight: turning, then tipping, then free', () => {
    expect(LEVELS).toHaveLength(24);
    expect(new Set(LEVELS.map((l) => l.id)).size).toBe(24);
    expect(new Set(LEVELS.map((l) => l.fig)).size).toBe(24);
    CHAPTERS.forEach((c, i) => { const ls = LEVELS.filter((l) => l.chapter === i); expect(ls).toHaveLength(8); ls.forEach((l) => expect(l.mode).toBe(c.mode)); });
    expect(levelIndex('m8')).toBe(23);
  });
  for (const l of LEVELS) {
    it(`${l.id} ${l.name}: the answer casts the figure; the start does not; no other way looks like it`, () => {
      expect(match(l.slabs, l.target, qId())).toBe(1);
      expect(match(l.slabs, l.target, l.start.q)).toBeLessThan(0.5);
      for (const a of l.answers) expect(qAngle(l.start.q, a)).toBeGreaterThan(1);
      const r = rng(l.id.charCodeAt(0) * 31 + l.id.charCodeAt(1));
      for (let k = 0; k < 600; k++) {
        let q: Q;
        if (l.mode === 'yaw') q = euler((r() * 2 - 1) * Math.PI, 0);
        else if (l.mode === 'tilt') q = euler((r() * 2 - 1) * Math.PI, (r() * 2 - 1) * 1.5);
        else q = qNorm([r() * 2 - 1, r() * 2 - 1, r() * 2 - 1, r() * 2 - 1]);
        if (Math.min(...l.answers.map((a) => qAngle(q, a))) > 0.45) expect(match(l.slabs, l.target, q)).toBeLessThan(0.82);
      }
    });
  }
  it('the decoys hide inside the figure', () => {
    for (const l of LEVELS) {
      const decoys = l.slabs.filter((s) => s.decoy);
      expect(decoys.length).toBeGreaterThan(0);
      const t = l.target, d = raster(shadow(decoys, qId()));
      for (let k = 0; k < d.length; k++) if (d[k]) expect(t[k]).toBe(1);
    }
  });
  it('a sculpture settles only when it comes close to an answer', () => {
    expect(nearAnswer(euler(0.05, 0), [qId()], 'yaw')).not.toBeNull();
    expect(nearAnswer(euler(0.3, 0), [qId()], 'yaw')).toBeNull();
    expect(nearAnswer(euler(0, TOLERANCE.tilt * 0.8), [qId()], 'tilt')).not.toBeNull();
  });
  it('sculpting is deterministic', () => {
    expect(sculpt(FIGURES.fish, 3)).toEqual(sculpt(FIGURES.fish, 3));
  });
});

describe('stars and save', () => {
  it('three seals without the outline, then two, then one', () => { expect(starsFor(0)).toBe(3); expect(starsFor(1)).toBe(2); expect(starsFor(4)).toBe(1); });
  it('survives junk and keeps the best', () => {
    expect(parseSave('{')).toEqual(freshSave());
    let s = freshSave();
    s = recordResult(s, 'p1', 2, 1); s = recordResult(s, 'p1', 3, 0);
    expect(s.stars.p1).toBe(3); expect(s.best.p1).toBe(0); expect(isUnlocked(s, 1)).toBe(true); expect(totalStars(s)).toBe(3);
  });
});
