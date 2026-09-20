import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '@/constants/theme';
import { dayKey, isoWeekday, type AlarmWeekday } from '@/lib/storage';

type DayCell = {
  key: string;
  label: string;
  completed: boolean;
  isToday: boolean;
  isScheduled: boolean;
};

/** Monday-start week containing today (Calm-style Mon–Sun strip). */
export function weekDayKeys(today = new Date()): string[] {
  const dow = today.getDay(); // 0=Sun … 6=Sat
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  return Array.from({ length: 7 }, (_, i) => dayKey(mondayOffset + i, today));
}

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

type Props = {
  completedDays: readonly string[];
  scheduledWeekdays?: readonly AlarmWeekday[];
  /** Optional: override "today" for tests */
  todayKey?: string;
};

export function WeekStreakStrip({ completedDays, scheduledWeekdays, todayKey }: Props) {
  const today = todayKey ?? dayKey(0);
  const keys = weekDayKeys();
  const completed = new Set(completedDays);
  
  const cells: DayCell[] = keys.map((key, i) => {
    const d = new Date(key);
    const iso = isoWeekday(d);
    const isScheduled = !scheduledWeekdays || scheduledWeekdays.includes(iso);
    
    return {
      key,
      label: DAY_LABELS[i],
      completed: completed.has(key),
      isToday: key === today,
      isScheduled,
    };
  });

  return (
    <View style={styles.row} accessibilityRole="summary" accessibilityLabel="Week sit streak">
      {cells.map((cell) => (
        <View key={cell.key} style={styles.col}>
          <View
            style={[
              styles.dot,
              !cell.isScheduled && styles.dotOff,
              cell.completed && styles.dotFilled,
              cell.isToday && styles.dotToday,
            ]}
          >
            {cell.completed ? <Text style={styles.check}>✓</Text> : null}
          </View>
          <Text
            style={[
              styles.label,
              cell.isToday && styles.labelToday,
              !cell.isScheduled && styles.labelOff,
            ]}
          >
            {cell.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const DOT = 28;

const styles = StyleSheet.create({
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
    borderColor: colors.textDim,
    opacity: 0.4,
  },
  dotFilled: {
    backgroundColor: colors.calm,
    borderColor: colors.calm,
  },
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
