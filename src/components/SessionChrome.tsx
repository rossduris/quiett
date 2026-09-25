import { useEffect, useMemo, type ReactNode } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { LockInAura } from '@/components/LockInAura';
import { ProgressRing } from '@/components/ProgressRing';
import { spacing, typography } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';
import type { SessionPhase } from '@/lib/session-machine';
import { useThemeColors } from '@/lib/theme-provider';

type Props = {
  phase: SessionPhase;
  /** Confirm progress 0–1 while detecting */
  confirmProgress: number;
  /** Meditation progress 0–1 (kept while paused, so we can say "your minutes are saved") */
  sitProgress: number;
  /** mm:ss while meditating; friendly duration ("2 minutes") otherwise */
  timerLabel: string;
  /**
   * The camera preview, rendered inside the soft circular window.
   * Must stay mounted across phases (same element position) so the camera never remounts.
   */
  camera: ReactNode;
};

/** Ring stroke + breathing room between the window and the ring. */
const RING_STROKE = 4;
const RING_GAP = 10;

/** Aura brightness per phase: faint ember while settling, full glow once locked in. */
const AURA_LEVEL: Record<SessionPhase, number> = {
  alarming: 0,
  detecting: 0.3,
  meditating: 1,
  completed: 1,
  emergency: 0,
};

/** Warm veil over the camera per phase (0 = clear, 1 = dreamy/tinted while meditating). */
const VEIL_TONE: Record<SessionPhase, number> = {
  alarming: 0,
  detecting: 0.25,
  meditating: 1,
  completed: 1,
  emergency: 0,
};

function copyFor(
  phase: SessionPhase,
  paused: boolean,
  timerLabel: string,
): { headline: string; hint: string; meta?: string } {
  switch (phase) {
    case 'alarming':
      return paused
        ? {
            headline: 'Come back to the frame',
            hint: 'Your minutes are saved. Settle in to pick up where you left off.',
          }
        : {
            headline: 'Find your place in the frame',
            hint: 'Prop your phone at eye level and look toward it.',
            meta: `Then ${timerLabel} of quiet`,
          };
    case 'detecting':
      return {
        headline: 'Settle in… stay still',
        hint: 'Almost there. The alarm will fade.',
      };
    case 'meditating':
      return {
        headline: 'You\u2019re in. Breathe.',
        hint: 'Stay with it until the circle fills.',
      };
    default:
      return { headline: '', hint: '' };
  }
}

export function SessionChrome({ phase, confirmProgress, sitProgress, timerLabel, camera }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width } = useWindowDimensions();

  const isDetect = phase === 'detecting';
  const isMeditate = phase === 'meditating';
  const paused = phase === 'alarming' && sitProgress > 0.001;
  const copy = copyFor(phase, paused, timerLabel);

  const windowSize = Math.round(Math.min(width - 104, 272));
  const ringSize = windowSize + 2 * (RING_STROKE + RING_GAP);
  const progress = isMeditate ? sitProgress : isDetect ? confirmProgress : 0;

  const veil = useSharedValue(VEIL_TONE[phase]);
  useEffect(() => {
    veil.value = withTiming(VEIL_TONE[phase], {
      duration: 900,
      easing: Easing.inOut(Easing.cubic),
    });
  }, [phase, veil]);

  // Dusk veil darkens the preview a touch so the timer reads; peach wash warms it.
  const duskVeilStyle = useAnimatedStyle(() => ({ opacity: 0.1 + 0.4 * veil.value }));
  const peachVeilStyle = useAnimatedStyle(() => ({ opacity: 0.06 + 0.2 * veil.value }));
  const timerStyle = useAnimatedStyle(() => ({ opacity: veil.value }));

  return (
    <View style={styles.root}>
      <View
        style={{ width: ringSize, height: ringSize }}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={
          isMeditate ? `${timerLabel} remaining` : isDetect ? 'Settling in' : 'Camera view'
        }
        accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
      >
        <LockInAura size={windowSize} level={AURA_LEVEL[phase]} color={colors.sessionGlow} />

        {/* Soft circular camera window */}
        <View
          style={[
            styles.window,
            {
              width: windowSize,
              height: windowSize,
              borderRadius: windowSize / 2,
              left: RING_STROKE + RING_GAP,
              top: RING_STROKE + RING_GAP,
            },
          ]}
        >
          {camera}
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, styles.duskVeil, duskVeilStyle]}
          />
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, styles.peachVeil, peachVeilStyle]}
          />
          {/* Feathered edge: fades the preview into the dusk so it never reads as a hard feed. */}
          <Svg
            pointerEvents="none"
            width={windowSize}
            height={windowSize}
            style={StyleSheet.absoluteFill}
          >
            <Defs>
              <RadialGradient id="quiettWindowVignette" cx="50%" cy="50%" r="50%">
                <Stop offset={0} stopColor={colors.sessionBgMid} stopOpacity={0} />
                <Stop offset={0.6} stopColor={colors.sessionBgMid} stopOpacity={0} />
                <Stop offset={0.86} stopColor={colors.sessionBgMid} stopOpacity={0.45} />
                <Stop offset={1} stopColor={colors.sessionBgMid} stopOpacity={0.92} />
              </RadialGradient>
            </Defs>
            <Circle
              cx={windowSize / 2}
              cy={windowSize / 2}
              r={windowSize / 2}
              fill="url(#quiettWindowVignette)"
            />
          </Svg>
          <Animated.View pointerEvents="none" style={[styles.timerWrap, timerStyle]}>
            {isMeditate ? <Text style={styles.timer}>{timerLabel}</Text> : null}
          </Animated.View>
        </View>

        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <ProgressRing
            size={ringSize}
            strokeWidth={RING_STROKE}
            progress={progress}
            color={colors.sessionGlow}
            trackColor={colors.sessionHairline}
          />
        </View>
      </View>

      <View style={styles.copy} accessibilityLiveRegion="polite">
        <Text style={styles.headline}>{copy.headline}</Text>
        <Text style={styles.hint}>{copy.hint}</Text>
        {copy.meta ? <Text style={styles.meta}>{copy.meta}</Text> : null}
      </View>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    root: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.lg,
    },
    window: {
      position: 'absolute',
      overflow: 'hidden',
      backgroundColor: colors.sessionBgTop,
    },
    duskVeil: { backgroundColor: colors.sessionBgTop },
    peachVeil: { backgroundColor: colors.sessionGlow },
    timerWrap: {
      ...StyleSheet.absoluteFill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    timer: {
      ...typography.hero,
      color: colors.sessionText,
      fontVariant: ['tabular-nums'],
      textShadowColor: colors.sessionBgTop,
      textShadowRadius: 18,
      textShadowOffset: { width: 0, height: 0 },
    },
    copy: {
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      minHeight: 96,
    },
    headline: {
      ...typography.verb,
      fontWeight: '500',
      color: colors.sessionText,
      textAlign: 'center',
    },
    hint: {
      ...typography.body,
      color: colors.sessionTextMuted,
      textAlign: 'center',
      lineHeight: 22,
    },
    meta: {
      ...typography.caption,
      color: colors.sessionTextMuted,
      opacity: 0.8,
      marginTop: spacing.xs,
      letterSpacing: 0.3,
    },
  });
}
