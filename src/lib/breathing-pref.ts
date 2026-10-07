import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/** Settings → "Breathing light": the soft orb that swells ~5 s in / ~5 s out while meditating. */
const KEY = 'quiett.breathingLight';
let cached: boolean | null = null;
const listeners = new Set<(on: boolean) => void>();

export async function loadBreathingLight(): Promise<boolean> {
  if (cached != null) return cached;
  const raw = await AsyncStorage.getItem(KEY).catch(() => null);
  cached = raw == null ? true : raw === '1';
  return cached;
}

export async function saveBreathingLight(on: boolean): Promise<void> {
  cached = on;
  listeners.forEach((l) => l(on));
  await AsyncStorage.setItem(KEY, on ? '1' : '0').catch(() => {});
}

export function useBreathingLight(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(cached ?? true);
  useEffect(() => {
    let alive = true;
    void loadBreathingLight().then((v) => alive && setOn(v));
    listeners.add(setOn);
    return () => {
      alive = false;
      listeners.delete(setOn);
    };
  }, []);
  return [on, (next: boolean) => void saveBreathingLight(next)];
}
