import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { ProgressRing } from '@/components/ProgressRing';
import { BreathingOrb } from '@/components/session/BreathingOrb';
import { SessionPrompt } from '@/components/session/SessionPrompt';
import { SessionScene } from '@/components/session/SessionScene';
import { haloWarmth, PROMPT_ROTATE_MS, sessionCopy } from '@/components/session/session-copy';
import { spacing, typography } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';
import { useBreathingLight } from '@/lib/breathing-pref';
import { isDimHour } from '@/lib/gentle-brightness';
import { hapticSelect, hapticSoft } from '@/lib/haptics';
import { DURATION, EASE, EASE_IN_OUT, SPRING_BOUNCY } from '@/lib/motion';
import type { PoseStatus } from '@/lib/pose/types';
import type { SessionPhase } from '@/lib/session-machine';
import { useThemeColors } from '@/lib/theme-provider';
import { useReduceMotion } from '@/lib/use-reduce-motion';

type Props = {
  phase: SessionPhase;
  pose: PoseStatus;
  /** Confirm progress 0–1 while detecting (the 2.5 s hold). */
  confirmProgress: number;
  /** Meditation progress 0–1 (kept while paused, so we can say "your minutes are saved"). */
  sitProgress: number;
  /** mm:ss remaining while meditating. */
  timerLabel: string;
  /** "2 minutes" for the pre-lock note. */
  durationLabel: string;
  /** Whole seconds left while meditating (final-10 s warmth). */
  secondsLeft?: number;
  /**
   * The camera preview, rendered inside the soft circular window. Must stay mounted across
   * phases (same element position) so the camera never remounts; while meditating the scene
   * simply covers it and it keeps running for the checks.
   */
  camera: ReactNode;
  /** Selected meditation track (its cover becomes the full-screen scene). Null until loaded. */
  trackId: string | null;
  wakeIntention: string;
  /** Dev pose overlay on: keep the camera visible under a lighter scene. */
  debugOverlay?: boolean;
  /** Space kept clear at the top / bottom (status bar + readout, emergency button). */
  topInset: number;
  bottomInset: number;
};

const RING_STROKE = 2;
const RING_GAP = 14;
const COPY_H = 132;

/**
 * Session screen, two modes:
 *  • Getting in position (alarm ringing / 2.5 s hold): the camera stays clear inside a soft halo
 *    that warms as each check is met, one gentle prompt at a time, a thin arc for the hold.
 *  • Meditating: the selected track's scene fades up full-screen over the (still running)
 *    camera, a breathing light sits where the window was, a thin ring tracks the time (tap to
 *    see what's left), and the wake intention shows once.
 * All motion is transform/opacity on the UI thread; the scene is the only animated SVG.
 */
export function SessionChrome({
  phase,
  pose,
  confirmProgress,
  sitProgress,
  timerLabel,
  durationLabel,
  secondsLeft,
  camera,
  trackId,
  wakeIntention,
  debugOverlay,
  topInset,
  bottomInset,
}: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width, height } = useWindowDimensions();
  const reduce = useReduceMotion();
  const [breathing] = useBreathingLight();
  const [dim] = useState(() => isDimHour());

  const isDetect = phase === 'detecting';
  const isMeditate = phase === 'meditating';
  const immersed = isMeditate || phase === 'completed';
  const paused = phase === 'alarming' && sitProgress > 0.001;

  const windowSize = Math.round(Math.min(width - 104, 272));
  const ringSize = windowSize + 2 * (RING_STROKE + RING_GAP);
  const progress = immersed || paused ? sitProgress : isDetect ? confirmProgress : 0;

  // ── Prompt rotation while meditating ────────────────────────────────────────
  const [step, setStep] = useState(-1);
  const locks = useRef(0);
  useEffect(() => {
    if (!isMeditate) return;
    locks.current += 1;
    setStep(locks.current > 1 ? -2 : -1);
    const id = setInterval(() => setStep((s) => (s < 0 ? 0 : s + 1)), PROMPT_ROTATE_MS);
    return () => clearInterval(id);
  }, [isMeditate]);
  const copy = sessionCopy({ phase, pose, paused, durationLabel, meditatingStep: step });
  const prompt = copy.prompt;

  // ── Halo warmth (framing) ───────────────────────────────────────────────────
  const warmth = haloWarmth(phase, pose, confirmProgress);
  // Three crisp states instead of a glow: not yet → nearly → ready / holding.
  const readyColor = warmth >= 0.6 ? colors.sessionGlow : warmth >= 0.3 ? colors.sessionTextMuted : colors.sessionHairline;

  // ── Mode blend: 0 = getting in position, 1 = immersed ──────────────────────
  const mode = useSharedValue(immersed ? 1 : 0);
  useEffect(() => {
    mode.value = withTiming(immersed ? 1 : 0, { duration: immersed ? 1400 : 220, easing: immersed ? EASE_IN_OUT : EASE });
  }, [immersed, mode]);
  const orbStyle = useAnimatedStyle(() => ({ opacity: mode.value }));
  const rimStyle = useAnimatedStyle(() => ({ opacity: 1 - mode.value }));

  // Ring: hidden until there's something to show (hold, meditation, banked minutes).
  const ringOn = useSharedValue(0);
  const showRing = isDetect || immersed || paused;
  useEffect(() => {
    ringOn.value = withTiming(showRing ? 1 : 0, { duration: DURATION.slow, easing: EASE });
  }, [showRing, ringOn]);
  const ringStyle = useAnimatedStyle(() => ({ opacity: ringOn.value }));

  // ── Lock-in pulse, final-10 s warmth, completion bloom (kept from before) ───
  const lockPulse = useSharedValue(1);
  const bloom = useSharedValue(0);
  const finale = useSharedValue(0);
  const prevPhase = useRef(phase);
  useEffect(() => {
    const was = prevPhase.current;
    prevPhase.current = phase;
    if (phase === 'meditating' && was === 'detecting') {
      hapticSoft();
      if (!reduce) lockPulse.value = withSequence(withTiming(1.035, { duration: DURATION.fast, easing: EASE }), withSpring(1, SPRING_BOUNCY));
    }
    if (phase === 'completed' && was === 'meditating') {
      bloom.value = 0;
      bloom.value = withTiming(1, { duration: reduce ? DURATION.base : DURATION.max + 300, easing: EASE });
    }
  }, [phase, reduce, lockPulse, bloom]);
  const inFinale = isMeditate && secondsLeft != null && secondsLeft <= 10 && secondsLeft > 0;
  useEffect(() => {
    finale.value = withTiming(inFinale ? 1 : 0, { duration: 900, easing: Easing.inOut(Easing.cubic) });
  }, [inFinale, finale]);
  const lockStyle = useAnimatedStyle(() => ({ transform: [{ scale: lockPulse.value }] }));
  // Completion: one faint thin ring drifting outward (no filled disc over the window).
  const bloomStyle = useAnimatedStyle(() => ({
    opacity: bloom.value <= 0 ? 0 : 0.35 * (1 - bloom.value),
    transform: [{ scale: reduce ? 1 : 1 + 0.18 * bloom.value }],
  }));
  // Final 10 s: the ring just firms up a little (no glow spilling inward).
  const finaleStyle = useAnimatedStyle(() => ({ opacity: 0.45 * finale.value }));

  // ── Tap to reveal the time for a moment ─────────────────────────────────────
  const [reveal, setReveal] = useState(false);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onRevealTime = () => {
    if (!isMeditate) return;
    hapticSelect();
    setReveal(true);
    if (revealTimer.current) clearTimeout(revealTimer.current);
    revealTimer.current = setTimeout(() => setReveal(false), 2600);
  };
  useEffect(() => () => {
    if (revealTimer.current) clearTimeout(revealTimer.current);
  }, []);
  useEffect(() => {
    if (!isMeditate) setReveal(false);
  }, [isMeditate]);

  // ── Wake intention: once, softly, after the first lock-in ──────────────────
  const intentionShown = useRef(false);
  const intent = useSharedValue(0);
  useEffect(() => {
    if (!isMeditate || intentionShown.current || !wakeIntention.trim()) return;
    intentionShown.current = true;
    intent.value = withSequence(
      withDelay(1800, withTiming(1, { duration: 1200, easing: EASE_IN_OUT })),
      withDelay(6500, withTiming(0, { duration: 1600, easing: EASE_IN_OUT })),
    );
  }, [isMeditate, wakeIntention, intent]);
  useEffect(() => {
    if (!isMeditate) {
      cancelAnimation(intent);
      intent.value = withTiming(0, { duration: DURATION.base });
    }
  }, [isMeditate, intent]);
  const intentStyle = useAnimatedStyle(() => ({ opacity: intent.value }));

  // ── End veil: the instant the session ends, cover the (now stopping) camera so its last
  // frame never shows as a freeze while we navigate away. Fast fade, never reverses.
  const ending = phase === 'completed' || phase === 'emergency';
  const veil = useSharedValue(ending ? 1 : 0);
  useEffect(() => {
    if (ending) veil.value = withTiming(1, { duration: reduce ? 0 : 160, easing: EASE });
  }, [ending, reduce, veil]);
  const veilStyle = useAnimatedStyle(() => ({ opacity: veil.value }));

  const a11yLabel = isMeditate ? `${timerLabel} remaining` : isDetect ? 'Settling in' : 'Camera view';

  // Two identical flex columns (below and above the scene) keep the window and the ring/orb aligned.
  const column = [styles.column, { paddingTop: topInset, paddingBottom: bottomInset }];

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* ── Below the scene: the clear camera window (nothing drawn over the face) ── */}
      <View style={column} pointerEvents="none">
        <View style={{ width: ringSize, height: ringSize }}>
          <View
            style={[
              styles.window,
              { width: windowSize, height: windowSize, borderRadius: windowSize / 2, left: RING_STROKE + RING_GAP, top: RING_STROKE + RING_GAP },
            ]}
          >
            {camera}
            <Animated.View
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, { backgroundColor: colors.sessionBgMid }, veilStyle]}
            />
          </View>
        </View>
        <View style={{ height: COPY_H }} />
      </View>

      {/* ── The scene (meditating) ── */}
      {trackId ? (
        <SessionScene
          trackId={trackId}
          width={width}
          height={height}
          shown={immersed}
          maxOpacity={debugOverlay ? 0.55 : 1}
          dim={dim}
          colors={colors}
          reduceMotion={reduce}
        />
      ) : null}

      {/* ── Above the scene: rim, ring, breathing light, time, copy ── */}
      <View style={column} pointerEvents="box-none">
        <Animated.View style={[{ width: ringSize, height: ringSize }, lockStyle]}>
          <Pressable
            onPress={onRevealTime}
            disabled={!isMeditate}
            style={StyleSheet.absoluteFill}
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={a11yLabel}
            accessibilityHint={isMeditate ? 'Double-tap to show the time left' : undefined}
            accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
          >
            {/* Crisp edge on the window; its colour says how ready you are (outside the face). */}
            <Animated.View pointerEvents="none" style={[styles.center, rimStyle]}>
              <View
                style={{
                  width: windowSize + 3,
                  height: windowSize + 3,
                  borderRadius: (windowSize + 3) / 2,
                  borderWidth: 1.5,
                  borderColor: readyColor,
                }}
              />
            </Animated.View>

            {/* Breathing light, meditating only (the scene covers the camera then). */}
            {immersed ? (
            <Animated.View pointerEvents="none" style={[styles.center, orbStyle]}>
              <BreathingOrb
                size={Math.round(windowSize * 0.56)}
                color={colors.sessionGlow}
                core={colors.sessionText}
                breathing={breathing}
                playing={isMeditate}
                reduceMotion={reduce}
                finale={finale}
              />
            </Animated.View>
            ) : null}

            {/* Thin arc: the 2.5 s hold, then the meditation. */}
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, ringStyle]}>
              <ProgressRing size={ringSize} strokeWidth={RING_STROKE} progress={progress} color={colors.sessionGlow} trackColor={colors.sessionChipBg} />
            </Animated.View>
            <Animated.View
              pointerEvents="none"
              style={[styles.finaleRing, { width: ringSize, height: ringSize, borderRadius: ringSize / 2 }, finaleStyle]}
            />

            {/* Remaining time, for a moment, on tap. */}
            {reveal && isMeditate ? (
              <Animated.View
                pointerEvents="none"
                entering={FadeIn.duration(DURATION.base)}
                exiting={FadeOut.duration(DURATION.slow)}
                style={styles.center}
              >
                <Text style={styles.time}>{timerLabel}</Text>
                <Text style={styles.timeNote}>left</Text>
              </Animated.View>
            ) : null}

            <Animated.View
              pointerEvents="none"
              style={[styles.bloom, { width: ringSize, height: ringSize, borderRadius: ringSize / 2 }, bloomStyle]}
            />
          </Pressable>
        </Animated.View>

        <View style={styles.copy} pointerEvents="none">
          <SessionPrompt
            prompt={prompt}
            note={copy.note}
            promptStyle={styles.prompt}
            noteStyle={styles.note}
            height={COPY_H - 44}
          />
          <Animated.Text style={[styles.intention, intentStyle]} numberOfLines={2} accessibilityElementsHidden={!isMeditate}>
            {wakeIntention.trim() ? `\u201C${wakeIntention.trim()}\u201D` : ''}
          </Animated.Text>
        </View>
      </View>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    column: {
      ...StyleSheet.absoluteFill,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
      gap: spacing.lg,
    },
    window: {
      position: 'absolute',
      overflow: 'hidden',
      backgroundColor: colors.sessionBgTop,
    },
    center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
    finaleRing: {
      position: 'absolute',
      left: 0,
      top: 0,
      borderWidth: 1,
      borderColor: colors.sessionGlow,
    },
    bloom: { position: 'absolute', left: 0, top: 0, borderWidth: 1, borderColor: colors.sessionGlow },
    time: {
      fontSize: 34,
      fontWeight: '300',
      letterSpacing: 0.5,
      color: colors.sessionText,
      fontVariant: ['tabular-nums'],
      textShadowColor: colors.sessionBgTop,
      textShadowRadius: 14,
      textShadowOffset: { width: 0, height: 0 },
    },
    timeNote: { ...typography.caption, color: colors.sessionTextMuted, letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 2 },
    copy: { height: COPY_H, alignSelf: 'stretch', alignItems: 'center' },
    prompt: {
      fontSize: 24,
      fontWeight: '400',
      letterSpacing: 0.2,
      color: colors.sessionText,
      textAlign: 'center',
      textShadowColor: colors.sessionBgTop,
      textShadowRadius: 12,
      textShadowOffset: { width: 0, height: 0 },
    },
    note: { ...typography.caption, color: colors.sessionTextMuted, textAlign: 'center', letterSpacing: 0.3 },
    intention: {
      ...typography.body,
      fontStyle: 'italic',
      color: colors.sessionTextMuted,
      textAlign: 'center',
      paddingHorizontal: spacing.lg,
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
    },
  });
}
