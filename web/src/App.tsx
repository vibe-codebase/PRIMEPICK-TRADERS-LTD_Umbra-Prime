import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CHAPTERS, LEVELS, levelIndex, type Level } from './game/levels';
import { theatre, startGame, type Finish, type HudState } from './game/scene';
import { sound } from './audio/sound';
import { haptic, onNative, toNative } from './bridge';
import { freshSave, isUnlocked, loadSave, recordResult, totalStars, writeSave, type Save } from './state/save';
import { Postcard } from './ui/Postcard';
import * as I from './ui/icons';

type Screen = 'home' | 'gallery' | 'play' | 'settings';
const MENU_LEVEL = 'w6';

export default function App() {
  const host = useRef<HTMLDivElement>(null);
  const [save, setSave] = useState<Save>(() => loadSave());
  const [screen, setScreen] = useState<Screen>('home');
  const [chapter, setChapter] = useState(0);
  const [level, setLevel] = useState<Level>(LEVELS[0]);
  const [paused, setPaused] = useState(false);
  const [finish, setFinish] = useState<Finish | null>(null);
  const [coach, setCoach] = useState(false);
  const [settingsFrom, setSettingsFrom] = useState<Screen>('home');
  const saveRef = useRef(save);
  saveRef.current = save;

  useEffect(() => {
    if (!host.current) return;
    theatre.reducedMotion = save.settings.reducedMotion;
    return startGame(host.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { writeSave(save); }, [save]);
  useEffect(() => {
    sound.setVolumes(save.settings.music, save.settings.sfx);
    theatre.reducedMotion = save.settings.reducedMotion;
    document.documentElement.dataset.motion = save.settings.reducedMotion ? 'reduced' : 'full';
  }, [save.settings]);

  const buzz = useCallback((s: 'light' | 'medium' | 'success' | 'warning') => haptic(s, saveRef.current.settings.haptics), []);
  useEffect(() => {
    const unlock = () => { sound.unlock(); sound.startMusic(chapter); };
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, [chapter]);

  const startLevel = useCallback((l: Level) => {
    sound.unlock(); sound.startMusic(l.chapter); sound.duck(true);
    setLevel(l); setChapter(l.chapter); setFinish(null); setPaused(false);
    setCoach(Boolean(l.hint) && !saveRef.current.seenHints.includes(l.id));
    setScreen('play');
    theatre.show('play', l);
  }, []);

  useEffect(() => {
    theatre.hooks = {
      onFinish: (f) => {
        setFinish(f);
        setSave((s) => recordResult(s, f.level.id, f.result.stars, f.result.hints));
      },
      onFirstAction: () => { setCoach(false); setSave((s) => (s.seenHints.includes(level.id) ? s : { ...s, seenHints: [...s.seenHints, level.id] })); },
      onHaptic: buzz,
    };
  }, [buzz, level.id]);

  const showMenu = useCallback(() => { if (!theatre.scene?.isMenu()) theatre.show('menu', LEVELS.find((l) => l.id === MENU_LEVEL)!); }, []);
  const goHome = useCallback(() => { setScreen('home'); setFinish(null); setPaused(false); sound.duck(false); showMenu(); }, [showMenu]);
  const goGallery = useCallback(() => { setScreen('gallery'); setFinish(null); setPaused(false); sound.duck(false); showMenu(); }, [showMenu]);
  const pause = useCallback((p: boolean) => { setPaused(p); theatre.setPaused(p); }, []);

  useEffect(() => onNative((e) => {
    if (e.type === 'native.lifecycle') {
      if (e.state === 'background') { sound.suspend(); if (screen === 'play' && !finish) pause(true); }
      else sound.resume();
      return;
    }
    if (screen === 'play') { if (finish) goGallery(); else if (!paused) pause(true); else goGallery(); }
    else if (screen === 'gallery') goHome();
    else if (screen === 'settings') setScreen(settingsFrom);
    else toNative({ type: 'exit' });
  }), [screen, paused, finish, pause, goHome, goGallery, settingsFrom]);

  useEffect(() => {
    const vis = () => { if (document.hidden) { sound.suspend(); if (screen === 'play' && !finish) pause(true); } else sound.resume(); };
    document.addEventListener('visibilitychange', vis);
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && screen === 'play' && !finish) pause(!paused);
      else if (e.key === 'h' && screen === 'play' && !paused) theatre.hint();
    };
    window.addEventListener('keydown', key);
    return () => { document.removeEventListener('visibilitychange', vis); window.removeEventListener('keydown', key); };
  }, [screen, paused, finish, pause]);

  const nextLevel = useMemo(() => { const i = levelIndex(level.id); return i >= 0 && i < LEVELS.length - 1 ? LEVELS[i + 1] : null; }, [level]);
  const firstOpen = useMemo(() => { const i = LEVELS.findIndex((l, idx) => isUnlocked(save, idx) && !save.stars[l.id]); return LEVELS[i >= 0 ? i : 0]; }, [save]);

  return (
    <div className={`app ch-${chapter}`}>
      <div className="stage" ref={host} />
      {screen === 'home' && (
        <Home lanterns={totalStars(save)} done={Object.keys(save.stars).length} resume={save.stars[LEVELS[0].id] ? firstOpen : null} onPlay={() => startLevel(firstOpen)}
          onGallery={() => { setChapter(firstOpen.chapter); setScreen('gallery'); }}
          onSettings={() => { setSettingsFrom('home'); setScreen('settings'); }} />
      )}
      {screen === 'gallery' && <Gallery save={save} chapter={chapter} onChapter={(c) => { setChapter(c); sound.startMusic(c); }} onPick={startLevel} onBack={goHome} />}
      {screen === 'play' && <Hud level={level} coach={coach} dim={paused || !!finish} onPause={() => pause(true)} />}
      {screen === 'play' && paused && !finish && (
        <PauseCard level={level} onResume={() => pause(false)} onRestart={() => startLevel(level)} onGallery={goGallery}
          onSettings={() => { setSettingsFrom('play'); setScreen('settings'); }} />
      )}
      {screen === 'play' && finish && (
        <ResultCard finish={finish} next={nextLevel && isUnlocked(save, levelIndex(nextLevel.id)) ? nextLevel : null}
          onNext={startLevel} onRetry={() => startLevel(level)} onGallery={goGallery} />
      )}
      {screen === 'settings' && (
        <Settings save={save} onChange={(st) => setSave((s) => ({ ...s, settings: st }))} onReset={() => setSave((s) => ({ ...freshSave(), settings: s.settings }))}
          onBack={() => { setScreen(settingsFrom); if (settingsFrom === 'play') pause(true); }} />
      )}
    </div>
  );
}

function Home({ lanterns, done, resume, onPlay, onGallery, onSettings }: { lanterns: number; done: number; resume: Level | null; onPlay: () => void; onGallery: () => void; onSettings: () => void }) {
  return (
    <div className="screen home">
      <header className="title">
        <h1>Umbra<small>Prime</small></h1>
        <p>Turn each sculpture in the lamplight until its shadow becomes a picture.</p>
      </header>
      <div className="home-actions">
        <button className="warm-btn" onClick={() => { sound.tap(); onPlay(); }} data-testid="play">
          <I.Lamp size={24} /> {resume ? <>Continue <small>{resume.name}</small></> : 'Light the lamp'}
        </button>
        <div className="row">
          <button className="mist-btn" onClick={() => { sound.tap(); onGallery(); }}><I.Screen /> Screens</button>
          <button className="mist-btn round" aria-label="Settings" onClick={() => { sound.tap(); onSettings(); }}><I.Gear /></button>
        </div>
        <div className="tally"><I.Seal size={17} on /> {lanterns} / {LEVELS.length * 3} · {done} shadows found</div>
      </div>
    </div>
  );
}

function Gallery({ save, chapter, onChapter, onPick, onBack }: { save: Save; chapter: number; onChapter: (c: number) => void; onPick: (l: Level) => void; onBack: () => void }) {
  const levels = LEVELS.filter((l) => l.chapter === chapter);
  const got = levels.reduce((a, l) => a + (save.stars[l.id] ?? 0), 0);
  const chapterOpen = (c: number) => isUnlocked(save, LEVELS.findIndex((l) => l.chapter === c));
  const w = Math.floor(Math.max(56, Math.min(84, (Math.min(window.innerWidth, 460) - 36 - 3 * 10) / 4, (window.innerHeight - 330) / 2 / 1.15 - 30)));
  return (
    <div className="screen gallery">
      <div className="topbar">
        <button className="icon-btn" aria-label="Back" onClick={() => { sound.tap(); onBack(); }}><I.Back /></button>
        <div className="heading"><span className="eyebrow">screens · {got}/72</span><h2>{CHAPTERS[chapter].name}</h2></div>
        <span />
      </div>
      <div className="tabs" role="tablist">
        {CHAPTERS.map((c, i) => (
          <button key={c.name} role="tab" aria-selected={i === chapter} disabled={!chapterOpen(i)} className={`tab t${i} ${i === chapter ? 'on' : ''}`}
            aria-label={`${c.name}${chapterOpen(i) ? '' : ' (locked)'}`} onClick={() => { sound.tap(); onChapter(i); }}><i />{c.name}</button>
        ))}
      </div>
      <p className="blurb">{CHAPTERS[chapter].blurb}</p>
      <div className="cards">
        {levels.map((l) => {
          const idx = levelIndex(l.id), open = isUnlocked(save, idx), st = save.stars[l.id] ?? 0;
          return (
            <button key={l.id} className={`card-btn ${open ? '' : 'locked'}`} disabled={!open} onClick={() => { sound.tap(); onPick(l); }}
              aria-label={`${l.name}${open ? '' : ' (locked)'}`} data-testid={`level-${idx + 1}`}>
              <Postcard level={l} solved={st > 0} locked={!open} width={w} />
              <span className="card-name">{st > 0 ? l.name : open ? '?' : ''}</span>
              <span className="marks">{[0, 1, 2].map((k) => <I.Seal key={k} size={14} on={k < st} />)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const HOW = { yaw: 'Drag left or right to turn', tilt: 'Drag any way to turn and tip', free: 'Drag to roll it like a ball' };
function Hud({ level, coach, dim, onPause }: { level: Level; coach: boolean; dim: boolean; onPause: () => void }) {
  const [st, setSt] = useState<HudState | null>(null);
  useEffect(() => {
    let sig = '';
    const poll = window.setInterval(() => { const s = theatre.state(); const k = JSON.stringify(s); if (k !== sig) { sig = k; setSt(s); } }, 80);
    return () => clearInterval(poll);
  }, []);
  const n = LEVELS.filter((l) => l.chapter === level.chapter).indexOf(level) + 1;
  const hints = st?.hints ?? 0;
  return (
    <div className={`hud ${dim ? 'dim' : ''}`}>
      <div className="hud-top">
        <button className="icon-btn" aria-label="Pause" onClick={(e) => { e.stopPropagation(); sound.tap(); onPause(); }} data-testid="pause"><I.Pause /></button>
        <div className="hud-title"><span>{CHAPTERS[level.chapter].name} · {n} of 8</span><strong>{level.name}</strong></div>
        <button className={`icon-btn hint ${st?.hinting ? 'on' : ''}`} aria-label={`Show the outline${hints ? ` (${hints} used)` : ''}`} disabled={st?.done} onClick={(e) => { e.stopPropagation(); theatre.hint(); }} data-testid="hint"><I.Lamp />{hints > 0 && <b>{hints}</b>}</button>
      </div>
      <div className="hud-bottom"><I.Turn size={20} mode={level.mode} /><span>{HOW[level.mode]}</span></div>
      {coach && level.hint && <div className="coach" role="note"><I.Lamp size={22} /><p>{level.hint}</p></div>}
    </div>
  );
}

function PauseCard({ level, onResume, onRestart, onGallery, onSettings }: { level: Level; onResume: () => void; onRestart: () => void; onGallery: () => void; onSettings: () => void }) {
  return (
    <div className="veil">
      <div className="card" role="dialog" aria-label="Paused">
        <span className="eyebrow">{level.name}</span>
        <h2>The lamp burns low</h2>
        <button className="warm-btn" onClick={() => { sound.tap(); onResume(); }} data-testid="resume">Back to the screen</button>
        <div className="row">
          <button className="mist-btn" onClick={() => { sound.tap(); onRestart(); }}><I.Restart /> Restart</button>
          <button className="mist-btn" onClick={() => { sound.tap(); onGallery(); }}><I.Screen /> Screens</button>
          <button className="mist-btn round" aria-label="Settings" onClick={() => { sound.tap(); onSettings(); }}><I.Gear /></button>
        </div>
      </div>
    </div>
  );
}

const TITLES = ['Found at last', 'The shadow speaks', 'In a single light'];
function ResultCard({ finish, next, onNext, onRetry, onGallery }: { finish: Finish; next: Level | null; onNext: (l: Level) => void; onRetry: () => void; onGallery: () => void }) {
  const r = finish.result;
  const [lit, setLit] = useState(0);
  useEffect(() => {
    const t = [0, 1, 2].filter((i) => i < r.stars).map((i) => window.setTimeout(() => { setLit(i + 1); sound.star(i); }, 420 + i * 330));
    return () => t.forEach(clearTimeout);
  }, [r.stars]);
  const lv = finish.level;
  return (
    <div className="veil soft">
      <div className="card result win" role="dialog" aria-label={`${lv.name} found`}>
        <span className="eyebrow">{CHAPTERS[lv.chapter].name}</span>
        <h2>{TITLES[r.stars - 1]}</h2>
        <div className="result-card"><Postcard level={lv} solved locked={false} width={128} /></div>
        <div className="big-stars">{[0, 1, 2].map((i) => <span key={i} className={i < lit ? 'on' : ''}><I.Seal size={44} on={i < lit} /></span>)}</div>
        <p className="checks"><span className="on">{lv.name}</span><span className={r.hints === 0 ? 'on' : ''}>{r.hints === 0 ? 'no hints' : `${r.hints} ${r.hints === 1 ? 'hint' : 'hints'}`}</span></p>
        {r.stars < 3 && <p className="note-small">Three seals for finding it without the lamp's outline.</p>}
        {next ? (
          <button className="warm-btn" onClick={() => { sound.tap(); onNext(next); }} data-testid="next">Next screen <I.Next size={18} /></button>
        ) : (
          <button className="warm-btn" onClick={() => { sound.tap(); onRetry(); }} data-testid="retry"><I.Restart size={18} /> Turn it again</button>
        )}
        <div className="row">
          {next && <button className="mist-btn" onClick={() => { sound.tap(); onRetry(); }}><I.Restart /> Again</button>}
          <button className="mist-btn" onClick={() => { sound.tap(); onGallery(); }}><I.Screen /> Screens</button>
        </div>
      </div>
    </div>
  );
}

function Settings({ save, onChange, onReset, onBack }: { save: Save; onChange: (s: Save['settings']) => void; onReset: () => void; onBack: () => void }) {
  const st = save.settings;
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="screen settings">
      <div className="topbar">
        <button className="icon-btn" aria-label="Back" onClick={() => { sound.tap(); onBack(); }}><I.Back /></button>
        <div className="heading"><span className="eyebrow">settings</span><h2>Tearoom</h2></div>
        <span />
      </div>
      <div className="card flat">
        <label className="slider">Music <input type="range" min={0} max={1} step={0.05} value={st.music} onChange={(e) => onChange({ ...st, music: +e.target.value })} /><output>{Math.round(st.music * 100)}</output></label>
        <label className="slider">Sounds <input type="range" min={0} max={1} step={0.05} value={st.sfx} onChange={(e) => onChange({ ...st, sfx: +e.target.value })} /><output>{Math.round(st.sfx * 100)}</output></label>
        <label className="toggle">Vibration <input type="checkbox" checked={st.haptics} onChange={(e) => onChange({ ...st, haptics: e.target.checked })} /><i /></label>
        <label className="toggle">Reduce motion <input type="checkbox" checked={st.reducedMotion} onChange={(e) => onChange({ ...st, reducedMotion: e.target.checked })} /><i /></label>
        <div className="reset">
          {confirm ? (
            <>
              <span>Put out every lamp?</span>
              <button className="mist-btn danger" onClick={() => { onReset(); setConfirm(false); }}>Reset</button>
              <button className="mist-btn" onClick={() => setConfirm(false)}>Keep</button>
            </>
          ) : <button className="mist-btn" onClick={() => setConfirm(true)}>Reset progress</button>}
        </div>
      </div>
      <p className="small-print">Plays fully offline. No ads, accounts or tracking.</p>
    </div>
  );
}
