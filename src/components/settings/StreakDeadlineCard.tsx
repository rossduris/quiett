import { useCallback, useMemo, useState } from 'react';
import { Text } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useThemeColors } from '@/lib/theme-provider';
import { loadStreakDeadlinePrefs, saveStreakDeadlinePrefs, type StreakDeadlinePrefs } from '@/lib/storage';
import { SettingsCard } from './SettingsCard';
import { SwitchButton } from './SettingsSwitchRow';
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
      label="Streak deadline"
      right={
        <SwitchButton
          on={prefs.enabled}
          label="Streak deadline"
          onChange={(enabled) => update({ ...prefs, enabled })}
        />
      }
    >
      <Text style={styles.hint}>
        Unlocks only count toward your streak if completed within a time limit after the alarm
        rings. Late unlocks still open the day but are marked late.
      </Text>
      {prefs.enabled ? (
        <PillGroup
          options={DEADLINE_OPTIONS}
          selected={prefs.minutes}
          onSelect={(minutes) => update({ ...prefs, minutes })}
        />
      ) : null}
    </SettingsCard>
  );
}
