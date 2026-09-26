import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Dev toggle for Library / picker cover style:
 *  - 'scenes'  generative SVG scene covers (default, and always in release builds)
 *  - 'art'     illustrated image covers
 *  - 'classic' original single-mark covers
 */
export type CoverStyle = 'art' | 'scenes' | 'classic';

export const COVER_STYLES: readonly CoverStyle[] = ['scenes', 'art', 'classic'];

const KEY = 'quiett.devCoverStyle';
/** Set once the Scenes-default migration has run (a saved 'art' from the old default is dropped once). */
const MIGRATED_KEY = 'quiett.devCoverStyle.scenesDefault';

export const DEFAULT_COVER_STYLE: CoverStyle = 'scenes';

let current: CoverStyle = DEFAULT_COVER_STYLE;
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
  void AsyncStorage.multiGet([KEY, MIGRATED_KEY]).then(([[, raw], [, migrated]]) => {
    let next = isCoverStyle(raw) ? raw : DEFAULT_COVER_STYLE;
    if (!migrated) {
      // 'art' was the old default — reset it to Scenes once; later explicit picks stick.
      if (next === 'art') {
        next = DEFAULT_COVER_STYLE;
        void AsyncStorage.setItem(KEY, next);
      }
      void AsyncStorage.setItem(MIGRATED_KEY, '1');
    }
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
  await AsyncStorage.multiSet([
    [KEY, style],
    [MIGRATED_KEY, '1'],
  ]);
}
