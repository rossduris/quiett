import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton } from '@/components/PrimaryButton';
import { spacing, typography } from '@/constants/theme';
import { useThemeColors } from '@/lib/theme-provider';
import type { ColorTokens } from '@/constants/themes';
import { useMemo } from 'react';

export default function ManageSubscriptionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const onManageInSettings = () => {
    void Linking.openURL('https://apps.apple.com/account/subscriptions');
  };

  const onRestorePurchases = async () => {
    Alert.alert(
      'Nothing to restore',
      'You don\'t have any past purchases to restore yet.',
      [{ text: 'OK' }],
    );
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={28} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Subscription</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.planCard}>
          <View style={styles.planHeader}>
            <View style={styles.planIconWrap}>
              <Ionicons name="pricetag" size={24} color={colors.calm} />
            </View>
            <View style={styles.planInfo}>
              <Text style={styles.planLabel}>Current plan</Text>
              <Text style={styles.planName}>Free</Text>
            </View>
          </View>
          <Text style={styles.planNote}>
            In-app purchases are not yet integrated. This screen shows the UI for subscription
            management.
          </Text>
        </View>

        <View style={styles.actionsCard}>
          <PrimaryButton
            label="Manage in Settings"
            variant="secondary"
            onPress={onManageInSettings}
          />
          <PrimaryButton
            label="Restore purchases"
            variant="secondary"
            onPress={() => void onRestorePurchases()}
          />
        </View>

        <View style={styles.legalCard}>
          <Text style={styles.legalText}>
            Your subscription automatically renews unless auto-renew is turned off at least 24
            hours before the end of the current period.
          </Text>
          <Text style={styles.legalText}>
            Your account will be charged for renewal within 24 hours before the end of the
            current period, and the cost of the renewal will be identified.
          </Text>
          <Text style={styles.legalText}>
            Subscriptions and auto-renewal can be managed or cancelled via your Apple ID account
            settings after purchase.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
    },
    headerTitle: {
      ...typography.title,
      color: colors.text,
    },
    scroll: { flex: 1 },
    content: {
      paddingHorizontal: spacing.lg,
      gap: spacing.lg,
    },
    planCard: {
      backgroundColor: colors.bgCard,
      borderRadius: 16,
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
      borderRadius: 16,
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
  });
}
