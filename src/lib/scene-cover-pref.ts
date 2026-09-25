import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Dev toggle for Library / picker cover style:
 *  - 'art'     illustrated image covers (default, and always in release builds)
 *  - 'scenes'  generative SVG scene covers
 *  - 'classic' original single-mark covers
 */
export type CoverStyle = 'art' | 'scenes' | 'classic';

export const COVER_STYLES: readonly CoverStyle[] = ['art', 'scenes', 'classic'];

const KEY = 'quiett.devCoverStyle';

let current: CoverStyle = 'art';
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function isCoverStyle(v: unknown): v is CoverStyle {
  return v === 'art' || v === 'scenes' || v === 'classic';
}

function ensureLoaded() {
  if (loaded || !__DEV__) return;
  loaded = true;
  void AsyncStorage.getItem(KEY).then((raw) => {
    if (isCoverStyle(raw) && raw !== current) {
      current = raw;
      emit();
    }
  });
}

function subscribe(listener: () => void) {
  ensureLoaded();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = (): CoverStyle => (__DEV__ ? current : 'art');

export function useCoverStyle(): CoverStyle {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export async function setCoverStyle(style: CoverStyle): Promise<void> {
  if (!__DEV__) return;
  loaded = true;
  current = style;
  emit();
  await AsyncStorage.setItem(KEY, style);
}
