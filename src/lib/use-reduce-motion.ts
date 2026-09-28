import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** Live "Reduce Motion" setting (AccessibilityInfo). Animations fall back to simple fades. */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((on) => {
      if (alive) setReduce(on);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduce;
}
