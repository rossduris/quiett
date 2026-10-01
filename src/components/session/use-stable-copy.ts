import { useEffect, useState } from 'react';
import type { PoseStatus } from '@/lib/pose/types';
import type { SessionCopy } from './session-copy';

/** How long a new reason must stay the same before it replaces the line on screen. */
export const GUIDANCE_HOLD_MS = 700;

type Held = { copy: SessionCopy; pose: PoseStatus };

/**
 * Keeps the current title, hint, and frame tone until the next reason has been
 * unchanged for a short moment, so a flickering check cannot strobe the words.
 * `immediate` skips the wait for phase changes (the hold, the quiet).
 */
export function useStableGuidance(copy: SessionCopy, pose: PoseStatus, immediate: boolean): Held {
  const [shown, setShown] = useState<Held>({ copy, pose });
  useEffect(() => {
    if (shown.copy.prompt === copy.prompt && shown.copy.note === copy.note && shown.pose === pose) return;
    if (immediate) {
      setShown({ copy, pose });
      return;
    }
    const id = setTimeout(() => setShown({ copy, pose }), GUIDANCE_HOLD_MS);
    return () => clearTimeout(id);
  }, [copy.note, copy.prompt, immediate, pose, shown.copy.note, shown.copy.prompt, shown.pose]);
  return shown;
}
