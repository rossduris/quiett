/**
 * Tunable Quiett session gates.
 *
 * Holding requires ALL of:
 * 1) bright enough (face-region luma ≥ BRIGHTNESS_MIN — softer than original 0.20)
 * 2) face looking at camera (Vision yaw/pitch + both eyes + mouth/lips)
 * 3) shoulders in view (not a face-only close crop) and upright enough
 * 4) still enough for a steady hand (a shaky phone still fails)
 *
 * Holding the phone is allowed. The accelerometer is not a gate.
 *
 * Session-machine also needs CONFIRM_HOLD_MS (~2.5s) of published `holding`.
 *
 * Dialing fidget / walking:
 * - Too easy to count while moving → LOWER STILLNESS_MAX_MOTION (e.g. 0.012)
 * - Too hard while sitting calmly → RAISE STILLNESS_MAX_MOTION (e.g. 0.025)
 * - Need longer "settle" before hold → RAISE STILLNESS_WINDOW_MS
 * - Walking still slips through → lower MAX and raise ENTER_HOLDING_FRAMES
 */

export const MIN_JOINT_CONFIDENCE = 0.25;
export const MIN_FACE_FOR_PRESENT = 1;
export const MAX_SHOULDER_TILT_RATIO = 0.35;
export const MIN_HEAD_ABOVE_SHOULDERS = 0.02;
export const MIN_SHOULDER_ABOVE_HIP = 0.05;

/** Look-back window for landmark travel (ms). */
export const STILLNESS_WINDOW_MS = 1200;
/**
 * Max average per-step travel across tracked points (Vision normalized 0–1).
 * Legacy image travel. A steady handheld tremor stays under this; walking or a shaky phone does not.
 */
export const STILLNESS_MAX_MOTION = 0.045;

/**
 * Time-based leave grace: once holding is published, a non-holding raw status must
 * persist this long before it's published. A 1–3 frame flicker (a Vision miss, a
 * blink turning the face check off) no longer resets the 2.5 s hold. ~350 ms is
 * ~4 frames at 12 fps / ~2 at 5 fps — short enough that real breaks still land fast.
 * Phone going flat (not_upright) skips the grace.
 */
export const LEAVE_HOLDING_GRACE_MS = 350;

/** Harder to enter holding (bias against false dismissals of the alarm). */
export const ENTER_HOLDING_FRAMES = 2;
/** Easier to leave holding once meditating / detecting (responsive break). */
export const LEAVE_HOLDING_FRAMES = 2;

/** Fallback still-capture interval when live view is not mounted (~2.5 Hz). */
export const CAPTURE_INTERVAL_MS = 400;
/** JPEG quality for analysis snapshots (0–1). */
export const CAPTURE_QUALITY = 0.2;

/**
 * Accelerometer gravity, in g. The phone must be portrait and close to vertical.
 * Landscape (|x| larger than |y|) fails. Flat makes |z| the large axis.
 * cos(pitch) = hypot(x, y) / |g|. 0.80 allows about 37° of tip forward or back.
 * A slight portrait tilt still passes. Steeper, including a phone aimed at the
 * ceiling, fails.
 */
export const MAX_FLAT_ABS_Z = 0.72;
/** Minimum in-plane share of gravity while portrait. 0.80 is about 37 degrees of pitch. */
export const MIN_VERTICAL_ABS_Y = 0.80;
/** Kept so older call sites still compile. The upright check uses MIN_VERTICAL_ABS_Y. */
export const MIN_PROPPED_ABS_Y = MIN_VERTICAL_ABS_Y;
/** Consecutive accel samples to enter/leave propped (anti-jitter). */
export const PROPPED_ENTER_SAMPLES = 4;
export const PROPPED_LEAVE_SAMPLES = 3;
/** Accel update interval (ms). */
export const ACCEL_INTERVAL_MS = 100;

/** Require a face facing the camera (not body-only). */
export const REQUIRE_FACE_LOOKING = true;

/**
 * Radians — must face the camera (Face ID style).
 * ~0.38 ≈ 22° yaw; pitch 0.42 — mouth/eyes + less chin-tuck.
 */
export const FACE_YAW_MAX = 0.38;
export const FACE_PITCH_MAX = 0.42;

/** Expand face box by this fraction when testing hand proximity (native uses fixed inset). */
/** @deprecated Native now rejects any clear hand in frame, not only face-overlap. */
export const HAND_NEAR_FACE_PAD = 0.22;

/**
 * Min mean face/frame luminance (0–1) from Vision. Below → too_dark / "more light".
 * Softened from original 0.20 (65% of original) to allow dimmer usable rooms
 * while still rejecting near-pitch-black / covered-camera cases.
 * Match native QuiettPoseVision.brightnessMin.
 * 
 * Tuning:
 * - 0.20 (original): Too strict — failed dim-but-usable rooms
 * - 0.13: Middle ground — rejects covered camera, passes typical dim indoor lighting
 * - 0.00: Too loose — no lighting gate
 */
export const BRIGHTNESS_MIN = 0.13;

/**
 * Arm stillness (body2d / body3d). Wrist + elbow positions are measured relative to the
 * same-side shoulder and divided by shoulder width (×sw), so 2D (image) and 3D (metres) share
 * one unit: 1.0 ×sw ≈ 35–40 cm for most adults. Per joint, travel = second-largest
 * deviation from the window median (one glitchy frame can't trip it) minus a jitter floor;
 * the check value is the worst joint.
 *
 * Tuning:
 * - Resting hands still trip it → RAISE ARM_MOTION_MAX (e.g. 0.45), ARM_JITTER_FLOOR or ARM_MOTION_PERSIST_MS
 * - Waving / reaching slips through → LOWER ARM_MOTION_MAX (e.g. 0.28) or ARM_MOTION_PERSIST_MS
 * - Breaks land too fast on a short reach → RAISE ARM_MOTION_WINDOW_MS / ARM_MOTION_MIN_SAMPLES
 * - Noisy 2D joints at night → RAISE ARM_MIN_JOINT_CONFIDENCE (joints below are ignored)
 */
/** Look-back window for arm travel (ms). */
export const ARM_MOTION_WINDOW_MS = 1500;
/** Frames (with that joint) needed in the window before the joint counts. */
export const ARM_MOTION_MIN_SAMPLES = 4;
/**
 * Fail above this travel (×sw, after the jitter floor).
 * A steady one-handed hold stays near the jitter floor. A wave or a hand to the face is
 * about 0.3 ×sw or more (~12 cm). 0.42 was letting that pass; 0.24 catches it.
 * 0.22 was twitchy for a hand that is simply resting.
 */
export const ARM_MOTION_MAX = 0.24;
/** Once failing, travel must drop below MAX × this to pass again (no chatter at the edge). */
export const ARM_MOTION_RECOVER_RATIO = 0.7;
/** Subtracted from each joint's travel: joint jitter + small natural shifts (×sw). */
export const ARM_JITTER_FLOOR = 0.065;
/** 2D joints below this Vision confidence are skipped for the frame (3D has no confidence). */
export const ARM_MIN_JOINT_CONFIDENCE = 0.3;
/** EMA weight of the newest frame (lower = smoother, laggier). */
export const ARM_SMOOTHING = 0.5;
/** A single-frame jump bigger than this (×sw) is a tracking glitch; ignored for up to 2 frames. */
export const ARM_GLITCH_JUMP = 1.2;
/**
 * Arms-only grace (ms). Long enough that one glitchy frame does not fail, short enough
 * that a scratch or a wave does. (450 used to forgive a scratch on purpose.)
 */
export const ARM_MOTION_PERSIST_MS = 250;
/** Short measurement gaps (blur) up to this long don't restart the persistence clock. */
export const ARM_MOTION_PERSIST_GAP_MS = 400;
/**
 * Once arms are failing, keep failing through frames where the arm joints can't be measured
 * (motion blur drops them) for up to this long. Real stillness (measured) clears it sooner.
 */
export const ARM_FAIL_HOLD_MS = 1200;
/**
 * While holding, a leave run (non-holding frames) is only cancelled by this many consecutive
 * holding frames. One stray "holding" frame in the middle of a real break used to restart the
 * grace timer, so flickery checks (arm motion, blinks) could keep the hold alive indefinitely.
 */
export const RECOVER_HOLDING_FRAMES = 2;

/**
 * Shoulder span in Vision's normalized image (level shoulders ≈ fraction of the width).
 * A normal handheld view, including a fairly close head, is often 0.45–0.9.
 * Missing shoulders is NOT "too close" (body pose drops them on ordinary head views).
 * Only shoulders that run essentially edge to edge mean the face is filling the frame.
 * - Still told to give it room when the face is merely close → RAISE SHOULDER_SPAN_MAX
 * - A face that fills the lens, shoulders at both edges, still passes → LOWER it
 */
export const SHOULDER_SPAN_MAX = 0.98;
export const SHOULDER_SPAN_MIN = 0.05;

/**
 * Body-mode stillness is computed natively in shoulder-widths (native limit 0.07, tuned
 * for a phone that does not move). A steady hand reads a bit higher than that.
 * 0.18 let fidgeting through. 0.11 still clears a steady hold; a real shift of the
 * head or torso fails. Arm waves are a separate check (they barely move the median).
 * No native rebuild: the session applies this on top of the native value.
 */
export const HANDHELD_STILLNESS_MAX = 0.11;

/**
 * Nose offset from the shoulder midpoint, divided by shoulder width.
 * Native headCentered allows 0.30, which still passes a phone held well off
 * to one side (about 30–40° — the face looks at the lens, the torso does not).
 * ~0.10 is a natural slight angle. 0.18 fails a strong turn and leaves a
 * centered handheld view alone. No shoulders (a close hold) does not block.
 */
export const SHOULDER_SQUARE_MAX = 0.18;
