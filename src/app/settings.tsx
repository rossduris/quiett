import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
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
  loadStreakDeadlinePrefs,
  saveStreakDeadlinePrefs,
  type StreakDeadlinePrefs,
} from '@/lib/storage';
import type { ColorTokens } from '@/constants/themes';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [sitMinutes, setSitMinutes] = useState<SitMinutes>(DEFAULT_SIT_MINUTES);
  const [alarmSoundId, setAlarmSoundId] = useState(DEFAULT_ALARM_SOUND_ID);
  const [meditationSoundId, setMeditationSoundId] = useState(DEFAULT_MEDITATION_SOUND_ID);
  const [previewing, setPreviewing] = useState(false);
  const [deadlinePrefs, setDeadlinePrefs] = useState<StreakDeadlinePrefs>({
    enabled: false,
    minutes: 30,
  });

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const [m, a, med, deadline] = await Promise.all([
          loadSitMinutes(),
          loadAlarmSoundId(),
          loadMeditationSoundId(),
          loadStreakDeadlinePrefs(),
        ]);
        if (!alive) return;
        setSitMinutes(m);
        setAlarmSoundId(a);
        setMeditationSoundId(med);
        setDeadlinePrefs(deadline);
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

  const onToggleDeadline = async () => {
    const next = { ...deadlinePrefs, enabled: !deadlinePrefs.enabled };
    setDeadlinePrefs(next);
    await saveStreakDeadlinePrefs(next);
  };

  const onSelectDeadlineMinutes = async (minutes: number) => {
    const next = { ...deadlinePrefs, minutes };
    setDeadlinePrefs(next);
    await saveStreakDeadlinePrefs(next);
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
        <Text style={[styles.cardLabel, { color: colors.textDim }]}>Preferences</Text>
        <Pressable
          onPress={() => router.push('/notifications')}
          style={({ pressed }) => [
            styles.linkRow,
            pressed && { opacity: 0.75 },
          ]}
          accessibilityRole="button"
        >
          <View style={styles.linkLeft}>
            <Ionicons name="notifications-outline" size={20} color={colors.text} />
            <Text style={[styles.linkText, { color: colors.text }]}>Notifications</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textDim} />
        </Pressable>
        <Pressable
          onPress={() => router.push('/wake-intention')}
          style={({ pressed }) => [
            styles.linkRow,
            pressed && { opacity: 0.75 },
          ]}
          accessibilityRole="button"
        >
          <View style={styles.linkLeft}>
            <Ionicons name="bulb-outline" size={20} color={colors.text} />
            <Text style={[styles.linkText, { color: colors.text }]}>Wake-up intention</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textDim} />
        </Pressable>
      </View>

      <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <View style={styles.cardTop}>
          <Text style={[styles.cardLabel, { color: colors.textDim }]}>Streak deadline</Text>
          <Pressable
            onPress={() => void onToggleDeadline()}
            style={styles.switchWrap}
            accessibilityRole="switch"
            accessibilityState={{ checked: deadlinePrefs.enabled }}
          >
            <View style={[styles.miniSwitch, deadlinePrefs.enabled && styles.miniSwitchOn]}>
              <View style={[styles.miniThumb, deadlinePrefs.enabled && styles.miniThumbOn]} />
            </View>
          </Pressable>
        </View>
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          Unlocks only count toward your streak if completed within a time limit after the alarm
          rings. Late unlocks still open the day but are marked late.
        </Text>
        {deadlinePrefs.enabled && (
          <View style={styles.row}>
            {[10, 15, 30, 60].map((m) => {
              const selected = m === deadlinePrefs.minutes;
              return (
                <Pressable
                  key={m}
                  onPress={() => void onSelectDeadlineMinutes(m)}
                  style={[
                    styles.pill,
                    { backgroundColor: colors.bgElevated, borderColor: colors.border },
                    selected && { backgroundColor: colors.calmSoft, borderColor: colors.calm },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text
                    style={[
                      styles.pillText,
                      { color: selected ? colors.calm : colors.textMuted },
                      selected && styles.pillTextSelected,
                    ]}
                  >
                    {m}m
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
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

      <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <Text style={[styles.cardLabel, { color: colors.textDim }]}>Support</Text>
        <Pressable
          onPress={() => router.push('/help')}
          style={({ pressed }) => [
            styles.linkRow,
            pressed && { opacity: 0.75 },
          ]}
          accessibilityRole="button"
        >
          <View style={styles.linkLeft}>
            <Ionicons name="help-circle-outline" size={20} color={colors.text} />
            <Text style={[styles.linkText, { color: colors.text }]}>Help</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textDim} />
        </Pressable>
        <Pressable
          onPress={() => router.push('/reliability-check')}
          style={({ pressed }) => [
            styles.linkRow,
            pressed && { opacity: 0.75 },
          ]}
          accessibilityRole="button"
        >
          <View style={styles.linkLeft}>
            <Ionicons name="checkmark-circle-outline" size={20} color={colors.text} />
            <Text style={[styles.linkText, { color: colors.text }]}>Alarm reliability check</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textDim} />
        </Pressable>
      </View>

      <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <Text style={[styles.cardLabel, { color: colors.textDim }]}>Account</Text>
        <Pressable
          onPress={() => router.push('/manage-subscription')}
          style={({ pressed }) => [
            styles.linkRow,
            pressed && { opacity: 0.75 },
          ]}
          accessibilityRole="button"
        >
          <View style={styles.linkLeft}>
            <Ionicons name="pricetag-outline" size={20} color={colors.text} />
            <Text style={[styles.linkText, { color: colors.text }]}>Manage subscription</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textDim} />
        </Pressable>
      </View>
    </ScrollView>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
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
    cardTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
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
    linkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: radii.md,
      backgroundColor: colors.bgElevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    linkLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      flex: 1,
    },
    linkText: {
      fontSize: 15,
      fontWeight: '500',
    },
    switchWrap: { paddingVertical: 4, paddingHorizontal: 4 },
    miniSwitch: {
      width: 42,
      height: 26,
      borderRadius: 13,
      backgroundColor: colors.border,
      justifyContent: 'center',
      paddingHorizontal: 2,
    },
    miniSwitchOn: { backgroundColor: colors.calm },
    miniThumb: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.bg,
    },
    miniThumbOn: { alignSelf: 'flex-end' },
  });
}
