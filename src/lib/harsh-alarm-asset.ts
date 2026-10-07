import { Asset } from 'expo-asset';
import { alarmSoundById, DEFAULT_ALARM_SOUND_ID } from '@/constants/sounds';

const uriCache = new Map<string, string>();

/** Drop cached URIs after replacing audio files on disk. */
export function clearHarshAlarmSoundUriCache(): void {
  uriCache.clear();
}

export function clearAlarmSoundUriCache(): void {
  uriCache.clear();
}

/**
 * Resolve a bundled alarm asset to a local file URI for AlarmKit `soundUri`.
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
    if (soundId !== DEFAULT_ALARM_SOUND_ID) return resolveAlarmSoundUri(DEFAULT_ALARM_SOUND_ID);
    throw new Error('Alarm sound failed to resolve.');
  }
  uriCache.set(soundId, asset.localUri);
  return asset.localUri;
}

export function alarmKitSoundName(soundId: string): string | undefined {
  return alarmSoundById(soundId).soundName;
}
