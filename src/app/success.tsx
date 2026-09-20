import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrimaryButton } from '@/components/PrimaryButton';
import { colors, spacing, typography } from '@/constants/theme';

export default function SuccessScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { streak } = useLocalSearchParams<{ streak?: string }>();
  const count = streak ? parseInt(streak, 10) : 0;

  return (
    <View
      style={[
        styles.screen,
        { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.lg },
      ]}
    >
      <Text style={styles.kicker}>Sit complete</Text>
      <Text style={styles.title}>Morning unlocked</Text>
      <Text style={styles.body}>
        You stayed upright and still. The alarm is gone — and the day can start quieter.
      </Text>
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

const styles = StyleSheet.create({
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
  streak: { marginTop: spacing.xxl, alignItems: 'center' },
  streakNum: { fontSize: 64, fontWeight: '200', color: colors.calm },
  streakLabel: { color: colors.textMuted },
  cta: { marginTop: 'auto', alignSelf: 'stretch' },
});
