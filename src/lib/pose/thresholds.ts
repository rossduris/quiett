/**
 * Tunable Quiett session gates.
 *
 * Holding requires ALL of:
 * 1) phone propped (accelerometer — not flat on bed/chest)
 * 2) bright enough (face-region luma ≥ BRIGHTNESS_MIN — softer than original 0.20)
 * 3) face looking at camera (Vision yaw/pitch + both eyes + mouth/lips)
 * 4) no clear hand in camera view (Vision hand pose; wrists high in frame also fail)
 * 5) still enough (landmark travel below STILLNESS_MAX_MOTION)
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
 * ~0.015–0.02 rejects walking; small seated sway usually stays under.
 */
export const STILLNESS_MAX_MOTION = 0.028;

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

/** Accelerometer: |z| above this ≈ phone flat (on bed/chest). */
export const MAX_FLAT_ABS_Z = 0.72;
/** |y| must exceed this for propped portrait / lean (nightstand). */
export const MIN_PROPPED_ABS_Y = 0.38;
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
/** Fail above this travel (×sw, after the jitter floor). ~0.28 ≈ 10–11 cm (0.22 too twitchy, 0.35 too loose). */
export const ARM_MOTION_MAX = 0.28;
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
 * Arms-only grace: travel must stay over ARM_MOTION_MAX this long (ms) before the check fails,
 * so a quick scratch / adjusting a sleeve doesn't break the hold. The normal leave-holding
 * grace (LEAVE_HOLDING_GRACE_MS) still applies on top, so a real arm break lands in ~1 s.
 */
export const ARM_MOTION_PERSIST_MS = 450;
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
