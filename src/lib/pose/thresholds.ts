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
