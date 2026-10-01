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
  hasPremiumEntitlement,
  initPurchases,
  purchasePackage,
  restorePurchases,
  showManageSubscriptions,
  type CustomerInfo,
  type PurchaseOutcome,
  type PurchasesOffering,
  type PurchasesPackage,
  type PurchasesUnavailableReason,
  type RestoreOutcome,
} from '@/lib/purchases';
import {
  enforceFreeUnlockTrack,
  loadDevForcePremium,
  saveDevForcePremium,
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
  customerInfo: CustomerInfo | null;
  purchase: (pkg: PurchasesPackage) => Promise<PurchaseOutcome>;
  restore: () => Promise<RestoreOutcome>;
  refresh: () => Promise<void>;
  manageSubscriptions: () => Promise<void>;
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
  const [devForcePremium, setDevForcePremiumState] = useState(false);
  const [devLoaded, setDevLoaded] = useState(false);
  const [infoSettled, setInfoSettled] = useState(!available);
  /** True only when we have a real answer about the entitlement (not a network error). */
  const [definitive, setDefinitive] = useState(!available);
  const [trackResetVersion, setTrackResetVersion] = useState(0);
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
    } else if (__DEV__) {
      console.warn('[premium] offerings fetch failed', offeringResult.reason);
    }
    setInfoSettled(true);
  }, [available]);

  useEffect(() => {
    alive.current = true;
    void loadDevForcePremium().then((on) => {
      if (!alive.current) return;
      setDevForcePremiumState(on);
      setDevLoaded(true);
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
      customerInfo,
      purchase,
      restore,
      refresh,
      manageSubscriptions: showManageSubscriptions,
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
      customerInfo,
      purchase,
      restore,
      refresh,
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
