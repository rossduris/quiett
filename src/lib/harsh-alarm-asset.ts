import { Asset } from 'expo-asset';
import { alarmSoundById, QUIETT_HARSH_ALARM } from '@/constants/sounds';

const uriCache = new Map<string, string>();

/** Drop cached URIs after replacing audio files on disk. */
export function clearHarshAlarmSoundUriCache(): void {
  uriCache.clear();
}

export function clearAlarmSoundUriCache(): void {
  uriCache.clear();
}

/** Exact filename for AlarmKit bundled soundName (iosAlarmSounds plugin). */
export const HARSH_ALARM_SOUND_NAME = 'quiett-harsh.caf';

/** Local file URI for AlarmKit / Android import (copied into durable storage on schedule). */
export async function resolveHarshAlarmSoundUri(): Promise<string> {
  const uri = await resolveAlarmSoundUri('quiett_harsh');
  if (!uri) throw new Error('Quiett harsh alarm asset failed to resolve.');
  return uri;
}

/**
 * Resolve a bundled alarm asset to a local file URI for AlarmKit `soundUri`.
 * Returns null for system default (no custom file).
 */
export async function resolveAlarmSoundUri(soundId: string): Promise<string | null> {
  const opt = alarmSoundById(soundId);
  if (opt.url == null) return null;
  if (typeof opt.url === 'string') return opt.url;

  const cached = uriCache.get(soundId);
  if (cached) return cached;

  const asset = Asset.fromModule(opt.url);
  asset.localUri = null;
  await asset.downloadAsync();
  if (!asset.localUri) {
    // Fallback to harsh if a tone fails to resolve
    if (soundId !== 'quiett_harsh') {
      return resolveAlarmSoundUri('quiett_harsh');
    }
    throw new Error('Quiett harsh alarm asset failed to resolve.');
  }
  uriCache.set(soundId, asset.localUri);
  return asset.localUri;
}

export function alarmKitSoundName(soundId: string): string | undefined {
  return alarmSoundById(soundId).soundName;
}

/** @deprecated keep export for older imports */
export { QUIETT_HARSH_ALARM };
