/**
 * Illustrated track covers (primary Library art). Metro needs literal require() calls.
 * Every track / sound id maps to a hand-picked cover; unknown ids hash into the covers
 * that no Library track uses yet, so new tracks still get stable, varied art.
 */
import { hashString } from '@/lib/scene-gen';

export const TRACK_COVER_IMAGES = {
  '01': require('../../assets/track-covers/cover-01.jpg'), // calm lake at dawn, treeline
  '02': require('../../assets/track-covers/cover-02.jpg'), // misty layered mountains, sun at ridge
  '03': require('../../assets/track-covers/cover-03.jpg'), // wildflower meadow, misty hills, sunrise
  '04': require('../../assets/track-covers/cover-04.jpg'), // pine forest, sun, tiny birds
  '05': require('../../assets/track-covers/cover-05.jpg'), // enchanted forest arch
  '06': require('../../assets/track-covers/cover-06.jpg'), // misty rock islands, still water
  '07': require('../../assets/track-covers/cover-07.jpg'), // cattail marsh pond, duck
  '08': require('../../assets/track-covers/cover-08.jpg'), // mountains, wildflowers, birds
  '09': require('../../assets/track-covers/cover-09.jpg'), // ocean horizon sunrise, long reflection
  '10': require('../../assets/track-covers/cover-10.jpg'), // tall window, warm light spill
  '11': require('../../assets/track-covers/cover-21.jpg'), // hot-air balloons over misty valley
  '12': require('../../assets/track-covers/cover-22.jpg'), // lighthouse on sea cliff at dawn
  '13': require('../../assets/track-covers/cover-13.jpg'), // lake with sailboat, orange mountains
  '14': require('../../assets/track-covers/cover-14.jpg'), // desert dunes, big sun
  '15': require('../../assets/track-covers/cover-15.jpg'), // misty pine forest at sunrise
  '16': require('../../assets/track-covers/cover-16.jpg'), // zen garden rocks, lone tree, pond
  '17': require('../../assets/track-covers/cover-17.jpg'), // canyon with river
  '18': require('../../assets/track-covers/cover-18.jpg'), // pink wildflower meadow
  '19': require('../../assets/track-covers/cover-23.jpg'), // waterfall into misty pool
  '20': require('../../assets/track-covers/cover-24.jpg'), // snowy birch grove
  // Sound-source covers — literal images of what each sound is.
  '25': require('../../assets/track-covers/cover-25-clear-bell.jpg'), // singing bowl
  '26': require('../../assets/track-covers/cover-26-rain.jpg'), // rain on a window
  '27': require('../../assets/track-covers/cover-27-waves.jpg'), // waves on a shore
  '28': require('../../assets/track-covers/cover-28-birds.jpg'), // songbirds on a blossom branch
  '29': require('../../assets/track-covers/cover-29-dawn-keys.jpg'), // piano at dawn
  '30': require('../../assets/track-covers/cover-30-soft-pad.jpg'), // sea of soft clouds
  '31': require('../../assets/track-covers/cover-31-warm-drone.jpg'), // tanpura with sound waves
} as const;

export type TrackCoverKey = keyof typeof TRACK_COVER_IMAGES;

export const TRACK_COVER_MAP: Record<string, TrackCoverKey> = {
  // Guided
  'guided:first-light': '03',
  'guided:open-eyes': '01',
  'guided:still-horizon': '09',
  'guided:warm-window': '10',
  'guided:quiet-rise': '11',
  'guided:clear-morning': '08',
  // Healing tones
  'music:soft-pad': '30',
  'music:dawn-keys': '29',
  'music:warm-drone': '31',
  'music:clear-bell': '25',
  // Ambient
  'ambient:calm_waves': '27',
  'ambient:morning_birds': '28',
  'ambient:soft_rain': '26',
  // Meditation sounds (raw playback ids)
  'sound:calm_waves': '27',
  'sound:morning_birds': '28',
  'sound:soft_rain': '26',
  // Alarm sounds
  'alarm:quiett_harsh': '17',
  'alarm:rise_and_shine': '12',
  'alarm:early_bright': '08',
  'alarm:fresh_morning': '15',
  'alarm:new_day': '09',
  'alarm:sunbeam': '05',
  'alarm:dayspring': '07',
  'alarm:peaceful': '19',
  'alarm:slow_wind': '14',
  'alarm:dawn_rain': '26',
  'alarm:coastal_breeze': '27',
  'alarm:hazy_day': '11',
  'alarm:new_breath': '03',
  'alarm:system_default': '02',
};

/** Covers not used by any Library track — fallback pool for new ids. */
const FALLBACK_POOL: TrackCoverKey[] = [
  '02', '04', '05', '06', '07', '12', '13', '14', '15', '16', '17', '18', '19', '20',
];

export function trackCoverKeyFor(id: string): TrackCoverKey {
  return TRACK_COVER_MAP[id] ?? FALLBACK_POOL[hashString(id) % FALLBACK_POOL.length]!;
}

export function trackCoverFor(id: string): number {
  return TRACK_COVER_IMAGES[trackCoverKeyFor(id)];
}
