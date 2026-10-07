import { useCallback, useMemo, useState, type ComponentProps, type ReactNode } from 'react';
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
  type LayoutChangeEvent,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton } from '@/components/PrimaryButton';
import { frostPill, pillText } from '@/components/library/library-styles';
import { PremiumHero } from '@/components/premium/PremiumHero';
import {
  BETA_DEMO_PRICES,
  BETA_DEMO_TRIAL,
  PAYWALL_ALLOW_CONTINUE_WHEN_PLANS_UNAVAILABLE,
  PAYWALL_DISMISSABLE,
} from '@/constants/paywall';
import { REVENUECAT_ENABLED } from '@/lib/dev-flags';
import { PRIVACY_POLICY_URL, SUBSCRIPTION_TERMS, TERMS_OF_USE_URL } from '@/constants/legal';
import { radii, spacing, typography } from '@/constants/theme';
import { THEMES, type ColorTokens } from '@/constants/themes';
import { hapticSelect, hapticSuccess } from '@/lib/haptics';
import {
  freeTrialLength,
  isAnnual,
  perMonthLabel,
  planInfo,
  sortPackages,
  trialAdjective,
  trialDisclosure,
} from '@/lib/paywall-plans';
import { describeUnavailableReason, hasPremiumEntitlement } from '@/lib/purchases';
import { usePremium } from '@/lib/premium-provider';
import { useThemeColors } from '@/lib/theme-provider';
import { useMotionActive } from '@/lib/use-motion-active';
import { useReduceMotion } from '@/lib/use-reduce-motion';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

type Props = {
  /**
   * 'onboarding': setup step right after alarm permission, before "You're set".
   *   Hard paywall: only a purchase / restore with `premium` active (or the TestFlight escape
   *   hatch when plans can't load) calls onContinue.
   * 'gate': the app-level gate (src/lib/access-gate.ts) for anyone without Premium.
   *   Same rules as onboarding; the gate opens by itself once Premium is active.
   * 'page': opened from Profile / Settings / Library under a Settings-style header.
   */
  context: 'onboarding' | 'gate' | 'page';
  /** Onboarding: go to the next step. Gate: re-check. Page: leave the screen. */
  onContinue: () => void;
  /** Extra quiet content at the bottom of the footer (the gate's "Turn off my alarm"). */
  footerExtra?: ReactNode;
};

/** "A and B", "A, B and C" */
function listNames(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * Real features only (theme names come from the theme registry). With the hard paywall all of
 * Quiett needs Premium, so these describe the whole app rather than extras.
 */
function benefitLines(): { icon: IoniconName; title: string; detail: string }[] {
  const themeNames = Object.values(THEMES).map((t) => t.name);
  return [
    {
      icon: 'alarm-outline',
      title: 'The camera check-in alarm',
      detail: 'It rings until the camera sees you\u2019re up.',
    },
    {
      icon: 'musical-notes-outline',
      title: 'Every sound and meditation',
      detail: 'All the tones, music beds and ambient sounds.',
    },
    {
      icon: 'color-palette-outline',
      title: 'Your streak, milestones and themes',
      detail: `${listNames(themeNames)}, anytime.`,
    },
  ];
}

const ANNUAL_TAG = 'Best value';
/** RevenueCat off: show the design with demo prices and an "Enter beta" CTA (no purchases). */
const BETA_MODE = !REVENUECAT_ENABLED;
const BETA_CAPTION = 'Free during beta. You won\u2019t be charged.';

/** Sound covers fanned out in the hero (left to right; Soft Pad, the default, in the middle). */
const HERO_TRACK_IDS = ['music:lantern-glow', 'ambient:calm_waves', 'music:soft-pad', 'ambient:campfire', 'music:moonset'] as const;
/** Hero art height bounds (pt). It takes the room left above the plans, within these. */
const HERO_MIN_H = 88;
const HERO_MAX_H = 200;
/** Room kept for two plan cards while plans load, so the hero doesn't resize when they land. */
const PLANS_RESERVE_H = 156;

/** The "Quiett Premium" pill (Library's Premium pill look): frosted over the hero art, soft on the page. */
function PremiumPill({ colors, styles, frost }: { colors: ColorTokens; styles: Styles; frost?: boolean }) {
  return (
    <View style={frost ? styles.pillFrost : styles.pillSoft}>
      <Ionicons name="sparkles" size={11} color={colors.calm} />
      <Text style={styles.pillLabel}>Quiett Premium</Text>
    </View>
  );
}

export function TrialPaywall({ context, onContinue, footerExtra }: Props) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width, height } = useWindowDimensions();
  /** iPhone SE / mini class: tighter gaps so the plans stay in view. */
  const compact = height < 720;
  const reduceMotion = useReduceMotion();
  // Hero loops run only while this screen is focused and the app is in the foreground.
  const motionActive = useMotionActive();
  const enter = (i: number) => (reduceMotion ? FadeIn.duration(200) : FadeInDown.delay(80 + i * 80).duration(380));

  const {
    available,
    unavailableReason,
    loading,
    offerings,
    offeringsError,
    introEligibility,
    customerInfo,
    purchase,
    restore,
    refresh,
    isPremium,
    devForcePremium,
    plansUnavailable,
  } = usePremium();

  const packages = useMemo(() => sortPackages(offerings?.availablePackages ?? []), [offerings]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Annual is preselected; if the offering changes under us (retry / foreground refresh) and
  // the picked package is gone, this falls back to Annual again, then to whatever exists.
  const selected =
    packages.find((p) => p.identifier === selectedId) ??
    packages.find(isAnnual) ??
    packages[0] ??
    null;
  const [busy, setBusy] = useState<'purchase' | 'restore' | 'retry' | null>(null);
  const [justUnlocked, setJustUnlocked] = useState(false);
  const benefits = useMemo(() => benefitLines(), []);
  const [betaPlanId, setBetaPlanId] = useState<string>(BETA_DEMO_PRICES[0].id);

  const entitled = hasPremiumEntitlement(customerInfo);
  const showActive = !BETA_MODE && (justUnlocked || entitled || (isPremium && devForcePremium));
  const plansReady = available && packages.length > 0;
  const showLoading = !plansReady && loading && !offeringsError;
  const showUnavailable = !BETA_MODE && !showActive && !plansReady && !showLoading;

  const trialFor = (pkg: (typeof packages)[number]) =>
    freeTrialLength(pkg, introEligibility[pkg.product.identifier]);
  const selectedTrial = selected ? trialFor(selected) : null;

  /** Onboarding or the app-level gate (no header, no back). */
  const inFlow = context !== 'page';
  // Soft paywall only: "Not now" while plans are on screen.
  const canSkip = inFlow && PAYWALL_DISMISSABLE && plansReady && !showActive;
  // TestFlight escape hatch: plans can't load, so let people through instead of hard-blocking.
  const escapeHatch =
    inFlow && !showActive && !plansReady && plansUnavailable && PAYWALL_ALLOW_CONTINUE_WHEN_PLANS_UNAVAILABLE;

  const unlocked = () => {
    hapticSuccess();
    if (inFlow) onContinue();
    else setJustUnlocked(true);
  };

  const onPurchase = async () => {
    if (!selected || busy) return;
    setBusy('purchase');
    const outcome = await purchase(selected);
    setBusy(null);
    switch (outcome.status) {
      case 'purchased':
        if (outcome.premium) {
          unlocked();
          return;
        }
        // Paid but the entitlement isn't on the receipt yet. The customer-info listener flips
        // this screen to "Premium is active" when it lands; Restore purchases forces it.
        Alert.alert(
          'Purchase received',
          'Premium should unlock in a moment. If it doesn\u2019t, tap Restore purchases.'
        );
        if (inFlow && PAYWALL_DISMISSABLE) onContinue();
        return;
      case 'cancelled':
        return; // the user closed the App Store sheet: stay here, say nothing
      case 'unavailable':
        Alert.alert('Plans unavailable right now', 'Please try again in a little while.');
        return;
      case 'error':
        Alert.alert('The purchase didn\u2019t go through', outcome.message);
        return;
    }
  };

  const onRestore = async () => {
    if (busy) return;
    setBusy('restore');
    const outcome = await restore();
    setBusy(null);
    switch (outcome.status) {
      case 'restored':
        unlocked();
        return;
      case 'nothing-found':
        Alert.alert('No purchases found', 'We couldn\u2019t find a Quiett Premium subscription for this Apple ID.');
        return;
      case 'unavailable':
        Alert.alert('Plans unavailable right now', 'Restoring will work once subscriptions are live.');
        return;
      case 'error':
        Alert.alert('Couldn\u2019t restore purchases', outcome.message);
        return;
    }
  };

  const onRetry = async () => {
    if (busy) return;
    setBusy('retry');
    try {
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  const openUrl = (url: string) => {
    void Linking.openURL(url).catch(() => {});
  };

  // Hero sizing: measure the scroll viewport and everything under the hero, then give the art the
  // room that's left so the plan cards stay in view without scrolling (capped, floored, and
  // dropped on SE-class phones when there's no room). The terms may sit below the fold.
  const [viewportH, setViewportH] = useState(0);
  const [topH, setTopH] = useState(0);
  const [plansH, setPlansH] = useState(0);
  const onViewport = useCallback((e: LayoutChangeEvent) => setViewportH(Math.round(e.nativeEvent.layout.height)), []);
  const onTop = useCallback((e: LayoutChangeEvent) => setTopH(Math.round(e.nativeEvent.layout.height)), []);
  const onPlans = useCallback((e: LayoutChangeEvent) => setPlansH(Math.round(e.nativeEvent.layout.height)), []);
  const heroW = Math.round(width - spacing.lg * 2);
  const heroH = useMemo(() => {
    if (!viewportH || !topH) return 0;
    const below = topH + spacing.md + Math.max(plansH, PLANS_RESERVE_H);
    // Content top padding, the gap under the hero, and a little breathing room above the fold.
    const room = viewportH - spacing.sm - spacing.md - below - spacing.sm;
    const fit = Math.floor(Math.min(room, HERO_MAX_H, Math.round(heroW * 0.5)) / 8) * 8;
    if (fit >= HERO_MIN_H) return fit;
    return compact ? 0 : HERO_MIN_H;
  }, [viewportH, topH, plansH, heroW, compact]);

  const headline = BETA_MODE
    ? `Try Quiett free for ${BETA_DEMO_TRIAL}`
    : showActive
    ? 'You\u2019re all set with Premium'
    : selectedTrial
      ? `Try Quiett free for ${selectedTrial}`
      : 'Unlock all of Quiett';

  let cta: { label: string; onPress: () => void; disabled?: boolean } | null;
  if (BETA_MODE) {
    cta = { label: 'Enter beta', onPress: () => { hapticSuccess(); onContinue(); } };
  } else if (showActive) {
    cta = { label: inFlow ? 'Continue' : 'Done', onPress: onContinue };
  } else if (plansReady) {
    cta = {
      label: busy === 'purchase' ? 'One moment\u2026' : selectedTrial ? 'Start free trial' : 'Subscribe',
      onPress: () => void onPurchase(),
      disabled: !selected || !!busy,
    };
  } else if (inFlow && (escapeHatch || (PAYWALL_DISMISSABLE && !showLoading))) {
    // Plans unavailable: TestFlight escape hatch (or soft paywall) lets people carry on.
    cta = { label: 'Continue', onPress: onContinue, disabled: !!busy };
  } else if (inFlow && showLoading) {
    cta = { label: 'Loading plans\u2026', onPress: () => {}, disabled: true };
  } else {
    // Hard paywall with no plans: only "Try again" (in the card above) and Restore.
    cta = null;
  }

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        onLayout={onViewport}
      >
        {heroH > 0 ? (
          <Animated.View
            entering={reduceMotion ? undefined : FadeIn.duration(420)}
            style={[styles.heroArt, { width: heroW, height: heroH }]}
          >
            <PremiumHero
              width={heroW}
              height={heroH}
              trackIds={HERO_TRACK_IDS}
              reduceMotion={reduceMotion}
              playing={motionActive}
            />
            {/* The page header already says "Quiett Premium". */}
            {inFlow ? (
              <View style={styles.heroPill} pointerEvents="none">
                <PremiumPill colors={colors} styles={styles} frost />
              </View>
            ) : null}
          </Animated.View>
        ) : null}

        <View onLayout={onTop} style={styles.section}>
          <Animated.View entering={enter(0)} style={styles.hero}>
            {inFlow && heroH === 0 ? <PremiumPill colors={colors} styles={styles} /> : null}
            <Text
              style={[styles.title, compact && styles.titleCompact]}
              accessibilityRole="header"
              maxFontSizeMultiplier={1.4}
            >
              {headline}
            </Text>
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
        </View>

        <View onLayout={onPlans}>
          {BETA_MODE ? (
            <Animated.View entering={enter(2)} style={styles.plans} accessibilityRole="radiogroup">
              {BETA_DEMO_PRICES.map((plan) => {
                const isSelected = betaPlanId === plan.id;
                const sub = [`${trialAdjective(BETA_DEMO_TRIAL)} free trial`, plan.perMonth].filter(Boolean).join(' \u00b7 ');
                const tag = plan.best ? ANNUAL_TAG : null;
                return (
                  <Pressable
                    key={plan.id}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={[plan.title, tag, `${plan.price} per ${plan.per}`, sub].filter(Boolean).join(', ')}
                    onPress={() => {
                      if (!isSelected) hapticSelect();
                      setBetaPlanId(plan.id);
                    }}
                    style={({ pressed }) => [styles.planCard, isSelected && styles.planCardSelected, pressed && styles.pressed]}
                  >
                    <View style={[styles.radio, isSelected && styles.radioOn]}>
                      {isSelected ? (
                        <Animated.View entering={reduceMotion ? undefined : ZoomIn.duration(180)} style={styles.radioDot} />
                      ) : null}
                    </View>
                    <View style={styles.planText}>
                      <View style={styles.planTitleRow}>
                        <Text style={styles.planTitle} numberOfLines={1}>
                          {plan.title}
                        </Text>
                        {tag ? (
                          <View style={styles.tag}>
                            <Text style={styles.tagText}>{tag}</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.planSub}>{sub}</Text>
                    </View>
                    <View style={styles.planPriceCol}>
                      <Text style={styles.planPrice} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                        {plan.price}
                      </Text>
                      <Text style={styles.planPer}>per {plan.per}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </Animated.View>
          ) : showActive ? (
            <View style={styles.stateCard}>
              <Ionicons name="checkmark-circle" size={28} color={colors.calm} />
              <Text style={styles.stateTitle}>
                {devForcePremium && !entitled && !justUnlocked ? 'Premium preview is on (dev)' : 'Quiett Premium is active'}
              </Text>
              {entitled && context === 'page' ? (
                <PrimaryButton
                  label="Manage subscription"
                  variant="secondary"
                  onPress={() => router.push('/manage-subscription')}
                  style={styles.stateBtn}
                />
              ) : null}
            </View>
          ) : showLoading ? (
            <View style={styles.stateCard} accessibilityLabel="Loading plans">
              <ActivityIndicator color={colors.calm} />
            </View>
          ) : plansReady ? (
            <Animated.View entering={enter(2)} style={styles.plans} accessibilityRole="radiogroup">
              {packages.map((pkg) => {
                const info = planInfo(pkg);
                const isSelected = selected?.identifier === pkg.identifier;
                const trial = trialFor(pkg);
                const perMonth = perMonthLabel(pkg);
                const sub = [trial ? `${trialAdjective(trial)} free trial` : null, perMonth]
                  .filter(Boolean)
                  .join(' \u00b7 ');
                const tag = isAnnual(pkg) && packages.length > 1 ? ANNUAL_TAG : null;
                return (
                  <Pressable
                    key={pkg.identifier}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={[
                      info.title,
                      tag,
                      `${pkg.product.priceString}${info.per ? ` per ${info.per}` : ''}`,
                      sub || null,
                    ]
                      .filter(Boolean)
                      .join(', ')}
                    onPress={() => {
                      if (!isSelected) hapticSelect();
                      setSelectedId(pkg.identifier);
                    }}
                    style={({ pressed }) => [styles.planCard, isSelected && styles.planCardSelected, pressed && styles.pressed]}
                  >
                    <View style={[styles.radio, isSelected && styles.radioOn]}>
                      {isSelected ? (
                        <Animated.View entering={reduceMotion ? undefined : ZoomIn.duration(180)} style={styles.radioDot} />
                      ) : null}
                    </View>
                    <View style={styles.planText}>
                      <View style={styles.planTitleRow}>
                        <Text style={styles.planTitle} numberOfLines={1}>
                          {info.title}
                        </Text>
                        {tag ? (
                          <View style={styles.tag}>
                            <Text style={styles.tagText}>{tag}</Text>
                          </View>
                        ) : null}
                      </View>
                      {sub ? <Text style={styles.planSub}>{sub}</Text> : null}
                    </View>
                    <View style={styles.planPriceCol}>
                      <Text style={styles.planPrice} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                        {pkg.product.priceString}
                      </Text>
                      {info.per ? <Text style={styles.planPer}>per {info.per}</Text> : null}
                    </View>
                  </Pressable>
                );
              })}
            </Animated.View>
          ) : showUnavailable ? (
            <Animated.View entering={enter(2)} style={styles.stateCard}>
              <Ionicons name="cloud-offline-outline" size={24} color={colors.textMuted} />
              <Text style={styles.stateTitle}>Plans unavailable right now</Text>
              <Text style={styles.stateBody}>
                {inFlow && (escapeHatch || PAYWALL_DISMISSABLE)
                  ? 'We couldn\u2019t load subscription options. You can try again, or continue for now.'
                  : 'We couldn\u2019t load subscription options. Check your connection and try again.'}
              </Text>
              {available ? (
                <PrimaryButton
                  label={busy === 'retry' ? 'Trying\u2026' : 'Try again'}
                  variant="secondary"
                  disabled={!!busy}
                  onPress={() => void onRetry()}
                  style={styles.stateBtn}
                />
              ) : null}
              {__DEV__ ? (
                <Text style={styles.devHint}>
                  Dev:{' '}
                  {unavailableReason
                    ? describeUnavailableReason(unavailableReason)
                    : offeringsError
                      ? 'getOfferings() failed. Usually the products aren\u2019t in App Store Connect yet, or RevenueCat has no ASC / IAP key.'
                      : 'RevenueCat returned no current offering with packages.'}
                </Text>
              ) : null}
            </Animated.View>
          ) : null}
        </View>

        {plansReady && !showActive ? (
          <View style={styles.terms}>
            {SUBSCRIPTION_TERMS.map((line) => (
              <Text key={line} style={styles.termsText}>
                {line}
              </Text>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <View
        style={[
          styles.footer,
          compact && styles.footerCompact,
          { paddingBottom: insets.bottom + (compact ? spacing.sm : spacing.md) },
        ]}
      >
        {cta ? <PrimaryButton label={cta.label} onPress={cta.onPress} disabled={cta.disabled} /> : null}
        {BETA_MODE ? (
          <Text style={styles.disclosure}>{BETA_CAPTION}</Text>
        ) : null}
        {plansReady && selected && !showActive ? (
          <Text style={styles.disclosure} accessibilityLiveRegion="polite">
            {trialDisclosure(selected, selectedTrial)}
          </Text>
        ) : null}
        <View style={styles.linksRow}>
          {BETA_MODE ? null : (
            <>
              <Pressable
                accessibilityRole="button"
                onPress={() => void onRestore()}
                disabled={!available || !!busy}
                hitSlop={10}
                style={styles.linkHit}
              >
                <Text style={[styles.link, (!available || !!busy) && styles.linkDisabled]}>
                  {busy === 'restore' ? 'Restoring\u2026' : 'Restore purchases'}
                </Text>
              </Pressable>
              <Text style={styles.linkDot}>{'\u00b7'}</Text>
            </>
          )}
          <Pressable accessibilityRole="link" onPress={() => openUrl(TERMS_OF_USE_URL)} hitSlop={10} style={styles.linkHit}>
            <Text style={styles.link}>Terms</Text>
          </Pressable>
          <Text style={styles.linkDot}>{'\u00b7'}</Text>
          <Pressable accessibilityRole="link" onPress={() => openUrl(PRIVACY_POLICY_URL)} hitSlop={10} style={styles.linkHit}>
            <Text style={styles.link}>Privacy</Text>
          </Pressable>
        </View>
        {canSkip ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Not now"
            accessibilityHint="Continues without starting a trial"
            onPress={onContinue}
            disabled={!!busy}
            hitSlop={8}
            style={({ pressed }) => [styles.notNow, pressed && styles.pressed]}
          >
            <Text style={styles.notNowText}>Not now</Text>
          </Pressable>
        ) : null}
        {footerExtra}
      </View>
    </View>
  );
}

type Styles = ReturnType<typeof createStyles>;

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    root: { flex: 1 },
    scroll: { flex: 1 },
    content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.lg, gap: spacing.md },
    section: { gap: spacing.md },
    pressed: { opacity: 0.7 },
    heroArt: { alignSelf: 'center' },
    heroPill: { position: 'absolute', left: 0, right: 0, bottom: spacing.sm, alignItems: 'center' },
    pillFrost: frostPill(colors),
    pillSoft: { ...frostPill(colors), backgroundColor: colors.calmSoft, borderColor: 'transparent' },
    pillLabel: { ...pillText, color: colors.calm },
    hero: { alignItems: 'center', gap: spacing.sm },
    title: { ...typography.title, color: colors.text, textAlign: 'center' },
    titleCompact: { fontSize: 24, lineHeight: 30 },
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
    planCardSelected: { borderColor: colors.calm, borderWidth: 2, backgroundColor: colors.calmSoft },
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
    planTitleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: spacing.sm, rowGap: 4 },
    planTitle: { color: colors.text, fontSize: 16, fontWeight: '600', flexShrink: 1 },
    planSub: { color: colors.textMuted, fontSize: 13 },
    tag: {
      backgroundColor: colors.accentStrong,
      borderRadius: radii.full,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
    },
    tagText: { color: colors.onAccent, fontSize: 11, fontWeight: '700' },
    planPriceCol: { alignItems: 'flex-end', flexShrink: 0, maxWidth: '40%' },
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
    stateBtn: { alignSelf: 'stretch', marginTop: spacing.xs },
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
    footerCompact: { paddingTop: spacing.sm, gap: spacing.xs },
    disclosure: { color: colors.textMuted, fontSize: 12, lineHeight: 17, textAlign: 'center' },
    linksRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
    linkHit: { paddingVertical: 6 },
    link: { color: colors.textMuted, fontSize: 13, fontWeight: '500' },
    linkDisabled: { opacity: 0.45 },
    linkDot: { color: colors.textDim, fontSize: 13 },
    notNow: { alignSelf: 'center', minHeight: 36, paddingHorizontal: spacing.md, justifyContent: 'center' },
    notNowText: { color: colors.textDim, fontSize: 14, fontWeight: '500' },
  });
}
