import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';
import { useThemeColors } from '@/lib/theme-provider';
import { usePremium } from '@/lib/premium-provider';
import { contactSupport } from '@/lib/support';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ThemePicker } from '@/components/ThemePicker';
import { SetupTips } from '@/components/SetupTips';
import { SettingsCard } from '@/components/settings/SettingsCard';
import { SettingsLinkRow } from '@/components/settings/SettingsLinkRow';
import { StreakDeadlineCard } from '@/components/settings/StreakDeadlineCard';
import { DevSettingsCard } from '@/components/settings/DevSettingsCard';
import { LegalCard } from '@/components/settings/LegalCard';
import { AppVersionFooter } from '@/components/settings/AppVersionFooter';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { isPremium } = usePremium();

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Settings" fallbackHref="/profile" />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <SettingsCard>
          <ThemePicker />
        </SettingsCard>

        <SettingsCard label="Preferences">
          <SettingsLinkRow
            icon="notifications-outline"
            label="Notifications"
            onPress={() => router.push('/notifications')}
          />
          <SettingsLinkRow
            icon="bulb-outline"
            label="Wake-up intention"
            onPress={() => router.push('/wake-intention')}
          />
        </SettingsCard>

        <StreakDeadlineCard />

        <SettingsCard label="Subscription">
          <SettingsLinkRow
            icon={isPremium ? 'sunny' : 'sunny-outline'}
            label="Quiett Premium"
            value={isPremium ? 'Active' : 'Free'}
            valueColor={isPremium ? colors.calm : undefined}
            accessibilityLabel={
              isPremium ? 'Quiett Premium, active. Manage subscription' : 'Quiett Premium, free plan'
            }
            onPress={() => router.push(isPremium ? '/manage-subscription' : '/paywall')}
          />
        </SettingsCard>

        <SettingsCard label="Help">
          <SettingsLinkRow icon="help-circle-outline" label="Troubleshooting" onPress={() => router.push('/help')} />
          <SettingsLinkRow
            icon="checkmark-circle-outline"
            label="Alarm reliability check"
            onPress={() => router.push('/reliability-check')}
          />
          <SetupTips />
          <SettingsLinkRow
            icon="mail-outline"
            label="Contact support"
            kind="link"
            accessibilityHint="Opens an email with your app version filled in"
            onPress={() => void contactSupport()}
          />
        </SettingsCard>

        <LegalCard />

        {__DEV__ ? <DevSettingsCard /> : null}

        <AppVersionFooter />
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.lg },
  });
}
