import React, { useCallback } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { notifyLivePoseFrame } from './liveBridge';
import type { NativePoseResult } from './types';

type NativeEvent<T> = { nativeEvent: T };

type NativeProps = {
  style?: StyleProp<ViewStyle>;
  isActive?: boolean;
  mirror?: boolean;
  onPoseFrame?: (event: NativeEvent<NativePoseResult>) => void;
  onCameraReady?: (event: NativeEvent<Record<string, never>>) => void;
  onMountError?: (event: NativeEvent<{ message?: string }>) => void;
};

type Props = {
  style?: StyleProp<ViewStyle>;
  /** When false, capture session pauses (default true). */
  isActive?: boolean;
  /** Mirror preview like a selfie (default true). */
  mirror?: boolean;
  onPoseFrame?: (frame: NativePoseResult) => void;
  onCameraReady?: () => void;
  onMountError?: (message: string) => void;
};

let NativeView: React.ComponentType<NativeProps> | null = null;
try {
  // Expo Modules: prefer requireNativeViewManager; fall back to requireNativeView.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const core = require('expo-modules-core') as {
    requireNativeViewManager?: <T>(name: string) => React.ComponentType<T>;
    requireNativeView?: <T>(name: string) => React.ComponentType<T>;
  };
  if (typeof core.requireNativeViewManager === 'function') {
    NativeView = core.requireNativeViewManager<NativeProps>('QuiettPose');
  } else if (typeof core.requireNativeView === 'function') {
    NativeView = core.requireNativeView<NativeProps>('QuiettPose');
  }
} catch {
  NativeView = null;
}

/**
 * Live front-camera preview + on-device Vision (~8–10 fps).
 * Prefer this over expo-camera stills when native is available.
 */
export function QuiettPoseCameraView({
  style,
  isActive = true,
  mirror = true,
  onPoseFrame,
  onCameraReady,
  onMountError,
}: Props) {
  const handleFrame = useCallback(
    (event: NativeEvent<NativePoseResult>) => {
      const frame = event?.nativeEvent ?? (event as unknown as NativePoseResult);
      const normalized: NativePoseResult = {
        available: !!frame?.available,
        faceCount: frame?.faceCount ?? 0,
        joints: frame?.joints ?? {},
        faceLooking: !!frame?.faceLooking,
        bothEyesVisible: !!frame?.bothEyesVisible,
        mouthVisible: !!frame?.mouthVisible,
        handNearFace: !!(frame?.handNearFace ?? frame?.handsVisible),
        handsVisible: !!(frame?.handsVisible ?? frame?.handNearFace),
        handCount: frame?.handCount ?? 0,
        faceYaw: frame?.faceYaw,
        faceRoll: frame?.faceRoll,
        facePitch: frame?.facePitch,
        brightness: frame?.brightness,
        brightEnough:
          frame?.brightEnough === undefined ? true : !!frame?.brightEnough,
        timestamp: frame?.timestamp ?? Date.now(),
      };
      notifyLivePoseFrame(normalized);
      onPoseFrame?.(normalized);
    },
    [onPoseFrame],
  );

  if (!NativeView || Platform.OS === 'web') {
    return (
      <View style={[styles.fallback, style]}>
        <Text style={styles.fallbackText}>Live pose camera unavailable</Text>
      </View>
    );
  }

  return (
    <NativeView
      style={style}
      isActive={isActive}
      mirror={mirror}
      onPoseFrame={handleFrame}
      onCameraReady={() => onCameraReady?.()}
      onMountError={(e) =>
        onMountError?.(e?.nativeEvent?.message ?? 'Camera failed to start')
      }
    />
  );
}

export function isQuiettPoseCameraViewAvailable(): boolean {
  return NativeView != null && Platform.OS === 'ios';
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: '#0B0F14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: { color: '#8B95A8', fontSize: 13, padding: 16, textAlign: 'center' },
});
