import { LOW_LIGHT_DEBOUNCE_MS, LOW_LIGHT_ENTER_LUMA, LOW_LIGHT_EXIT_LUMA } from './thresholds';

/**
 * Low-light gate with hysteresis + debounce, fed the native per-frame luma (0–1).
 *
 * - Enters "dim" once luma stays below `enter` for `debounceMs`.
 * - Leaves "dim" once luma stays above `exit` (higher than `enter`) for `debounceMs`.
 * - Anything in between keeps the current state, so the line cannot flicker at the edge.
 * - A frame with no luma (old native binary, Vision miss) keeps the state and does not
 *   advance the timer. A long frame gap restarts the timer.
 */
export type LowLightGate = {
  push: (luma: number | undefined | null, now?: number) => boolean;
  reset: () => void;
  isDim: () => boolean;
};

export function createLowLightGate(
  enter: number = LOW_LIGHT_ENTER_LUMA,
  exit: number = LOW_LIGHT_EXIT_LUMA,
  debounceMs: number = LOW_LIGHT_DEBOUNCE_MS,
): LowLightGate {
  let dim = false;
  let pendingSince: number | null = null;
  let lastAt: number | null = null;

  return {
    push(luma, now = Date.now()) {
      if (luma == null || !Number.isFinite(luma)) return dim;
      if (lastAt != null && now - lastAt > debounceMs) pendingSince = null;
      lastAt = now;
      const wantsFlip = dim ? luma > exit : luma < enter;
      if (!wantsFlip) {
        pendingSince = null;
        return dim;
      }
      if (pendingSince == null) pendingSince = now;
      if (now - pendingSince >= debounceMs) {
        dim = !dim;
        pendingSince = null;
      }
      return dim;
    },
    reset() {
      dim = false;
      pendingSince = null;
      lastAt = null;
    },
    isDim: () => dim,
  };
}
