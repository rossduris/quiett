import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Dev toggle for Library / picker cover style:
 *  - 'scenes'  generative SVG scene covers (default, and always in release builds)
 *  - 'classic' original single-mark covers
 * (The illustrated 'art' style was removed for launch; a saved 'art' reads back as Scenes.)
 */
export type CoverStyle = 'scenes' | 'classic';

export const COVER_STYLES: readonly CoverStyle[] = ['scenes', 'classic'];

const KEY = 'quiett.devCoverStyle';

export const DEFAULT_COVER_STYLE: CoverStyle = 'scenes';

let current: CoverStyle = DEFAULT_COVER_STYLE;
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function isCoverStyle(v: unknown): v is CoverStyle {
  return v === 'scenes' || v === 'classic';
}

function ensureLoaded() {
  if (loaded || !__DEV__) return;
  loaded = true;
  void AsyncStorage.getItem(KEY).then((raw) => {
    const next = isCoverStyle(raw) ? raw : DEFAULT_COVER_STYLE;
    if (next !== current) {
      current = next;
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

const getSnapshot = (): CoverStyle => (__DEV__ ? current : DEFAULT_COVER_STYLE);

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
