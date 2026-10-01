/**
 * Night-friendly screen brightness for the session. expo-brightness is a native module: on a
 * build made before it was added every call quietly does nothing (same guard as haptics).
 *
 * Behaviour: only in the dim hours (see `isDimHour`), and only ever *up* — the screen eases from
 * the user's current brightness to a soft floor over ~25 s (it also helps the camera see a face
 * in a dark room). The original brightness is restored when the session ends or the app leaves
 * the foreground.
 */
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

type BrightnessModule = typeof import('expo-brightness');

let mod: BrightnessModule | null | undefined;
function brightness(): BrightnessModule | null {
  if (mod !== undefined) return mod;
  mod = null;
  if (Platform.OS === 'web') return mod;
  try {
    if (!requireOptionalNativeModule('ExpoBrightness')) return mod;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('expo-brightness') as BrightnessModule;
  } catch {
    mod = null;
  }
  return mod;
}

/** Early morning / late evening: warm, dim session palette and the gentle brightness ramp. */
export function isDimHour(now: Date = new Date()): boolean {
  const m = now.getHours() * 60 + now.getMinutes();
  return m < 7 * 60 + 30 || m >= 19 * 60 + 30;
}

const FLOOR = 0.5;
const RAMP_MS = 25_000;
const STEP_MS = 1_000;

export function useGentleBrightness(active: boolean) {
  useEffect(() => {
    const b = brightness();
    if (!active || !b || !isDimHour()) return;
    let original: number | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let alive = true;

    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const restore = () => {
      stop();
      if (original == null) return;
      const value = original;
      original = null;
      b.setBrightnessAsync(value).catch(() => {});
      if (Platform.OS === 'android') b.restoreSystemBrightnessAsync().catch(() => {});
    };
    const start = async () => {
      try {
        const now = await b.getBrightnessAsync();
        if (!alive || now >= FLOOR) return;
        original = now;
        const t0 = Date.now();
        timer = setInterval(() => {
          const t = Math.min(1, (Date.now() - t0) / RAMP_MS);
          // Ease-in-out so the change is never noticeable as a step.
          const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
          b.setBrightnessAsync(now + (FLOOR - now) * e).catch(() => {});
          if (t >= 1) stop();
        }, STEP_MS);
      } catch {
        /* brightness is best-effort */
      }
    };

    void start();
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') restore();
    });
    return () => {
      alive = false;
      sub.remove();
      restore();
    };
  }, [active]);
}
