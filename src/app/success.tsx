import { useEffect, useMemo, useState } from 'react';
import { AppState, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  ZoomIn,
  type SharedValue,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedScene } from '@/components/onboarding/art/AnimatedScene';
import { artPalette } from '@/components/onboarding/art/art-palette';
import { sunriseLayout } from '@/components/onboarding/art/scene-layouts';
import { BadgeMedallion } from '@/components/profile/BadgeMedallion';
import { MedalSheen } from '@/components/MedalSheen';
import { ALL_BADGES } from '@/constants/badges';
import { radii } from '@/constants/theme';
import { hapticCelebrate, hapticSuccess } from '@/lib/haptics';
import { DURATION, EASE, SPRING_BOUNCY, enterStagger } from '@/lib/motion';
import { useReduceMotion } from '@/lib/use-reduce-motion';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrimaryButton } from '@/components/PrimaryButton';
import { spacing, typography } from '@/constants/theme';
import { useThemeColors } from '@/lib/theme-provider';
import type { ColorTokens } from '@/constants/themes';
import { dayKey, loadWakeIntentionsByDay } from '@/lib/storage';
import { fadeOutBacktrack, stopBacktrack } from '@/lib/audio';

export default function SuccessScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { streak, intention: intentionParam, prev, badges } = useLocalSearchParams<{
    streak?: string;
    intention?: string;
    /** Streak before this morning (from /session), so the tick-up shows only a real change. */
    prev?: string;
    /** Badge ids newly earned by this morning (comma list, from /session). */
    badges?: string;
  }>();
  const count = streak ? parseInt(streak, 10) : 0;
  const prevCount = prev != null ? parseInt(prev, 10) : NaN;
  const ticked = Number.isFinite(count) && Number.isFinite(prevCount) && count > prevCount;
  const newBadges = useMemo(() => {
    const ids = (badges ?? '').split(',').filter(Boolean);
    return ALL_BADGES.filter((b) => ids.includes(b.id)).slice(0, 3);
  }, [badges]);
  const reduce = useReduceMotion();
  const { width } = useWindowDimensions();
  const sceneW = width - spacing.lg * 2;
  const sceneH = Math.round(Math.min(newBadges.length ? 160 : 220, sceneW * 0.52));
  const layout = useMemo(() => sunriseLayout(sceneW, sceneH, artPalette(colors), { rings: true }), [sceneW, sceneH, colors]);

  // Haptics: a success tap as the screen lands, a fuller pattern when the streak ticks / badge lands.
  useEffect(() => {
    hapticSuccess();
    if (!ticked && newBadges.length === 0) return;
    const t = setTimeout(hapticCelebrate, newBadges.length ? 1250 : 700);
    return () => clearTimeout(t);
  }, [ticked, newBadges.length]);
  // This morning's intention (snapshotted when the morning completed); empty when none was set.
  // Passed from /session so it renders on first frame; storage is the fallback.
  const [intention, setIntention] = useState(() => intentionParam?.trim() ?? '');
  useEffect(() => {
    if (intentionParam?.trim()) return;
    let alive = true;
    void loadWakeIntentionsByDay().then((byDay) => {
      if (alive) setIntention(byDay[dayKey(0)]?.trim() ?? '');
    });
    return () => {
      alive = false;
    };
  }, [intentionParam]);

  // The meditation backtrack carries on here after the unlock; it fades out when the user
  // leaves this screen, taps to begin the day, or backgrounds the app.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') stopBacktrack();
    });
    return () => {
      sub.remove();
      fadeOutBacktrack();
    };
  }, []);

  const beginDay = () => {
    fadeOutBacktrack();
    router.replace('/');
  };

  return (
    <View
      style={[
        styles.screen,
        { backgroundColor: colors.bg, paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg },
      ]}
    >
      <Animated.View entering={enterStagger(0, reduce)} style={styles.scene}>
        <AnimatedScene layout={layout} reduceMotion={reduce} radius={radii.xl} />
      </Animated.View>
      <Animated.Text entering={enterStagger(1, reduce, 120)} style={[styles.kicker, { color: colors.textDim }]}>
        Morning complete
      </Animated.Text>
      <Animated.Text entering={enterStagger(2, reduce, 120)} style={[styles.title, { color: colors.text }]}>
        Morning unlocked
      </Animated.Text>
      <Animated.Text entering={enterStagger(3, reduce, 120)} style={[styles.body, { color: colors.textMuted }]}>
        You held still through the gate. Alarm off — the day can start quieter.
      </Animated.Text>
      {intention ? (
        <Animated.Text entering={enterStagger(4, reduce, 120)} style={styles.intention}>
          “{intention}”
        </Animated.Text>
      ) : null}
      <Animated.View entering={enterStagger(5, reduce, 120)} style={styles.streak}>
        <StreakTick count={count} prev={ticked ? prevCount : null} reduce={reduce} colors={colors} styles={styles} />
        <Text style={styles.streakLabel}>day streak</Text>
      </Animated.View>
      {newBadges.length ? (
        <View style={styles.badges} accessibilityRole="summary">
          {newBadges.map((b, i) => (
            <Animated.View
              key={b.id}
              entering={
                reduce
                  ? enterStagger(0, true)
                  : ZoomIn.delay(1000 + i * 140).springify().damping(SPRING_BOUNCY.damping ?? 11).stiffness(SPRING_BOUNCY.stiffness ?? 220)
              }
              style={styles.badge}
              accessible
              accessibilityLabel={`New milestone: ${b.label}`}
            >
              <MedalSheen size={60} play delay={1500 + i * 140} id={`sheen-success-${b.id}`}>
                <BadgeMedallion badge={b} earned size={60} colors={colors} idPrefix={`success-${b.id}`} />
              </MedalSheen>
              <Text style={styles.badgeKicker}>New milestone</Text>
              <Text style={styles.badgeLabel} numberOfLines={1}>
                {b.label}
              </Text>
            </Animated.View>
          ))}
        </View>
      ) : null}
      <PrimaryButton
        label="Begin your day"
        onPress={beginDay}
        style={styles.cta}
      />
    </View>
  );
}

const BURST = 12;

/**
 * Streak number with flame. When the streak really went up (prev given), the old number rolls
 * up and out, the new one springs in, the flame pops and a small spark burst fires once.
 * Reduce Motion / no change: the final number simply fades in with the block.
 */
function StreakTick({
  count,
  prev,
  reduce,
  colors,
  styles,
}: {
  count: number;
  prev: number | null;
  reduce: boolean;
  colors: ColorTokens;
  styles: ReturnType<typeof createStyles>;
}) {
  const animate = prev != null && !reduce;
  const roll = useSharedValue(animate ? 0 : 1);
  const flame = useSharedValue(animate ? 0 : 1);
  const burst = useSharedValue(0);

  useEffect(() => {
    if (!animate) return;
    roll.value = withDelay(620, withSpring(1, SPRING_BOUNCY));
    flame.value = withDelay(620, withSequence(withTiming(1.35, { duration: DURATION.fast, easing: EASE }), withSpring(1, SPRING_BOUNCY)));
    burst.value = withDelay(640, withTiming(1, { duration: DURATION.max + 240, easing: EASE }));
  }, [animate, roll, flame, burst]);

  const oldStyle = useAnimatedStyle(() => ({
    opacity: 1 - Math.min(1, roll.value * 1.6),
    transform: [{ translateY: -28 * roll.value }],
  }));
  const newStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, roll.value * 1.4),
    transform: [{ translateY: 28 * (1 - roll.value) }],
  }));
  const flameStyle = useAnimatedStyle(() => ({ transform: [{ scale: flame.value }] }));

  const shown = Number.isFinite(count) ? String(count) : '—';
  return (
    <View style={styles.tickRow} accessible accessibilityLabel={`${shown} day streak`}>
      <Animated.View style={flameStyle}>
        <Ionicons name="flame" size={30} color={colors.sunrise} />
      </Animated.View>
      <View style={styles.tickNum}>
        {animate
          ? Array.from({ length: BURST }, (_, i) => <Spark key={i} i={i} burst={burst} color={i % 2 ? colors.sunrise : colors.calm} />)
          : null}
        {animate ? (
          <Animated.Text style={[styles.streakNum, styles.tickAbs, oldStyle]}>{String(prev)}</Animated.Text>
        ) : null}
        <Animated.Text style={[styles.streakNum, newStyle]}>{shown}</Animated.Text>
      </View>
    </View>
  );
}

function Spark({ i, burst, color }: { i: number; burst: SharedValue<number>; color: string }) {
  const a = (i / BURST) * Math.PI * 2 + (i % 3) * 0.2;
  const dist = 46 + (i % 4) * 9;
  const style = useAnimatedStyle(() => {
    const v = burst.value;
    return {
      opacity: v <= 0 || v >= 1 ? 0 : 1 - v,
      transform: [{ translateX: Math.cos(a) * dist * v }, { translateY: Math.sin(a) * dist * v }, { scale: 1 - 0.6 * v }],
    };
  });
  return <Animated.View pointerEvents="none" style={[sparkBase.spark, { backgroundColor: color }, style]} />;
}

const sparkBase = StyleSheet.create({
  spark: { position: 'absolute', width: 6, height: 6, borderRadius: 3, alignSelf: 'center', top: '50%', marginTop: -3 },
});

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  kicker: {
    color: colors.calm,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontSize: 12,
  },
  title: { ...typography.title, color: colors.text, marginTop: spacing.sm },
  body: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 24,
    maxWidth: 320,
  },
  intention: {
    ...typography.body,
    fontStyle: 'italic',
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    maxWidth: 320,
  },
  scene: { marginBottom: spacing.lg, borderRadius: radii.xl, overflow: 'hidden' },
  streak: { marginTop: spacing.xl, alignItems: 'center' },
  tickRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  tickNum: { alignItems: 'center', justifyContent: 'center', minWidth: 60 },
  tickAbs: { position: 'absolute' },
  badges: { flexDirection: 'row', justifyContent: 'center', gap: spacing.lg, marginTop: spacing.lg },
  badge: { alignItems: 'center', width: 96 },
  badgeKicker: { ...typography.eyebrow, color: colors.calm, marginTop: spacing.xs, fontSize: 10 },
  badgeLabel: { ...typography.caption, color: colors.text, fontWeight: '600' },
  streakNum: { fontSize: 64, fontWeight: '200', color: colors.calm },
  streakLabel: { color: colors.textMuted },
  cta: { marginTop: 'auto', alignSelf: 'stretch' },
});
}
