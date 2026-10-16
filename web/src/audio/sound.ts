/**
 * Umbra sound, synthesised with Web Audio: a reed-organ drone like a shō, a breathy bamboo flute that plays
 * a phrase now and then, and a temple bowl struck in the distance. Turning the sculpture rustles (paper),
 * creaks (wood) or hums (lacquer); as the shadow comes right a soft chime rises; when it settles, the bowl
 * rings and a seal is stamped.
 */
const semis = (root: number, n: number) => root * Math.pow(2, n / 12);
const SCALE = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24];
const ROOTS = [146.83, 130.81, 110];

export class Sound {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private music!: GainNode;
  private sfx!: GainNode;
  private verb!: ConvolverNode;
  private noise!: AudioBuffer;
  private turnGain: GainNode | null = null;
  private turnFilter: BiquadFilterNode | null = null;
  private timer: number | null = null;
  private next = 0;
  private beatN = 0;
  private chapter = 0;
  private seed = 41;
  private musicVol = 0.6;
  private sfxVol = 0.8;
  private ducked = false;
  private lastWarm = 0;

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      this.ctx = ctx;
      this.master = ctx.createGain(); this.master.gain.value = 0.9;
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3;
      this.master.connect(comp).connect(ctx.destination);
      this.music = ctx.createGain(); this.sfx = ctx.createGain();
      this.verb = ctx.createConvolver(); this.verb.buffer = this.impulse(3.6);
      const wet = ctx.createGain(); wet.gain.value = 0.38;
      this.verb.connect(wet).connect(this.master);
      this.music.connect(this.master); this.music.connect(this.verb);
      this.sfx.connect(this.master); this.sfx.connect(this.verb);
      this.noise = this.makeNoise();
      // the sound of turning, its level set by how fast the sculpture turns
      const src = ctx.createBufferSource(); src.buffer = this.noise; src.loop = true;
      this.turnFilter = ctx.createBiquadFilter(); this.turnFilter.type = 'bandpass'; this.turnFilter.Q.value = 1.2;
      this.turnGain = ctx.createGain(); this.turnGain.gain.value = 0;
      src.connect(this.turnFilter).connect(this.turnGain).connect(this.sfx); src.start();
      this.applyVolumes();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }
  setVolumes(music: number, sfx: number) { this.musicVol = music; this.sfxVol = sfx; this.applyVolumes(); }
  private applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.music.gain.setTargetAtTime(this.musicVol * 0.5 * (this.ducked ? 0.6 : 1), t, 0.25);
    this.sfx.gain.setTargetAtTime(this.sfxVol, t, 0.05);
    this.turnFilter?.frequency.setTargetAtTime([2600, 700, 1400][this.chapter], t, 0.2);
  }
  duck(on: boolean) { this.ducked = on; this.applyVolumes(); }
  suspend() { void this.ctx?.suspend(); }
  resume() { if (this.ctx?.state === 'suspended') void this.ctx.resume(); }
  startMusic(chapter: number) {
    if (!this.ctx) return;
    if (this.timer !== null && chapter === this.chapter) return;
    this.chapter = chapter; this.applyVolumes();
    this.next = this.ctx.currentTime + 0.4;
    if (this.timer === null) this.timer = window.setInterval(() => this.schedule(), 150);
  }
  private rnd() { this.seed = (this.seed * 9301 + 49297) % 233280; return this.seed / 233280; }
  private schedule() {
    const ctx = this.ctx!, step = 0.5, root = ROOTS[this.chapter % 3];
    while (this.next < ctx.currentTime + 0.8) {
      const t = this.next, pos = this.beatN % 48;
      if (pos === 0) this.sho(t, root, step * 48);
      if (pos === 8 || (pos === 30 && this.rnd() < 0.5)) this.phrase(t, root);
      if (pos === 40 && this.rnd() < 0.6) this.bowl(t, root / 2, 0.05);
      this.next += step; this.beatN++;
    }
  }
  /** A cluster of reeds, slowly breathing. */
  private sho(t: number, root: number, dur: number) {
    const ctx = this.ctx!;
    for (const n of [0, 7, 10, 14, 17]) {
      const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
      o.type = 'sawtooth'; o.frequency.value = semis(root, n); o.detune.value = (this.rnd() - 0.5) * 8;
      lp.type = 'lowpass'; lp.frequency.value = 700;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.006, t + dur * 0.35); g.gain.linearRampToValueAtTime(0.0001, t + dur);
      o.connect(lp).connect(g).connect(this.music); o.start(t); o.stop(t + dur + 0.1);
    }
  }
  /** A bamboo flute: a sine with breath and a slow vibrato, bending into each note. */
  private flute(t: number, f: number, dur: number, vol: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator(), g = ctx.createGain(), vib = ctx.createOscillator(), vg = ctx.createGain();
    o.frequency.setValueAtTime(f * 0.97, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.18);
    vib.frequency.value = 5; vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * 0.012, t + dur * 0.6);
    vib.connect(vg).connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.25); g.gain.setValueAtTime(vol, t + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.music); o.start(t); vib.start(t); o.stop(t + dur + 0.05); vib.stop(t + dur + 0.05);
    const n = ctx.createBufferSource(); n.buffer = this.noise; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * 2; bp.Q.value = 3;
    const ng = ctx.createGain(); ng.gain.setValueAtTime(0.0001, t); ng.gain.linearRampToValueAtTime(vol * 0.35, t + 0.1); ng.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.8);
    n.connect(bp).connect(ng).connect(this.music); n.start(t, this.rnd()); n.stop(t + dur);
  }
  private phrase(t: number, root: number) {
    let d = 5 + Math.floor(this.rnd() * 3), at = t;
    const n = 2 + Math.floor(this.rnd() * 3);
    for (let i = 0; i < n; i++) {
      const dur = 0.9 + this.rnd() * 1.4;
      this.flute(at, semis(root * 2, SCALE[d]), dur, 0.028);
      at += dur * 0.85; d = Math.max(3, Math.min(SCALE.length - 1, d + Math.floor(this.rnd() * 3) - 1));
    }
  }
  /** A singing bowl: a few inharmonic partials, struck and left to ring. */
  private bowl(t: number, f: number, vol: number, bus: GainNode = this.music) {
    const ctx = this.ctx!;
    for (const [m, v, d] of [[1, 1, 6], [2.71, 0.5, 4], [5.1, 0.25, 2.5], [8.2, 0.12, 1.4]] as const) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = f * m; o.detune.value = (this.rnd() - 0.5) * 6;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol * v, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g).connect(bus); o.start(t); o.stop(t + d + 0.05);
    }
  }
  private hiss(t: number, dur: number, vol: number, freq: number, q = 1) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource(); src.buffer = this.noise;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = q; bp.frequency.value = freq;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + Math.min(0.01, dur / 4)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp).connect(g).connect(this.sfx); src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }
  tap() { if (this.ctx) this.bowl(this.ctx.currentTime, 880, 0.03, this.sfx); }
  /** 0..1: how fast the sculpture is turning. */
  turning(speed: number) { if (this.ctx && this.turnGain) this.turnGain.gain.setTargetAtTime(Math.min(1, speed) * [0.05, 0.07, 0.04][this.chapter], this.ctx.currentTime, 0.06); }
  /** The shadow is coming right: a soft chime, higher the closer. */
  warmer(close: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (t - this.lastWarm < 0.6) return;
    this.lastWarm = t;
    this.bowl(t, semis(ROOTS[this.chapter % 3] * 4, SCALE[Math.min(SCALE.length - 1, Math.round((close - 0.5) * 16))]), 0.018, this.sfx);
  }
  settle() { if (this.ctx) { const t = this.ctx.currentTime; this.hiss(t, 0.5, 0.04, 1200, 0.8); } }
  reveal(chapter: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, root = ROOTS[chapter % 3];
    this.bowl(t, root * 2, 0.12, this.sfx);
    [0, 3, 5, 7, 10, 12].forEach((d, i) => this.bowl(t + 0.35 + i * 0.12, semis(root * 4, d), 0.025, this.sfx));
  }
  stamp() { if (this.ctx) { const t = this.ctx.currentTime; this.hiss(t, 0.08, 0.1, 400, 1); this.hiss(t, 0.04, 0.05, 2400, 2); } }
  hint() { if (this.ctx) { const t = this.ctx.currentTime; this.hiss(t, 0.6, 0.03, 3000, 0.6); this.bowl(t, semis(ROOTS[this.chapter % 3] * 4, 7), 0.03, this.sfx); } }
  star(i: number) { if (this.ctx) this.bowl(this.ctx.currentTime, [587.33, 698.46, 880][i] ?? 880, 0.05, this.sfx); }

  private makeNoise() {
    const ctx = this.ctx!;
    const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  private impulse(seconds: number) {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    return b;
  }
}
export const sound = new Sound();
