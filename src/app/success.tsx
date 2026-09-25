import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrimaryButton } from '@/components/PrimaryButton';
import { spacing, typography } from '@/constants/theme';
import { useThemeColors } from '@/lib/theme-provider';
import type { ColorTokens } from '@/constants/themes';
import { dayKey, loadWakeIntentionsByDay } from '@/lib/storage';

export default function SuccessScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { streak, intention: intentionParam } = useLocalSearchParams<{
    streak?: string;
    intention?: string;
  }>();
  const count = streak ? parseInt(streak, 10) : 0;
  // This morning's intention (snapshotted when the morning completed); empty when none was set.
  // Passed from /session so it renders on first frame; storage is the fallback.
  const [intention, setIntention] = useState(() => intentionParam?.trim() ?? '');
  useEffect(() => {
    if (intentionParam?.trim()) return;
    let alive = true;
    void loadWakeIntentionsByDay().then((byDay) => {
      if (alive) setIntention(byDay[dayKey(0)]?.trim() ?? '');
    });
    return () => {
      alive = false;
    };
  }, [intentionParam]);

  return (
    <View
      style={[
        styles.screen,
        { backgroundColor: colors.bg, paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.lg },
      ]}
    >
      <Text style={[styles.kicker, { color: colors.textDim }]}>Morning complete</Text>
      <Text style={[styles.title, { color: colors.text }]}>Morning unlocked</Text>
      <Text style={[styles.body, { color: colors.textMuted }]}>
        You held still through the gate. Alarm off — the day can start quieter.
      </Text>
      {intention ? <Text style={styles.intention}>“{intention}”</Text> : null}
      <View style={styles.streak}>
        <Text style={styles.streakNum}>{Number.isFinite(count) ? count : '—'}</Text>
        <Text style={styles.streakLabel}>day streak</Text>
      </View>
      <PrimaryButton
        label="Back home"
        onPress={() => router.replace('/')}
        style={styles.cta}
      />
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  kicker: {
    color: colors.calm,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontSize: 12,
  },
  title: { ...typography.title, color: colors.text, marginTop: spacing.sm },
  body: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 24,
    maxWidth: 320,
  },
  intention: {
    ...typography.body,
    fontStyle: 'italic',
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    maxWidth: 320,
  },
  streak: { marginTop: spacing.xxl, alignItems: 'center' },
  streakNum: { fontSize: 64, fontWeight: '200', color: colors.calm },
  streakLabel: { color: colors.textMuted },
  cta: { marginTop: 'auto', alignSelf: 'stretch' },
});
}
