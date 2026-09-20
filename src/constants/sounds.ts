export type SoundOption = {
  id: string;
  label: string;
  /**
   * Playback source for in-app audio.
   * Bundled assets use `require(...)`; remotes stay as https URLs (meditation / previews).
   */
  url: string | number;
};

/** Canonical Quiett wake tone — same file AlarmKit uses on the lock screen. */
export const QUIETT_HARSH_ALARM = require('../../assets/audio/quiett-harsh.m4a');

export const ALARM_SOUNDS: readonly SoundOption[] = [
  {
    id: 'quiett_harsh',
    label: 'Quiett harsh',
    url: QUIETT_HARSH_ALARM,
  },
  {
    id: 'alarm_clock',
    label: 'Alarm clock',
    url: 'https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg',
  },
  {
    id: 'digital_watch',
    label: 'Digital watch',
    url: 'https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg',
  },
  {
    id: 'bugle',
    label: 'Bugle call',
    url: 'https://actions.google.com/sounds/v1/alarms/bugle_tune.ogg',
  },
] as const;

export const MEDITATION_SOUNDS: readonly SoundOption[] = [
  {
    id: 'calm_waves',
    label: 'Calm waves',
    url: 'https://actions.google.com/sounds/v1/ambiences/calm_waves.ogg',
  },
  {
    id: 'morning_birds',
    label: 'Morning birds',
    url: 'https://actions.google.com/sounds/v1/ambiences/birds_in_forest.ogg',
  },
  {
    id: 'soft_rain',
    label: 'Soft rain',
    url: 'https://actions.google.com/sounds/v1/weather/rain_on_roof.ogg',
  },
] as const;

export const DEFAULT_ALARM_SOUND_ID = 'quiett_harsh';
export const DEFAULT_MEDITATION_SOUND_ID = MEDITATION_SOUNDS[0]!.id;

export function alarmSoundById(id: string): SoundOption {
  return ALARM_SOUNDS.find((s) => s.id === id) ?? ALARM_SOUNDS[0]!;
}

export function meditationSoundById(id: string): SoundOption {
  return MEDITATION_SOUNDS.find((s) => s.id === id) ?? MEDITATION_SOUNDS[0]!;
}
