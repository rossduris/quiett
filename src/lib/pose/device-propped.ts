import { Accelerometer, type AccelerometerMeasurement } from 'expo-sensors';
import {
  ACCEL_INTERVAL_MS,
  MAX_FLAT_ABS_Z,
  MIN_PROPPED_ABS_Y,
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
};

/**
 * True when the phone looks propped (nightstand / upright lean), not flat
 * on a mattress or held on the chest while lying down.
 *
 * Uses gravity from Accelerometer: flat ⇒ |z| dominant; propped portrait ⇒ |y| strong and |z| not flat.
 */
export function isRawPropped(m: Pick<AccelerometerMeasurement, 'x' | 'y' | 'z'>): boolean {
  const ax = Math.abs(m.x);
  const ay = Math.abs(m.y);
  const az = Math.abs(m.z);
  if (az >= MAX_FLAT_ABS_Z) return false;
  if (ay < MIN_PROPPED_ABS_Y) return false;
  // Prefer Y (portrait prop) over X (landscape prop) but allow modest landscape lean.
  return ay >= ax * 0.85 || ay >= 0.5;
}

export type ProppedMonitor = {
  start: () => void;
  stop: () => void;
  /** Latest hysteretic propped flag (defaults true until first samples — fail open briefly). */
  isPropped: () => boolean;
  subscribe: (listener: (sample: ProppedSample) => void) => () => void;
};

/**
 * Live propped-phone monitor. Fail-closed after first reading: if sensors
 * unavailable, isPropped() returns false so the sit cannot cheat-open.
 */
export function createProppedMonitor(): ProppedMonitor {
  const listeners = new Set<(sample: ProppedSample) => void>();
  let sub: { remove: () => void } | null = null;
  let published = false;
  let hasSample = false;
  let enter = 0;
  let leave = 0;
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

  const onReading = (m: AccelerometerMeasurement) => {
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
      void Accelerometer.isAvailableAsync().then((ok) => {
        if (!ok) {
          hasSample = true;
          published = false;
          emit({ propped: false, rawPropped: false, x: 0, y: 0, z: 0 });
        }
      });
    },
    stop() {
      sub?.remove();
      sub = null;
      hasSample = false;
      published = false;
      enter = 0;
      leave = 0;
    },
    isPropped: () => (hasSample ? published : false),
    subscribe(listener) {
      listeners.add(listener);
      listener(last);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
