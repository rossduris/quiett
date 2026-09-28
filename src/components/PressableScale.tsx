import { forwardRef, type ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type View, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { usePressScale } from '@/lib/use-press-scale';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  /** Scale reached while pressed (default 0.97). */
  scaleTo?: number;
};

/** Pressable with the shared spring press-scale (dims instead with Reduce Motion). */
export const PressableScale = forwardRef<View, Props>(function PressableScale(
  { style, children, scaleTo, onPressIn, onPressOut, ...rest },
  ref,
) {
  const press = usePressScale(scaleTo);
  return (
    <AnimatedPressable
      ref={ref}
      {...rest}
      onPressIn={(e) => {
        press.handlers.onPressIn();
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        press.handlers.onPressOut();
        onPressOut?.(e);
      }}
      style={[style, press.style]}
    >
      {children}
    </AnimatedPressable>
  );
});
