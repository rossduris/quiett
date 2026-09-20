import { Asset } from 'expo-asset';
import { QUIETT_HARSH_ALARM } from '@/constants/sounds';

let cachedUri: string | null = null;

/** Drop cached URI after replacing the audio file on disk. */
export function clearHarshAlarmSoundUriCache(): void {
  cachedUri = null;
}

/** Local file URI for AlarmKit / Android import (copied into durable storage on schedule). */
export async function resolveHarshAlarmSoundUri(): Promise<string> {
  if (cachedUri) return cachedUri;
  const asset = Asset.fromModule(QUIETT_HARSH_ALARM);
  // Force reload so a replaced m4a/caf is picked up after Metro refresh.
  asset.localUri = null;
  await asset.downloadAsync();
  if (!asset.localUri) {
    throw new Error('Quiett harsh alarm asset failed to resolve.');
  }
  cachedUri = asset.localUri;
  return cachedUri;
}

/** Exact filename for AlarmKit bundled soundName (iosAlarmSounds plugin). */
export const HARSH_ALARM_SOUND_NAME = 'quiett-harsh.caf';
