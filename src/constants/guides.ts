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
    // id kept from the original 'Open Eyes' so saved selections stay valid.
    id: 'open-eyes',
    title: 'Still Lake',
    durationLabel: '2 min',
    locked: false,
    mood: 'Still',
    blurb: 'Let the mind settle, smooth as still water.',
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
    // id kept from the original 'Quiet Rise' so saved selections stay valid.
    id: 'quiet-rise',
    title: 'Drifting Up',
    durationLabel: '2 min',
    locked: true,
    mood: 'Light',
    blurb: 'Rise slowly and let the heaviness fall away.',
    accent: '#9B8CFF',
    accentSoft: 'rgba(155,140,255,0.18)',
  },
  {
    // id kept from the original 'Clear Morning' so saved selections stay valid.
    id: 'clear-morning',
    title: 'Mountain Bloom',
    durationLabel: '2 min',
    locked: true,
    mood: 'Grounded',
    blurb: 'Steady as the peaks, soft as the flowers.',
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
