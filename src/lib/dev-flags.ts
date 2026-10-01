import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Launch feature flags with dev-only overrides (Settings → dev section).
 *  - showGuided: Guided shelf in Library / Home / Meditation sheet. Off for launch; the data
 *    and screens stay in the code so it can come back once real voice guides ship.
 *  - voiceGuides: voice-over layer during the meditation + the Voice picker in Library.
 *  - accountUi: Profile account row (Sign in with Apple, "Save streak across devices").
 *    Off for launch until real sign-in and sync exist.
 * Release builds always use the launch values below; the overrides only exist in __DEV__.
 */
export const SHOW_GUIDED = false;
export const VOICE_GUIDES = false;
export const ACCOUNT_UI = false;

export type DevFlag = 'showGuided' | 'voiceGuides' | 'accountUi';

const KEYS: Record<DevFlag, string> = {
  showGuided: 'quiett.devShowGuided',
  voiceGuides: 'quiett.devVoiceGuides',
  accountUi: 'quiett.devAccountUi',
};

type State = Record<DevFlag, boolean>;

let state: State = { showGuided: false, voiceGuides: false, accountUi: false };
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
      const next: State = { showGuided: g === '1', voiceGuides: v === '1', accountUi: a === '1' };
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
  return ACCOUNT_UI || (__DEV__ && state.accountUi);
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
