import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, G } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = {
  size?: number;
  strokeWidth?: number;
  /** 0–1 fill amount */
  progress: number;
  color: string;
  trackColor?: string;
  /** Soft Breathwrk-style outer halos */
  concentric?: boolean;
  /** Gentle pulse on the stroke (alarm idle) */
  pulse?: boolean;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function ProgressRing({
  size = 280,
  strokeWidth = 10,
  progress,
  color,
  trackColor = 'rgba(255,255,255,0.08)',
  concentric = false,
  pulse = false,
  children,
  style,
}: Props) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, progress));

  const progressSv = useSharedValue(clamped);
  const pulseSv = useSharedValue(1);
  const breathSv = useSharedValue(1);

  useEffect(() => {
    progressSv.value = withTiming(clamped, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [clamped, progressSv]);

  useEffect(() => {
    if (pulse) {
      pulseSv.value = withRepeat(
        withTiming(1.035, { duration: 900, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      );
    } else {
      pulseSv.value = withTiming(1, { duration: 200 });
    }
  }, [pulse, pulseSv]);

  useEffect(() => {
    if (concentric) {
      breathSv.value = withRepeat(
        withTiming(1.06, { duration: 3200, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      );
    } else {
      breathSv.value = withTiming(1, { duration: 240 });
    }
  }, [concentric, breathSv]);

  const animatedProps = useAnimatedProps(() => {
    const dash = circumference * progressSv.value;
    return {
      strokeDashoffset: circumference - dash,
    };
  });

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseSv.value }],
  }));

  const breathStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breathSv.value }],
  }));

  return (
    <Animated.View style={[styles.wrap, { width: size, height: size }, style, pulseStyle]}>
      {concentric ? (
        <>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.halo,
              breathStyle,
              {
                width: size + 56,
                height: size + 56,
                borderRadius: (size + 56) / 2,
                borderColor: color,
                opacity: 0.12,
              },
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.halo,
              breathStyle,
              {
                width: size + 28,
                height: size + 28,
                borderRadius: (size + 28) / 2,
                borderColor: color,
                opacity: 0.2,
              },
            ]}
          />
        </>
      ) : null}

      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            animatedProps={animatedProps}
          />
        </G>
      </Svg>

      <View style={styles.center} pointerEvents="box-none">
        {children}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  halo: {
    position: 'absolute',
    borderWidth: 1.5,
  },
});
