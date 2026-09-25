import { useMemo, useState, type ComponentProps } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useSafeBack } from '@/components/ScreenHeader';
import { VOICE_GUIDE_TRACKS } from '@/constants/guides';
import { PRIVACY_POLICY_URL, SUBSCRIPTION_TERMS, TERMS_OF_USE_URL } from '@/constants/legal';
import { radii, spacing, typography } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';
import { describeUnavailableReason, hasPremiumEntitlement, type PurchasesPackage } from '@/lib/purchases';
import { usePremium } from '@/lib/premium-provider';
import { useThemeColors } from '@/lib/theme-provider';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

/** Human names of the premium tracks, straight from the catalog (never hard-coded copy). */
function premiumTrackNames(): string {
  const names = VOICE_GUIDE_TRACKS.map((t) => t.title);
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

const NUMBER_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight'];

/** Benefits = only what Premium unlocks in the code today. */
function benefitLines(): { icon: IoniconName; title: string; detail: string }[] {
  const count = VOICE_GUIDE_TRACKS.length;
  const countWord = NUMBER_WORDS[count] ?? String(count);
  return [
    {
      icon: 'musical-notes-outline',
      title: `${countWord} more guided morning tracks`,
      detail: `${premiumTrackNames()}.`,
    },
    {
      icon: 'sunny-outline',
      title: 'Choose them for any morning',
      detail: 'Set any premium track to play after the camera check, from Home or Library.',
    },
    {
      icon: 'shuffle-outline',
      title: 'Surprise me uses the full shelf',
      detail: 'The daily rotation picks from every track, not only the free ones.',
    },
    {
      icon: 'heart-outline',
      title: 'Keep Quiett growing',
      detail: 'The alarm, camera check, streaks and free tracks stay free either way.',
    },
  ];
}

type PlanInfo = {
  title: string;
  /** "year", "month"… or null for one-time purchases. */
  per: string | null;
  /** Months in one billing period, when known. */
  months: number | null;
};

function parseIsoPeriod(period: string | null): { per: string; months: number | null } | null {
  if (!period) return null;
  const m = /^P(\d+)([DWMY])$/.exec(period);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2];
  const word = unit === 'Y' ? 'year' : unit === 'M' ? 'month' : unit === 'W' ? 'week' : 'day';
  const months = unit === 'Y' ? n * 12 : unit === 'M' ? n : null;
  return { per: n === 1 ? word : `${n} ${word}s`, months };
}

function planInfo(pkg: PurchasesPackage): PlanInfo {
  // Compare as plain strings so this file never needs the SDK at runtime.
  const type = pkg.packageType as string;
  switch (type) {
    case 'ANNUAL':
      return { title: 'Yearly', per: 'year', months: 12 };
    case 'SIX_MONTH':
      return { title: '6 months', per: '6 months', months: 6 };
    case 'THREE_MONTH':
      return { title: '3 months', per: '3 months', months: 3 };
    case 'TWO_MONTH':
      return { title: '2 months', per: '2 months', months: 2 };
    case 'MONTHLY':
      return { title: 'Monthly', per: 'month', months: 1 };
    case 'WEEKLY':
      return { title: 'Weekly', per: 'week', months: null };
    case 'LIFETIME':
      return { title: 'Lifetime', per: null, months: null };
    default: {
      const parsed = parseIsoPeriod(pkg.product.subscriptionPeriod);
      return {
        title: pkg.product.title || 'Premium',
        per: parsed?.per ?? null,
        months: parsed?.months ?? null,
      };
    }
  }
}

/** Per-month equivalent — only when RevenueCat can compute it for a multi-month plan. */
function perMonthLabel(pkg: PurchasesPackage): string | null {
  const info = planInfo(pkg);
  if (!info.months || info.months <= 1) return null;
  const s = pkg.product.pricePerMonthString;
  return s ? `${s}/month` : null;
}

function sortPackages(pkgs: PurchasesPackage[]): PurchasesPackage[] {
  const order = ['ANNUAL', 'SIX_MONTH', 'THREE_MONTH', 'TWO_MONTH', 'MONTHLY', 'WEEKLY', 'LIFETIME'];
  const rank = (p: PurchasesPackage) => {
    const i = order.indexOf(p.packageType as string);
    return i === -1 ? order.length : i;
  };
  return [...pkgs].sort((a, b) => rank(a) - rank(b));
}

/** "Save 40%" on the annual plan, only if a monthly plan exists to compare against. */
function annualSavings(pkgs: PurchasesPackage[]): number | null {
  const annual = pkgs.find((p) => (p.packageType as string) === 'ANNUAL');
  const monthly = pkgs.find((p) => (p.packageType as string) === 'MONTHLY');
  if (!annual || !monthly) return null;
  if (annual.product.currencyCode !== monthly.product.currencyCode) return null;
  const monthlyPrice = monthly.product.price;
  if (!(monthlyPrice > 0)) return null;
  const pct = Math.round((1 - annual.product.price / (monthlyPrice * 12)) * 100);
  return pct >= 5 ? pct : null;
}

function disclosure(pkg: PurchasesPackage): string {
  const info = planInfo(pkg);
  if (!info.per) return `${pkg.product.priceString} one-time purchase.`;
  return `${pkg.product.priceString} per ${info.per}. Renews automatically — cancel anytime.`;
}

export default function PaywallScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const close = useSafeBack('/');
  const {
    available,
    unavailableReason,
    loading,
    offerings,
    customerInfo,
    purchase,
    restore,
    isPremium,
    devForcePremium,
  } = usePremium();

  const packages = useMemo(
    () => sortPackages(offerings?.availablePackages ?? []),
    [offerings]
  );
  const savings = useMemo(() => annualSavings(packages), [packages]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected =
    packages.find((p) => p.identifier === selectedId) ?? packages[0] ?? null;
  const [busy, setBusy] = useState<'purchase' | 'restore' | null>(null);
  const [justUnlocked, setJustUnlocked] = useState(false);

  const benefits = useMemo(() => benefitLines(), []);
  const entitled = hasPremiumEntitlement(customerInfo);
  const showActive = justUnlocked || entitled || (isPremium && devForcePremium);
  const canBuy = available && !!selected && !busy && !showActive;

  const onPurchase = async () => {
    if (!selected) return;
    setBusy('purchase');
    const outcome = await purchase(selected);
    setBusy(null);
    switch (outcome.status) {
      case 'purchased':
        if (outcome.premium) {
          setJustUnlocked(true);
        } else {
          Alert.alert(
            'Purchase received',
            'Premium should unlock in a moment. If it does not, tap Restore purchases.'
          );
        }
        return;
      case 'cancelled':
        return;
      case 'unavailable':
        Alert.alert('Subscriptions aren\u2019t available yet', 'Please try again later.');
        return;
      case 'error':
        Alert.alert('The purchase didn\u2019t go through', outcome.message);
        return;
    }
  };

  const onRestore = async () => {
    setBusy('restore');
    const outcome = await restore();
    setBusy(null);
    switch (outcome.status) {
      case 'restored':
        setJustUnlocked(true);
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
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={8}
          onPress={close}
          style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
        >
          <Ionicons name="close" size={22} color={colors.textMuted} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.markGlow}>
            <Image
              source={require('../../assets/images/icon.png')}
              style={styles.mark}
              accessibilityIgnoresInvertColors
            />
          </View>
          <Text style={styles.kicker}>Quiett Premium</Text>
          <Text style={styles.title}>More ways to begin the morning</Text>
          <Text style={styles.lead}>
            Unlock the rest of the guided shelf for the quiet minutes after you wake.
          </Text>
        </View>

        <View style={styles.benefits}>
          {benefits.map((b) => (
            <View key={b.title} style={styles.benefitRow}>
              <View style={styles.benefitIcon}>
                <Ionicons name={b.icon} size={18} color={colors.calm} />
              </View>
              <View style={styles.benefitText}>
                <Text style={styles.benefitTitle}>{b.title}</Text>
                <Text style={styles.benefitDetail}>{b.detail}</Text>
              </View>
            </View>
          ))}
        </View>

        {showActive ? (
          <View style={styles.stateCard}>
            <Ionicons name="checkmark-circle" size={28} color={colors.calm} />
            <Text style={styles.stateTitle}>
              {devForcePremium && !entitled && !justUnlocked
                ? 'Premium preview is on (dev)'
                : 'You\u2019re Premium'}
            </Text>
            <Text style={styles.stateBody}>
              Every track is open in Library and in the morning track picker.
            </Text>
          </View>
        ) : loading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator color={colors.calm} />
          </View>
        ) : available && packages.length > 0 ? (
          <View style={styles.plans} accessibilityRole="radiogroup">
            {packages.map((pkg) => {
              const info = planInfo(pkg);
              const isSelected = selected?.identifier === pkg.identifier;
              const perMonth = perMonthLabel(pkg);
              const isAnnual = (pkg.packageType as string) === 'ANNUAL';
              return (
                <Pressable
                  key={pkg.identifier}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`${info.title}, ${pkg.product.priceString}${
                    info.per ? ` per ${info.per}` : ''
                  }`}
                  onPress={() => setSelectedId(pkg.identifier)}
                  style={({ pressed }) => [
                    styles.planCard,
                    isSelected && styles.planCardSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={[styles.radio, isSelected && styles.radioOn]}>
                    {isSelected ? <View style={styles.radioDot} /> : null}
                  </View>
                  <View style={styles.planText}>
                    <View style={styles.planTitleRow}>
                      <Text style={styles.planTitle}>{info.title}</Text>
                      {isAnnual && savings ? (
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>Save {savings}%</Text>
                        </View>
                      ) : null}
                    </View>
                    {perMonth ? <Text style={styles.planSub}>{perMonth}</Text> : null}
                  </View>
                  <View style={styles.planPriceCol}>
                    <Text style={styles.planPrice}>{pkg.product.priceString}</Text>
                    {info.per ? <Text style={styles.planPer}>per {info.per}</Text> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={styles.stateCard}>
            <Ionicons name="moon-outline" size={24} color={colors.textMuted} />
            <Text style={styles.stateTitle}>Subscriptions aren{'\u2019'}t available yet</Text>
            <Text style={styles.stateBody}>
              Premium will open here soon. Everything free keeps working as it does today.
            </Text>
            {__DEV__ ? (
              <Text style={styles.devHint}>
                Dev:{' '}
                {unavailableReason
                  ? describeUnavailableReason(unavailableReason)
                  : 'RevenueCat returned no current offering with packages.'}
              </Text>
            ) : null}
          </View>
        )}

        <View style={styles.terms}>
          {SUBSCRIPTION_TERMS.map((line) => (
            <Text key={line} style={styles.termsText}>
              {line}
            </Text>
          ))}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        {showActive ? (
          <PrimaryButton label="Done" onPress={close} />
        ) : (
          <PrimaryButton
            label={busy === 'purchase' ? 'One moment\u2026' : 'Continue'}
            onPress={() => void onPurchase()}
            disabled={!canBuy}
          />
        )}
        {!showActive && selected && available ? (
          <Text style={styles.disclosure}>{disclosure(selected)}</Text>
        ) : null}
        <View style={styles.linksRow}>
          <Pressable
            accessibilityRole="button"
            onPress={() => void onRestore()}
            disabled={!available || !!busy}
            hitSlop={6}
          >
            <Text style={[styles.link, (!available || !!busy) && styles.linkDisabled]}>
              {busy === 'restore' ? 'Restoring\u2026' : 'Restore purchases'}
            </Text>
          </Pressable>
          <Text style={styles.linkDot}>·</Text>
          <Pressable accessibilityRole="link" onPress={() => openUrl(TERMS_OF_USE_URL)} hitSlop={6}>
            <Text style={styles.link}>Terms of Use</Text>
          </Pressable>
          <Text style={styles.linkDot}>·</Text>
          <Pressable
            accessibilityRole="link"
            onPress={() => openUrl(PRIVACY_POLICY_URL)}
            hitSlop={6}
          >
            <Text style={styles.link}>Privacy Policy</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    topBar: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      paddingHorizontal: spacing.md,
    },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: radii.full,
      backgroundColor: colors.bgCard,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pressed: { opacity: 0.7 },
    scroll: { flex: 1 },
    content: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.lg,
      gap: spacing.lg,
    },
    hero: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.xs },
    markGlow: {
      width: 104,
      height: 104,
      borderRadius: 52,
      backgroundColor: colors.sunriseSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    mark: { width: 80, height: 80, borderRadius: 20 },
    kicker: {
      color: colors.calm,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    title: {
      ...typography.title,
      color: colors.text,
      textAlign: 'center',
    },
    lead: {
      ...typography.body,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 22,
      paddingHorizontal: spacing.sm,
    },
    benefits: {
      backgroundColor: colors.bgCard,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      gap: spacing.md,
    },
    benefitRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
    benefitIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.calmSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    benefitText: { flex: 1, gap: 2 },
    benefitTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
    benefitDetail: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
    plans: { gap: spacing.sm },
    planCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: colors.bgCard,
      borderRadius: radii.lg,
      borderWidth: 1.5,
      borderColor: colors.border,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
    },
    planCardSelected: {
      borderColor: colors.calm,
      backgroundColor: colors.sunriseSoft,
    },
    radio: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: colors.textDim,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioOn: { borderColor: colors.calm },
    radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.calm },
    planText: { flex: 1, gap: 2 },
    planTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    planTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
    planSub: { color: colors.textMuted, fontSize: 13 },
    badge: {
      backgroundColor: colors.calm,
      borderRadius: radii.full,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
    },
    badgeText: { color: colors.bg, fontSize: 11, fontWeight: '700' },
    planPriceCol: { alignItems: 'flex-end' },
    planPrice: { color: colors.text, fontSize: 16, fontWeight: '600' },
    planPer: { color: colors.textDim, fontSize: 12 },
    stateCard: {
      backgroundColor: colors.bgCard,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      alignItems: 'center',
      gap: spacing.sm,
    },
    stateTitle: { color: colors.text, fontSize: 17, fontWeight: '600', textAlign: 'center' },
    stateBody: { color: colors.textMuted, fontSize: 14, lineHeight: 20, textAlign: 'center' },
    devHint: { color: colors.textDim, fontSize: 12, lineHeight: 17, textAlign: 'center' },
    terms: { gap: spacing.xs, paddingHorizontal: spacing.xs },
    termsText: { color: colors.textDim, fontSize: 11, lineHeight: 16 },
    footer: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      gap: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      backgroundColor: colors.bg,
    },
    disclosure: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
    linksRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    link: { color: colors.textMuted, fontSize: 13, fontWeight: '500' },
    linkDisabled: { opacity: 0.45 },
    linkDot: { color: colors.textDim, fontSize: 13 },
  });
}
