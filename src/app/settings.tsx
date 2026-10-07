import { SettingsSwitchRow } from '@/components/settings/SettingsSwitchRow';
import { useBreathingLight } from '@/lib/breathing-pref';
import { EnterStagger } from '@/components/EnterStagger';
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
  const [breathingLight, setBreathingLight] = useBreathingLight();

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Settings" fallbackHref="/profile" />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <EnterStagger index={0}>
          <SettingsCard label="Appearance">
            <ThemePicker variant="rows" />
          </SettingsCard>
        </EnterStagger>

        <EnterStagger index={1}>
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
            <SettingsSwitchRow
              icon="radio-button-on-outline"
              label="Breathing light while meditating"
              value={breathingLight}
              onChange={setBreathingLight}
            />
          </SettingsCard>
        </EnterStagger>

        <EnterStagger index={2}>
          <StreakDeadlineCard />
        </EnterStagger>

        <EnterStagger index={3}>
          <SettingsCard label="Premium">
            <SettingsLinkRow
              icon={isPremium ? 'sunny' : 'sunny-outline'}
              label="Quiett Premium"
              value={isPremium ? 'Active' : 'Not active'}
              valueColor={isPremium ? colors.calm : undefined}
              accessibilityLabel={
                isPremium ? 'Quiett Premium, active. Manage subscription' : 'Quiett Premium, not active'
              }
              onPress={() => router.push(isPremium ? '/manage-subscription' : '/paywall')}
            />
          </SettingsCard>
        </EnterStagger>

        <EnterStagger index={4}>
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
        </EnterStagger>

        <EnterStagger index={5}>
          <LegalCard />
        </EnterStagger>

        {__DEV__ ? (
          <EnterStagger index={6}>
            <DevSettingsCard />
          </EnterStagger>
        ) : null}

        <EnterStagger index={7}>
          <AppVersionFooter />
        </EnterStagger>
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    content: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.xl },
  });
}
