import { memo, useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import { radii, spacing, typography } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';
import { SNOOZE_CHART_COPY as COPY } from '@/constants/onboarding';
import { useThemeColors } from '@/lib/theme-provider';
import { snoozeChartGeometry } from './art/snooze-chart-geometry';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const DRAW_MS = 1600;
const QUIETT_DELAY_MS = 250;
const ease = Easing.inOut(Easing.cubic);

type Props = { width: number; height?: number; reduceMotion: boolean };

/**
 * "Time lost to snoozing": two illustrative curves that draw on (stroke-dashoffset) with
 * reanimated. Paths are static; only dash offset, opacity and scale animate on the UI thread.
 * Reduce Motion shows the finished chart immediately.
 */
export const SnoozeChart = memo(function SnoozeChart({ width, height = 176, reduceMotion }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const chartW = width - spacing.md * 2;
  const g = useMemo(() => snoozeChartGeometry(chartW, height), [chartW, height]);
  const regularColor = colors.warning;
  const quiettColor = colors.calm;

  const regDraw = useSharedValue(reduceMotion ? 1 : 0);
  const qtDraw = useSharedValue(reduceMotion ? 1 : 0);
  const fills = useSharedValue(reduceMotion ? 1 : 0);
  const regDot = useSharedValue(reduceMotion ? 1 : 0);
  const qtDot = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) {
      regDraw.value = 1;
      qtDraw.value = 1;
      fills.value = 1;
      regDot.value = 1;
      qtDot.value = 1;
      return;
    }
    regDraw.value = 0;
    qtDraw.value = 0;
    fills.value = 0;
    regDot.value = 0;
    qtDot.value = 0;
    regDraw.value = withDelay(200, withTiming(1, { duration: DRAW_MS, easing: ease }));
    qtDraw.value = withDelay(200 + QUIETT_DELAY_MS, withTiming(1, { duration: DRAW_MS, easing: ease }));
    fills.value = withDelay(200 + DRAW_MS * 0.6, withTiming(1, { duration: 700 }));
    regDot.value = withDelay(200 + DRAW_MS, withSpring(1, { damping: 11, stiffness: 180 }));
    qtDot.value = withDelay(200 + QUIETT_DELAY_MS + DRAW_MS, withSpring(1, { damping: 11, stiffness: 180 }));
  }, [reduceMotion, regDraw, qtDraw, fills, regDot, qtDot]);

  const regProps = useAnimatedProps(() => ({ strokeDashoffset: g.regularLength * (1 - regDraw.value) }));
  const qtProps = useAnimatedProps(() => ({ strokeDashoffset: g.quiettLength * (1 - qtDraw.value) }));
  const fillStyle = useAnimatedStyle(() => ({ opacity: fills.value }));

  const a11y = `${COPY.cardTitle}, illustration. ${COPY.regularLabel}: time lost to snoozing dips, then climbs back up by ${COPY.endLabel}. ${COPY.quiettLabel}: it falls to zero.`;

  return (
    <View style={[styles.card, { width }]} accessible accessibilityRole="image" accessibilityLabel={a11y}>
      <Text style={styles.cardTitle}>{COPY.cardTitle}</Text>
      <View style={{ width: chartW, height }}>
        {/* Guides (static) */}
        <Svg width={chartW} height={height} style={StyleSheet.absoluteFill}>
          {g.guidesY.map((y, i) => (
            <Line key={`gy${i}`} x1={g.box.padX} x2={chartW - g.box.padX} y1={y} y2={y} stroke={colors.border} strokeWidth={1} strokeDasharray={i === 2 ? undefined : '4 5'} />
          ))}
          {g.guidesX.map((x, i) => (
            <Line key={`gx${i}`} x1={x} x2={x} y1={g.guidesY[0]} y2={g.baselineY} stroke={colors.border} strokeWidth={1} strokeDasharray="4 5" />
          ))}
        </Svg>
        {/* Soft fills fade in once the lines are mostly drawn */}
        <Animated.View style={[StyleSheet.absoluteFill, fillStyle]}>
          <Svg width={chartW} height={height}>
            <Defs>
              <LinearGradient id="snz-reg-fill" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={regularColor} stopOpacity={0} />
                <Stop offset="1" stopColor={regularColor} stopOpacity={0.22} />
              </LinearGradient>
              <LinearGradient id="snz-qt-fill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={quiettColor} stopOpacity={0.26} />
                <Stop offset="1" stopColor={quiettColor} stopOpacity={0.02} />
              </LinearGradient>
            </Defs>
            <Path d={g.regularFillPath} fill="url(#snz-reg-fill)" />
            <Path d={g.quiettFillPath} fill="url(#snz-qt-fill)" />
          </Svg>
        </Animated.View>
        {/* Lines draw on */}
        <Svg width={chartW} height={height} style={StyleSheet.absoluteFill}>
          <AnimatedPath
            d={g.regularPath}
            stroke={regularColor}
            strokeWidth={3}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${g.regularLength} ${g.regularLength}`}
            animatedProps={regProps}
          />
          <AnimatedPath
            d={g.quiettPath}
            stroke={quiettColor}
            strokeWidth={3.5}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${g.quiettLength} ${g.quiettLength}`}
            animatedProps={qtProps}
          />
        </Svg>
        <EndPoint x={g.regularEnd.x} y={g.regularEnd.y} color={regularColor} ring={colors.bgCard} progress={regDot} />
        <EndPoint x={g.quiettEnd.x} y={g.quiettEnd.y} color={quiettColor} ring={colors.bgCard} progress={qtDot} />
        <LineLabel
          text={COPY.regularLabel}
          color={regularColor}
          bg={colors.bgElevated}
          right={spacing.lg}
          top={Math.max(0, g.regularEnd.y - 34)}
          progress={regDot}
          styles={styles}
        />
        <LineLabel
          text={COPY.quiettLabel}
          color={quiettColor}
          bg={colors.bgElevated}
          right={spacing.lg}
          top={g.quiettEnd.y - 32}
          progress={qtDot}
          styles={styles}
        />
      </View>
      <View style={styles.axis}>
        <Text style={styles.axisLabel}>{COPY.startLabel}</Text>
        <Text style={styles.axisLabel}>{COPY.endLabel}</Text>
      </View>
    </View>
  );
});

const DOT = 12;

function EndPoint({ x, y, color, ring, progress }: { x: number; y: number; color: string; ring: string; progress: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({ opacity: Math.min(1, progress.value * 2), transform: [{ scale: progress.value }] }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: 'absolute', left: x - DOT / 2, top: y - DOT / 2, width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: color, borderWidth: 2, borderColor: ring },
        style,
      ]}
    />
  );
}

function LineLabel({
  text,
  color,
  bg,
  right,
  top,
  progress,
  styles,
}: {
  text: string;
  color: string;
  bg: string;
  right: number;
  top: number;
  progress: SharedValue<number>;
  styles: ReturnType<typeof createStyles>;
}) {
  const style = useAnimatedStyle(() => ({ opacity: Math.min(1, progress.value), transform: [{ translateY: (1 - Math.min(1, progress.value)) * 6 }] }));
  return (
    <Animated.View pointerEvents="none" style={[styles.lineLabel, { right, top, backgroundColor: bg, borderColor: color }, style]}>
      <Text style={[styles.lineLabelText, { color }]}>{text}</Text>
    </Animated.View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    card: {
      alignSelf: 'center',
      backgroundColor: colors.bgCard,
      borderRadius: radii.xl,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm + 4,
      gap: spacing.xs,
    },
    cardTitle: { ...typography.subtitle, color: colors.text, fontWeight: '700' },
    axis: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
    axisLabel: { ...typography.caption, color: colors.textDim, fontWeight: '600' },
    lineLabel: {
      position: 'absolute',
      borderRadius: radii.full,
      borderWidth: 1,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
    },
    lineLabelText: { ...typography.caption, fontSize: 12, fontWeight: '700' },
  });
}
