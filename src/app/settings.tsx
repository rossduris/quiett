import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { radii, spacing } from '@/constants/theme';
import { useThemeColors } from '@/lib/theme-provider';
import { ThemePicker } from '@/components/ThemePicker';
import { ScreenHeader } from '@/components/ScreenHeader';
import {
  DEFAULT_SIT_MINUTES,
  loadSitMinutes,
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
  const [deadlinePrefs, setDeadlinePrefs] = useState<StreakDeadlinePrefs>({
    enabled: false,
    minutes: 30,
  });

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const [m, deadline] = await Promise.all([
          loadSitMinutes(),
          loadStreakDeadlinePrefs(),
        ]);
        if (!alive) return;
        setSitMinutes(m);
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
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScreenHeader title="Settings" fallbackHref="/profile" />
      <ScrollView
        style={styles.screen}
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

        {__DEV__ ? (
        <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.cardLabel, { color: colors.textDim }]}>Unlock length (dev only)</Text>
          <Text style={[styles.hint, { color: colors.textMuted }]}>Release builds are locked to 2 minutes</Text>
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
        ) : null}

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
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    screen: { flex: 1 },
    content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.lg },
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
