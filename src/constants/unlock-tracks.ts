import { MORNING_GUIDE_TRACKS } from '@/constants/guides';
import { DEFAULT_MEDITATION_SOUND_ID, MEDITATION_SOUNDS } from '@/constants/sounds';

export type UnlockTrackKind = 'guided' | 'music' | 'ambient';

export type UnlockTrack = {
  id: string;
  kind: UnlockTrackKind;
  title: string;
  durationLabel: string;
  blurb: string;
  /** Premium / coming-soon voice — not progress-gated. */
  locked: boolean;
  /** Playback id from MEDITATION_SOUNDS until voice assets ship. */
  playbackSoundId: string;
  accent: string;
  accentSoft: string;
  mood: string;
};

const GUIDE_PLAYBACK: Record<string, string> = {
  'first-light': 'calm_waves',
  'open-eyes': 'morning_birds',
  'still-horizon': 'calm_waves',
  'warm-window': 'soft_rain',
  'quiet-rise': 'calm_waves',
  'clear-morning': 'morning_birds',
};

const GUIDED_TRACKS: UnlockTrack[] = MORNING_GUIDE_TRACKS.map((g) => ({
  id: `guided:${g.id}`,
  kind: 'guided' as const,
  title: g.title,
  durationLabel: g.durationLabel,
  blurb: g.blurb,
  locked: g.locked,
  playbackSoundId: GUIDE_PLAYBACK[g.id] ?? DEFAULT_MEDITATION_SOUND_ID,
  accent: g.accent,
  accentSoft: g.accentSoft,
  mood: g.mood,
}));

/** Healing tones — calm music, no guide voice. */
const MUSIC_TRACKS: UnlockTrack[] = [
  {
    id: 'music:soft-pad',
    kind: 'music',
    title: 'Soft Pad',
    durationLabel: 'Loop',
    blurb: 'Quiet tones while you stay still — no voice.',
    locked: false,
    playbackSoundId: 'calm_waves',
    accent: '#5B8CFF',
    accentSoft: 'rgba(91,140,255,0.18)',
    mood: 'Tone',
  },
  {
    id: 'music:dawn-keys',
    kind: 'music',
    title: 'Dawn Keys',
    durationLabel: 'Loop',
    blurb: 'Light, spacious wash for a gentle start.',
    locked: false,
    playbackSoundId: 'morning_birds',
    accent: '#9B8CFF',
    accentSoft: 'rgba(155,140,255,0.18)',
    mood: 'Tone',
  },
  {
    id: 'music:warm-drone',
    kind: 'music',
    title: 'Warm Drone',
    durationLabel: 'Loop',
    blurb: 'Low, steady hum — healing tone without words.',
    locked: false,
    playbackSoundId: 'soft_rain',
    accent: '#F0B429',
    accentSoft: 'rgba(240,180,41,0.16)',
    mood: 'Tone',
  },
  {
    id: 'music:clear-bell',
    kind: 'music',
    title: 'Clear Bell',
    durationLabel: 'Loop',
    blurb: 'Soft resonance to settle into the morning.',
    locked: false,
    playbackSoundId: 'calm_waves',
    accent: '#3DCFB0',
    accentSoft: 'rgba(61,207,176,0.16)',
    mood: 'Tone',
  },
];

const AMBIENT_META: Record<
  string,
  { title: string; blurb: string; accent: string; accentSoft: string; mood: string }
> = {
  calm_waves: {
    title: 'Ocean',
    blurb: 'Soft waves in the background.',
    accent: '#A8C5D4',
    accentSoft: 'rgba(168,197,212,0.20)',
    mood: 'Ambient',
  },
  morning_birds: {
    title: 'Forest birds',
    blurb: 'Gentle birds while you hold still.',
    accent: '#3DCFB0',
    accentSoft: 'rgba(61,207,176,0.18)',
    mood: 'Ambient',
  },
  soft_rain: {
    title: 'Rain',
    blurb: 'Rain on a roof — calm noise, no guide.',
    accent: '#5B8CFF',
    accentSoft: 'rgba(91,140,255,0.16)',
    mood: 'Ambient',
  },
};

const AMBIENT_TRACKS: UnlockTrack[] = MEDITATION_SOUNDS.map((s) => {
  const meta = AMBIENT_META[s.id] ?? {
    title: s.label,
    blurb: 'Ambient sound for the morning session.',
    accent: '#A8C5D4',
    accentSoft: 'rgba(168,197,212,0.18)',
    mood: 'Ambient',
  };
  return {
    id: `ambient:${s.id}`,
    kind: 'ambient' as const,
    title: meta.title,
    durationLabel: 'Loop',
    blurb: meta.blurb,
    locked: false,
    playbackSoundId: s.id,
    accent: meta.accent,
    accentSoft: meta.accentSoft,
    mood: meta.mood,
  };
});

export const UNLOCK_TRACKS: readonly UnlockTrack[] = [
  ...GUIDED_TRACKS,
  ...MUSIC_TRACKS,
  ...AMBIENT_TRACKS,
];

export const DEFAULT_UNLOCK_TRACK_ID = GUIDED_TRACKS[0]!.id;

export function unlockTrackById(id: string): UnlockTrack {
  return UNLOCK_TRACKS.find((t) => t.id === id) ?? UNLOCK_TRACKS[0]!;
}

export function unlockTracksByKind(kind: UnlockTrackKind): UnlockTrack[] {
  return UNLOCK_TRACKS.filter((t) => t.kind === kind);
}

export function kindLabel(kind: UnlockTrackKind): string {
  switch (kind) {
    case 'guided':
      return 'Guided';
    case 'music':
      return 'Healing tones';
    case 'ambient':
      return 'Ambient';
  }
}

export function kindSectionHint(kind: UnlockTrackKind): string {
  switch (kind) {
    case 'guided':
      return 'Short morning meditations. Premium voice tracks are available to browse when they ship — nothing is gated by finishing others.';
    case 'music':
      return 'Healing tones and calm music — no guide voice.';
    case 'ambient':
      return 'Rain, ocean, birds — simple background sound.';
  }
}

export function freeUnlockTracks(): UnlockTrack[] {
  return UNLOCK_TRACKS.filter((t) => !t.locked);
}

/** Random free track for Surprise me — prefers a different id when possible. */
export function pickSurpriseTrack(excludeId?: string): UnlockTrack {
  const free = freeUnlockTracks();
  const pool = excludeId ? free.filter((t) => t.id !== excludeId) : free;
  const list = pool.length > 0 ? pool : free;
  const pick = list[Math.floor(Math.random() * list.length)] ?? UNLOCK_TRACKS[0]!;
  return pick;
}
