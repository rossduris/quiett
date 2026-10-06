import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { AppState } from 'react-native';
import {
  addCustomerInfoListener,
  fetchCurrentOffering,
  fetchCustomerInfo,
  fetchIntroEligibility,
  hasPremiumEntitlement,
  initPurchases,
  logInPurchases,
  logOutPurchases,
  purchasePackage,
  restorePurchases,
  showManageSubscriptions,
  type CustomerInfo,
  type IntroEligibilityState,
  type PurchaseOutcome,
  type PurchasesOffering,
  type PurchasesPackage,
  type PurchasesUnavailableReason,
  type RestoreOutcome,
} from '@/lib/purchases';
import { useAuth } from '@/lib/auth-provider';
import {
  enforceFreeUnlockTrack,
  loadDevForcePremium,
  loadLastKnownPremium,
  saveDevForcePremium,
  saveLastKnownPremium,
} from '@/lib/storage';

type PremiumContextValue = {
  /** Premium entitlement active (or the dev override is on). */
  isPremium: boolean;
  /** True until the first customer-info / offering fetch settles. */
  loading: boolean;
  /** RevenueCat configured with a native module and API key. */
  available: boolean;
  unavailableReason: PurchasesUnavailableReason | null;
  /** Current offering from RevenueCat (null when unavailable or none configured). */
  offerings: PurchasesOffering | null;
  /** The last offerings fetch failed (network, or products not set up in App Store Connect). */
  offeringsError: boolean;
  /**
   * No plans to buy: purchases off on this build, the offerings fetch failed, or RevenueCat has
   * no current offering with packages. False while the first fetch is still in flight.
   */
  plansUnavailable: boolean;
  /**
   * RevenueCat gave a real answer about the entitlement for the current app user (false after a
   * failed fetch / failed logIn, e.g. offline). Always true when purchases are unavailable.
   */
  entitlementKnown: boolean;
  /**
   * App user id RevenueCat is synced to: a Supabase user id, null for anonymous, undefined until
   * the first sync this launch. Compare with the auth user before trusting `isPremium`.
   */
  purchasesUserId: string | null | undefined;
  /** Last definitive entitlement answer from a previous fetch (persisted), null if never known. */
  lastKnownPremium: boolean | null;
  /** Free-trial eligibility per store product id ('unknown' until StoreKit answers). */
  introEligibility: Record<string, IntroEligibilityState>;
  customerInfo: CustomerInfo | null;
  purchase: (pkg: PurchasesPackage) => Promise<PurchaseOutcome>;
  restore: () => Promise<RestoreOutcome>;
  refresh: () => Promise<void>;
  manageSubscriptions: () => Promise<void>;
  /**
   * Link purchases to the signed-in Supabase user (logIn aliases an anonymous purchase onto the
   * account), or null = signed out → anonymous RevenueCat customer. Sign-in is optional.
   */
  syncUser: (userId: string | null) => Promise<void>;
  /** Bumps when a lapsed/free user's premium track was reset to the default free track. */
  trackResetVersion: number;
  /** __DEV__ only: preview the unlocked state without a purchase. */
  devForcePremium: boolean;
  setDevForcePremium: (on: boolean) => Promise<void>;
};

const PremiumContext = createContext<PremiumContextValue | null>(null);

/**
 * Initialized once in the root layout. Works on every build: without the RevenueCat native
 * module or an API key it runs in "unavailable" mode (free tier, no prices, no crash).
 */
export function PremiumProvider({ children }: PropsWithChildren) {
  const [status] = useState(() => initPurchases());
  const available = status.available;
  const unavailableReason = status.available ? null : status.reason;

  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [offerings, setOfferings] = useState<PurchasesOffering | null>(null);
  const [offeringsError, setOfferingsError] = useState(false);
  const [introEligibility, setIntroEligibility] = useState<Record<string, IntroEligibilityState>>({});
  const [devForcePremium, setDevForcePremiumState] = useState(false);
  const [devLoaded, setDevLoaded] = useState(false);
  const [infoSettled, setInfoSettled] = useState(!available);
  /** True only when we have a real answer about the entitlement (not a network error). */
  const [definitive, setDefinitive] = useState(!available);
  const [trackResetVersion, setTrackResetVersion] = useState(0);
  const [purchasesUserId, setPurchasesUserId] = useState<string | null | undefined>(undefined);
  const [lastKnownPremium, setLastKnownPremium] = useState<boolean | null>(null);
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    if (!available) return;
    const [infoResult, offeringResult] = await Promise.allSettled([
      fetchCustomerInfo(),
      fetchCurrentOffering(),
    ]);
    if (!alive.current) return;
    if (infoResult.status === 'fulfilled') {
      setCustomerInfo(infoResult.value);
      setDefinitive(infoResult.value != null);
    } else if (__DEV__) {
      console.warn('[premium] customer info fetch failed', infoResult.reason);
    }
    if (offeringResult.status === 'fulfilled') {
      setOfferings(offeringResult.value);
      setOfferingsError(false);
    } else {
      setOfferingsError(true);
      if (__DEV__) console.warn('[premium] offerings fetch failed', offeringResult.reason);
    }
    setInfoSettled(true);
    // Trial eligibility (StoreKit): only shown when it isn't known to be used up.
    const productIds =
      offeringResult.status === 'fulfilled' && offeringResult.value
        ? offeringResult.value.availablePackages.map((p) => p.product.identifier)
        : [];
    if (productIds.length > 0) {
      const eligibility = await fetchIntroEligibility(productIds);
      if (alive.current) setIntroEligibility(eligibility);
    }
  }, [available]);

  /** Last user id passed to RevenueCat (undefined = never synced this launch). */
  const syncedUser = useRef<string | null | undefined>(undefined);
  const syncUser = useCallback(
    async (userId: string | null) => {
      if (!available || syncedUser.current === userId) return;
      syncedUser.current = userId;
      // Signed out (including at launch): make sure RevenueCat is anonymous, so Premium comes from
      // the anonymous customer. logOutPurchases is a no-op returning null when it already is;
      // it only does work if RevenueCat still remembers an account the Supabase session lost.
      const info = userId ? await logInPurchases(userId) : await logOutPurchases();
      if (!alive.current) return;
      // A newer sign-in / sign-out started while this one was in flight: let that one finish.
      if (syncedUser.current !== userId) return;
      if (info) {
        setCustomerInfo(info);
        setDefinitive(true);
      } else if (userId) {
        // logIn failed (offline): the customer info on hand belongs to the previous app user.
        setDefinitive(false);
      }
      setPurchasesUserId(userId);
      // Already anonymous with nothing to switch: the launch fetch already has this customer.
      if (info || userId) void refresh();
    },
    [available, refresh]
  );

  useEffect(() => {
    alive.current = true;
    void loadDevForcePremium().then((on) => {
      if (!alive.current) return;
      setDevForcePremiumState(on);
      setDevLoaded(true);
    });
    void loadLastKnownPremium().then((known) => {
      if (alive.current) setLastKnownPremium((prev) => prev ?? known);
    });
    void refresh();
    const unsubscribe = addCustomerInfoListener((info) => {
      if (!alive.current) return;
      setCustomerInfo(info);
      setDefinitive(true);
    });
    // Re-check when the app returns to the foreground (renewals / lapses while away).
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void refresh();
    });
    return () => {
      alive.current = false;
      unsubscribe();
      sub.remove();
    };
  }, [refresh]);

  const entitled = hasPremiumEntitlement(customerInfo);
  const isPremium = entitled || (__DEV__ && devForcePremium);
  const loading = !infoSettled || !devLoaded;
  const plansUnavailable =
    !available || offeringsError || (infoSettled && !(offerings?.availablePackages.length ?? 0));

  // Remember the last real answer so the access gate can open instantly (and offline) next launch.
  useEffect(() => {
    if (!available || loading || !definitive) return;
    void saveLastKnownPremium(entitled).then(() => {
      if (alive.current) setLastKnownPremium(entitled);
    });
  }, [available, loading, definitive, entitled]);

  // Lapse / never-bought fallback: once we KNOW Premium is inactive, make sure no premium track
  // stays selected. Skipped while loading or after a failed fetch, so being offline never
  // downgrades a paying user.
  useEffect(() => {
    if (loading || isPremium || !definitive) return;
    void enforceFreeUnlockTrack().then((reset) => {
      if (reset && alive.current) setTrackResetVersion((v) => v + 1);
    });
  }, [loading, isPremium, definitive]);

  const purchase = useCallback(async (pkg: PurchasesPackage) => {
    const outcome = await purchasePackage(pkg);
    if (outcome.status === 'purchased' && alive.current) {
      setCustomerInfo(outcome.customerInfo);
      setDefinitive(true);
    }
    return outcome;
  }, []);

  const restore = useCallback(async () => {
    const outcome = await restorePurchases();
    if ((outcome.status === 'restored' || outcome.status === 'nothing-found') && alive.current) {
      setCustomerInfo(outcome.customerInfo);
      setDefinitive(true);
    }
    return outcome;
  }, []);

  const setDevForcePremium = useCallback(async (on: boolean) => {
    if (!__DEV__) return;
    setDevForcePremiumState(on);
    await saveDevForcePremium(on);
  }, []);

  const value = useMemo<PremiumContextValue>(
    () => ({
      isPremium,
      loading,
      available,
      unavailableReason,
      offerings,
      offeringsError,
      plansUnavailable,
      entitlementKnown: definitive,
      purchasesUserId,
      lastKnownPremium,
      introEligibility,
      customerInfo,
      purchase,
      restore,
      refresh,
      manageSubscriptions: showManageSubscriptions,
      syncUser,
      trackResetVersion,
      devForcePremium: __DEV__ && devForcePremium,
      setDevForcePremium,
    }),
    [
      isPremium,
      loading,
      available,
      unavailableReason,
      offerings,
      offeringsError,
      plansUnavailable,
      definitive,
      purchasesUserId,
      lastKnownPremium,
      introEligibility,
      customerInfo,
      purchase,
      restore,
      refresh,
      syncUser,
      trackResetVersion,
      devForcePremium,
      setDevForcePremium,
    ]
  );

  return <PremiumContext.Provider value={value}>{children}</PremiumContext.Provider>;
}

export function usePremium(): PremiumContextValue {
  const ctx = useContext(PremiumContext);
  if (!ctx) throw new Error('usePremium must be used inside <PremiumProvider>');
  return ctx;
}

/**
 * True while Quiett Premium is active (entitlement `premium`, or the dev override).
 * With the hard paywall, the whole app (tabs) is gated on this via src/lib/access-gate.ts.
 */
export function useIsPremium(): boolean {
  return usePremium().isPremium;
}

/**
 * Keeps the RevenueCat app user id in step with the Supabase session: signed in → logIn with
 * the Supabase user id, signed out → anonymous. Mount once inside both providers. Renders nothing.
 */
export function PurchasesUserSync() {
  const { user, loading } = useAuth();
  const { syncUser } = usePremium();
  const userId = user?.id ?? null;
  useEffect(() => {
    if (loading) return;
    void syncUser(userId);
  }, [loading, userId, syncUser]);
  return null;
}
