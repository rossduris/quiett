import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { ScreenHeader, useSafeBack } from '@/components/ScreenHeader';
import { TrialPaywall } from '@/components/premium/TrialPaywall';
import type { ColorTokens } from '@/constants/themes';
import { useThemeColors } from '@/lib/theme-provider';

/**
 * Quiett Premium, opened later from Profile, Settings, Subscription or a locked Library sound.
 * Same paywall as the last onboarding step, under the Settings-style header (back + title).
 */
export default function PaywallScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const close = useSafeBack('/');

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Quiett Premium" fallbackHref="/" />
      <TrialPaywall context="page" onContinue={close} />
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
  });
}
