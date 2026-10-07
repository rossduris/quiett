import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { EmptyState } from '@/components/EmptyState';
import { StreakCalendar } from '@/components/StreakCalendar';
import { useThemeColors } from '@/lib/theme-provider';
import { morningsInMonth, type Schedule } from '@/lib/streak-calendar';
import { createProfileStyles } from './profile-styles';
import { SectionHeader } from './SectionHeader';

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
    <View style={styles.section}>
      <SectionHeader
        label="Calendar"
        meta={completedDays.length ? `${monthMornings} ${monthMornings === 1 ? 'morning' : 'mornings'} unlocked` : undefined}
      />
      <View style={styles.card}>
        {completedDays.length === 0 ? (
          <EmptyState bare scene="calm" title="No mornings yet" body="Each morning you unlock fills in a day here." />
        ) : null}
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
    </View>
  );
}
