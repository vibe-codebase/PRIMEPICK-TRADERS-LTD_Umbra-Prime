import Phaser from 'phaser';
import * as A from './art';
import { LEVELS, type Level } from './levels';
import { euler, match, nearAnswer, primPolygon, qAngle, qAxis, qId, qMul, qNorm, qRot, qSlerp, shadow, VIEW, type Q, type Slab } from './geo';
import { FIGURES } from './figures';
import { sound } from '../audio/sound';

export type Result = { hints: number; stars: number; seconds: number };
export type Finish = { level: Level; result: Result };
type Hooks = { onFinish?: (f: Finish) => void; onFirstAction?: () => void; onHaptic?: (s: 'light' | 'medium' | 'success' | 'warning') => void };
export type HudState = { hints: number; close: number; done: boolean; hinting: boolean };
import { starsFor } from './scene.logic';
export { starsFor };

/** Bridge between React and the Phaser scene. */
export const theatre = {
  hooks: {} as Hooks,
  scene: null as ShadowScene | null,
  reducedMotion: false,
  font: 'Marcellus, Georgia, serif',
  show(mode: 'menu' | 'play', level: Level) { this.scene?.show(mode, level); },
  setPaused(p: boolean) { this.scene?.setPaused(p); },
  state(): HudState | null { return this.scene?.hudState() ?? null; },
  hint() { this.scene?.hint(); },
  debug() { return this.scene?.debugState(); },
  /** QA only: set the orientation directly (yaw, pitch in radians). */
  qaTurn(yaw: number, pitch: number) { this.scene?.qaTurn(yaw, pitch); },
  /** QA only: CSS position of the sculpture's centre. */
  objectScreen() { return this.scene?.objectScreen(); },
};
(window as unknown as { __umbra: typeof theatre }).__umbra = theatre;

const W = 360;
const SHOWCASE = ['w6', 'm8', 'p6', 'm4', 'w7', 'p8'];
const SENS = 0.0105;
const LX = -0.35, LY = -0.62, LZ = 0.7;

type Face = { pts: { x: number; y: number }[]; depth: number; shade: number; slab: number; kind: 'cap' | 'side' };

export class ShadowScene extends Phaser.Scene {
  level: Level = LEVELS[0];
  private mode: 'menu' | 'play' = 'menu';
  private paused = false;
  private finished = false;
  private acted = false;
  private texSeq = 0;
  private r = 2;
  private vw = W;
  private H = 700;
  private panel = { x: 0, y: 0, w: 300, h: 330 };
  private sw = 110; // shadow pixels per unit
  private so = 70; // sculpture pixels per unit
  private ox = 180;
  private oy = 560;
  private yaw = 0;
  private pitch = 0;
  private q: Q = qId();
  private vel = { x: 0, y: 0 };
  private drag: { x: number; y: number; t: number } | null = null;
  private snap: { from: Q; to: Q; t: number } | null = null;
  private wonT = -1;
  private hintT = -9;
  private hints = 0;
  private startClock = 0;
  private close = 0;
  private lastClose = 0;
  private dirty = true;
  private clock = 0;
  private shadowTex!: Phaser.Textures.CanvasTexture;
  private og!: Phaser.GameObjects.Graphics;
  private fx!: Phaser.GameObjects.Graphics;
  private warm!: Phaser.GameObjects.Image;
  private sealImg: Phaser.GameObjects.Image | null = null;
  private nameText: Phaser.GameObjects.Text | null = null;
  private motes: { x: number; y: number; s: number; t: number }[] = [];
  private demo = { t: 0, idx: 0 };
  private turning = 0;

  constructor() { super('shadow'); }

  create() {
    theatre.scene = this;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.down(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.move(p));
    this.input.on('pointerup', () => this.up());
    this.input.on('pointerupoutside', () => this.up());
    this.scale.on('resize', () => this.rebuild());
    this.show('menu', LEVELS.find((l) => l.id === SHOWCASE[0])!);
  }
  isMenu() { return this.mode === 'menu'; }
  setPaused(p: boolean) { this.paused = p; if (p) this.up(); }
  hudState(): HudState { return { hints: this.hints, close: Math.round(this.close * 100) / 100, done: this.finished || this.wonT >= 0 || !!this.snap, hinting: this.clock - this.hintT < 2.6 }; }
  debugState() { return { ...this.hudState(), mode: this.mode, yaw: this.yaw, pitch: this.pitch, angle: Math.min(...this.level.answers.map((a) => qAngle(this.q, a))), won: this.wonT >= 0 }; }
  objectScreen() { const z = this.cameras.main.zoom, k = (this.game.canvas.clientWidth || this.vw) / this.scale.width; return { x: this.ox * z * k, y: this.oy * z * k }; }

  show(mode: 'menu' | 'play', level: Level) {
    this.mode = mode;
    this.level = level;
    this.paused = false; this.finished = false; this.acted = false;
    this.wonT = -1; this.snap = null; this.hintT = -9; this.hints = 0; this.drag = null; this.vel = { x: 0, y: 0 };
    this.yaw = level.start.yaw; this.pitch = level.start.pitch; this.q = level.mode === 'free' ? level.start.q : euler(this.yaw, this.pitch);
    this.startClock = this.clock; this.demo.t = 0; this.dirty = true;
    this.rebuild();
  }

  // ── layout ────────────────────────────────────────────────────────────
  private tex(prefix: string, c: HTMLCanvasElement) { const k = `${prefix}-${++this.texSeq}`; this.textures.addCanvas(k, c); return k; }
  private rebuild() {
    const stale = this.textures.getTextureKeys().filter((k) => /-\d+$/.test(k));
    this.tweens.killAll();
    this.children.removeAll(true);
    if (stale.length) this.events.once('postrender', () => stale.forEach((k) => this.textures.exists(k) && this.textures.remove(k)));
    const pw = this.scale.width, ph = this.scale.height, zoom = Math.min(pw / W, ph / 640);
    this.vw = pw / zoom; this.H = ph / zoom;
    this.r = Math.min(2, Math.max(1, zoom));
    this.cameras.main.setZoom(zoom).centerOn(this.vw / 2, this.H / 2);
    const dpr = Math.min(2, window.devicePixelRatio || 1), css = zoom / dpr;
    const l = this.level, m = A.MOODS[l.chapter], r = this.r;
    this.cameras.main.setBackgroundColor(m.bg);
    // the screen fills the upper part; the sculpture floats below it
    const top = this.mode === 'play' ? 92 / css : this.H * 0.25, bottom = this.mode === 'play' ? this.H - 96 / css : this.H * 0.8;
    const pwid = Math.min(this.vw - 44, 340, (bottom - top) * 0.62 / 1.1);
    const ph2 = pwid * 1.1;
    this.panel = { x: Math.round((this.vw - pwid) / 2), y: Math.round(top), w: Math.round(pwid), h: Math.round(ph2) };
    this.sw = pwid * 0.38;
    const below = bottom - (this.panel.y + ph2);
    this.so = Math.min(this.sw * 0.66, below / 2.7);
    this.ox = this.vw / 2; this.oy = this.panel.y + ph2 + below * 0.5;
    this.add.image(0, 0, this.tex('bd', A.backdrop(m, this.vw, this.H, r, this.panel, 9 + l.chapter))).setOrigin(0, 0).setScale(1 / r);
    // the lamp's warmth on the screen, brighter as the shadow comes right
    this.warm = this.add.image(this.panel.x + this.panel.w / 2, this.panel.y + this.panel.h * 0.55, this.tex('glow', A.glow(256, m.glow))).setScale((this.panel.w * 1.3) / 256).setAlpha(0.15).setBlendMode(Phaser.BlendModes.ADD);
    const skey = `shadow-${++this.texSeq}`;
    this.shadowTex = this.textures.createCanvas(skey, Math.round(this.panel.w * r), Math.round(this.panel.h * r))!;
    this.add.image(this.panel.x, this.panel.y, skey).setOrigin(0, 0).setScale(1 / r);
    this.add.image(0, 0, this.tex('frame', A.frame(m, this.vw, this.H, r, this.panel, 9 + l.chapter))).setOrigin(0, 0).setScale(1 / r);
    this.add.image(0, 0, this.tex('vig', A.vignette(this.vw, this.H, r, this.vw / 2, this.panel.y + this.panel.h * 0.6, l.chapter === 2 ? 0.8 : 0.7))).setOrigin(0, 0).setScale(1 / r);
    // the stand and the sculpture
    this.og = this.add.graphics();
    this.fx = this.add.graphics();
    this.sealImg = null; this.nameText = null;
    if (this.wonT >= 0) this.reveal(true);
    this.dirty = true;
  }

  // ── input ─────────────────────────────────────────────────────────────
  private down(p: Phaser.Input.Pointer) {
    if (this.mode !== 'play' || this.paused || this.finished || this.snap || this.wonT >= 0) return;
    if (!this.acted) { this.acted = true; theatre.hooks.onFirstAction?.(); }
    this.drag = { x: p.x, y: p.y, t: this.clock };
    this.vel = { x: 0, y: 0 };
  }
  private move(p: Phaser.Input.Pointer) {
    const d = this.drag;
    if (!d) return;
    const z = this.cameras.main.zoom, dx = (p.x - d.x) / z, dy = (p.y - d.y) / z;
    d.x = p.x; d.y = p.y;
    this.turn(dx, dy);
    const dt = Math.max(0.008, this.clock - d.t); d.t = this.clock;
    this.vel = { x: this.vel.x * 0.5 + (dx / dt) * 0.5, y: this.vel.y * 0.5 + (dy / dt) * 0.5 };
  }
  private up() { if (!this.drag) return; this.drag = null; if (Math.hypot(this.vel.x, this.vel.y) < 30) this.vel = { x: 0, y: 0 }; }
  /** Turn by a drag of (dx, dy) world pixels, as the chapter allows. */
  private turn(dx: number, dy: number) {
    const mode = this.level.mode;
    if (mode === 'yaw') { this.yaw += dx * SENS; this.q = euler(this.yaw, 0); }
    else if (mode === 'tilt') { this.yaw += dx * SENS; this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch - dy * SENS)); this.q = euler(this.yaw, this.pitch); }
    else { const a = Math.hypot(dx, dy) * SENS; if (a > 0) this.q = qNorm(qMul(qAxis([-dy, dx, 0], a), this.q)); }
    this.turning += Math.hypot(dx, dy);
    this.dirty = true;
  }
  qaTurn(yaw: number, pitch: number) { this.yaw = yaw; this.pitch = pitch; this.q = euler(yaw, pitch); this.dirty = true; if (!this.acted) { this.acted = true; theatre.hooks.onFirstAction?.(); } }
  hint() {
    if (this.mode !== 'play' || this.wonT >= 0 || this.snap || this.clock - this.hintT < 2.6) return;
    this.hints++; this.hintT = this.clock; sound.hint();
  }

  // ── frame ─────────────────────────────────────────────────────────────
  update(_t: number, dms: number) {
    const dt = Math.min(0.05, Math.max(0.001, dms / 1000 || 0.016));
    this.clock += dt;
    if (this.paused) return;
    const l = this.level;
    if (this.mode === 'menu') this.runDemo(dt);
    // a flick keeps turning, slowing
    if (!this.drag && !this.snap && this.wonT < 0 && (this.vel.x || this.vel.y)) {
      this.turn(this.vel.x * dt, this.vel.y * dt);
      const f = Math.pow(0.05, dt); this.vel = { x: this.vel.x * f, y: this.vel.y * f };
      if (Math.hypot(this.vel.x, this.vel.y) < 8) this.vel = { x: 0, y: 0 };
    }
    // close enough: it settles into place
    if (!this.snap && this.wonT < 0 && this.mode === 'play') {
      const a = nearAnswer(this.q, l.answers, l.mode);
      if (a) { this.snap = { from: this.q, to: a, t: 0 }; this.drag = null; this.vel = { x: 0, y: 0 }; sound.settle(); theatre.hooks.onHaptic?.('medium'); }
    }
    if (this.snap) {
      this.snap.t = Math.min(1, this.snap.t + dt / 0.7);
      const e = 1 - Math.pow(1 - this.snap.t, 3);
      this.q = qSlerp(this.snap.from, this.snap.to, e); this.dirty = true;
      if (this.snap.t >= 1) { this.q = this.snap.to; this.snap = null; this.win(); }
    }
    if (this.mode === 'play' && this.wonT >= 0 && !this.finished && this.clock - this.wonT > 2.8) {
      this.finished = true;
      theatre.hooks.onFinish?.({ level: l, result: { hints: this.hints, stars: starsFor(this.hints), seconds: Math.round(this.wonT - this.startClock) } });
    }
    sound.turning(Math.min(1, this.turning / (dt * 600)));
    this.turning = 0;
    if (this.dirty) { this.close = match(l.slabs, l.target, this.q); this.dirty = false; this.paintShadow(); }
    this.warm.setAlpha(0.12 + 0.3 * Math.max(0, Math.min(1, (this.close - 0.4) / 0.5)) + (this.wonT >= 0 ? 0.15 : 0));
    if (this.close > this.lastClose + 0.12 && this.close > 0.6) sound.warmer(this.close);
    if (Math.abs(this.close - this.lastClose) > 0.12) this.lastClose = this.close;
    this.drawSculpture();
    this.drawFx(dt);
  }
  private win() {
    this.wonT = this.clock;
    sound.reveal(this.level.chapter);
    theatre.hooks.onHaptic?.('success');
    this.paintShadow();
    this.reveal(false);
  }
  /** The name and the seal, pressed onto the screen. */
  private reveal(instant: boolean) {
    const m = A.MOODS[this.level.chapter], p = this.panel, r = this.r;
    const s = Math.round(p.w * 0.14);
    this.sealImg = this.add.image(p.x + p.w - s * 0.75, p.y + p.h - s * 0.75, this.tex('seal', A.seal(m, this.level.name[0], s * r, theatre.font))).setScale(1 / r).setAlpha(0.9);
    this.nameText = this.add.text(p.x + p.w / 2, p.y + p.h - 18, this.level.name, { fontFamily: theatre.font, fontSize: `${Math.round(p.w * 0.075)}px`, color: this.level.chapter === 2 ? '#e8ecff' : '#3a2516' })
      .setOrigin(0.5, 1).setResolution(r).setAlpha(0.85);
    if (!instant && !theatre.reducedMotion) {
      this.sealImg.setScale(1.6 / r).setAlpha(0); this.nameText.setAlpha(0);
      this.tweens.add({ targets: this.sealImg, scale: 1 / r, alpha: 0.9, duration: 380, delay: 700, ease: 'Back.easeOut', onStart: () => sound.stamp() });
      this.tweens.add({ targets: this.nameText, alpha: 0.85, duration: 900, delay: 300 });
    }
  }
  private runDemo(dt: number) {
    const d = this.demo, l = this.level;
    d.t += dt;
    const turnT = 5.5, hold = 3.5;
    const e = Math.min(1, Math.max(0, (d.t - 0.6) / turnT)), ease = e < 0.5 ? 4 * e * e * e : 1 - Math.pow(-2 * e + 2, 3) / 2;
    this.q = qSlerp(l.start.q, l.answers[0], ease); this.dirty = true;
    if (e >= 1 && this.wonT < 0) { this.wonT = this.clock; this.reveal(false); }
    if (d.t > turnT + hold + 0.6) { d.idx = (d.idx + 1) % SHOWCASE.length; this.show('menu', LEVELS.find((x) => x.id === SHOWCASE[d.idx])!); }
  }

  // ── drawing ───────────────────────────────────────────────────────────
  private paintShadow() {
    const m = A.MOODS[this.level.chapter], ctx = this.shadowTex.context, r = this.r, p = this.panel;
    const cx = p.w / 2, cy = p.h * 0.47;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.setTransform(r, 0, 0, r, 0, 0);
    const won = this.wonT >= 0;
    const polys = shadow(this.level.slabs, this.q);
    ctx.filter = won ? 'none' : `blur(${1.4 * r}px)`;
    ctx.fillStyle = m.shadow; ctx.globalAlpha = won ? 0.92 : 0.78;
    ctx.beginPath();
    for (const poly of polys) { poly.forEach(([x, y], k) => (k ? ctx.lineTo(cx + x * this.sw, cy + y * this.sw) : ctx.moveTo(cx + x * this.sw, cy + y * this.sw))); ctx.closePath(); }
    ctx.fill('nonzero');
    ctx.filter = 'none'; ctx.globalAlpha = 1;
    this.shadowTex.refresh();
  }
  private drawSculpture() {
    const g = this.og, l = this.level, m = A.MOODS[l.chapter], q = this.q, so = this.so, ox = this.ox, oy = this.oy;
    g.clear();
    // the stand: a brass pin down to a small base
    const baseY = oy + so * 1.55;
    g.fillStyle(0x000000, 0.35); g.fillEllipse(ox, baseY + 3, so * 0.9, so * 0.16);
    g.fillStyle(l.chapter === 2 ? 0x2a0a10 : 0x2a1a0e, 1); g.fillEllipse(ox, baseY, so * 0.62, so * 0.12);
    g.lineStyle(2, l.chapter === 2 ? 0xe3b55a : 0xb08a4a, 0.9); g.lineBetween(ox, oy, ox, baseY);
    const faces: Face[] = [];
    const cam = (v: [number, number, number]) => qRot(VIEW, qRot(q, v));
    l.slabs.forEach((s, si) => {
      const z0 = s.z - s.t / 2, z1 = s.z + s.t / 2;
      const front = s.pts.map(([x, y]) => cam([x, y, z1])), back = s.pts.map(([x, y]) => cam([x, y, z0]));
      const nF = cam([0, 0, 1]), nB = cam([0, 0, -1]), o = cam([0, 0, 0]);
      const proj = (v: number[]) => ({ x: ox + v[0] * so, y: oy + v[1] * so });
      const shade = (n: number[]) => { const nn = [n[0] - o[0], n[1] - o[1], n[2] - o[2]]; return Math.max(0, (nn[0] * LX + nn[1] * LY + nn[2] * LZ) / Math.hypot(LX, LY, LZ)); };
      const facing = (n: number[]) => n[2] - o[2] > 0;
      if (facing(nF)) faces.push({ pts: front.map(proj), depth: front.reduce((a, v) => a + v[2], 0) / front.length, shade: shade(nF), slab: si, kind: 'cap' });
      if (facing(nB)) faces.push({ pts: back.map(proj), depth: back.reduce((a, v) => a + v[2], 0) / back.length, shade: shade(nB), slab: si, kind: 'cap' });
      const n = s.pts.length;
      // winding: outward side normals
      let area = 0; for (let k = 0; k < n; k++) { const a = s.pts[k], b = s.pts[(k + 1) % n]; area += a[0] * b[1] - b[0] * a[1]; }
      const sg = area >= 0 ? 1 : -1;
      for (let k = 0; k < n; k++) {
        const a = s.pts[k], b = s.pts[(k + 1) % n];
        const nx = (b[1] - a[1]) * sg, ny = -(b[0] - a[0]) * sg, nl = Math.hypot(nx, ny) || 1;
        const nn = cam([nx / nl, ny / nl, 0]);
        if (!facing(nn)) continue;
        const quad = [front[k], front[(k + 1) % n], back[(k + 1) % n], back[k]];
        faces.push({ pts: quad.map(proj), depth: quad.reduce((acc, v) => acc + v[2], 0) / 4, shade: shade(nn), slab: si, kind: 'side' });
      }
    });
    faces.sort((a, b) => a.depth - b.depth);
    const edge = A.hexNum(m.edge);
    for (const f of faces) {
      const s: Slab = l.slabs[f.slab];
      const base = m.mat[Math.floor(s.tone * m.mat.length) % m.mat.length];
      const lit = 0.55 + f.shade * 0.6 + (f.kind === 'side' ? -0.08 : 0.04);
      const [rr, gg, bb] = A.rgb(base);
      const col = (Math.min(255, rr * lit) << 16) | (Math.min(255, gg * lit) << 8) | Math.min(255, bb * lit);
      g.fillStyle(col, 1); g.fillPoints(f.pts, true);
      g.lineStyle(l.chapter === 2 ? 1.1 : 0.7, edge, l.chapter === 2 ? 0.9 : 0.55); g.strokePoints(f.pts, true);
    }
  }
  private drawFx(dt: number) {
    const fx = this.fx, l = this.level, m = A.MOODS[l.chapter], p = this.panel;
    fx.clear();
    // the hint: the figure's outline glows on the screen for a moment
    const ht = this.clock - this.hintT;
    if (ht < 2.6) {
      const a = Math.min(1, ht / 0.3) * Math.min(1, (2.6 - ht) / 0.6);
      const cx = p.x + p.w / 2, cy = p.y + p.h * 0.47;
      fx.fillStyle(l.chapter === 2 ? 0xdfe8ff : 0xfff3d8, 0.32 * a);
      for (const pr of FIGURES[l.fig]) { const poly = primPolygon(pr); fx.fillPoints(poly.map(([x, y]) => ({ x: cx + x * this.sw, y: cy + y * this.sw })), true); }
    }
    // dust (or moths) in the lamplight
    if (!theatre.reducedMotion) {
      while (this.motes.length < 22) this.motes.push({ x: Math.random() * this.vw, y: this.panel.y + Math.random() * (this.H - this.panel.y), s: Math.random(), t: Math.random() * 10 });
      for (const mo of this.motes) {
        mo.t += dt; mo.x += Math.sin(mo.t * 0.5 + mo.s * 9) * 5 * dt; mo.y += (Math.cos(mo.t * 0.35 + mo.s * 4) * 3 - 1.2) * dt;
        if (mo.y < this.panel.y) mo.y = this.H;
        const a = (0.25 + 0.3 * Math.sin(mo.t * 1.3 + mo.s * 7) ** 2) * (l.chapter === 2 ? 0.8 : 1);
        fx.fillStyle(A.hexNum(m.glow), a); fx.fillCircle(mo.x, mo.y, 0.7 + mo.s * 0.8);
      }
    }
  }
}

export function startGame(parent: HTMLElement) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#140e0a',
    scale: { mode: Phaser.Scale.NONE, width: parent.clientWidth * dpr, height: parent.clientHeight * dpr, zoom: 1 / dpr },
    render: { antialias: true, pixelArt: false, powerPreference: 'high-performance' },
    audio: { noAudio: true },
    fps: { target: 60, smoothStep: false },
    input: { activePointers: 1 },
    scene: [ShadowScene],
    banner: false,
  });
  const onResize = () => {
    const d = Math.min(window.devicePixelRatio || 1, 2);
    game.scale.setZoom(1 / d);
    game.scale.resize(parent.clientWidth * d, parent.clientHeight * d);
  };
  window.addEventListener('resize', onResize);
  return () => { window.removeEventListener('resize', onResize); game.destroy(true); };
}
