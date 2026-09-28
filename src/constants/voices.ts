import { MORNING_GUIDE_TRACKS } from '@/constants/guides';

/**
 * Voice guides — the optional voice layer that plays over the backtrack (the selected tone
 * or ambient sound) during the meditation. Behind the "Voice guides (dev)" switch for now.
 *
 * Until the recorded scripts ship, every guide points at one short placeholder clip
 * (rendered with macOS `say`, ~30 s). Swap each entry for its own file when it lands.
 */
export const VOICE_NONE = 'none';

const PLACEHOLDER_VOICE = require('../../assets/audio/voice/placeholder-guide.m4a');

/** Guide script id (guides.ts) → voice clip. */
const VOICE_CLIPS: Record<string, number> = Object.fromEntries(
  MORNING_GUIDE_TRACKS.map((g) => [g.id, PLACEHOLDER_VOICE]),
);

export type VoiceOption = { id: string; title: string; blurb: string };

/** Picker options: "No voice" first, then one per guided script. */
export const VOICE_OPTIONS: readonly VoiceOption[] = [
  { id: VOICE_NONE, title: 'No voice', blurb: 'Just the sound you picked.' },
  ...MORNING_GUIDE_TRACKS.map((g) => ({ id: g.id, title: g.title, blurb: g.blurb })),
];

export function voiceClipFor(id: string | null | undefined): number | null {
  if (!id || id === VOICE_NONE) return null;
  return VOICE_CLIPS[id] ?? null;
}

export function voiceOptionById(id: string): VoiceOption {
  return VOICE_OPTIONS.find((v) => v.id === id) ?? VOICE_OPTIONS[0]!;
}

/** Guided track id (`guided:first-light`) → its voice id, else null. */
export function voiceIdForTrack(trackId: string): string | null {
  if (!trackId.startsWith('guided:')) return null;
  const id = trackId.slice('guided:'.length);
  return VOICE_CLIPS[id] ? id : null;
}
