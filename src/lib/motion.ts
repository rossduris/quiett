import { Easing, FadeIn, FadeInDown, FadeOut, type WithSpringConfig } from 'react-native-reanimated';

/**
 * One motion vocabulary for the whole app. Interactions stay under 600 ms; only ambient loops
 * (scene covers, auras, heroes) run longer. Everything that moves checks `useReduceMotion()`.
 */
export const DURATION = {
  /** Press feedback, toggles. */
  fast: 160,
  /** Most state changes (fills, colour, small moves). */
  base: 260,
  /** Entrances, expanding panels. */
  slow: 420,
  /** Ceiling for any interaction. */
  max: 560,
} as const;

/** Calm "ease-out-quint"-ish curve used for timing animations. */
export const EASE = Easing.bezier(0.22, 1, 0.36, 1);
/** Symmetric curve for loops and ping-pongs. */
export const EASE_IN_OUT = Easing.inOut(Easing.sin);

/** Snappy, no-overshoot-to-speak-of spring for presses, pills and pills' fills. */
export const SPRING: WithSpringConfig = { damping: 18, stiffness: 260, mass: 0.8 };
/** A touch of bounce for celebratory moments (streak tick, badge pop, tab icon). */
export const SPRING_BOUNCY: WithSpringConfig = { damping: 11, stiffness: 220, mass: 0.8 };
/** Soft, slower settle for larger surfaces (tab pill, expanding cards). */
export const SPRING_SOFT: WithSpringConfig = { damping: 22, stiffness: 180, mass: 1 };

/** Stagger step for lists / sections. */
export const STAGGER = 60;
/** Cap so long lists don't wait forever. */
const STAGGER_MAX = 6;

/** Entering animation for item `i` of a staggered group; a plain quick fade with Reduce Motion. */
export function enterStagger(i: number, reduceMotion: boolean, base = 0) {
  if (reduceMotion) return FadeIn.duration(DURATION.fast);
  return FadeInDown.delay(base + Math.min(i, STAGGER_MAX) * STAGGER)
    .duration(DURATION.slow)
    .easing(EASE)
    .withInitialValues({ opacity: 0, transform: [{ translateY: 10 }] });
}

/** Simple fade used for swaps (e.g. placeholder → content). */
export function enterFade(reduceMotion: boolean, delay = 0) {
  return FadeIn.delay(reduceMotion ? 0 : delay).duration(reduceMotion ? DURATION.fast : DURATION.base);
}

export function exitFade() {
  return FadeOut.duration(DURATION.fast);
}
