import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrimaryButton } from '@/components/PrimaryButton';
import { spacing, typography } from '@/constants/theme';
import { useThemeColors } from '@/lib/theme-provider';
import type { ColorTokens } from '@/constants/themes';

export default function EmergencyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View
      style={[
        styles.screen,
        { backgroundColor: colors.bg, paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.lg },
      ]}
    >
      <Text style={[styles.kicker, { color: colors.textDim }]}>Ended early</Text>
      <Text style={[styles.title, { color: colors.text }]}>Morning ended early</Text>
      <Text style={[styles.body, { color: colors.textMuted }]}>
        That’s okay — some mornings need it. Your streak starts again from zero, and your next
        alarm is still set. Tomorrow is a fresh start.
      </Text>
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
    color: colors.textDim,
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
  cta: { marginTop: 'auto', alignSelf: 'stretch' },
});
}
