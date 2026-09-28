import { useMemo, useState, type ComponentProps } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useSafeBack } from '@/components/ScreenHeader';
import { PremiumHero } from '@/components/premium/PremiumHero';
import { premiumUnlockTracks, UNLOCK_TRACKS } from '@/constants/unlock-tracks';
import { PRIVACY_POLICY_URL, SUBSCRIPTION_TERMS, TERMS_OF_USE_URL } from '@/constants/legal';
import { radii, spacing, typography } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';
import { describeUnavailableReason, hasPremiumEntitlement, type PurchasesPackage } from '@/lib/purchases';
import { usePremium } from '@/lib/premium-provider';
import { useThemeColors } from '@/lib/theme-provider';
import { useReduceMotion } from '@/lib/use-reduce-motion';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

/** "A, B and C" */
function listNames(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

const NUMBER_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];

function countTitle(n: number, noun: string): string {
  return `${NUMBER_WORDS[n] ?? String(n)} more ${noun}`;
}

/**
 * "Keep going" past the 2:00 unlock is planned for Premium. Flip this on when it ships so the
 * paywall only ever lists what Premium unlocks in the code today.
 */
const KEEP_GOING_AVAILABLE = false;

/** Real counts straight from the catalog (sound library = every non-guided track). */
function libraryCounts() {
  const sounds = UNLOCK_TRACKS.filter((t) => t.kind !== 'guided');
  return {
    total: sounds.length,
    music: sounds.filter((t) => t.kind === 'music').length,
    ambient: sounds.filter((t) => t.kind === 'ambient').length,
    free: sounds.filter((t) => !t.locked).length,
  };
}

/** Covers for the hero fan: a varied handful of Premium sounds, falling back to any Premium track. */
const HERO_PREFS = ['ambient:campfire', 'music:lantern-glow', 'music:golden-hour', 'music:moonset', 'ambient:snow_morning'];
function heroTrackIds(): string[] {
  const premium = premiumUnlockTracks();
  const picked = HERO_PREFS.filter((id) => premium.some((t) => t.id === id));
  for (const t of premium) {
    if (picked.length >= 5) break;
    if (!picked.includes(t.id)) picked.push(t.id);
  }
  return picked.slice(0, 5);
}

/** Benefits = only what Premium unlocks in the code today (names straight from the catalog). */
function benefitLines(): { icon: IoniconName; title: string; detail: string }[] {
  const premium = premiumUnlockTracks();
  const tones = premium.filter((t) => t.kind === 'music').map((t) => t.title);
  const ambient = premium.filter((t) => t.kind === 'ambient').map((t) => t.title);
  const lines: { icon: IoniconName; title: string; detail: string }[] = [];
  if (tones.length) {
    lines.push({ icon: 'musical-notes-outline', title: countTitle(tones.length, 'tones and music beds'), detail: `${listNames(tones)}.` });
  }
  if (ambient.length) {
    lines.push({ icon: 'leaf-outline', title: countTitle(ambient.length, 'ambient sounds'), detail: `${listNames(ambient)}.` });
  }
  if (KEEP_GOING_AVAILABLE) {
    lines.push({ icon: 'time-outline', title: 'Keep going past 2:00', detail: 'Stay with your sound after the unlock for as long as you like.' });
  }
  lines.push(
    {
      icon: 'shuffle-outline',
      title: 'Surprise me uses the full library',
      detail: 'The daily rotation picks from every sound, not only the free ones.',
    },
    {
      icon: 'heart-outline',
      title: 'Keep Quiett growing',
      detail: 'The alarm, camera check, streaks and free sounds stay free either way.',
    },
  );
  return lines;
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
  const { width } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const counts = useMemo(() => libraryCounts(), []);
  const heroIds = useMemo(() => heroTrackIds(), []);
  const heroW = Math.min(width - spacing.lg * 2, 460);
  const heroH = Math.round(Math.min(230, heroW * 0.62));
  /** Section entrance: gentle rise, or a plain fade under Reduce Motion. */
  const enter = (i: number) => (reduceMotion ? FadeIn.duration(200) : FadeInDown.delay(120 + i * 90).duration(420));
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
    setDevForcePremium,
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
        <PremiumHero width={heroW} height={heroH} trackIds={heroIds} reduceMotion={reduceMotion} />

        <Animated.View entering={enter(0)} style={styles.hero}>
          <Text style={styles.kicker}>Quiett Premium</Text>
          <Text style={styles.title} accessibilityRole="header">
            Open the full sound library
          </Text>
          <Text style={styles.lead}>
            All {counts.total} sounds for the two calm minutes after you wake. {counts.free} of them stay free either way.
          </Text>
          <View style={styles.chips} accessibilityLabel={`${counts.total} sounds: ${counts.music} tones and music beds, ${counts.ambient} ambient sounds`}>
            <CountChip value={counts.total} label="sounds" styles={styles} strong />
            <CountChip value={counts.music} label="tones & music" styles={styles} />
            <CountChip value={counts.ambient} label="ambient" styles={styles} />
          </View>
        </Animated.View>

        <Animated.View entering={enter(1)} style={styles.benefits}>
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
        </Animated.View>

        {showActive ? (
          <View style={styles.stateCard}>
            <Ionicons name="checkmark-circle" size={28} color={colors.calm} />
            <Text style={styles.stateTitle}>
              {devForcePremium && !entitled && !justUnlocked
                ? 'Premium preview is on (dev)'
                : 'You\u2019re Premium'}
            </Text>
            <Text style={styles.stateBody}>
              All {counts.total} sounds are open in Library and in your morning sound picker.
            </Text>
            {entitled ? (
              <PrimaryButton
                label="Manage subscription"
                variant="secondary"
                onPress={() => router.push('/manage-subscription')}
                style={styles.stateBtn}
              />
            ) : null}
          </View>
        ) : loading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator color={colors.calm} />
          </View>
        ) : available && packages.length > 0 ? (
          <Animated.View entering={enter(2)} style={styles.plans} accessibilityRole="radiogroup">
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
                    {isSelected ? (
                      <Animated.View entering={reduceMotion ? undefined : ZoomIn.duration(180)} style={styles.radioDot} />
                    ) : null}
                  </View>
                  <View style={styles.planText}>
                    <View style={styles.planTitleRow}>
                      <Text style={styles.planTitle}>{info.title}</Text>
                      {isAnnual && savings ? (
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>Save {savings}%</Text>
                        </View>
                      ) : isAnnual && packages.length > 1 ? (
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>Best value</Text>
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
          </Animated.View>
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
            label={busy === 'purchase' ? 'One moment\u2026' : `Unlock all ${counts.total} sounds`}
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
        {__DEV__ ? (
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: devForcePremium }}
            onPress={() => void setDevForcePremium(!devForcePremium)}
            hitSlop={6}
            style={styles.devRow}
          >
            <Text style={styles.devLink}>Force premium (dev): {devForcePremium ? 'On' : 'Off'}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function CountChip({
  value,
  label,
  strong,
  styles,
}: {
  value: number;
  label: string;
  strong?: boolean;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={[styles.chip, strong && styles.chipStrong]}>
      <Text style={[styles.chipValue, strong && styles.chipValueStrong]}>{value}</Text>
      <Text style={[styles.chipLabel, strong && styles.chipLabelStrong]}>{label}</Text>
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
    hero: { alignItems: 'center', gap: spacing.sm },
    chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.xs },
    chip: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 5,
      paddingHorizontal: spacing.md - 4,
      paddingVertical: 6,
      borderRadius: radii.full,
      backgroundColor: colors.bgCard,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipStrong: { backgroundColor: colors.accentStrong, borderColor: colors.accentStrong },
    chipValue: { color: colors.text, fontSize: 15, fontWeight: '700' },
    chipValueStrong: { color: colors.onAccent },
    chipLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '500' },
    chipLabelStrong: { color: colors.onAccent },
    stateBtn: { alignSelf: 'stretch', marginTop: spacing.xs },
    devRow: { alignSelf: 'center', paddingVertical: 4 },
    devLink: { color: colors.textDim, fontSize: 12, fontWeight: '500' },
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
      width: 34,
      height: 34,
      borderRadius: 17,
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
      borderWidth: 2,
      backgroundColor: colors.calmSoft,
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
      backgroundColor: colors.accentStrong,
      borderRadius: radii.full,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
    },
    badgeText: { color: colors.onAccent, fontSize: 11, fontWeight: '700' },
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
