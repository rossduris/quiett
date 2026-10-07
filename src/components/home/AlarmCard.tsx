import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { RollingText } from '@/components/RollingText';
import { SpringPill } from '@/components/SpringPill';
import { MiniSwitch } from '@/components/settings/SettingsSwitchRow';
import { hapticSelect, hapticSoft } from '@/lib/haptics';
import { DURATION, EASE, SPRING_SOFT } from '@/lib/motion';
import { useReduceMotion } from '@/lib/use-reduce-motion';
import { PrimaryButton } from '@/components/PrimaryButton';
import { radii, spacing, typography } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';
import { getRingsCountdown, getTodayStatusChip, relativeDayLabel, type TodayStatus } from '@/lib/home-status';
import {
  formatWeekdayHint,
  nextAlarmDate,
  WEEKDAY_DISPLAY_ORDER,
  WEEKDAY_SHORT,
  type AlarmPrefs,
  type Weekday,
} from '@/lib/storage';
import { useThemeColors } from '@/lib/theme-provider';
import { deviceUses24h, displayHhMm, parseHhMmToDate, toHhMm } from '@/lib/time-format';
import { homeCard } from './home-styles';

/** Below this window width (iPhone SE / mini) the time drops from `display` to `hero`. */
const NARROW_WIDTH = 390;

/** Minute clock local to this card, re-anchored whenever Home refreshes `resetAt`. */
function useMinuteClock(resetAt: Date): Date {
  const [tick, setNow] = useState(() => new Date());
  useEffect(() => {
    // Tick on the minute boundary so the countdown never lags the real clock by up to a minute.
    let id: ReturnType<typeof setInterval> | null = null;
    const first = setTimeout(() => {
      setNow(new Date());
      id = setInterval(() => setNow(new Date()), 60_000);
    }, 60_000 - (Date.now() % 60_000) + 50);
    return () => {
      clearTimeout(first);
      if (id) clearInterval(id);
    };
  }, [resetAt]);
  // A Home refresh (`resetAt` is its fresh "now") counts as a newer reading than the last tick.
  return resetAt.getTime() > tick.getTime() ? resetAt : tick;
}

type Props = {
  alarm: AlarmPrefs;
  alarmSavedAt: number | null;
  unlockedToday: boolean;
  /** Sticky handoff / alerting — suppress Missed chip while a wake is in flight. */
  liveWakePending?: boolean;
  /** Home's focus / foreground / day-rollover timestamp. */
  homeNow: Date;
  pickerOpen: boolean;
  onPickerOpenChange: (open: boolean) => void;
  onSetTime: (hhmm: string) => void;
  onToggleEnabled: () => void;
  onToggleWeekday: (day: Weekday) => void;
};

export function AlarmCard({
  alarm,
  alarmSavedAt,
  unlockedToday,
  liveWakePending = false,
  homeNow,
  pickerOpen,
  onPickerOpenChange,
  onSetTime,
  onToggleEnabled,
  onToggleWeekday,
}: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const now = useMinuteClock(homeNow);

  const rings = useMemo(() => getRingsCountdown(alarm, unlockedToday, now), [alarm, unlockedToday, now]);
  const chip = useMemo(
    () => getTodayStatusChip(alarm, unlockedToday, now, alarmSavedAt, liveWakePending),
    [alarm, unlockedToday, now, alarmSavedAt, liveWakePending],
  );
  const next = alarm.enabled ? nextAlarmDate(alarm.time, alarm.weekdays, now) : null;
  const label = unlockedToday && next ? `Next alarm · ${relativeDayLabel(next, now)}` : 'Morning alarm';
  const timeText = displayHhMm(alarm.time);
  const showChip = !unlockedToday && chip != null && chip.status !== 'unlocked_today';

  const chipTone = (status: TodayStatus): string =>
    status === 'missed_morning'
      ? colors.warning
      : status === 'unlocked_today' || status === 'waiting_settle'
        ? colors.calm
        : colors.textMuted;

  const reduce = useReduceMotion();
  // Alarm off: the time dims smoothly rather than snapping colour.
  const dim = useSharedValue(alarm.enabled ? 1 : 0.42);
  useEffect(() => {
    dim.value = withTiming(alarm.enabled ? 1 : 0.42, { duration: DURATION.base, easing: EASE });
  }, [alarm.enabled, dim]);
  const dimStyle = useAnimatedStyle(() => ({ opacity: dim.value }));
  const panelEnter = reduce
    ? FadeIn.duration(DURATION.fast)
    : FadeInDown.duration(DURATION.slow).easing(EASE).withInitialValues({ opacity: 0, transform: [{ translateY: -8 }] });
  const cardLayout = reduce ? undefined : LinearTransition.springify().damping(SPRING_SOFT.damping ?? 22).stiffness(SPRING_SOFT.stiffness ?? 180);

  const onTimeValueChange = (_event: unknown, date?: Date) => {
    if (!date) return;
    if (Platform.OS === 'android') onPickerOpenChange(false);
    const next = toHhMm(date);
    if (next !== alarm.time) hapticSelect();
    onSetTime(next);
  };

  return (
    <Animated.View style={styles.card} layout={cardLayout}>
      {!unlockedToday && alarm.enabled ? (
        <Animated.View pointerEvents="none" style={StyleSheet.absoluteFill} entering={FadeIn.duration(DURATION.slow)} exiting={FadeOut.duration(DURATION.base)}>
          <View pointerEvents="none" style={styles.sunriseWashTop} />
          <View pointerEvents="none" style={styles.sunriseWashEdge} />
        </Animated.View>
      ) : null}
      <View style={styles.cardTop}>
        <Text style={styles.cardLabel}>{label}</Text>
        <Pressable
          onPress={() => {
            if (alarm.enabled) hapticSelect();
            else hapticSoft();
            onToggleEnabled();
          }}
          hitSlop={8}
          style={styles.switchRow}
          accessibilityRole="switch"
          accessibilityLabel="Morning alarm"
          accessibilityState={{ checked: alarm.enabled }}
        >
          <MiniSwitch on={alarm.enabled} size="lg" />
        </Pressable>
      </View>

      <Pressable
        onPress={() => {
          hapticSelect();
          onPickerOpenChange(!pickerOpen);
        }}
        style={styles.timeHit}
        accessibilityRole="button"
        accessibilityLabel={`Alarm time, ${timeText}`}
        accessibilityHint="Change the alarm time and days"
        accessibilityState={{ expanded: pickerOpen }}
      >
        <Animated.View style={dimStyle}>
          <RollingText text={timeText} style={[styles.time, width < NARROW_WIDTH && styles.timeNarrow]} reduceMotion={reduce} />
        </Animated.View>
      </Pressable>

      {rings ? (
        <View style={styles.ringsRow}>
          <Ionicons name="sunny-outline" size={18} color={colors.sunrise} />
          <Text style={styles.ringsText}>{rings.label}</Text>
        </View>
      ) : null}

      <Text style={styles.hint}>
        {alarm.enabled
          ? `Tap time to change · ${formatWeekdayHint(alarm.weekdays)}`
          : 'Alarm off · turn on to wake with Quiett'}
      </Text>

      {pickerOpen ? (
        <Animated.View entering={panelEnter} exiting={FadeOut.duration(DURATION.fast)} style={styles.panel}>
          <View style={styles.timePickerWrap}>
            <DateTimePicker
              value={parseHhMmToDate(alarm.time)}
              mode="time"
              display="spinner"
              // Follows the device clock: iOS reads the system 12/24h setting natively; Android
              // is told explicitly so it matches the card's formatting.
              {...(Platform.OS === 'android' ? { is24Hour: deviceUses24h() } : null)}
              minuteInterval={1}
              onValueChange={onTimeValueChange}
              onDismiss={() => onPickerOpenChange(false)}
              themeVariant={colors.statusBarStyle === 'dark' ? 'light' : 'dark'}
              textColor={colors.text}
            />
          </View>
          <View style={styles.dayPills}>
            {WEEKDAY_DISPLAY_ORDER.map((day: Weekday) => {
              const dayLabel = WEEKDAY_SHORT[day];
              const selected = alarm.weekdays.includes(day);
              return (
                <SpringPill
                  key={day}
                  selected={selected}
                  label={dayLabel}
                  onPress={() => onToggleWeekday(day)}
                  style={styles.pill}
                  selectedStyle={styles.pillSelected}
                  textStyle={styles.pillText}
                  selectedTextStyle={styles.pillTextSelected}
                  accessibilityRole="button"
                  accessibilityLabel={dayLabel}
                  accessibilityState={{ selected }}
                />
              );
            })}
          </View>
          {Platform.OS === 'ios' ? (
            <PrimaryButton label="Done" variant="secondary" onPress={() => onPickerOpenChange(false)} />
          ) : null}
        </Animated.View>
      ) : null}

      {showChip && chip ? (
        <View style={[styles.statusChip, { borderColor: chipTone(chip.status) }]}>
          <View style={[styles.statusDot, { backgroundColor: chipTone(chip.status) }]} />
          <Text style={[styles.statusLabel, { color: chipTone(chip.status) }]}>{chip.label}</Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    card: { ...homeCard(colors), gap: spacing.sm, paddingVertical: spacing.xl, overflow: 'hidden' },
    sunriseWashTop: {
      position: 'absolute',
      top: -40,
      right: -30,
      width: 220,
      height: 160,
      borderRadius: 110,
      backgroundColor: colors.sunriseDeep,
      opacity: 0.55,
    },
    sunriseWashEdge: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 72,
      backgroundColor: colors.sunriseSoft,
      opacity: 0.7,
    },
    cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    cardLabel: { ...typography.eyebrow, color: colors.textDim },
    switchRow: { padding: spacing.xs },
    switch: {
      width: 51,
      height: 31,
      borderRadius: radii.full,
      backgroundColor: colors.border,
      justifyContent: 'center',
      paddingHorizontal: 2,
    },
    switchOn: { backgroundColor: colors.calm },
    thumb: { width: 27, height: 27, borderRadius: radii.full, backgroundColor: colors.bg },
    thumbOn: { alignSelf: 'flex-end' },
    timeHit: { paddingVertical: spacing.sm },
    panel: { gap: spacing.sm },
    time: { ...typography.display, color: colors.text },
    timeNarrow: { ...typography.hero },
    timeOff: { color: colors.textDim },
    hint: { ...typography.caption, color: colors.textMuted },
    timePickerWrap: {
      alignSelf: 'stretch',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.bgElevated,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      paddingVertical: spacing.sm,
    },
    // Seven equal pills on one row at every width (44pt tall targets).
    dayPills: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm },
    pill: {
      flex: 1,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radii.lg,
      backgroundColor: colors.bg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    pillSelected: { backgroundColor: colors.calm, borderColor: colors.calm },
    pillText: { ...typography.caption, fontWeight: '600', color: colors.textMuted },
    pillTextSelected: { color: colors.bg },
    ringsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: radii.lg,
      backgroundColor: colors.sunriseSoft,
      borderWidth: 1,
      borderColor: colors.sunriseDeep,
    },
    ringsText: { ...typography.subtitle, color: colors.sunrise, fontWeight: '700', letterSpacing: 0.2 },
    statusChip: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginTop: spacing.xs,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: radii.full,
      borderWidth: 1,
      backgroundColor: colors.bgElevated,
    },
    statusDot: { width: 7, height: 7, borderRadius: radii.full },
    statusLabel: { ...typography.eyebrow, letterSpacing: 0.5 },
  });
}
