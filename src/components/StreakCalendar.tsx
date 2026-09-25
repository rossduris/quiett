import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radii, spacing } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';
import { useThemeColors } from '@/lib/theme-provider';
import { type Weekday } from '@/lib/storage';
import {
  buildMonthGrid,
  isCurrentMonth,
  shiftMonth,
  type CalendarCell,
} from '@/lib/streak-calendar';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

type Props = {
  completedDays: readonly string[];
  scheduledWeekdays: readonly Weekday[];
  year: number;
  month: number;
  onChangeMonth: (next: { year: number; month: number }) => void;
};

type Styles = ReturnType<typeof createStyles>;

function CellView({ cell, styles }: { cell: CalendarCell; styles: Styles }) {
  return (
    <View
      style={[
        styles.cell,
        !cell.scheduled && styles.cellOff,
        cell.completed && styles.cellFilled,
        cell.missed && styles.cellMissed,
        cell.isToday && styles.cellToday,
      ]}
      accessibilityLabel={`${cell.key}${cell.completed ? ', unlocked' : cell.missed ? ', missed' : cell.scheduled ? '' : ', off'}`}
    >
      {cell.completed ? (
        <Text style={styles.check}>✓</Text>
      ) : (
        <Text
          style={[
            styles.dayNum,
            !cell.scheduled && styles.dayNumOff,
            cell.isFuture && styles.dayNumFuture,
            cell.missed && styles.dayNumMissed,
            cell.isToday && styles.dayNumToday,
          ]}
        >
          {cell.day}
        </Text>
      )}
    </View>
  );
}

export function StreakCalendar({
  completedDays,
  scheduledWeekdays,
  year,
  month,
  onChangeMonth,
}: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const grid = buildMonthGrid(year, month, completedDays, scheduledWeekdays);
  const canGoForward = !isCurrentMonth(year, month);
  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);

  const padded: (CalendarCell | null)[] = [
    ...Array.from({ length: grid.leadingBlanks }, () => null),
    ...grid.cells,
  ];
  while (padded.length % 7 !== 0) padded.push(null);

  const weeks: (CalendarCell | null)[][] = [];
  for (let i = 0; i < padded.length; i += 7) {
    weeks.push(padded.slice(i, i + 7));
  }

  return (
    <View
      style={styles.wrap}
      accessibilityRole="summary"
      accessibilityLabel={`${grid.title} streak calendar`}
    >
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          onPress={() => onChangeMonth(prev)}
          hitSlop={10}
          style={({ pressed }) => [styles.navBtn, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back" size={18} color={colors.textMuted} />
        </Pressable>
        <Text style={styles.title}>{grid.title}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next month"
          disabled={!canGoForward}
          onPress={() => {
            if (canGoForward) onChangeMonth(next);
          }}
          hitSlop={10}
          style={({ pressed }) => [
            styles.navBtn,
            !canGoForward && styles.navDisabled,
            pressed && canGoForward && styles.pressed,
          ]}
        >
          <Ionicons
            name="chevron-forward"
            size={18}
            color={canGoForward ? colors.textMuted : colors.border}
          />
        </Pressable>
      </View>

      <View style={styles.dowRow}>
        {DAY_LABELS.map((label, i) => (
          <Text key={`${label}-${i}`} style={styles.dow}>
            {label}
          </Text>
        ))}
      </View>

      {weeks.map((week, wi) => (
        <View key={`w-${wi}`} style={styles.week}>
          {week.map((cell, di) =>
            cell ? (
              <CellView key={cell.key} cell={cell} styles={styles} />
            ) : (
              <View key={`blank-${wi}-${di}`} style={styles.blank} />
            ),
          )}
        </View>
      ))}

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.cellFilled]} />
          <Text style={styles.legendText}>Unlocked</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.cellMissed]} />
          <Text style={styles.legendText}>Missed</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.cellOff]} />
          <Text style={styles.legendText}>Off day</Text>
        </View>
      </View>
    </View>
  );
}

const CELL = 34;

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
  wrap: { gap: spacing.sm },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  navBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  navDisabled: { opacity: 0.35 },
  pressed: { opacity: 0.75 },
  dowRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  dow: {
    width: CELL,
    textAlign: 'center',
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  week: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  blank: { width: CELL, height: CELL },
  cell: {
    width: CELL,
    height: CELL,
    borderRadius: CELL / 2,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellOff: {
    borderStyle: 'dashed',
    opacity: 0.4,
  },
  cellFilled: {
    backgroundColor: colors.calm,
    borderColor: colors.calm,
    borderStyle: 'solid',
    opacity: 1,
  },
  cellMissed: {
    borderColor: colors.warning,
    borderStyle: 'solid',
    opacity: 0.85,
  },
  cellToday: {
    borderColor: colors.text,
    borderWidth: 2,
    opacity: 1,
  },
  check: {
    color: colors.bg,
    fontSize: 14,
    fontWeight: '700',
    marginTop: -1,
  },
  dayNum: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  dayNumOff: { color: colors.textDim },
  dayNumFuture: { color: colors.textDim },
  dayNumMissed: { color: colors.warning },
  dayNumToday: { color: colors.text },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  legendText: { color: colors.textDim, fontSize: 11, fontWeight: '600' },
});
}
