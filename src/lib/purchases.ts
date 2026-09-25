/**
 * RevenueCat wrapper for Quiett Premium.
 *
 * Why this file exists: `react-native-purchases` needs a native module (RNPurchases) that only
 * ships in a dev/production build made AFTER the package was installed. Older dev builds, Expo
 * Go, and web do not have it. Everything in the app talks to RevenueCat through here, and this
 * module never touches the SDK unless the native module is really present and an API key is set.
 *
 * Safety rules:
 * - Only `import type` from 'react-native-purchases' at module scope (erased at compile time).
 * - The runtime `require('react-native-purchases')` happens lazily, after checking
 *   `NativeModules.RNPurchases`, and is wrapped in try/catch.
 * - No key → "unavailable" mode. We never fall back to RevenueCat's Expo Go preview/mock data,
 *   so the paywall can never show fake prices.
 */
import { Linking, NativeModules, Platform } from 'react-native';
import type {
  CustomerInfo,
  PurchasesEntitlementInfo,
  PurchasesOffering,
  PurchasesPackage,
} from 'react-native-purchases';

export type { CustomerInfo, PurchasesOffering, PurchasesPackage };

/** Entitlement identifier configured in the RevenueCat dashboard. */
export const PREMIUM_ENTITLEMENT_ID = 'premium';

export const APP_STORE_SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions';

export type PurchasesUnavailableReason =
  | 'unsupported-platform'
  | 'no-native-module'
  | 'no-api-key'
  | 'configure-failed';

export type PurchasesStatus =
  | { available: true }
  | { available: false; reason: PurchasesUnavailableReason };

type PurchasesSdk = typeof import('react-native-purchases');

let sdk: PurchasesSdk | null | undefined; // undefined = not resolved yet
let status: PurchasesStatus | null = null;

function nativeModulePresent(): boolean {
  try {
    return NativeModules != null && NativeModules.RNPurchases != null;
  } catch {
    return false;
  }
}

function loadSdk(): PurchasesSdk | null {
  if (sdk !== undefined) return sdk;
  sdk = null;
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return null;
  // Current dev builds without the native module stop here: the JS package is never required,
  // so nothing can throw or red-box.
  if (!nativeModulePresent()) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    sdk = require('react-native-purchases') as PurchasesSdk;
  } catch {
    sdk = null;
  }
  return sdk;
}

function readApiKey(): string | null {
  const key =
    Platform.OS === 'ios'
      ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY
      : Platform.OS === 'android'
        ? process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY
        : undefined;
  const trimmed = typeof key === 'string' ? key.trim() : '';
  return trimmed.length > 0 ? trimmed : null;
}

/** Configure RevenueCat once. Safe to call many times; returns the cached status. */
export function initPurchases(): PurchasesStatus {
  if (status) return status;
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    status = { available: false, reason: 'unsupported-platform' };
    return status;
  }
  if (!nativeModulePresent()) {
    status = { available: false, reason: 'no-native-module' };
    return status;
  }
  const apiKey = readApiKey();
  if (!apiKey) {
    status = { available: false, reason: 'no-api-key' };
    return status;
  }
  const mod = loadSdk();
  if (!mod) {
    status = { available: false, reason: 'no-native-module' };
    return status;
  }
  try {
    if (__DEV__) {
      void mod.default.setLogLevel(mod.LOG_LEVEL.WARN).catch(() => {});
    }
    mod.default.configure({ apiKey });
    status = { available: true };
  } catch (e) {
    if (__DEV__) console.warn('[purchases] configure failed', e);
    status = { available: false, reason: 'configure-failed' };
  }
  return status;
}

export function purchasesStatus(): PurchasesStatus {
  return status ?? initPurchases();
}

function ready(): PurchasesSdk | null {
  return purchasesStatus().available ? loadSdk() : null;
}

/** Short, dev-facing explanation used in __DEV__ hints only. */
export function describeUnavailableReason(reason: PurchasesUnavailableReason): string {
  switch (reason) {
    case 'unsupported-platform':
      return 'This platform has no App Store purchases.';
    case 'no-native-module':
      return 'This build has no RevenueCat native module yet — rebuild the dev client.';
    case 'no-api-key':
      return 'EXPO_PUBLIC_REVENUECAT_IOS_KEY is not set (.env.local), so purchases are off.';
    case 'configure-failed':
      return 'RevenueCat failed to configure — check the API key.';
  }
}

export function premiumEntitlement(info: CustomerInfo | null): PurchasesEntitlementInfo | null {
  return info?.entitlements.active[PREMIUM_ENTITLEMENT_ID] ?? null;
}

export function hasPremiumEntitlement(info: CustomerInfo | null): boolean {
  return premiumEntitlement(info) != null;
}

export async function fetchCustomerInfo(): Promise<CustomerInfo | null> {
  const mod = ready();
  if (!mod) return null;
  return mod.default.getCustomerInfo();
}

/** The "current" offering from the RevenueCat dashboard (no product ids are hard-coded). */
export async function fetchCurrentOffering(): Promise<PurchasesOffering | null> {
  const mod = ready();
  if (!mod) return null;
  const offerings = await mod.default.getOfferings();
  const current = offerings.current;
  if (!current || current.availablePackages.length === 0) return null;
  return current;
}

export type PurchaseOutcome =
  | { status: 'purchased'; customerInfo: CustomerInfo; premium: boolean }
  | { status: 'cancelled' }
  | { status: 'unavailable' }
  | { status: 'error'; message: string };

export async function purchasePackage(pkg: PurchasesPackage): Promise<PurchaseOutcome> {
  const mod = ready();
  if (!mod) return { status: 'unavailable' };
  try {
    const { customerInfo } = await mod.default.purchasePackage(pkg);
    return { status: 'purchased', customerInfo, premium: hasPremiumEntitlement(customerInfo) };
  } catch (e: unknown) {
    const err = e as { userCancelled?: boolean | null; code?: string; message?: string };
    if (
      err?.userCancelled ||
      err?.code === mod.PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR
    ) {
      return { status: 'cancelled' };
    }
    return { status: 'error', message: err?.message ?? 'The purchase did not go through.' };
  }
}

export type RestoreOutcome =
  | { status: 'restored'; customerInfo: CustomerInfo }
  | { status: 'nothing-found'; customerInfo: CustomerInfo }
  | { status: 'unavailable' }
  | { status: 'error'; message: string };

export async function restorePurchases(): Promise<RestoreOutcome> {
  const mod = ready();
  if (!mod) return { status: 'unavailable' };
  try {
    const customerInfo = await mod.default.restorePurchases();
    return hasPremiumEntitlement(customerInfo)
      ? { status: 'restored', customerInfo }
      : { status: 'nothing-found', customerInfo };
  } catch (e: unknown) {
    const err = e as { message?: string };
    return { status: 'error', message: err?.message ?? 'Could not reach the App Store.' };
  }
}

/** Subscribe to customer info changes (renewals, expirations, purchases on other devices). */
export function addCustomerInfoListener(cb: (info: CustomerInfo) => void): () => void {
  const mod = ready();
  if (!mod) return () => {};
  try {
    mod.default.addCustomerInfoUpdateListener(cb);
  } catch {
    return () => {};
  }
  return () => {
    try {
      mod.default.removeCustomerInfoUpdateListener(cb);
    } catch {
      // ignore
    }
  };
}

/** Opens Apple's subscription management sheet, or the App Store account page as a fallback. */
export async function showManageSubscriptions(): Promise<void> {
  const mod = ready();
  if (mod && Platform.OS === 'ios') {
    try {
      await mod.default.showManageSubscriptions();
      return;
    } catch {
      // fall through to the URL
    }
  }
  await Linking.openURL(APP_STORE_SUBSCRIPTIONS_URL).catch(() => {});
}
