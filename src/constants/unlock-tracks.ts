import { MORNING_GUIDE_TRACKS } from '@/constants/guides';
import { libraryArtFor } from '@/constants/library-art';
import { DEFAULT_MEDITATION_SOUND_ID, MEDITATION_SOUNDS } from '@/constants/sounds';

export type UnlockTrackKind = 'guided' | 'music' | 'ambient';

export type UnlockTrack = {
  id: string;
  kind: UnlockTrackKind;
  title: string;
  durationLabel: string;
  blurb: string;
  /** Opens with Quiett Premium (never progress-gated). */
  locked: boolean;
  /** Playback id from MEDITATION_SOUNDS / MUSIC_SOUNDS (see sounds.ts). */
  playbackSoundId: string;
  accent: string;
  accentSoft: string;
  mood: string;
  /** Monotone cover art (bundled image). */
  art?: number;
};

/** Backtrack under each guide's voice (voice layer: see voices.ts / audio.ts). */
const GUIDE_PLAYBACK: Record<string, string> = {
  'first-light': 'tone_432_pad',
  'open-eyes': 'tone_432_drone',
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
  // Guided voices are free — Premium gates the sound library, not the guides.
  locked: false,
  playbackSoundId: GUIDE_PLAYBACK[g.id] ?? DEFAULT_MEDITATION_SOUND_ID,
  accent: g.accent,
  accentSoft: g.accentSoft,
  mood: g.mood,
}));

/**
 * Tones & music — solfeggio / tone beds, no guide voice. Ids are kept from the original
 * placeholders (e.g. `music:dawn-keys`) so saved selections stay valid.
 * Free: Soft Pad, Warm Drone, Dawn Wash (+ music beds Low Cloud, Quiet Hours). The rest open with Premium.
 */
const MUSIC_TRACKS: UnlockTrack[] = [
  {
    id: 'music:soft-pad',
    kind: 'music',
    title: 'Soft Pad',
    durationLabel: 'Loop',
    blurb: 'Quiet 432 Hz pads, soft as morning cloud — no voice.',
    locked: false,
    playbackSoundId: 'tone_432_pad',
    accent: '#5B8CFF',
    accentSoft: 'rgba(91,140,255,0.18)',
    mood: 'Tone',
  },
  {
    id: 'music:warm-drone',
    kind: 'music',
    title: 'Warm Drone',
    durationLabel: 'Loop',
    blurb: 'A low, steady 432 Hz hum that barely moves.',
    locked: false,
    playbackSoundId: 'tone_432_drone',
    accent: '#F0B429',
    accentSoft: 'rgba(240,180,41,0.16)',
    mood: 'Tone',
  },
  {
    id: 'music:dawn-keys',
    kind: 'music',
    title: 'Dawn Wash',
    durationLabel: 'Loop',
    blurb: 'A light, spacious 639 Hz wash for a gentle start.',
    locked: false,
    playbackSoundId: 'tone_639_wash',
    accent: '#9B8CFF',
    accentSoft: 'rgba(155,140,255,0.18)',
    mood: 'Tone',
  },
  {
    id: 'music:deep-roots',
    kind: 'music',
    title: 'Deep Roots',
    durationLabel: 'Loop',
    blurb: 'The lowest tone on the shelf — a deep, grounded 174 Hz bed.',
    locked: true,
    playbackSoundId: 'tone_174_roots',
    accent: '#B07D56',
    accentSoft: 'rgba(176,125,86,0.18)',
    mood: 'Tone',
  },
  {
    id: 'music:valley-mist',
    kind: 'music',
    title: 'Valley Mist',
    durationLabel: 'Loop',
    blurb: 'A soft 285 Hz haze, even and unhurried.',
    locked: true,
    playbackSoundId: 'tone_285_mist',
    accent: '#8FB3C9',
    accentSoft: 'rgba(143,179,201,0.18)',
    mood: 'Tone',
  },
  {
    id: 'music:lantern-glow',
    kind: 'music',
    title: 'Lantern Glow',
    durationLabel: 'Loop',
    blurb: 'Warm 417 Hz tones that drift like lanterns on still water.',
    locked: true,
    playbackSoundId: 'tone_417_lantern',
    accent: '#F29E4C',
    accentSoft: 'rgba(242,158,76,0.18)',
    mood: 'Tone',
  },
  {
    id: 'music:clear-bell',
    kind: 'music',
    title: 'Clear Bell',
    durationLabel: 'Loop',
    blurb: 'A bright 852 Hz shimmer, like a bowl still ringing.',
    locked: true,
    playbackSoundId: 'tone_852_bell',
    accent: '#3DCFB0',
    accentSoft: 'rgba(61,207,176,0.16)',
    mood: 'Tone',
  },
  {
    id: 'music:moonset',
    kind: 'music',
    title: 'Moonset',
    durationLabel: 'Loop',
    blurb: 'The highest tone here — a still 963 Hz glow as the night lets go.',
    locked: true,
    playbackSoundId: 'tone_963_moon',
    accent: '#C9B7E0',
    accentSoft: 'rgba(201,183,224,0.18)',
    mood: 'Tone',
  },
  {
    id: 'music:heartwood',
    kind: 'music',
    title: 'Heartwood',
    durationLabel: 'Loop',
    blurb: 'Slow, warm swells that rise and settle, ring by ring.',
    locked: true,
    playbackSoundId: 'tone_heartwood',
    accent: '#C98B6B',
    accentSoft: 'rgba(201,139,107,0.18)',
    mood: 'Tone',
  },
  // Calm music beds — steady, no vocals. Free: Low Cloud, Quiet Hours.
  {
    id: 'music:low-cloud',
    kind: 'music',
    title: 'Low Cloud',
    durationLabel: 'Loop',
    blurb: 'A deep, unbroken pad, like a soft overcast morning.',
    locked: false,
    playbackSoundId: 'music_low_cloud',
    accent: '#8FA3B8',
    accentSoft: 'rgba(143,163,184,0.18)',
    mood: 'Music',
  },
  {
    id: 'music:quiet-hours',
    kind: 'music',
    title: 'Quiet Hours',
    durationLabel: 'Loop',
    blurb: 'A calm, level bed for mornings that start slowly.',
    locked: false,
    playbackSoundId: 'music_quiet_hours',
    accent: '#E8A06A',
    accentSoft: 'rgba(232,160,106,0.18)',
    mood: 'Music',
  },
  {
    id: 'music:golden-hour',
    kind: 'music',
    title: 'Golden Hour',
    durationLabel: 'Loop',
    blurb: 'Warm, round tones that stay steady from start to end.',
    locked: true,
    playbackSoundId: 'music_golden_hour',
    accent: '#F0B429',
    accentSoft: 'rgba(240,180,41,0.16)',
    mood: 'Music',
  },
  {
    id: 'music:velvet-night',
    kind: 'music',
    title: 'Velvet Night',
    durationLabel: 'Loop',
    blurb: 'Low, soft chords that move slowly under a thin moon.',
    locked: true,
    playbackSoundId: 'music_velvet_night',
    accent: '#8C7BD8',
    accentSoft: 'rgba(140,123,216,0.18)',
    mood: 'Music',
  },
  {
    id: 'music:starlit',
    kind: 'music',
    title: 'Starlit',
    durationLabel: 'Loop',
    blurb: 'Gentle pads under a scatter of quiet high notes.',
    locked: true,
    playbackSoundId: 'music_starlit',
    accent: '#7FA7E8',
    accentSoft: 'rgba(127,167,232,0.18)',
    mood: 'Music',
  },
  {
    id: 'music:drift',
    kind: 'music',
    title: 'Drift',
    durationLabel: 'Loop',
    blurb: 'Slow ambient layers that barely change, on purpose.',
    locked: true,
    playbackSoundId: 'music_drift',
    accent: '#7FB8C4',
    accentSoft: 'rgba(127,184,196,0.18)',
    mood: 'Music',
  },
];

/** Ambient sounds that open with Premium (Shoreline, Forest birds, Rain and Night crickets stay free). */
const PREMIUM_AMBIENT = new Set([
  'wind_in_trees',
  'morning_pond',
  'campfire',
  'snow_morning',
  'night_stream',
  'distant_thunder',
  'after_the_rain',
  'hearth',
  'rain_on_eaves',
]);

const AMBIENT_META: Record<
  string,
  { title: string; blurb: string; accent: string; accentSoft: string; mood: string }
> = {
  calm_waves: {
    title: 'Shoreline',
    blurb: 'Gentle waves on the shore — calm noise, no guide.',
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
    blurb: 'Soft, steady rain — calm noise, no guide.',
    accent: '#5B8CFF',
    accentSoft: 'rgba(91,140,255,0.16)',
    mood: 'Ambient',
  },
  wind_in_trees: {
    title: 'Wind in the trees',
    blurb: 'A soft breeze moving through leaves.',
    accent: '#8FB996',
    accentSoft: 'rgba(143,185,150,0.18)',
    mood: 'Ambient',
  },
  morning_pond: {
    title: 'Morning pond',
    blurb: 'Still water, distant frogs and a few birds.',
    accent: '#7FB8C4',
    accentSoft: 'rgba(127,184,196,0.18)',
    mood: 'Ambient',
  },
  campfire: {
    title: 'Campfire',
    blurb: 'A small fire crackling — warm and steady.',
    accent: '#F0B429',
    accentSoft: 'rgba(240,180,41,0.16)',
    mood: 'Ambient',
  },
  night_crickets: {
    title: 'Night crickets',
    blurb: 'A warm summer night full of steady crickets.',
    accent: '#8FB996',
    accentSoft: 'rgba(143,185,150,0.18)',
    mood: 'Ambient',
  },
  snow_morning: {
    title: 'Snow morning',
    blurb: 'Soft snowfall with small birds calling nearby.',
    accent: '#A8C5D4',
    accentSoft: 'rgba(168,197,212,0.20)',
    mood: 'Ambient',
  },
  night_stream: {
    title: 'Night stream',
    blurb: 'A small stream running over stones in the dark.',
    accent: '#5B8CFF',
    accentSoft: 'rgba(91,140,255,0.16)',
    mood: 'Ambient',
  },
  distant_thunder: {
    title: 'Distant thunder',
    blurb: 'Steady rain with thunder rolling far away.',
    accent: '#9B8CFF',
    accentSoft: 'rgba(155,140,255,0.18)',
    mood: 'Ambient',
  },
  after_the_rain: {
    title: 'After the rain',
    blurb: 'Leaves dripping as the forest wakes after a shower.',
    accent: '#3DCFB0',
    accentSoft: 'rgba(61,207,176,0.16)',
    mood: 'Ambient',
  },
  hearth: {
    title: 'Hearth',
    blurb: 'A small fire crackling and hissing close by, indoors.',
    accent: '#F29E4C',
    accentSoft: 'rgba(242,158,76,0.18)',
    mood: 'Ambient',
  },
  rain_on_eaves: {
    title: 'Rain on the eaves',
    blurb: 'Rain running off the roof and into the gutter.',
    accent: '#7FA7C4',
    accentSoft: 'rgba(127,167,196,0.18)',
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
    locked: PREMIUM_AMBIENT.has(s.id),
    playbackSoundId: s.id,
    accent: meta.accent,
    accentSoft: meta.accentSoft,
    mood: meta.mood,
  };
});

const _UNLOCK_TRACKS_RAW: UnlockTrack[] = [
  ...GUIDED_TRACKS,
  ...MUSIC_TRACKS,
  ...AMBIENT_TRACKS,
];

export const UNLOCK_TRACKS: readonly UnlockTrack[] = _UNLOCK_TRACKS_RAW.map((t) => ({
  ...t,
  art: libraryArtFor(t.id) ?? t.art,
}));

/** Free default for new installs (and the fallback when Premium lapses). */
export const DEFAULT_UNLOCK_TRACK_ID = 'music:soft-pad';

export function unlockTrackById(id: string): UnlockTrack {
  return UNLOCK_TRACKS.find((t) => t.id === id) ?? UNLOCK_TRACKS[0]!;
}

export function unlockTracksByKind(kind: UnlockTrackKind): UnlockTrack[] {
  return UNLOCK_TRACKS.filter((t) => t.kind === kind);
}

/** Shelf order; the Guided shelf only when it is switched on (hidden for launch). */
export function visibleKinds(includeGuided: boolean): UnlockTrackKind[] {
  return includeGuided ? ['guided', 'music', 'ambient'] : ['music', 'ambient'];
}

/**
 * While the Guided shelf is hidden, a saved guided pick maps to the plain track that plays
 * the same backtrack (First Light → Soft Pad, Still Lake → Warm Drone, …), else the default.
 */
export function launchTrackId(id: string, includeGuided: boolean): string {
  const track = unlockTrackById(id);
  if (track.kind !== 'guided' || includeGuided) return track.id;
  const twin = UNLOCK_TRACKS.find((t) => t.kind !== 'guided' && t.playbackSoundId === track.playbackSoundId);
  return twin?.id ?? DEFAULT_UNLOCK_TRACK_ID;
}

export function kindLabel(kind: UnlockTrackKind): string {
  switch (kind) {
    case 'guided':
      return 'Guided';
    case 'music':
      return 'Tones & music';
    case 'ambient':
      return 'Ambient';
  }
}

export function kindSectionHint(kind: UnlockTrackKind): string {
  switch (kind) {
    case 'guided':
      return 'Short morning meditations with a voice guide.';
    case 'music':
      return 'Solfeggio tones and calm music beds — steady, no vocals, no guide voice.';
    case 'ambient':
      return 'Rain, streams, ocean, birds, crickets, snow, fire — simple background sound.';
  }
}

export function freeUnlockTracks(): UnlockTrack[] {
  return UNLOCK_TRACKS.filter((t) => !t.locked);
}

/** Premium-only tracks on the visible shelves (paywall copy). */
export function premiumUnlockTracks(includeGuided = false): UnlockTrack[] {
  return UNLOCK_TRACKS.filter((t) => t.locked && (includeGuided || t.kind !== 'guided'));
}

/**
 * Tracks the user can pick right now: every track with Premium, free tracks otherwise.
 * Guided tracks only join when the Guided shelf is visible.
 */
export function availableUnlockTracks(includePremium = false, includeGuided = false): UnlockTrack[] {
  const pool = includePremium ? [...UNLOCK_TRACKS] : freeUnlockTracks();
  return includeGuided ? pool : pool.filter((t) => t.kind !== 'guided');
}

/**
 * Random track for Surprise me — prefers a different id when possible. Premium tracks join
 * the rotation only when `includePremium` is true (Premium active).
 */
export function pickSurpriseTrack(
  excludeId?: string,
  includePremium = false,
  includeGuided = false,
): UnlockTrack {
  const free = availableUnlockTracks(includePremium, includeGuided);
  const pool = excludeId ? free.filter((t) => t.id !== excludeId) : free;
  const list = pool.length > 0 ? pool : free;
  const pick = list[Math.floor(Math.random() * list.length)] ?? UNLOCK_TRACKS[0]!;
  return pick;
}
