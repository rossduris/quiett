import type { PoseStatus } from '@/lib/pose/types';
import type { SessionPhase } from '@/lib/session-machine';

/**
 * Gentle, one-at-a-time prompts for the session. Short, second person, no warnings, no
 * medical claims, and never the word the brand avoids for the practice ("sit").
 * Pure (no RN) so the box preview renders the same words.
 */
export type SessionCopy = {
  /** The one prompt on screen. */
  prompt: string;
  /** Optional small line under it. */
  note?: string;
  /** Soft tone for a break: halo and prompt stay calm, never alarming. */
  tone: 'guide' | 'nudge' | 'calm';
};

/** What the camera still needs, in the gate order (phone → light → face → hands → posture → stillness). */
export function posePrompt(status: PoseStatus): string {
  switch (status) {
    case 'not_upright':
      return 'Prop your phone up, facing you';
    case 'too_dark':
      return 'A little more light helps';
    case 'hands_near':
    case 'arms_moving':
      return 'Let your hands rest';
    case 'posture':
      return 'Soften your shoulders';
    case 'fidgeting':
      return 'Settle in';
    case 'holding':
      return 'Stay just like this';
    default:
      return 'Come into the circle';
  }
}

/** Rotating prompts while meditating (after the first "You're in"). */
export const MEDITATING_PROMPTS = [
  'Soften your gaze',
  'Let your shoulders drop',
  'Rest here',
  'Let the breath be easy',
  'Nothing to do but be here',
] as const;

/** How long each meditating prompt stays before the next fades in. */
export const PROMPT_ROTATE_MS = 22_000;

export function sessionCopy(opts: {
  phase: SessionPhase;
  pose: PoseStatus;
  /** Meditation minutes already banked (a break is in progress). */
  paused: boolean;
  /** "2 minutes" */
  durationLabel: string;
  /** Index into MEDITATING_PROMPTS; -1 = first lock-in line, -2 = back after a break. */
  meditatingStep: number;
}): SessionCopy {
  const { phase, pose, paused, durationLabel, meditatingStep } = opts;
  switch (phase) {
    case 'alarming':
      if (paused) {
        // A break mid-meditation: a calm nudge back, not a warning.
        const need = pose === 'absent' || pose === 'holding' ? 'Come back to center' : posePrompt(pose);
        return { prompt: need, note: 'Your minutes are saved', tone: 'nudge' };
      }
      return { prompt: posePrompt(pose), note: `Then ${durationLabel} of quiet`, tone: 'guide' };
    case 'detecting':
      return { prompt: 'Stay just like this', note: 'The alarm will fade', tone: 'guide' };
    case 'meditating':
      return {
        prompt:
          meditatingStep === -2
            ? 'Welcome back. Breathe.'
            : meditatingStep < 0
              ? 'You\u2019re in. Breathe.'
              : MEDITATING_PROMPTS[meditatingStep % MEDITATING_PROMPTS.length]!,
        tone: 'calm',
      };
    case 'completed':
      return { prompt: 'Morning unlocked', tone: 'calm' };
    default:
      return { prompt: '', tone: 'calm' };
  }
}

/** Halo warmth 0–1 for the framing glow: rises as each gate is met, full once locked in. */
export function haloWarmth(phase: SessionPhase, pose: PoseStatus, confirmProgress: number): number {
  if (phase === 'meditating' || phase === 'completed') return 1;
  if (phase === 'detecting') return 0.62 + 0.38 * Math.max(0, Math.min(1, confirmProgress));
  switch (pose) {
    case 'holding':
      return 0.6;
    case 'fidgeting':
      return 0.48;
    case 'posture':
    case 'hands_near':
    case 'arms_moving':
      return 0.36;
    case 'too_dark':
    case 'not_upright':
      return 0.2;
    default:
      return 0.1;
  }
}
