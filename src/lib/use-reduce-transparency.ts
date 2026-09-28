import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

/** Live iOS "Reduce Transparency" setting (always false elsewhere). Glass falls back to solid. */
export function useReduceTransparency(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    let alive = true;
    void AccessibilityInfo.isReduceTransparencyEnabled().then((v) => {
      if (alive) setOn(v);
    });
    const sub = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setOn);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return on;
}
