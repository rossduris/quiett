import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { enterStagger } from '@/lib/motion';
import { useReduceMotion } from '@/lib/use-reduce-motion';

/** Wraps a section so it rises in as item `index` of a staggered group (first mount only). */
export function EnterStagger({ index, base = 0, style, children }: { index: number; base?: number; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const reduce = useReduceMotion();
  return (
    <Animated.View entering={enterStagger(index, reduce, base)} style={style}>
      {children}
    </Animated.View>
  );
}
