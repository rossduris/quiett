import type { PoseJoint, PoseLandmarks, PoseStatus } from './types';
import {
  MAX_SHOULDER_TILT_RATIO,
  MIN_FACE_FOR_PRESENT,
  MIN_HEAD_ABOVE_SHOULDERS,
  MIN_JOINT_CONFIDENCE,
  MIN_SHOULDER_ABOVE_HIP,
  STILLNESS_MAX_MOTION,
  STILLNESS_WINDOW_MS,
} from './thresholds';

function joint(landmarks: PoseLandmarks, name: string): PoseJoint | null {
  const j = landmarks.joints[name];
  if (!j || j.confidence < MIN_JOINT_CONFIDENCE) return null;
  return j;
}

function mid(a: PoseJoint, b: PoseJoint): { x: number; y: number } {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export type MotionPoint = { x: number; y: number };

export type MotionSample = {
  timestamp: number;
  /** Multi-point: mid-shoulders (+ nose when available). */
  points: MotionPoint[];
};

export type ClassifyResult = {
  present: boolean;
  upright: boolean;
  /** True when both shoulders are visible — required for holding. */
  hasShoulders: boolean;
  /** Face-only present path (softer — never holding). */
  faceOnly: boolean;
  /** Points used for stillness (mid-shoulders, nose…). */
  stillnessPoints: MotionPoint[];
  confidence: number;
};

/**
 * Presence + upright for sit detection.
 *
 * Holding requires shoulders in frame. Face-only → present but not upright
 * (shows as sit-up / not_upright chip, never holding).
 * Prefer hips for torso upright when available.
 */
export function classifyPresenceAndUpright(landmarks: PoseLandmarks): ClassifyResult {
  const nose = joint(landmarks, 'nose');
  const neck = joint(landmarks, 'neck');
  const lShoulder = joint(landmarks, 'leftShoulder');
  const rShoulder = joint(landmarks, 'rightShoulder');
  const lHip = joint(landmarks, 'leftHip');
  const rHip = joint(landmarks, 'rightHip');

  const hasShoulders = !!(lShoulder && rShoulder);
  const hasFace = landmarks.faceCount >= MIN_FACE_FOR_PRESENT;
  const present = hasShoulders || hasFace || !!nose;

  if (!present) {
    return {
      present: false,
      upright: false,
      hasShoulders: false,
      faceOnly: false,
      stillnessPoints: [],
      confidence: 0,
    };
  }

  let confidence = 0.4;
  if (hasFace) confidence = Math.max(confidence, 0.85);
  if (nose) confidence = Math.max(confidence, 0.92);
  if (hasShoulders) confidence = Math.max(confidence, 0.95);
  if (lHip && rHip) confidence = Math.max(confidence, 0.98);

  // Face / nose only — present but cannot reach holding.
  if (!hasShoulders || !lShoulder || !rShoulder) {
    return {
      present: true,
      upright: false,
      hasShoulders: false,
      faceOnly: true,
      stillnessPoints: nose ? [{ x: nose.x, y: nose.y }] : [],
      confidence,
    };
  }

  const shoulders = mid(lShoulder, rShoulder);
  const shoulderWidth = Math.max(
    0.001,
    Math.hypot(lShoulder.x - rShoulder.x, lShoulder.y - rShoulder.y),
  );
  const tiltRatio = Math.abs(lShoulder.y - rShoulder.y) / shoulderWidth;
  const shouldersLevel = tiltRatio <= MAX_SHOULDER_TILT_RATIO;
  const head = nose ?? neck;
  const headAbove = head
    ? head.y - shoulders.y >= MIN_HEAD_ABOVE_SHOULDERS
    : hasFace;

  // Prefer hips for torso upright when both hips are available.
  let torsoUp = true;
  if (lHip && rHip) {
    const hips = mid(lHip, rHip);
    torsoUp = shoulders.y - hips.y >= MIN_SHOULDER_ABOVE_HIP;
  }

  const upright = shouldersLevel && headAbove && torsoUp;
  const stillnessPoints: MotionPoint[] = [shoulders];
  if (nose) stillnessPoints.push({ x: nose.x, y: nose.y });

  return {
    present: true,
    upright,
    hasShoulders: true,
    faceOnly: false,
    stillnessPoints,
    confidence,
  };
}

/** Multi-point stillness: average travel across mid-shoulders (+ nose). */
export function isStill(history: MotionSample[], now: number): boolean {
  const windowed = history.filter((h) => now - h.timestamp <= STILLNESS_WINDOW_MS);
  // Not enough samples yet — treat as still so we can ENTER holding (was stuck fidgeting).
  if (windowed.length < 3) return true;

  let totalTravel = 0;
  let steps = 0;
  for (let i = 1; i < windowed.length; i++) {
    const a = windowed[i - 1]!;
    const b = windowed[i]!;
    const n = Math.min(a.points.length, b.points.length);
    if (n === 0) continue;
    let frameTravel = 0;
    for (let p = 0; p < n; p++) {
      const pa = a.points[p]!;
      const pb = b.points[p]!;
      frameTravel += Math.hypot(pb.x - pa.x, pb.y - pa.y);
    }
    totalTravel += frameTravel / n;
    steps += 1;
  }
  if (steps === 0) return false;
  return totalTravel / steps <= STILLNESS_MAX_MOTION;
}

export function toPoseStatus(
  present: boolean,
  _upright?: boolean,
  still: boolean = true,
  _hasShoulders?: boolean,
  phonePropped: boolean = true,
  faceLooking: boolean = false,
  handsNearFace: boolean = false,
): PoseStatus {
  // Gates: propped + face looking + no hands + still.
  if (!phonePropped) return 'not_upright'; // chip: "prop phone"
  if (!present || !faceLooking) return 'absent'; // no face / not facing camera
  if (handsNearFace) return 'hands_near'; // chip: "hands away"
  if (!still) return 'fidgeting'; // chip: "hold still"
  return 'holding';
}

/**
 * Holding hysteresis:
 * - Harder to ENTER holding (need `enterNeeds` consecutive raw holding)
 * - Easier to LEAVE holding (need `leaveNeeds` consecutive non-holding)
 */
export function createHoldingHysteresis(
  enterNeeds: number,
  leaveNeeds: number,
): {
  push: (raw: PoseStatus) => PoseStatus;
  reset: () => void;
  published: () => PoseStatus;
} {
  let published: PoseStatus = 'absent';
  let enterStreak = 0;
  let leaveStreak = 0;

  return {
    push(raw: PoseStatus) {
      if (published === 'holding') {
        if (raw === 'holding') {
          leaveStreak = 0;
          return published;
        }
        leaveStreak += 1;
        if (leaveStreak >= leaveNeeds) {
          published = raw;
          leaveStreak = 0;
          enterStreak = 0;
        }
        return published;
      }

      // Not currently holding — harder to enter.
      if (raw === 'holding') {
        enterStreak += 1;
        leaveStreak = 0;
        if (enterStreak >= enterNeeds) {
          published = 'holding';
          enterStreak = 0;
        }
        // While building enter streak, keep last non-holding (often fidgeting).
        return published;
      }

      enterStreak = 0;
      // Publish non-holding promptly so alarm returns / chip updates.
      published = raw;
      return published;
    },
    reset() {
      published = 'absent';
      enterStreak = 0;
      leaveStreak = 0;
    },
    published: () => published,
  };
}
