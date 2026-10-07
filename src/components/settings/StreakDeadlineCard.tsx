import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useThemeColors } from '@/lib/theme-provider';
import { loadStreakDeadlinePrefs, saveStreakDeadlinePrefs, type StreakDeadlinePrefs } from '@/lib/storage';
import { SettingsCard } from './SettingsCard';
import { SettingsSwitchRow } from './SettingsSwitchRow';
import { PillGroup } from './PillGroup';
import { createSettingsStyles } from './settings-styles';

const DEADLINE_OPTIONS = [10, 15, 30, 60].map((m) => ({
  value: m,
  label: `${m}m`,
  accessibilityLabel: `${m} minutes`,
}));

export function StreakDeadlineCard() {
  const colors = useThemeColors();
  const styles = useMemo(() => createSettingsStyles(colors), [colors]);
  const [prefs, setPrefs] = useState<StreakDeadlinePrefs>({ enabled: false, minutes: 30 });

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void loadStreakDeadlinePrefs().then((p) => {
        if (alive) setPrefs(p);
      });
      return () => {
        alive = false;
      };
    }, []),
  );

  const update = (next: StreakDeadlinePrefs) => {
    setPrefs(next);
    void saveStreakDeadlinePrefs(next);
  };

  return (
    <SettingsCard
      label="Streak"
      footnote="With a deadline on, a morning only counts toward your streak if you unlock within that time after the alarm. Late unlocks still open the day, marked late."
    >
      <SettingsSwitchRow
        icon="timer-outline"
        label="Streak deadline"
        value={prefs.enabled}
        onChange={(enabled) => update({ ...prefs, enabled })}
      />
      {prefs.enabled ? (
        <View style={styles.block}>
          <PillGroup
            options={DEADLINE_OPTIONS}
            selected={prefs.minutes}
            onSelect={(minutes) => update({ ...prefs, minutes })}
          />
        </View>
      ) : null}
    </SettingsCard>
  );
}
