import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radii, spacing, typography } from '@/constants/theme';
import { useThemeColors } from '@/lib/theme-provider';
import { ThemePicker } from '@/components/ThemePicker';
import {
  ALARM_SOUNDS,
  ALARM_SOUND_SECTIONS,
  alarmSoundsBySection,
  MEDITATION_SOUNDS,
  DEFAULT_ALARM_SOUND_ID,
  DEFAULT_MEDITATION_SOUND_ID,
} from '@/constants/sounds';
import { previewSoundUrl } from '@/lib/audio';
import { syncOsAlarm } from '@/lib/os-alarm';
import {
  DEFAULT_SIT_MINUTES,
  loadAlarmPrefs,
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
  const colors = useThemeColors();
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
    void syncOsAlarm(await loadAlarmPrefs());
    const opt = ALARM_SOUNDS.find((s) => s.id === id);
    if (opt && opt.url != null && !previewing) {
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
    if (opt && opt.url != null && !previewing) {
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
      style={[styles.screen, { backgroundColor: colors.bg }]}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + spacing.xl },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <ThemePicker />
      </View>

      <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <Text style={[styles.cardLabel, { color: colors.textDim }]}>Sit length</Text>
        <Text style={[styles.hint, { color: colors.textMuted }]}>Required unlock before the morning opens</Text>
        <View style={styles.row}>
          {SIT_MINUTE_OPTIONS.map((m) => {
            const selected = m === sitMinutes;
            return (
              <Pressable
                key={m}
                onPress={() => void onSelectSit(m)}
                style={[
                  styles.pill,
                  { backgroundColor: colors.bgElevated, borderColor: colors.border },
                  selected && { backgroundColor: colors.calmSoft, borderColor: colors.calm },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <Text style={[styles.pillText, { color: selected ? colors.calm : colors.textMuted }, selected && styles.pillTextSelected]}>{m === 0.5 ? '30s' : `${m}m`}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <Text style={[styles.cardLabel, { color: colors.textDim }]}>Alarm sound</Text>
        <Text style={[styles.hint, { color: colors.textMuted }]}>Wake tone while the morning gate is not held</Text>
        {ALARM_SOUND_SECTIONS.map((section) => {
          const opts = alarmSoundsBySection(section.id);
          if (opts.length === 0) return null;
          return (
            <View key={section.id} style={styles.soundSection}>
              <Text style={[styles.sectionLabel, { color: colors.text }]}>{section.label}</Text>
              <Text style={[styles.sectionHint, { color: colors.textDim }]}>{section.hint}</Text>
              {opts.map((s) => {
                const selected = s.id === alarmSoundId;
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => void onSelectAlarm(s.id)}
                    style={[
                      styles.optionRow,
                      selected && { backgroundColor: colors.bgElevated, borderColor: colors.border },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                  >
                    <Text style={[styles.optionText, { color: selected ? colors.text : colors.textMuted }, selected && { fontWeight: '600' }]}>
                      {s.label}
                    </Text>
                    {selected ? <Text style={[styles.check, { color: colors.calm }]}>✓</Text> : null}
                  </Pressable>
                );
              })}
            </View>
          );
        })}
      </View>

      <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <Text style={[styles.cardLabel, { color: colors.textDim }]}>Meditation track</Text>
        <Text style={[styles.hint, { color: colors.textMuted }]}>Plays once you are looking · still. Prefer Home → Morning sound, or Library, for guided / healing tones / ambient.</Text>
        {MEDITATION_SOUNDS.map((s) => {
          const selected = s.id === meditationSoundId;
          return (
            <Pressable
              key={s.id}
              onPress={() => void onSelectMeditation(s.id)}
              style={[
                styles.optionRow,
                selected && { backgroundColor: colors.bgElevated, borderColor: colors.border },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Text style={[styles.optionText, { color: selected ? colors.text : colors.textMuted }, selected && { fontWeight: '600' }]}>
                {s.label}
              </Text>
              {selected ? <Text style={[styles.check, { color: colors.calm }]}>✓</Text> : null}
            </Pressable>
          );
        })}
      </View>

      {previewing ? <Text style={[styles.previewHint, { color: colors.textDim }]}>Previewing…</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.lg },
  card: {
    borderRadius: 16,
    padding: spacing.lg,
    borderWidth: 1,
    gap: spacing.sm,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  hint: { fontSize: 13, marginBottom: spacing.xs },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillText: { fontWeight: '600' },
  pillTextSelected: {},
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
  optionText: { fontSize: 16 },
  check: { fontSize: 16, fontWeight: '700' },
  previewHint: { textAlign: 'center', fontSize: 13 },
  soundSection: { gap: spacing.xs, marginTop: spacing.sm },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  sectionHint: { fontSize: 12, lineHeight: 16, marginBottom: 4 },
});
