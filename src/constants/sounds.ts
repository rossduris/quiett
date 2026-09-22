export type SoundOption = {
  id: string;
  label: string;
  /**
   * Playback source for in-app audio / preview.
   * Bundled assets use `require(...)`; remotes stay as https URLs.
   * System default uses null (no in-app file).
   */
  url: string | number | null;
  /** AlarmKit / Android soundName when bundling a file in the app. */
  soundName?: string;
  /** Picker section. */
  section: 'intense' | 'laid_back' | 'system';
};

/** Canonical Quiett wake tone — same file AlarmKit uses on the lock screen. */
export const QUIETT_HARSH_ALARM = require('../../assets/audio/quiett-harsh.m4a');
/** Denser/hotter render for in-app /session (media stream is quieter than AlarmKit file). */
export const QUIETT_HARSH_SESSION = require('../../assets/audio/quiett-harsh-session.m4a');

const ALARM_ASSET = {
  'rise-and-shine': require('../../assets/audio/alarms/rise-and-shine.caf'),
  'early-bright': require('../../assets/audio/alarms/early-bright.caf'),
  'fresh-morning': require('../../assets/audio/alarms/fresh-morning.caf'),
  'new-day': require('../../assets/audio/alarms/new-day.caf'),
  sunbeam: require('../../assets/audio/alarms/sunbeam.caf'),
  dayspring: require('../../assets/audio/alarms/dayspring.caf'),
  peaceful: require('../../assets/audio/alarms/peaceful.caf'),
  'slow-wind': require('../../assets/audio/alarms/slow-wind.caf'),
  'dawn-rain': require('../../assets/audio/alarms/dawn-rain.caf'),
  'coastal-breeze': require('../../assets/audio/alarms/coastal-breeze.caf'),
  'hazy-day': require('../../assets/audio/alarms/hazy-day.caf'),
  'new-breath': require('../../assets/audio/alarms/new-breath.caf'),
} as const;

export const ALARM_SOUNDS: readonly SoundOption[] = [
  {
    id: 'quiett_harsh',
    label: 'Quiett harsh',
    url: QUIETT_HARSH_ALARM,
    soundName: 'quiett-harsh.caf',
    section: 'intense',
  },
  {
    id: 'rise_and_shine',
    label: 'Rise and Shine',
    url: ALARM_ASSET['rise-and-shine'],
    soundName: 'rise-and-shine.caf',
    section: 'intense',
  },
  {
    id: 'early_bright',
    label: 'Early Bright',
    url: ALARM_ASSET['early-bright'],
    soundName: 'early-bright.caf',
    section: 'intense',
  },
  {
    id: 'fresh_morning',
    label: 'Fresh Morning',
    url: ALARM_ASSET['fresh-morning'],
    soundName: 'fresh-morning.caf',
    section: 'intense',
  },
  {
    id: 'new_day',
    label: 'New Day',
    url: ALARM_ASSET['new-day'],
    soundName: 'new-day.caf',
    section: 'intense',
  },
  {
    id: 'sunbeam',
    label: 'Sunbeam',
    url: ALARM_ASSET.sunbeam,
    soundName: 'sunbeam.caf',
    section: 'intense',
  },
  {
    id: 'dayspring',
    label: 'Dayspring',
    url: ALARM_ASSET.dayspring,
    soundName: 'dayspring.caf',
    section: 'intense',
  },
  {
    id: 'peaceful',
    label: 'Peaceful',
    url: ALARM_ASSET.peaceful,
    soundName: 'peaceful.caf',
    section: 'laid_back',
  },
  {
    id: 'slow_wind',
    label: 'Slow Wind',
    url: ALARM_ASSET['slow-wind'],
    soundName: 'slow-wind.caf',
    section: 'laid_back',
  },
  {
    id: 'dawn_rain',
    label: 'Dawn Rain',
    url: ALARM_ASSET['dawn-rain'],
    soundName: 'dawn-rain.caf',
    section: 'laid_back',
  },
  {
    id: 'coastal_breeze',
    label: 'Coastal Breeze',
    url: ALARM_ASSET['coastal-breeze'],
    soundName: 'coastal-breeze.caf',
    section: 'laid_back',
  },
  {
    id: 'hazy_day',
    label: 'Hazy Day',
    url: ALARM_ASSET['hazy-day'],
    soundName: 'hazy-day.caf',
    section: 'laid_back',
  },
  {
    id: 'new_breath',
    label: 'New Breath',
    url: ALARM_ASSET['new-breath'],
    soundName: 'new-breath.caf',
    section: 'laid_back',
  },
  {
    id: 'system_default',
    label: 'System default',
    url: null,
    section: 'system',
  },
] as const;

export const ALARM_SOUND_SECTIONS: {
  id: SoundOption['section'];
  label: string;
  hint: string;
}[] = [
  {
    id: 'intense',
    label: 'Intense',
    hint: 'Sharper wake tones that cut through sleep.',
  },
  {
    id: 'laid_back',
    label: 'Laid-back',
    hint: 'Softer morning tones — still an alarm, gentler edge.',
  },
  {
    id: 'system',
    label: 'System',
    hint: 'Uses the iOS AlarmKit default alert sound.',
  },
];

export const MEDITATION_SOUNDS: readonly SoundOption[] = [
  {
    id: 'calm_waves',
    label: 'Calm waves',
    url: 'https://actions.google.com/sounds/v1/ambiences/calm_waves.ogg',
    section: 'laid_back',
  },
  {
    id: 'morning_birds',
    label: 'Morning birds',
    url: 'https://actions.google.com/sounds/v1/ambiences/birds_in_forest.ogg',
    section: 'laid_back',
  },
  {
    id: 'soft_rain',
    label: 'Soft rain',
    url: 'https://actions.google.com/sounds/v1/weather/rain_on_roof.ogg',
    section: 'laid_back',
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

export function alarmSoundsBySection(section: SoundOption['section']): SoundOption[] {
  return ALARM_SOUNDS.filter((s) => s.section === section);
}
