import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Launch feature flags with dev-only overrides (Settings → dev section).
 *  - showGuided: Guided shelf in Library / Home / Meditation sheet. Off for launch; the data
 *    and screens stay in the code so it can come back once real voice guides ship.
 *  - voiceGuides: voice-over layer during the meditation + the Voice picker in Library.
 *  - accountUi: Profile account row (Apple + Google via Supabase). On for release when
 *    EXPO_PUBLIC_SUPABASE_* keys exist; hide in Settings → Developer if needed while iterating.
 * Release builds always use the launch values below; the overrides only exist in __DEV__.
 */
export const SHOW_GUIDED = false;
export const VOICE_GUIDES = false;
/** Account UI on — live app requires Apple/Google; gate auth itself on isSupabaseConfigured(). */
export const ACCOUNT_UI = true;
/** Google sign-in hidden for now (Apple only). Flip to true to restore; code paths stay intact. */
export const GOOGLE_SIGN_IN_ENABLED = false;
/**
 * Sign-in is OPTIONAL: no onboarding sign-in step and no sign-in on the access gate. Purchases
 * and restores work on the anonymous RevenueCat customer; signing in from Profile (AccountRow)
 * links the subscription to the account via Purchases.logIn.
 * Nothing reads this while it's false. If required sign-in comes back, the screen is kept in
 * src/components/account/AccountSignIn.tsx; the onboarding step and gate branch would need
 * re-adding.
 */
export const SIGN_IN_REQUIRED = false;
/**
 * TODO(before release): flip back to true once the App Store Connect subscriptions exist and the
 * RevenueCat store keys are added.
 * false = RevenueCat is fully OFF: Purchases.configure and every react-native-purchases call are
 * skipped (src/lib/purchases.ts), and everyone is treated as Premium (premium-provider), so the
 * access gate never blocks and alarms always schedule. The paywall (onboarding + /paywall) still
 * shows its design with BETA_DEMO_PRICES (src/constants/paywall.ts) and an "Enter beta" button.
 */
export const REVENUECAT_ENABLED = false;

export type DevFlag = 'showGuided' | 'voiceGuides' | 'accountUi';

const KEYS: Record<DevFlag, string> = {
  showGuided: 'quiett.devShowGuided',
  voiceGuides: 'quiett.devVoiceGuides',
  accountUi: 'quiett.devAccountUi',
};

type State = Record<DevFlag, boolean>;

let state: State = { showGuided: false, voiceGuides: false, accountUi: ACCOUNT_UI };
let loaded = false;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

/** Load the dev overrides once (no-op in release). Safe to await from non-React code. */
export function loadDevFlags(): Promise<void> {
  if (loaded || !__DEV__) return Promise.resolve();
  if (loading) return loading;
  loading = AsyncStorage.multiGet([KEYS.showGuided, KEYS.voiceGuides, KEYS.accountUi]).then(
    ([[, g], [, v], [, a]]) => {
      loaded = true;
      const next: State = {
        showGuided: g === '1',
        voiceGuides: v === '1',
        // Unset → launch default (ACCOUNT_UI); explicit '0'/'1' honors the Settings switch.
        accountUi: a == null ? ACCOUNT_UI : a === '1',
      };
      if (
        next.showGuided !== state.showGuided ||
        next.voiceGuides !== state.voiceGuides ||
        next.accountUi !== state.accountUi
      ) {
        state = next;
        emit();
      }
    },
  );
  return loading;
}

function subscribe(listener: () => void) {
  void loadDevFlags();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Current value (launch flag OR dev override). Call `loadDevFlags()` first outside React. */
export function showGuided(): boolean {
  return SHOW_GUIDED || (__DEV__ && state.showGuided);
}

export function voiceGuidesEnabled(): boolean {
  return VOICE_GUIDES || (__DEV__ && state.voiceGuides);
}

export function accountUiEnabled(): boolean {
  // In __DEV__, the Settings switch overrides the launch flag (including force-off).
  if (__DEV__) return state.accountUi;
  return ACCOUNT_UI;
}

/** Raw dev override (for the Settings switches). */
export function useDevFlag(flag: DevFlag): boolean {
  const get = () => (__DEV__ ? state[flag] : false);
  return useSyncExternalStore(subscribe, get, get);
}

export function useShowGuided(): boolean {
  return useSyncExternalStore(subscribe, showGuided, showGuided);
}

export function useVoiceGuidesEnabled(): boolean {
  return useSyncExternalStore(subscribe, voiceGuidesEnabled, voiceGuidesEnabled);
}

export function useAccountUiEnabled(): boolean {
  return useSyncExternalStore(subscribe, accountUiEnabled, accountUiEnabled);
}

export async function setDevFlag(flag: DevFlag, on: boolean): Promise<void> {
  if (!__DEV__) return;
  loaded = true;
  state = { ...state, [flag]: on };
  emit();
  await AsyncStorage.setItem(KEYS[flag], on ? '1' : '0');
}
