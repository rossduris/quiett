import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii, spacing, typography } from '@/constants/theme';
import {
  ALARM_SOUNDS,
  MEDITATION_SOUNDS,
  DEFAULT_ALARM_SOUND_ID,
  DEFAULT_MEDITATION_SOUND_ID,
} from '@/constants/sounds';
import { previewSoundUrl } from '@/lib/audio';
import {
  DEFAULT_SIT_MINUTES,
  loadAlarmSoundId,
  loadMeditationSoundId,
  loadSitMinutes,
  saveAlarmSoundId,
  saveMeditationSoundId,
  saveSitMinutes,
  SIT_MINUTE_OPTIONS,
  type SitMinutes,
} from '@/lib/storage';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const [sitMinutes, setSitMinutes] = useState<SitMinutes>(DEFAULT_SIT_MINUTES);
  const [alarmSoundId, setAlarmSoundId] = useState(DEFAULT_ALARM_SOUND_ID);
  const [meditationSoundId, setMeditationSoundId] = useState(DEFAULT_MEDITATION_SOUND_ID);
  const [previewing, setPreviewing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const [m, a, med] = await Promise.all([
          loadSitMinutes(),
          loadAlarmSoundId(),
          loadMeditationSoundId(),
        ]);
        if (!alive) return;
        setSitMinutes(m);
        setAlarmSoundId(a);
        setMeditationSoundId(med);
      })();
      return () => {
        alive = false;
      };
    }, []),
  );

  const onSelectSit = async (minutes: SitMinutes) => {
    setSitMinutes(minutes);
    await saveSitMinutes(minutes);
  };

  const onSelectAlarm = async (id: string) => {
    setAlarmSoundId(id);
    await saveAlarmSoundId(id);
    const opt = ALARM_SOUNDS.find((s) => s.id === id);
    if (opt && !previewing) {
      setPreviewing(true);
      try {
        await previewSoundUrl(opt.url);
      } finally {
        setPreviewing(false);
      }
    }
  };

  const onSelectMeditation = async (id: string) => {
    setMeditationSoundId(id);
    await saveMeditationSoundId(id);
    const opt = MEDITATION_SOUNDS.find((s) => s.id === id);
    if (opt && !previewing) {
      setPreviewing(true);
      try {
        await previewSoundUrl(opt.url);
      } finally {
        setPreviewing(false);
      }
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + spacing.xl },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Sit length</Text>
        <Text style={styles.hint}>Required unlock before the morning opens</Text>
        <View style={styles.row}>
          {SIT_MINUTE_OPTIONS.map((m) => {
            const selected = m === sitMinutes;
            return (
              <Pressable
                key={m}
                onPress={() => void onSelectSit(m)}
                style={[styles.pill, selected && styles.pillSelected]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <Text style={[styles.pillText, selected && styles.pillTextSelected]}>{m === 0.5 ? '30s' : `${m}m`}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Alarm sound</Text>
        <Text style={styles.hint}>Plays when the sit gate is not held</Text>
        {ALARM_SOUNDS.map((s) => {
          const selected = s.id === alarmSoundId;
          return (
            <Pressable
              key={s.id}
              onPress={() => void onSelectAlarm(s.id)}
              style={[styles.optionRow, selected && styles.optionSelected]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                {s.label}
              </Text>
              {selected ? <Text style={styles.check}>✓</Text> : null}
            </Pressable>
          );
        })}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Meditation track</Text>
        <Text style={styles.hint}>Plays once you are looking · still. Prefer Home → Morning sound, or Library, for guided / healing tones / ambient.</Text>
        {MEDITATION_SOUNDS.map((s) => {
          const selected = s.id === meditationSoundId;
          return (
            <Pressable
              key={s.id}
              onPress={() => void onSelectMeditation(s.id)}
              style={[styles.optionRow, selected && styles.optionSelected]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                {s.label}
              </Text>
              {selected ? <Text style={styles.check}>✓</Text> : null}
            </Pressable>
          );
        })}
      </View>

      {previewing ? <Text style={styles.previewHint}>Previewing…</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.lg },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  cardLabel: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  hint: { color: colors.textMuted, fontSize: 13, marginBottom: spacing.xs },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
  },
  pillSelected: {
    borderColor: colors.calm,
    backgroundColor: 'rgba(61,207,176,0.14)',
  },
  pillText: { color: colors.textMuted, fontWeight: '600' },
  pillTextSelected: { color: colors.calm },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  optionSelected: {
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
  },
  optionText: { color: colors.textMuted, fontSize: 16 },
  optionTextSelected: { color: colors.text, fontWeight: '600' },
  check: { color: colors.calm, fontSize: 16, fontWeight: '700' },
  previewHint: { color: colors.textDim, textAlign: 'center', fontSize: 13 },
});
