export type GuideTrack = {
  id: string;
  title: string;
  durationLabel: string;
  /** Free now vs premium voice (coming soon) — not progress-gated. */
  locked: boolean;
  blurb: string;
  /** Short mood tag shown on the card. */
  mood: string;
  /** Accent wash behind the card art tile. */
  accent: string;
  accentSoft: string;
};

/** Morning wake-up meditation shelf — placeholder for future guided VO. */
export const MORNING_GUIDE_TRACKS: readonly GuideTrack[] = [
  {
    id: 'first-light',
    title: 'First Light',
    durationLabel: '2 min',
    locked: false,
    mood: 'Gentle',
    blurb: 'Soft breath to meet the morning without rush.',
    accent: '#3DCFB0',
    accentSoft: 'rgba(61,207,176,0.18)',
  },
  {
    id: 'open-eyes',
    title: 'Open Eyes',
    durationLabel: '2 min',
    locked: false,
    mood: 'Clear',
    blurb: 'A gentle arrival — body awake, mind clear.',
    accent: '#A8C5D4',
    accentSoft: 'rgba(168,197,212,0.20)',
  },
  {
    id: 'still-horizon',
    title: 'Still Horizon',
    durationLabel: '2 min',
    locked: true,
    mood: 'Steady',
    blurb: 'Steady voice guiding a calm start.',
    accent: '#5B8CFF',
    accentSoft: 'rgba(91,140,255,0.18)',
  },
  {
    id: 'warm-window',
    title: 'Warm Window',
    durationLabel: '2 min',
    locked: true,
    mood: 'Soft',
    blurb: 'Light tone for mornings that feel heavy.',
    accent: '#F0B429',
    accentSoft: 'rgba(240,180,41,0.16)',
  },
  {
    id: 'quiet-rise',
    title: 'Quiet Rise',
    durationLabel: '2 min',
    locked: true,
    mood: 'Slow',
    blurb: 'Unhurried breath before the day opens.',
    accent: '#9B8CFF',
    accentSoft: 'rgba(155,140,255,0.18)',
  },
  {
    id: 'clear-morning',
    title: 'Clear Morning',
    durationLabel: '2 min',
    locked: true,
    mood: 'Focus',
    blurb: 'Short guided focus as the day begins.',
    accent: '#3DCFB0',
    accentSoft: 'rgba(61,207,176,0.14)',
  },
] as const;

/** Featured free morning guide on Library. */
export const MORNING_PICK_GUIDE = MORNING_GUIDE_TRACKS[0];
/** @deprecated use MORNING_PICK_GUIDE */
export const TONIGHTS_GUIDE_PREVIEW = MORNING_PICK_GUIDE;

export const FREE_GUIDE_TRACKS = MORNING_GUIDE_TRACKS.filter((t) => !t.locked);
export const VOICE_GUIDE_TRACKS = MORNING_GUIDE_TRACKS.filter((t) => t.locked);
