import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton } from '@/components/PrimaryButton';
import { radii, spacing, typography } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';
import { getRingsCountdown, getTodayStatusChip, relativeDayLabel, type TodayStatus } from '@/lib/home-status';
import { formatWeekdayHint, nextAlarmDate, type AlarmPrefs, type Weekday } from '@/lib/storage';
import { useThemeColors } from '@/lib/theme-provider';
import { deviceUses24h, displayHhMm, parseHhMmToDate, toHhMm } from '@/lib/time-format';
import { homeCard } from './home-styles';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
/** Below this window width (iPhone SE / mini) the time drops from `display` to `hero`. */
const NARROW_WIDTH = 390;

/** Minute clock local to this card, re-anchored whenever Home refreshes `resetAt`. */
function useMinuteClock(resetAt: Date): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, [resetAt]);
  return now;
}

type Props = {
  alarm: AlarmPrefs;
  alarmSavedAt: number | null;
  unlockedToday: boolean;
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
    () => getTodayStatusChip(alarm, unlockedToday, now, alarmSavedAt),
    [alarm, unlockedToday, now, alarmSavedAt],
  );
  const next = alarm.enabled ? nextAlarmDate(alarm.time, alarm.weekdays, now) : null;
  const label = unlockedToday && next ? `Next alarm · ${relativeDayLabel(next, now)}` : 'Morning alarm';
  const timeText = displayHhMm(alarm.time);
  const showChip = !unlockedToday && chip != null && chip.status !== 'unlocked_today';

  const chipTone = (status: TodayStatus): string =>
    status === 'missed_morning' ? colors.warning : status === 'unlocked_today' ? colors.calm : colors.textMuted;

  const onTimeValueChange = (_event: unknown, date?: Date) => {
    if (!date) return;
    if (Platform.OS === 'android') onPickerOpenChange(false);
    onSetTime(toHhMm(date));
  };

  return (
    <View style={styles.card}>
      {!unlockedToday && alarm.enabled ? (
        <>
          <View pointerEvents="none" style={styles.sunriseWashTop} />
          <View pointerEvents="none" style={styles.sunriseWashEdge} />
        </>
      ) : null}
      <View style={styles.cardTop}>
        <Text style={styles.cardLabel}>{label}</Text>
        <Pressable
          onPress={onToggleEnabled}
          hitSlop={8}
          style={styles.switchRow}
          accessibilityRole="switch"
          accessibilityLabel="Morning alarm"
          accessibilityState={{ checked: alarm.enabled }}
        >
          <View style={[styles.switch, alarm.enabled && styles.switchOn]}>
            <View style={[styles.thumb, alarm.enabled && styles.thumbOn]} />
          </View>
        </Pressable>
      </View>

      <Pressable
        onPress={() => onPickerOpenChange(!pickerOpen)}
        style={styles.timeHit}
        accessibilityRole="button"
        accessibilityLabel={`Alarm time, ${timeText}`}
        accessibilityHint="Change the alarm time and days"
        accessibilityState={{ expanded: pickerOpen }}
      >
        <Text
          style={[styles.time, width < NARROW_WIDTH && styles.timeNarrow, !alarm.enabled && styles.timeOff]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
        >
          {timeText}
        </Text>
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
        <>
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
            {DAYS.map((dayLabel, i) => {
              const day = (i + 1) as Weekday;
              const selected = alarm.weekdays.includes(day);
              return (
                <Pressable
                  key={day}
                  onPress={() => onToggleWeekday(day)}
                  style={[styles.pill, selected && styles.pillSelected]}
                  accessibilityRole="button"
                  accessibilityLabel={dayLabel}
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.pillText, selected && styles.pillTextSelected]}>{dayLabel}</Text>
                </Pressable>
              );
            })}
          </View>
          {Platform.OS === 'ios' ? (
            <PrimaryButton label="Done" variant="secondary" onPress={() => onPickerOpenChange(false)} />
          ) : null}
        </>
      ) : null}

      {showChip && chip ? (
        <View style={[styles.statusChip, { borderColor: chipTone(chip.status) }]}>
          <View style={[styles.statusDot, { backgroundColor: chipTone(chip.status) }]} />
          <Text style={[styles.statusLabel, { color: chipTone(chip.status) }]}>{chip.label}</Text>
        </View>
      ) : null}
    </View>
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
