import { useMemo, useState } from 'react';
import { REVENUECAT_ENABLED } from '@/lib/dev-flags';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ScreenHeader } from '@/components/ScreenHeader';
import { PRIVACY_POLICY_URL, SUBSCRIPTION_TERMS, TERMS_OF_USE_URL } from '@/constants/legal';
import { radii, spacing } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';
import { premiumEntitlement } from '@/lib/purchases';
import { usePremium } from '@/lib/premium-provider';
import { useThemeColors } from '@/lib/theme-provider';

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function ManageSubscriptionScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {
    available,
    loading,
    customerInfo,
    isPremium,
    devForcePremium,
    restore,
    manageSubscriptions,
  } = usePremium();
  const [restoring, setRestoring] = useState(false);

  const entitlement = premiumEntitlement(customerInfo);
  const renewDate = formatDate(entitlement?.expirationDate ?? null);

  // Hard paywall: everything needs Quiett Premium, so there is no free plan to describe. People
  // without Premium are normally behind the access gate; if they land here, point them to the paywall.
  let planName = 'No active subscription';
  let planNote = available
    ? 'Quiett needs an active Quiett Premium subscription. If you already subscribed with this Apple ID, tap Restore purchases.'
    : 'Subscriptions aren\u2019t available in this version of Quiett yet.';
  if (entitlement) {
    planName = 'Quiett Premium';
    if (!entitlement.expirationDate) {
      planNote = 'Quiett Premium is active with no end date.';
    } else if (entitlement.willRenew) {
      planNote = renewDate ? `Renews on ${renewDate}.` : 'Renews automatically.';
    } else {
      planNote = renewDate
        ? `Ends on ${renewDate}. It won\u2019t renew unless you turn renewal back on.`
        : 'Won\u2019t renew at the end of this period.';
    }
    if ((entitlement.periodType as string) === 'TRIAL' && renewDate) {
      planNote = entitlement.willRenew
        ? `Free trial — your plan starts on ${renewDate}.`
        : `Free trial ends on ${renewDate}.`;
    }
  } else if (!REVENUECAT_ENABLED) {
    planName = 'Quiett Premium';
    planNote = 'Everything is unlocked in this beta. Subscriptions aren\u2019t live yet.';
  } else if (isPremium && devForcePremium) {
    planName = 'Premium (dev preview)';
    planNote = 'Forced on from Settings → Developer. No purchase is attached.';
  }

  const onRestore = async () => {
    if (!available) {
      Alert.alert(
        'Subscriptions aren\u2019t available yet',
        'Restoring will work once Premium launches in this version of Quiett.'
      );
      return;
    }
    setRestoring(true);
    const outcome = await restore();
    setRestoring(false);
    switch (outcome.status) {
      case 'restored':
        Alert.alert('Purchases restored', 'Quiett Premium is active on this device.');
        return;
      case 'nothing-found':
        Alert.alert(
          'No purchases found',
          'We couldn\u2019t find a Quiett Premium subscription for this Apple ID.'
        );
        return;
      case 'unavailable':
        Alert.alert('Subscriptions aren\u2019t available yet', 'Please try again later.');
        return;
      case 'error':
        Alert.alert('Couldn\u2019t restore purchases', outcome.message);
        return;
    }
  };

  const openUrl = (url: string) => {
    void Linking.openURL(url).catch(() => {});
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Subscription" fallbackHref="/settings" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.planCard}>
          <View style={styles.planHeader}>
            <View style={styles.planIconWrap}>
              <Ionicons
                name={isPremium ? 'sunny' : 'sunny-outline'}
                size={24}
                color={colors.calm}
              />
            </View>
            <View style={styles.planInfo}>
              <Text style={styles.planLabel}>Current plan</Text>
              <Text style={styles.planName}>{loading ? '\u2026' : planName}</Text>
            </View>
          </View>
          {!loading ? <Text style={styles.planNote}>{planNote}</Text> : null}
        </View>

        <View style={styles.actionsCard}>
          {!isPremium ? (
            <PrimaryButton label="See Quiett Premium" onPress={() => router.push('/paywall')} />
          ) : null}
          {entitlement ? (
            <PrimaryButton
              label="Manage in iPhone Settings"
              variant="secondary"
              onPress={() => void manageSubscriptions()}
            />
          ) : null}
          <PrimaryButton
            label={restoring ? 'Restoring\u2026' : 'Restore purchases'}
            variant="secondary"
            disabled={restoring}
            onPress={() => void onRestore()}
          />
        </View>

        <View style={styles.legalCard}>
          {SUBSCRIPTION_TERMS.map((line) => (
            <Text key={line} style={styles.legalText}>
              {line}
            </Text>
          ))}
          <View style={styles.linksRow}>
            <Pressable accessibilityRole="link" onPress={() => openUrl(TERMS_OF_USE_URL)} hitSlop={6}>
              <Text style={styles.link}>Terms of Use</Text>
            </Pressable>
            <Text style={styles.legalText}>·</Text>
            <Pressable
              accessibilityRole="link"
              onPress={() => openUrl(PRIVACY_POLICY_URL)}
              hitSlop={6}
            >
              <Text style={styles.link}>Privacy Policy</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    scroll: { flex: 1 },
    content: {
      paddingHorizontal: spacing.lg,
      gap: spacing.lg,
    },
    planCard: {
      backgroundColor: colors.bgCard,
      borderRadius: radii.lg,
      padding: spacing.xl,
      borderWidth: 1,
      borderColor: colors.border,
      gap: spacing.md,
    },
    planHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    planIconWrap: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.calmSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    planInfo: {
      flex: 1,
      gap: spacing.xs,
    },
    planLabel: {
      color: colors.textDim,
      fontSize: 12,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    planName: {
      color: colors.text,
      fontSize: 24,
      fontWeight: '600',
    },
    planNote: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
    actionsCard: {
      gap: spacing.md,
    },
    legalCard: {
      backgroundColor: colors.bgCard,
      borderRadius: radii.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
      gap: spacing.md,
    },
    legalText: {
      color: colors.textDim,
      fontSize: 12,
      lineHeight: 18,
    },
    linksRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    link: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '500',
    },
  });
}
