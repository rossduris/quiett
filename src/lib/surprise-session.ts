import { pickSurpriseTrack } from '@/constants/unlock-tracks';
import { loadUnlockTrackId, saveUnlockTrackId } from '@/lib/storage';

/**
 * Roll the morning track when the meditation starts, not when Surprise me is tapped.
 * Launch shelf only: tones and ambient (every one of them). Guided stays out.
 */
export async function rollSurpriseTrack(): Promise<string> {
  const current = await loadUnlockTrackId();
  const picked = pickSurpriseTrack(current, false);
  return saveUnlockTrackId(picked.id);
}
