import { useEffect, useMemo, useRef, useState, type ElementRef } from 'react';
import { AppState, Platform, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  isLivePoseCameraAvailable,
  QuiettPoseCameraView,
} from 'quiett-pose';
import { PoseStatusChip } from '@/components/PoseStatusChip';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SessionChrome } from '@/components/SessionChrome';
import { spacing, typography } from '@/constants/theme';
import {
  crossfadeToMeditation,
  playHarshAlarm,
  releaseAudio,
  stopAllAudio,
} from '@/lib/audio';
import {
  captureFromCameraRef,
  createOnDevicePoseDetector,
} from '@/lib/pose';
import type { PoseStatus } from '@/lib/pose/types';
import {
  CONFIRM_HOLD_MS,
  formatMmSs,
  reduceSession,
  sitDurationMs,
  type SessionEvent,
  type SessionPhase,
} from '@/lib/session-machine';
import {
  DEFAULT_SIT_MINUTES,
  loadSitMinutes,
  type SitMinutes,
} from '@/lib/storage';
import type { ColorTokens } from '@/constants/themes';
import { useThemeColors } from '@/lib/theme-provider';
import { Ionicons } from '@expo/vector-icons';

const PRACTICE_DURATION_SEC = 30;

const PHASE_TONE: Record<SessionPhase, number> = {
  alarming: 0,
  detecting: 0.45,
  meditating: 1,
  completed: 1,
  emergency: 0,
};

function ringColorFor(phase: SessionPhase, colors: ColorTokens): string {
  switch (phase) {
    case 'alarming':
      return colors.alarm;
    case 'detecting':
      return colors.sunrise;
    case 'meditating':
      return colors.calm;
    default:
      return colors.mist;
  }
}

export default function TestMorningScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<SessionPhase>('alarming');
  const [pose, setPose] = useState<PoseStatus>('absent');
  const [confirmLeft, setConfirmLeft] = useState(CONFIRM_HOLD_MS);
  const [sitLeft, setSitLeft] = useState(PRACTICE_DURATION_SEC * 1000);
  const [cameraReady, setCameraReady] = useState(false);

  const preferLive = isLivePoseCameraAvailable();
  const cameraRef = useRef<ElementRef<typeof CameraView>>(null);
  const confirmStart = useRef<number | null>(null);
  const sitStart = useRef<number | null>(null);
  const sitAccrued = useRef(0);
  const finishing = useRef(false);

  const phaseTone = useSharedValue<number>(PHASE_TONE.alarming);

  const detector = useMemo(
    () =>
      preferLive
        ? createOnDevicePoseDetector({ mode: 'live' })
        : createOnDevicePoseDetector({
            mode: 'capture',
            captureFrame: captureFromCameraRef(cameraRef),
          }),
    [preferLive],
  );

  const dispatch = (event: SessionEvent) => {
    setPhase((prev) => reduceSession(prev, event));
  };

  useEffect(() => {
    void (async () => {
      await playHarshAlarm();
    })();
    return () => {
      void stopAllAudio();
      releaseAudio();
    };
  }, []);

  useEffect(() => {
    phaseTone.value = withTiming(PHASE_TONE[phase], {
      duration: 480,
      easing: Easing.inOut(Easing.cubic),
    });
  }, [phase, phaseTone]);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [permission, requestPermission]);

  useEffect(() => {
    if (!permission?.granted || !cameraReady) return;
    detector.start();
    const unsub = detector.subscribe((sample) => {
      setPose(sample.status);
    });
    return () => {
      unsub();
      detector.stop();
    };
  }, [detector, permission?.granted, cameraReady]);

  useEffect(() => {
    if (pose === 'holding') dispatch({ type: 'POSE_HOLDING' });
    else dispatch({ type: 'POSE_BROKEN' });
  }, [pose]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    if (phase === 'alarming') {
      confirmStart.current = null;
      if (sitStart.current != null) {
        sitAccrued.current += Date.now() - sitStart.current;
        sitStart.current = null;
      }
      setConfirmLeft(CONFIRM_HOLD_MS);
      void playHarshAlarm();
    }

    if (phase === 'detecting') {
      void playHarshAlarm();
      if (confirmStart.current == null) confirmStart.current = Date.now();
      interval = setInterval(() => {
        const start = confirmStart.current;
        if (!start) return;
        const left = CONFIRM_HOLD_MS - (Date.now() - start);
        setConfirmLeft(Math.max(0, left));
        if (left <= 0) dispatch({ type: 'CONFIRM_ELAPSED' });
      }, 100);
    } else {
      confirmStart.current = null;
    }

    if (phase === 'meditating') {
      void crossfadeToMeditation();
      if (sitStart.current == null) sitStart.current = Date.now();
      interval = setInterval(() => {
        const start = sitStart.current;
        if (!start) return;
        const elapsed = sitAccrued.current + (Date.now() - start);
        const left = PRACTICE_DURATION_SEC * 1000 - elapsed;
        setSitLeft(Math.max(0, left));
        if (left <= 0 && !finishing.current) {
          finishing.current = true;
          dispatch({ type: 'SIT_COMPLETE' });
        }
      }, 100);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [phase]);

  useEffect(() => {
    if (phase === 'completed') {
      void (async () => {
        await stopAllAudio();
        releaseAudio();
        router.replace({
          pathname: '/test-success',
        });
      })();
    }
  }, [phase, router]);

  const timerLabel = phase === 'meditating' ? formatMmSs(sitLeft) : '30s (practice)';

  const confirmProgress = 1 - confirmLeft / CONFIRM_HOLD_MS;
  const sitProgress = 1 - sitLeft / (PRACTICE_DURATION_SEC * 1000);
  const scrimStyle = useAnimatedStyle(() => {
    const overlay = interpolateColor(
      phaseTone.value,
      [0, 0.45, 1],
      ['rgba(255,92,92,0.28)', 'rgba(10,18,32,0.45)', 'rgba(10,18,32,0.55)'],
    );
    return { backgroundColor: overlay };
  });

  const glowStyle = useAnimatedStyle(() => {
    const glow = interpolateColor(
      phaseTone.value,
      [0, 0.45, 1],
      ['rgba(255,92,92,0.35)', 'rgba(232,160,106,0.20)', 'rgba(224,122,85,0.18)'],
    );
    return { backgroundColor: glow };
  });

  if (!permission) {
    return <View style={styles.screen} />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.screen, styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.permTitle}>Camera access needed</Text>
        <Text style={styles.permBody}>
          Quiett uses the front camera to confirm you are in frame. Pose runs on-device with Apple
          Vision — frames never leave your phone.
        </Text>
        <PrimaryButton label="Grant camera" onPress={() => void requestPermission()} />
        <PrimaryButton label="Cancel" variant="ghost" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.cameraLayer}>
        {preferLive ? (
          <QuiettPoseCameraView
            style={StyleSheet.absoluteFill}
            isActive={phase !== 'completed'}
            onCameraReady={() => {
              setCameraReady(true);
            }}
            onMountError={(message) => {
              console.warn('[quiett] live camera', message);
              setCameraReady(false);
            }}
          />
        ) : (
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing="front"
            mute
            onCameraReady={() => {
              setCameraReady(true);
            }}
            onMountError={(e) => {
              console.warn('[quiett] camera', e);
              setCameraReady(false);
            }}
          />
        )}
        <Animated.View pointerEvents="none" style={[styles.scrim, scrimStyle]} />
        <Animated.View pointerEvents="none" style={[styles.glowTop, glowStyle]} />
      </View>

      <View
        style={[
          styles.ui,
          {
            paddingTop: insets.top + spacing.sm,
            paddingBottom: insets.bottom + spacing.md,
          },
        ]}
      >
        <View style={styles.top}>
          <View style={styles.practiceBadge}>
            <Ionicons name="flask-outline" size={14} color={colors.calm} />
            <Text style={styles.practiceBadgeText}>Practice mode</Text>
          </View>
          <PoseStatusChip status={pose} />
        </View>

        <View style={styles.center}>
          <SessionChrome
            phase={phase}
            confirmProgress={confirmProgress}
            sitProgress={sitProgress}
            timerLabel={timerLabel}
            ringColor={ringColorFor(phase, colors)}
          />
        </View>

        <View style={styles.bottom}>
          <PrimaryButton
            label="End practice"
            variant="ghost"
            onPress={() => router.back()}
          />
        </View>
      </View>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    cameraLayer: {
      ...StyleSheet.absoluteFill,
      backgroundColor: colors.bg,
    },
    scrim: {
      ...StyleSheet.absoluteFill,
    },
    glowTop: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      height: '38%',
      opacity: 0.55,
    },
    ui: {
      flex: 1,
      paddingHorizontal: spacing.lg,
      justifyContent: 'space-between',
    },
    top: {
      alignItems: 'center',
      gap: spacing.sm,
      minHeight: 40,
    },
    practiceBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: colors.calmSoft,
      borderWidth: 1,
      borderColor: colors.calm,
    },
    practiceBadgeText: {
      color: colors.calm,
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bottom: {
      gap: spacing.md,
      alignItems: 'center',
    },
    centered: {
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      gap: spacing.md,
    },
    permTitle: { ...typography.title, color: colors.text, textAlign: 'center' },
    permBody: {
      ...typography.body,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 22,
    },
  });
}
