import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { spacing } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';
import { useThemeColors } from '@/lib/theme-provider';

const HOLD_MS = 2000;
/** Keep the full ring on screen briefly so it reads as complete. */
const COMPLETE_PAUSE_MS = 150;
const DRAIN_MS = 250;

const SIZE = 80;
const STROKE = 4;
const RING = SIZE + STROKE * 2 + 6;
const R = (RING - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = { onConfirm: () => void };

export function EmergencyHoldButton({ onConfirm }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [holding, setHolding] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const progress = useSharedValue(0);
  const doneRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirmRef = useRef(onConfirm);
  useEffect(() => {
    confirmRef.current = onConfirm;
  }, [onConfirm]);

  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => alive && setReduceMotion(v));
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      alive = false;
      sub.remove();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const complete = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // Ring is at a full 360° now; hold it briefly, then run the exact same confirm.
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      confirmRef.current();
    }, COMPLETE_PAUSE_MS);
  };

  const confirmNow = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    confirmRef.current();
  };

  const start = () => {
    if (doneRef.current) return;
    setHolding(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    cancelAnimation(progress);
    // Ring and completion share one timer: completion fires only when progress hits 1.
    const remaining = HOLD_MS * (1 - progress.value);
    progress.value = withTiming(1, { duration: remaining, easing: Easing.linear }, (finished) => {
      if (finished) runOnJS(complete)();
    });
  };

  const release = () => {
    if (doneRef.current) return;
    setHolding(false);
    cancelAnimation(progress);
    progress.value = withTiming(0, { duration: DRAIN_MS, easing: Easing.out(Easing.quad) });
  };

  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRC * (1 - progress.value),
  }));

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: reduceMotion ? 1 : 1 - 0.04 * Math.min(1, progress.value * 4) }],
  }));

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="End early"
        accessibilityHint="Press and hold the button for two seconds. For emergencies only, this resets your streak. Or use the actions menu to end early now."
        accessibilityActions={[{ name: 'activate', label: 'End early' }, { name: 'longpress', label: 'End early' }]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'activate' || e.nativeEvent.actionName === 'longpress') {
            confirmNow();
          }
        }}
        onPressIn={start}
        onPressOut={release}
        hitSlop={8}
        style={styles.hit}
      >
        <Svg width={RING} height={RING} style={StyleSheet.absoluteFill}>
          <Circle
            cx={RING / 2}
            cy={RING / 2}
            r={R}
            stroke={colors.sessionHairline}
            strokeWidth={STROKE}
            fill="none"
          />
          <AnimatedCircle
            cx={RING / 2}
            cy={RING / 2}
            r={R}
            stroke={colors.sessionGlow}
            strokeWidth={STROKE}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${CIRC} ${CIRC}`}
            animatedProps={ringProps}
            transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
          />
        </Svg>
        <Animated.View style={[styles.btn, holding && styles.btnActive, pressStyle]}>
          <Text style={[styles.inner, holding && styles.innerActive]} numberOfLines={2}>
            {holding ? 'Keep\nholding' : 'Press\n& hold'}
          </Text>
        </Animated.View>
      </Pressable>
      <Text style={styles.label}>Press and hold to end early</Text>
      <Text style={styles.hint}>For emergencies · resets your streak</Text>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    wrap: { alignItems: 'center', gap: spacing.xs, width: '100%' },
    hit: {
      width: RING,
      height: RING,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xs,
    },
    btn: {
      width: SIZE,
      height: SIZE,
      borderRadius: SIZE / 2,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.sessionHairline,
      backgroundColor: colors.sessionChipBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnActive: { borderColor: colors.sessionGlow, backgroundColor: colors.sessionGlowSoft },
    inner: {
      color: colors.sessionTextMuted,
      fontWeight: '600',
      fontSize: 13,
      lineHeight: 16,
      textAlign: 'center',
    },
    innerActive: { color: colors.sessionText },
    label: { color: colors.sessionText, fontWeight: '500', fontSize: 14, letterSpacing: 0.2 },
    hint: { color: colors.sessionTextMuted, fontSize: 12, letterSpacing: 0.2 },
  });
}
