import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TrialPaywall } from '@/components/premium/TrialPaywall';
import { TurnOffAlarmLink } from '@/components/premium/TurnOffAlarmLink';
import { spacing } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';
import { usePremium } from '@/lib/premium-provider';
import { useThemeColors } from '@/lib/theme-provider';

/**
 * Full-screen paywall shown by the tabs layout in place of the tabs (see src/lib/access-gate.ts).
 * No sign-in (it's optional): purchase and restore work on the anonymous RevenueCat customer.
 * No close button and it never navigates: it disappears on its own once Premium is active (or
 * the TestFlight escape hatch applies).
 */
export function AccessGateScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { refresh } = usePremium();

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.md }]}>
      {/* Every way forward (purchase, restore) flips Premium, which opens the gate by itself.
          Home is behind this screen, so it carries the only way to stop a scheduled alarm. */}
      <TrialPaywall context="gate" onContinue={() => void refresh()} footerExtra={<TurnOffAlarmLink />} />
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
  });
}
