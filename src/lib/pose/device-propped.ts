import { Accelerometer, type AccelerometerMeasurement } from 'expo-sensors';
import {
  ACCEL_INTERVAL_MS,
  MIN_VERTICAL_ABS_Y,
  PROPPED_ENTER_SAMPLES,
  PROPPED_LEAVE_SAMPLES,
} from './thresholds';

export type ProppedSample = {
  propped: boolean;
  /** Instantaneous propped estimate before hysteresis. */
  rawPropped: boolean;
  x: number;
  y: number;
  z: number;
  /** True when no motion reading arrived in time; the propped check is skipped (passes). */
  sensorMissing?: boolean;
};

/** No accelerometer reading within this long after start → skip the propped check. */
const NO_READING_GRACE_MS = 3500;

/**
 * True when the phone is upright and portrait. Holding it is fine.
 * Landscape (|x| larger than |y|) fails. Lying down, a flat phone, or a
 * strong tip toward the ceiling fails too.
 *
 * Pitch is the tip out of the screen plane: cos(pitch) = hypot(x, y) / |g|.
 * The limit is MIN_VERTICAL_ABS_Y (~37°).
 */
export function isRawPropped(m: Pick<AccelerometerMeasurement, 'x' | 'y' | 'z'>): boolean {
  const ax = Math.abs(m.x);
  const ay = Math.abs(m.y);
  if (ax > ay) return false;
  const inPlane = Math.hypot(m.x, m.y);
  const mag = Math.hypot(m.x, m.y, m.z);
  if (mag < 0.2) return false;
  return inPlane / mag >= MIN_VERTICAL_ABS_Y;
}

export type ProppedMonitor = {
  start: () => void;
  stop: () => void;
  /** Latest hysteretic propped flag (defaults true until first samples — fail open briefly). */
  isPropped: () => boolean;
  subscribe: (listener: (sample: ProppedSample) => void) => () => void;
};

/**
 * Live phone-orientation monitor (roughly vertical portrait). While readings arrive the
 * check is enforced. If the sensor is unavailable or no reading arrives within
 * NO_READING_GRACE_MS, the check is skipped (isPropped() → true) so a missing sensor
 * does not trap them; a later reading turns the check back on.
 */
export function createProppedMonitor(): ProppedMonitor {
  const listeners = new Set<(sample: ProppedSample) => void>();
  let sub: { remove: () => void } | null = null;
  let published = false;
  let hasSample = false;
  let enter = 0;
  let leave = 0;
  let sensorMissing = false;
  let graceTimer: ReturnType<typeof setTimeout> | null = null;
  let last: ProppedSample = {
    propped: false,
    rawPropped: false,
    x: 0,
    y: 0,
    z: 0,
  };

  const emit = (sample: ProppedSample) => {
    last = sample;
    listeners.forEach((l) => l(sample));
  };

  const clearGrace = () => {
    if (graceTimer) clearTimeout(graceTimer);
    graceTimer = null;
  };

  const markMissing = () => {
    if (hasSample) return;
    sensorMissing = true;
    emit({ propped: true, rawPropped: true, x: 0, y: 0, z: 0, sensorMissing: true });
  };

  const onReading = (m: AccelerometerMeasurement) => {
    clearGrace();
    sensorMissing = false;
    const rawPropped = isRawPropped(m);
    if (!hasSample) {
      hasSample = true;
      published = rawPropped;
      enter = 0;
      leave = 0;
      emit({ propped: published, rawPropped, x: m.x, y: m.y, z: m.z });
      return;
    }

    if (published) {
      if (rawPropped) {
        leave = 0;
      } else {
        leave += 1;
        if (leave >= PROPPED_LEAVE_SAMPLES) {
          published = false;
          leave = 0;
          enter = 0;
        }
      }
    } else if (rawPropped) {
      enter += 1;
      leave = 0;
      if (enter >= PROPPED_ENTER_SAMPLES) {
        published = true;
        enter = 0;
      }
    } else {
      enter = 0;
    }

    emit({ propped: published, rawPropped, x: m.x, y: m.y, z: m.z });
  };

  return {
    start() {
      if (sub) return;
      Accelerometer.setUpdateInterval(ACCEL_INTERVAL_MS);
      sub = Accelerometer.addListener(onReading);
      clearGrace();
      graceTimer = setTimeout(markMissing, NO_READING_GRACE_MS);
      void Accelerometer.isAvailableAsync()
        .then((ok) => {
          if (!ok && sub) {
            clearGrace();
            markMissing();
          }
        })
        .catch(() => {});
    },
    stop() {
      clearGrace();
      sensorMissing = false;
      sub?.remove();
      sub = null;
      hasSample = false;
      published = false;
      enter = 0;
      leave = 0;
    },
    // No sample yet, or none within the grace: pass. A real flat or sideways reading still fails.
    isPropped: () => (sensorMissing || !hasSample ? true : published),
    subscribe(listener) {
      listeners.add(listener);
      listener(last);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
