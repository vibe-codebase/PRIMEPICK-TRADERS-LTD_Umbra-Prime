type P = { size?: number };
const s = (size = 22) => ({ width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const });

export const Pause = ({ size }: P) => <svg {...s(size)} aria-hidden><path d="M9 6.5v11M15 6.5v11" /></svg>;
export const Back = ({ size }: P) => <svg {...s(size)} aria-hidden><path d="M14.5 5.5 8 12l6.5 6.5" /></svg>;
export const Next = ({ size }: P) => <svg {...s(size)} aria-hidden><path d="M9.5 5.5 16 12l-6.5 6.5" /></svg>;
export const Restart = ({ size }: P) => <svg {...s(size)} aria-hidden><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" /><path d="M4 4.5v3.5h3.5" /></svg>;
export const Gear = ({ size }: P) => (
  <svg {...s(size)} aria-hidden><circle cx="12" cy="12" r="3" /><path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2 5.5 5.5" /></svg>
);
/** A paper lantern, for hints. */
export const Lamp = ({ size }: P) => <svg {...s(size)} aria-hidden><path d="M9 4h6M9 20h6M12 2v2" /><path d="M8.5 4.5C5.5 7 5.5 17 8.5 19.5h7c3-2.5 3-12.5 0-15z" fill="currentColor" fillOpacity=".18" /><path d="M7 9.5h10M6.6 14.5h10.8" strokeWidth="1.1" /></svg>;
/** A shoji screen, for the gallery of sculptures. */
export const Screen = ({ size }: P) => <svg {...s(size)} aria-hidden><rect x="4" y="3" width="16" height="18" rx="1" /><path d="M12 3v18M4 9h16M4 15h16" strokeWidth="1.2" /></svg>;
/** The turning allowed: side to side, side to side and up and down, or every way. */
export const Turn = ({ size, mode }: P & { mode: 'yaw' | 'tilt' | 'free' }) => (
  <svg {...s(size)} aria-hidden>
    <ellipse cx="12" cy="12" rx="8.5" ry="3.4" strokeWidth="1.3" />
    {mode !== 'yaw' && <ellipse cx="12" cy="12" rx="3.4" ry="8.5" strokeWidth="1.3" />}
    {mode === 'free' && <circle cx="12" cy="12" r="8.5" strokeWidth="1.3" />}
    <path d="M18.5 9.2l2 .3-.6 2" strokeWidth="1.4" />
  </svg>
);
/** Stars are seals. */
export const Seal = ({ size = 22, on }: P & { on?: boolean }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <rect x="4" y="4" width="16" height="16" rx="2" fill={on ? '#b8322a' : 'none'} stroke={on ? 'none' : 'rgba(240,226,200,.45)'} strokeWidth="1.4" />
    <rect x="7" y="7" width="10" height="10" rx="1" fill="none" stroke={on ? 'rgba(255,240,220,.85)' : 'rgba(240,226,200,.25)'} strokeWidth="1.1" />
    <path d="M10 10.5h4M12 10.5v4M10 14.5h4" stroke={on ? 'rgba(255,240,220,.85)' : 'rgba(240,226,200,.25)'} strokeWidth="1.1" strokeLinecap="round" />
  </svg>
);
