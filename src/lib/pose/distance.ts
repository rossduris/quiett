import type { PoseLandmarks } from './types';
import { MIN_JOINT_CONFIDENCE, SHOULDER_SPAN_MAX, SHOULDER_SPAN_MIN } from './thresholds';

/**
 * Shoulder span in Vision's normalized image (0–1 on each axis).
 * Level shoulders ≈ fraction of the frame width. Returns null when the
 * shoulders are missing or the numbers are not normalized, so a bad reading
 * never invents a distance gate.
 */
export function shoulderSpan(joints: PoseLandmarks['joints']): number | null {
  const l = joints.leftShoulder;
  const r = joints.rightShoulder;
  if (!l || !r) return null;
  if (l.confidence < MIN_JOINT_CONFIDENCE || r.confidence < MIN_JOINT_CONFIDENCE) return null;
  const span = Math.hypot(l.x - r.x, l.y - r.y);
  if (!Number.isFinite(span) || span <= 0 || span > 1.5) return null;
  return span;
}

/**
 * How far the nose sits from the middle of the shoulders, in shoulder-widths.
 * Square to the phone is near 0. A body turned away, or a phone held far to
 * one side while they look at it, pushes this up. Null when the shoulders
 * or the nose are missing — a close hold with no shoulders does not block.
 */
export function shoulderSquareOffset(joints: PoseLandmarks['joints']): number | null {
  const l = joints.leftShoulder;
  const r = joints.rightShoulder;
  const n = joints.nose;
  if (!l || !r || !n) return null;
  if (
    l.confidence < MIN_JOINT_CONFIDENCE ||
    r.confidence < MIN_JOINT_CONFIDENCE ||
    n.confidence < MIN_JOINT_CONFIDENCE
  ) {
    return null;
  }
  const span = Math.hypot(l.x - r.x, l.y - r.y);
  if (!Number.isFinite(span) || span <= 0.02) return null;
  const mid = (l.x + r.x) / 2;
  const off = Math.abs(n.x - mid) / span;
  return Number.isFinite(off) ? off : null;
}

/** null = in range, or not measurable (does not block). */
export function distanceStatus(span: number | null): 'too_close' | 'too_far' | null {
  if (span == null) return null;
  if (span >= SHOULDER_SPAN_MAX) return 'too_close';
  if (span <= SHOULDER_SPAN_MIN) return 'too_far';
  return null;
}
