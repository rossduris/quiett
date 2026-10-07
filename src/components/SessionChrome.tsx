import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
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
import { useStableGuidance } from '@/components/session/use-stable-copy';
import { spacing, typography } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';
import { useBreathingLight } from '@/lib/breathing-pref';
import { isDimHour } from '@/lib/gentle-brightness';
import { hapticSoft } from '@/lib/haptics';
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
   * The camera preview. Must stay mounted across phases (same element) so the camera never
   * remounts; while meditating the scene covers it and it keeps running for the checks.
   * It is a wide rounded frame, never a face-sized circle.
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

/** Session time ring after the scene covers the camera. Was 2px and easy to miss. */
const RING_STROKE = 8;
const COPY_H = 132;
/** Rounded rect, not a circle. A face-sized circle made people lean in. */
const FRAME_RADIUS = 28;

/**
 * Session screen, two modes:
 *  • Getting in position: a wide camera frame (head and shoulders), one title and one hint.
 *  • Meditating: the selected track's scene fades up full-screen over the (still running)
 *    camera, a breathing light and a thin ring track the time (tap to see what's left).
 * The guidance line is replaced in place, and only after a new reason has stayed put.
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
  const { width } = useWindowDimensions();
  const reduce = useReduceMotion();
  const [breathing] = useBreathingLight();
  const [dim] = useState(() => isDimHour());

  const isDetect = phase === 'detecting';
  const isMeditate = phase === 'meditating';
  const immersed = isMeditate || phase === 'completed';
  const paused = phase === 'alarming' && sitProgress > 0.001;

  const medallion = Math.round(Math.min(width * 0.62, 280));
  const progress = immersed || paused ? sitProgress : isDetect ? confirmProgress : 0;
  const [frame, setFrame] = useState({ w: width, h: 0 });
  const copyBlock = COPY_H;
  const frameGap = spacing.md;

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
  const rawCopy = sessionCopy({ phase, pose, paused, durationLabel, meditatingStep: step });
  // A flickering reason waits. Phase changes (the hold, the quiet) replace the line at once.
  const held = useStableGuidance(rawCopy, pose, phase !== 'alarming');
  const copy = held.copy;
  const shownPose = held.pose;

  // ── Halo warmth (framing) ───────────────────────────────────────────────────
  const warmth = haloWarmth(phase, shownPose, confirmProgress);
  const readyColor = warmth >= 0.6 ? colors.sessionGlow : warmth >= 0.3 ? colors.sessionTextMuted : colors.sessionHairline;

  // ── Mode blend: 0 = getting in position, 1 = immersed ──────────────────────
  const mode = useSharedValue(immersed ? 1 : 0);
  useEffect(() => {
    mode.value = withTiming(immersed ? 1 : 0, { duration: immersed ? 1400 : 220, easing: immersed ? EASE_IN_OUT : EASE });
  }, [immersed, mode]);
  const orbStyle = useAnimatedStyle(() => ({ opacity: mode.value }));

  // The camera should arrive, not pop in unfinished. Opacity only, so the frame never scales into a circle.
  const arrive = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    arrive.value = withTiming(1, { duration: reduce ? 0 : 700, easing: EASE });
  }, [arrive, reduce]);
  const arriveVeil = useAnimatedStyle(() => ({ opacity: 1 - arrive.value }));
  const frameEdge = useAnimatedStyle(() => ({ opacity: (1 - mode.value) * arrive.value }));

  // Ring: hidden until there's something to show (hold, meditation, banked minutes).
  const ringOn = useSharedValue(0);
  const showRing = isDetect || immersed || paused;
  useEffect(() => {
    ringOn.value = withTiming(showRing ? 1 : 0, { duration: DURATION.slow, easing: EASE });
  }, [showRing, ringOn]);
  const ringStyle = useAnimatedStyle(() => ({ opacity: ringOn.value }));

  // ── Lock-in pulse, final-10 s warmth, completion bloom ─────────────────────
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
  const bloomStyle = useAnimatedStyle(() => ({
    opacity: bloom.value <= 0 ? 0 : 0.35 * (1 - bloom.value),
    transform: [{ scale: reduce ? 1 : 1 + 0.18 * bloom.value }],
  }));
  const finaleStyle = useAnimatedStyle(() => ({ opacity: 0.45 * finale.value }));

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
      intent.set(withTiming(0, { duration: DURATION.base }));
    }
  }, [isMeditate, intent]);
  const intentStyle = useAnimatedStyle(() => ({ opacity: intent.value }));

  const ending = phase === 'completed' || phase === 'emergency';
  const veil = useSharedValue(ending ? 1 : 0);
  useEffect(() => {
    if (ending) veil.value = withTiming(1, { duration: reduce ? 0 : 160, easing: EASE });
  }, [ending, reduce, veil]);
  const veilStyle = useAnimatedStyle(() => ({ opacity: veil.value }));

  const a11yLabel = isMeditate ? `${timerLabel} remaining` : isDetect ? 'Settling in' : 'Camera view';
  const frameBottom = bottomInset + copyBlock + frameGap;

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="box-none"
      onLayout={(e) => {
        const w = Math.round(e.nativeEvent.layout.width);
        const h = Math.round(e.nativeEvent.layout.height);
        setFrame((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
      }}
    >
      {/* Wide camera: head and shoulders, with a calm edge. Not a face target. */}
      <Animated.View pointerEvents="none" style={[styles.frame, { top: topInset, bottom: frameBottom }]}>
        {camera}
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.sessionBgTop }, arriveVeil]} />
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.sessionBgMid }, veilStyle]} />
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[styles.frameEdge, { top: topInset, bottom: frameBottom, borderColor: readyColor }, frameEdge]}
      />

      {trackId && frame.h > 0 ? (
        <SessionScene
          trackId={trackId}
          width={frame.w}
          height={frame.h}
          shown={immersed}
          maxOpacity={debugOverlay ? 0.55 : 1}
          dim={dim}
          colors={colors}
          reduceMotion={reduce}
        />
      ) : null}

      {/* Breathing light and time, only after the scene covers the camera. */}
      <View style={styles.medallionLayer} pointerEvents="box-none">
        {immersed ? (
          <Animated.View style={[{ width: medallion, height: medallion }, lockStyle]}>
            <View
              style={StyleSheet.absoluteFill}
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel={a11yLabel}
              accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
            >
              <Animated.View pointerEvents="none" style={[styles.center, orbStyle]}>
                <BreathingOrb
                  size={Math.round(medallion * 0.46)}
                  color={colors.sessionGlow}
                  core={colors.sessionText}
                  breathing={breathing}
                  playing={isMeditate}
                  reduceMotion={reduce}
                  finale={finale}
                />
              </Animated.View>
              <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, ringStyle]}>
                <ProgressRing size={medallion} strokeWidth={RING_STROKE} progress={progress} color={colors.sessionGlow} trackColor={colors.sessionChipBg} />
              </Animated.View>
              <Animated.View
                pointerEvents="none"
                style={[styles.finaleRing, { width: medallion, height: medallion, borderRadius: medallion / 2 }, finaleStyle]}
              />
              {isMeditate ? (
                <Animated.View
                  pointerEvents="none"
                  entering={reduce ? undefined : FadeIn.duration(DURATION.base)}
                  exiting={reduce ? undefined : FadeOut.duration(DURATION.slow)}
                  style={styles.center}
                >
                  <Text style={styles.time} maxFontSizeMultiplier={1.3}>{timerLabel}</Text>
                  <Text style={styles.timeNote} maxFontSizeMultiplier={1.3}>left</Text>
                </Animated.View>
              ) : null}
              <Animated.View
                pointerEvents="none"
                style={[styles.bloom, { width: medallion, height: medallion, borderRadius: medallion / 2 }, bloomStyle]}
              />
            </View>
          </Animated.View>
        ) : null}
      </View>

      <View style={[styles.copy, { bottom: bottomInset, height: copyBlock }]} pointerEvents="none">
        <SessionPrompt prompt={copy.prompt} note={copy.note} promptStyle={styles.prompt} noteStyle={styles.note} />
        <Animated.Text style={[styles.intention, intentStyle]} numberOfLines={2} accessibilityElementsHidden={!isMeditate}>
          {wakeIntention.trim() ? `\u201C${wakeIntention.trim()}\u201D` : ''}
        </Animated.Text>
      </View>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    frame: {
      position: 'absolute',
      left: spacing.lg,
      right: spacing.lg,
      borderRadius: FRAME_RADIUS,
      overflow: 'hidden',
      backgroundColor: colors.sessionBgTop,
    },
    frameEdge: {
      position: 'absolute',
      left: spacing.lg,
      right: spacing.lg,
      borderRadius: FRAME_RADIUS,
      borderWidth: 1.5,
    },
    medallionLayer: {
      ...StyleSheet.absoluteFill,
      alignItems: 'center',
      justifyContent: 'center',
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
    copy: {
      position: 'absolute',
      left: 0,
      right: 0,
      paddingHorizontal: spacing.lg,
      alignItems: 'center',
    },
    prompt: {
      fontSize: 24,
      lineHeight: 30,
      fontWeight: '400',
      letterSpacing: 0.2,
      color: colors.sessionText,
      textAlign: 'center',
    },
    note: { ...typography.caption, color: colors.sessionTextMuted, textAlign: 'center', letterSpacing: 0.3, lineHeight: 18 },
    intention: {
      ...typography.body,
      fontStyle: 'italic',
      color: colors.sessionTextMuted,
      textAlign: 'center',
      paddingHorizontal: spacing.lg,
      marginTop: spacing.sm,
    },
  });
}
