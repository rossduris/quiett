import {
  DEFAULT_SIT_MINUTES,
  type SitMinutes,
} from '@/lib/storage';

export type SessionPhase =
  | 'alarming'
  | 'detecting'
  | 'meditating'
  | 'completed'
  | 'emergency';

export type SessionEvent =
  | { type: 'POSE_HOLDING' }
  | { type: 'POSE_BROKEN' }
  | { type: 'CONFIRM_ELAPSED' }
  | { type: 'SIT_COMPLETE' }
  | { type: 'EMERGENCY_DISMISS' };

export const CONFIRM_HOLD_MS = 2500;

/** Unlock length from Settings sit-length picker (30s / 2 / 3 / 5 / 10). */
export function sitDurationMs(minutes: SitMinutes = DEFAULT_SIT_MINUTES): number {
  return minutes * 60 * 1000;
}

export function reduceSession(phase: SessionPhase, event: SessionEvent): SessionPhase {
  switch (phase) {
    case 'alarming':
      if (event.type === 'POSE_HOLDING') return 'detecting';
      if (event.type === 'EMERGENCY_DISMISS') return 'emergency';
      return phase;
    case 'detecting':
      if (event.type === 'POSE_BROKEN') return 'alarming';
      if (event.type === 'CONFIRM_ELAPSED') return 'meditating';
      if (event.type === 'EMERGENCY_DISMISS') return 'emergency';
      return phase;
    case 'meditating':
      if (event.type === 'POSE_BROKEN') return 'alarming';
      if (event.type === 'SIT_COMPLETE') return 'completed';
      if (event.type === 'EMERGENCY_DISMISS') return 'emergency';
      return phase;
    default:
      return phase;
  }
}

export function formatMmSs(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
