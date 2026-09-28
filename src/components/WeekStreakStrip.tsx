import { memo, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { SPRING_BOUNCY } from '@/lib/motion';
import { useReduceMotion } from '@/lib/use-reduce-motion';
import { spacing } from '@/constants/theme';
import { dayKey, WEEKDAY_DISPLAY_ORDER, WEEKDAY_INITIAL, type Weekday } from '@/lib/storage';
import { useThemeColors } from '@/lib/theme-provider';
import type { ColorTokens } from '@/constants/themes';

type DayCell = {
  key: string;
  label: string;
  completed: boolean;
  isToday: boolean;
  scheduled: boolean;
};

/** Sunday-start week containing today (Sun–Sat strip); index i ↔ WEEKDAY_DISPLAY_ORDER[i]. */
export function weekDayKeys(today = new Date()): string[] {
  const sundayOffset = -today.getDay(); // 0=Sun … 6=Sat
  return Array.from({ length: 7 }, (_, i) => dayKey(sundayOffset + i, today));
}

type Props = {
  completedDays: readonly string[];
  scheduledWeekdays?: readonly Weekday[];
  todayKey?: string;
};

function WeekStreakStripBase({ completedDays, scheduledWeekdays, todayKey }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const today = todayKey ?? dayKey(0);
  const keys = weekDayKeys();
  const completed = new Set(completedDays);
  const scheduled = scheduledWeekdays ? new Set(scheduledWeekdays) : null;
  // After first paint, a day that turns completed (e.g. back from /success) springs its fill in.
  const reduce = useReduceMotion();
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
  }, []);
  const fillIn = mounted.current && !reduce ? ZoomIn.springify().damping(SPRING_BOUNCY.damping ?? 11).stiffness(SPRING_BOUNCY.stiffness ?? 220) : undefined;
  
  const cells: DayCell[] = keys.map((key, i) => {
    const isoWeekday: Weekday = WEEKDAY_DISPLAY_ORDER[i] ?? 7;
    return {
      key,
      label: WEEKDAY_INITIAL[isoWeekday],
      completed: completed.has(key),
      isToday: key === today,
      scheduled: scheduled === null || scheduled.has(isoWeekday),
    };
  });

  return (
    <View style={styles.row} accessibilityRole="summary" accessibilityLabel="This week's mornings">
      {cells.map((cell) => (
        <View key={cell.key} style={styles.col}>
          <View
            style={[
              styles.dot,
              !cell.scheduled && styles.dotOff,
              cell.completed && styles.dotDone,
              cell.isToday && styles.dotToday,
            ]}
          >
            {cell.completed ? (
              <Animated.View entering={fillIn} style={[styles.fill, cell.isToday && styles.fillToday]}>
                <Text style={styles.check}>✓</Text>
              </Animated.View>
            ) : null}
          </View>
          <Text style={[
            styles.label, 
            !cell.scheduled && styles.labelOff,
            cell.isToday && styles.labelToday
          ]}>
            {cell.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const DOT = 28;

export const WeekStreakStrip = memo(WeekStreakStripBase);

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.xs,
    },
    col: {
      alignItems: 'center',
      gap: spacing.xs,
      flex: 1,
    },
    dot: {
      width: DOT,
      height: DOT,
      borderRadius: DOT / 2,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
    },
    dotOff: {
      borderStyle: 'dashed',
      borderColor: colors.border,
      opacity: 0.4,
    },
    dotFilled: {
      backgroundColor: colors.calm,
      borderColor: colors.calm,
      borderStyle: 'solid',
      opacity: 1,
    },
    // Fill is its own layer so it can spring in; the ring keeps the outline.
    dotDone: { borderColor: colors.calm, borderStyle: 'solid', opacity: 1 },
    fill: {
      ...StyleSheet.absoluteFill,
      margin: -1.5,
      borderRadius: DOT / 2,
      backgroundColor: colors.calm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fillToday: { margin: 1 },
    dotToday: {
      borderColor: colors.text,
      borderWidth: 2,
    },
    check: {
      color: colors.bg,
      fontSize: 14,
      fontWeight: '700',
      marginTop: -1,
    },
    label: {
      color: colors.textDim,
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 0.4,
    },
    labelOff: {
      opacity: 0.4,
    },
    labelToday: {
      color: colors.textMuted,
    },
  });
}
