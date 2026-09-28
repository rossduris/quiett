import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { mix } from '@/lib/scene-gen';
import { radii, spacing, typography } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';
import { useThemeColors } from '@/lib/theme-provider';
import {
  buildMonthGrid,
  dayKeyLabel,
  isCurrentMonth,
  shiftMonth,
  type CalendarCell,
  type Schedule,
} from '@/lib/streak-calendar';
import { WEEKDAY_DISPLAY_ORDER, WEEKDAY_INITIAL } from '@/lib/storage';

const DAY_LABELS = WEEKDAY_DISPLAY_ORDER.map((d) => WEEKDAY_INITIAL[d]);

type Props = {
  completedDays: readonly string[];
  /** Weekdays, or a resolver over the schedule history (so past months keep their old schedule). */
  schedule: Schedule;
  year: number;
  month: number;
  /** Earliest month with history; Previous is disabled here (and with no history at all). */
  firstMonth: { year: number; month: number } | null;
  now: Date;
  onChangeMonth: (next: { year: number; month: number }) => void;
};

function cellA11yLabel(cell: CalendarCell): string {
  const status = cell.completed
    ? 'unlocked'
    : cell.missed
      ? 'missed'
      : !cell.scheduled
        ? 'off day'
        : cell.isToday
          ? 'today'
          : cell.isFuture
            ? 'scheduled'
            : null;
  return status ? `${dayKeyLabel(cell.key)}, ${status}` : dayKeyLabel(cell.key);
}

type Styles = ReturnType<typeof createStyles>;

/** Filled accent dot with a soft top-left highlight (unlocked mornings, and the legend). */
function UnlockedDot({ size, colors, id }: { size: number; colors: ColorTokens; id: string }) {
  const r = size / 2;
  return (
    <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
      <Defs>
        <RadialGradient id={id} cx="35%" cy="30%" r="75%">
          <Stop offset="0" stopColor={mix(colors.calm, colors.sunrise, 0.45)} />
          <Stop offset="1" stopColor={colors.calm} />
        </RadialGradient>
      </Defs>
      <Circle cx={r} cy={r} r={r} fill={`url(#${id})`} />
    </Svg>
  );
}

function CellView({ cell, styles, colors }: { cell: CalendarCell; styles: Styles; colors: ColorTokens }) {
  return (
    <View
      style={[styles.cell, cell.isFuture && !cell.isToday && styles.cellFuture]}
      accessible
      accessibilityLabel={cellA11yLabel(cell)}
    >
      {cell.isToday ? <View style={styles.todayRing} /> : null}
      {cell.completed ? (
        <View style={styles.dot}>
          <UnlockedDot size={DOT} colors={colors} id={`cal-${cell.key}`} />
          <Text style={styles.dotNum}>{cell.day}</Text>
        </View>
      ) : (
        <Text
          style={[
            styles.dayNum,
            !cell.scheduled && styles.dayNumOff,
            cell.isToday && styles.dayNumToday,
          ]}
        >
          {cell.day}
        </Text>
      )}
      {cell.missed ? <View style={styles.missedMark} /> : null}
    </View>
  );
}

export function StreakCalendar({
  completedDays,
  schedule,
  year,
  month,
  firstMonth,
  now,
  onChangeMonth,
}: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const grid = useMemo(
    () => buildMonthGrid(year, month, completedDays, schedule, now),
    [year, month, completedDays, schedule, now],
  );
  const canGoForward = !isCurrentMonth(year, month, now);
  const canGoBack =
    firstMonth !== null && year * 12 + month > firstMonth.year * 12 + firstMonth.month;
  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);

  const weeks = useMemo(() => {
    const padded: (CalendarCell | null)[] = [
      ...Array.from({ length: grid.leadingBlanks }, () => null),
      ...grid.cells,
    ];
    while (padded.length % 7 !== 0) padded.push(null);
    const rows: (CalendarCell | null)[][] = [];
    for (let i = 0; i < padded.length; i += 7) rows.push(padded.slice(i, i + 7));
    return rows;
  }, [grid]);

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
          accessibilityState={{ disabled: !canGoBack }}
          disabled={!canGoBack}
          onPress={() => {
            if (canGoBack) onChangeMonth(prev);
          }}
          hitSlop={10}
          style={({ pressed }) => [
            styles.navBtn,
            !canGoBack && styles.navDisabled,
            pressed && canGoBack && styles.pressed,
          ]}
        >
          <Ionicons
            name="chevron-back"
            size={18}
            color={canGoBack ? colors.textMuted : colors.border}
          />
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">
          {grid.title}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next month"
          accessibilityState={{ disabled: !canGoForward }}
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
              <CellView key={cell.key} cell={cell} styles={styles} colors={colors} />
            ) : (
              <View key={`blank-${wi}-${di}`} style={styles.blank} />
            ),
          )}
        </View>
      ))}

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={styles.legendDot}>
            <UnlockedDot size={10} colors={colors} id="cal-legend-dot" />
          </View>
          <Text style={styles.legendText}>Unlocked</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={styles.legendRing} />
          <Text style={styles.legendText}>Today</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={styles.legendMissed} />
          <Text style={styles.legendText}>Missed</Text>
        </View>
        <View style={styles.legendItem}>
          <Text style={styles.legendOffNum}>8</Text>
          <Text style={styles.legendText}>Off day</Text>
        </View>
      </View>
    </View>
  );
}

const CELL = 38;
const DOT = 30;

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    wrap: { gap: spacing.sm },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.xs,
    },
    title: { ...typography.body, color: colors.text, fontWeight: '600' },
    navBtn: {
      width: 32,
      height: 32,
      borderRadius: radii.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.bg,
    },
    navDisabled: { opacity: 0.35 },
    pressed: { opacity: 0.75 },
    dowRow: { flexDirection: 'row', justifyContent: 'space-between' },
    dow: {
      width: CELL,
      textAlign: 'center',
      ...typography.eyebrow,
      color: colors.textDim,
      fontSize: 10,
      letterSpacing: 0.6,
    },
    week: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    blank: { width: CELL, height: CELL },
    cell: { width: CELL, height: CELL, alignItems: 'center', justifyContent: 'center' },
    cellFuture: { opacity: 0.38 },
    todayRing: {
      position: 'absolute',
      width: CELL - 2,
      height: CELL - 2,
      borderRadius: radii.full,
      borderWidth: 1.5,
      borderColor: colors.text,
    },
    dot: { width: DOT, height: DOT, alignItems: 'center', justifyContent: 'center' },
    dotNum: { ...typography.caption, color: colors.bg, fontSize: 12, fontWeight: '700' },
    dayNum: { ...typography.caption, color: colors.textMuted, fontSize: 13, fontWeight: '500', fontVariant: ['tabular-nums'] },
    dayNumOff: { color: colors.textDim, opacity: 0.6 },
    dayNumToday: { color: colors.text, fontWeight: '700' },
    missedMark: {
      position: 'absolute',
      bottom: 3,
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.warning,
      opacity: 0.8,
    },
    legend: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.sm },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendDot: { width: 10, height: 10 },
    legendRing: { width: 10, height: 10, borderRadius: radii.full, borderWidth: 1.5, borderColor: colors.text },
    legendMissed: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.warning, opacity: 0.8 },
    legendOffNum: { fontSize: 11, fontWeight: '500', color: colors.textDim, opacity: 0.6 },
    legendText: { ...typography.caption, color: colors.textDim, fontSize: 11, fontWeight: '600' },
  });
}
