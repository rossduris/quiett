export type SoundOption = {
  id: string;
  label: string;
  /**
   * Playback source for in-app audio / preview.
   * Bundled assets use `require(...)`; remotes stay as https URLs.
   * System default uses null (no in-app file).
   */
  url: string | number | null;
  /**
   * In-app camera-view ring when it differs from `url` (System default: lock screen uses the
   * iOS sound, the app rings the bundled Classic tone since it can't play the system one).
   */
  inAppUrl?: number;
  /** AlarmKit / Android soundName when bundling a file in the app. */
  soundName?: string;
  /** Picker section. */
  section: 'intense' | 'laid_back' | 'system';
};

/** Canonical Quiett wake tone — same file AlarmKit uses on the lock screen. */
export const QUIETT_HARSH_ALARM = require('../../assets/audio/quiett-harsh.m4a');
/** Denser/hotter render for in-app /session (media stream is quieter than AlarmKit file). */
export const QUIETT_HARSH_SESSION = require('../../assets/audio/quiett-harsh-session.m4a');
/**
 * Classic phone-style ring (original synthesized two-tone ring, 27 s, loops cleanly) for the
 * in-app ring when the user picked System default. Not registered with AlarmKit.
 */
export const QUIETT_CLASSIC_RING = require('../../assets/audio/classic-ring.caf');

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
    inAppUrl: QUIETT_CLASSIC_RING,
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
    hint: 'Lock screen uses the iOS default alert. In the app, a classic phone-style ring plays.',
  },
];

export const MEDITATION_SOUNDS: readonly SoundOption[] = [
  {
    id: 'calm_waves',
    label: 'Shoreline',
    url: require('../../assets/audio/ambient/calm-waves.m4a'),
    section: 'laid_back',
  },
  {
    id: 'morning_birds',
    label: 'Morning birds',
    url: require('../../assets/audio/ambient/morning-birds.m4a'),
    section: 'laid_back',
  },
  {
    id: 'soft_rain',
    label: 'Soft rain',
    url: require('../../assets/audio/ambient/soft-rain.m4a'),
    section: 'laid_back',
  },
  {
    id: 'wind_in_trees',
    label: 'Wind in the trees',
    url: require('../../assets/audio/ambient/wind-in-trees.m4a'),
    section: 'laid_back',
  },
  {
    id: 'morning_pond',
    label: 'Morning pond',
    url: require('../../assets/audio/ambient/morning-pond.m4a'),
    section: 'laid_back',
  },
  {
    id: 'campfire',
    label: 'Campfire',
    url: require('../../assets/audio/ambient/campfire.m4a'),
    section: 'laid_back',
  },
  {
    id: 'night_crickets',
    label: 'Night crickets',
    url: require('../../assets/audio/ambient/night-crickets.m4a'),
    section: 'laid_back',
  },
  {
    id: 'snow_morning',
    label: 'Snow morning',
    url: require('../../assets/audio/ambient/snow-morning.m4a'),
    section: 'laid_back',
  },
  {
    id: 'night_stream',
    label: 'Night stream',
    url: require('../../assets/audio/ambient/night-stream.m4a'),
    section: 'laid_back',
  },
  {
    id: 'distant_thunder',
    label: 'Distant thunder',
    url: require('../../assets/audio/ambient/distant-thunder.m4a'),
    section: 'laid_back',
  },
  {
    id: 'after_the_rain',
    label: 'After the rain',
    url: require('../../assets/audio/ambient/after-the-rain.m4a'),
    section: 'laid_back',
  },
  {
    id: 'hearth',
    label: 'Hearth',
    url: require('../../assets/audio/ambient/hearth.m4a'),
    section: 'laid_back',
  },
  {
    id: 'rain_on_eaves',
    label: 'Rain on the eaves',
    url: require('../../assets/audio/ambient/rain-on-eaves.m4a'),
    section: 'laid_back',
  },
] as const;

/**
 * Healing-tone / solfeggio beds and calm music beds: 5-min seamless loops (cut from the middle of the source,
 * tail crossfaded into the head over 9 s, no file-level fades, -21 LUFS, 96 kbps AAC) that loop
 * in session; audio.ts fades the first play in. Playback-only:
 * healing-tone (and guided) tracks point at these via `playbackSoundId`; they are not
 * listed as Ambient tracks. Sessions start them at a random point (see audio.ts).
 */
export const MUSIC_SOUNDS: readonly SoundOption[] = [
  {
    id: 'tone_432_pad',
    label: '432 Hz soft pad',
    url: require('../../assets/audio/music/432hz-soft-pad.m4a'),
    section: 'laid_back',
  },
  {
    id: 'tone_432_drone',
    label: '432 Hz warm drone',
    url: require('../../assets/audio/music/432hz-warm-drone.m4a'),
    section: 'laid_back',
  },
  {
    id: 'tone_639_wash',
    label: '639 Hz dawn wash',
    url: require('../../assets/audio/music/639hz-dawn-wash.m4a'),
    section: 'laid_back',
  },
  {
    id: 'tone_174_roots',
    label: '174 Hz deep roots',
    url: require('../../assets/audio/music/174hz-deep-roots.m4a'),
    section: 'laid_back',
  },
  {
    id: 'tone_285_mist',
    label: '285 Hz valley mist',
    url: require('../../assets/audio/music/285hz-valley-mist.m4a'),
    section: 'laid_back',
  },
  {
    id: 'tone_417_lantern',
    label: '417 Hz lantern glow',
    url: require('../../assets/audio/music/417hz-lantern-glow.m4a'),
    section: 'laid_back',
  },
  {
    id: 'tone_852_bell',
    label: '852 Hz clear bell',
    url: require('../../assets/audio/music/852hz-clear-bell.m4a'),
    section: 'laid_back',
  },
  {
    id: 'tone_963_moon',
    label: '963 Hz moonset',
    url: require('../../assets/audio/music/963hz-moonset.m4a'),
    section: 'laid_back',
  },
  {
    id: 'tone_heartwood',
    label: 'Heartwood',
    url: require('../../assets/audio/music/heartwood.m4a'),
    section: 'laid_back',
  },
  // Calm music beds (no solfeggio tuning): same 5-min seamless-loop treatment.
  {
    id: 'music_low_cloud',
    label: 'Low Cloud',
    url: require('../../assets/audio/music/low-cloud.m4a'),
    section: 'laid_back',
  },
  {
    id: 'music_quiet_hours',
    label: 'Quiet Hours',
    url: require('../../assets/audio/music/quiet-hours.m4a'),
    section: 'laid_back',
  },
  {
    id: 'music_golden_hour',
    label: 'Golden Hour',
    url: require('../../assets/audio/music/golden-hour.m4a'),
    section: 'laid_back',
  },
  {
    id: 'music_velvet_night',
    label: 'Velvet Night',
    url: require('../../assets/audio/music/velvet-night.m4a'),
    section: 'laid_back',
  },
  {
    id: 'music_starlit',
    label: 'Starlit',
    url: require('../../assets/audio/music/starlit.m4a'),
    section: 'laid_back',
  },
  {
    id: 'music_drift',
    label: 'Drift',
    url: require('../../assets/audio/music/drift.m4a'),
    section: 'laid_back',
  },
] as const;

/** Tone clips are long one-shot cuts: sessions start at a random offset instead of 0. */
export function isToneSound(id: string): boolean {
  return MUSIC_SOUNDS.some((s) => s.id === id);
}

/** Every in-app playback source (ambient + music beds). */
const PLAYBACK_SOUNDS: readonly SoundOption[] = [...MEDITATION_SOUNDS, ...MUSIC_SOUNDS];

export const DEFAULT_ALARM_SOUND_ID = 'quiett_harsh';
export const DEFAULT_MEDITATION_SOUND_ID = MEDITATION_SOUNDS[0]!.id;

export function alarmSoundById(id: string): SoundOption {
  return ALARM_SOUNDS.find((s) => s.id === id) ?? ALARM_SOUNDS[0]!;
}

export function meditationSoundById(id: string): SoundOption {
  return PLAYBACK_SOUNDS.find((s) => s.id === id) ?? MEDITATION_SOUNDS[0]!;
}

export function alarmSoundsBySection(section: SoundOption['section']): SoundOption[] {
  return ALARM_SOUNDS.filter((s) => s.section === section);
}
