import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { StreakCalendar } from '@/components/StreakCalendar';
import { spacing } from '@/constants/theme';
import { useThemeColors } from '@/lib/theme-provider';
import { morningsInMonth, type Schedule } from '@/lib/streak-calendar';
import { createProfileStyles } from './profile-styles';

type Props = {
  completedDays: readonly string[];
  schedule: Schedule;
  firstMonth: { year: number; month: number } | null;
  now: Date;
};

export function CalendarCard({ completedDays, schedule, firstMonth, now }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createProfileStyles(colors), [colors]);
  const [shown, setShown] = useState(() => ({ year: now.getFullYear(), month: now.getMonth() }));
  const monthMornings = useMemo(
    () => morningsInMonth(shown.year, shown.month, completedDays),
    [shown, completedDays],
  );

  return (
    <View style={[styles.card, { gap: 0 }]}>
      <Text style={styles.cardTitle} accessibilityRole="header">
        Streak calendar
      </Text>
      <Text style={[styles.cardSub, { marginBottom: spacing.md }]}>
        {monthMornings} {monthMornings === 1 ? 'morning' : 'mornings'} unlocked
      </Text>
      <StreakCalendar
        completedDays={completedDays}
        schedule={schedule}
        year={shown.year}
        month={shown.month}
        firstMonth={firstMonth}
        now={now}
        onChangeMonth={setShown}
      />
    </View>
  );
}
