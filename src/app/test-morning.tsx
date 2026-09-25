import { useEffect, useMemo, useRef, useState, type ElementRef } from 'react';
import { AppState, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { StatusBar } from 'expo-status-bar';
import {
  isLivePoseCameraAvailable,
  QuiettPoseCameraView,
} from 'quiett-pose';
import { PoseStatusChip } from '@/components/PoseStatusChip';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SessionBackdrop } from '@/components/SessionBackdrop';
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
  type SessionEvent,
  type SessionPhase,
} from '@/lib/session-machine';
import { saveTestMorningCompleted } from '@/lib/storage';
import type { ColorTokens } from '@/constants/themes';
import { useThemeColors } from '@/lib/theme-provider';
import { Ionicons } from '@expo/vector-icons';

const PRACTICE_DURATION_SEC = 30;

export default function TestMorningScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission, getPermission] = useCameraPermissions();
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
    if (permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [permission, requestPermission]);

  // Returning from iOS Settings: re-read camera permission.
  const permissionGranted = permission?.granted ?? false;
  useEffect(() => {
    if (permissionGranted) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void getPermission();
    });
    return () => sub.remove();
  }, [permissionGranted, getPermission]);

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
        await saveTestMorningCompleted(true);
        router.replace({
          pathname: '/test-success',
        });
      })();
    }
  }, [phase, router]);

  const timerLabel = phase === 'meditating' ? formatMmSs(sitLeft) : '30 seconds';

  const confirmProgress = 1 - confirmLeft / CONFIRM_HOLD_MS;
  const sitProgress = 1 - sitLeft / (PRACTICE_DURATION_SEC * 1000);

  if (!permission) {
    return <View style={styles.screen} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.screen}>
        <StatusBar style="light" />
        <SessionBackdrop />
        <View
          style={[
            styles.permContent,
            { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.md },
          ]}
        >
          <View style={styles.permCopy}>
            <Text style={styles.permTitle}>Let Quiett see you</Text>
            <Text style={styles.permBody}>
              {permission.canAskAgain
                ? 'Your front camera gently checks that you\u2019re settled and still. It all happens on your phone \u2014 nothing is sent anywhere.'
                : 'Camera access is off for Quiett. Turn it on in Settings, then come back to practice. It all happens on your phone \u2014 nothing is sent anywhere.'}
            </Text>
            <PrimaryButton
              label={permission.canAskAgain ? 'Allow camera' : 'Open Settings'}
              onPress={() => {
                if (permission.canAskAgain) void requestPermission();
                else void Linking.openSettings();
              }}
              style={styles.permCta}
            />
          </View>
          <View style={styles.bottom}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Not now"
              onPress={() => router.back()}
              style={({ pressed }) => [styles.endBtn, pressed && styles.endBtnPressed]}
            >
              <Text style={styles.endBtnText}>Not now</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  const cameraView = preferLive ? (
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
  );

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <SessionBackdrop />

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
            <Ionicons name="leaf-outline" size={13} color={colors.sessionGlow} />
            <Text style={styles.practiceBadgeText}>Practice run · 30 seconds</Text>
          </View>
          <PoseStatusChip status={pose} />
        </View>

        <View style={styles.center}>
          <SessionChrome
            phase={phase}
            confirmProgress={confirmProgress}
            sitProgress={sitProgress}
            timerLabel={timerLabel}
            camera={cameraView}
          />
        </View>

        <View style={styles.bottom}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="End practice"
            onPress={() => router.back()}
            style={({ pressed }) => [styles.endBtn, pressed && styles.endBtnPressed]}
          >
            <Text style={styles.endBtnText}>End practice</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.sessionBgTop,
    },
    permContent: {
      flex: 1,
      paddingHorizontal: spacing.lg,
      justifyContent: 'space-between',
    },
    permCopy: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: spacing.md,
    },
    permCta: { alignSelf: 'stretch', marginTop: spacing.sm },
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
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    practiceBadgeText: {
      color: colors.sessionGlow,
      fontSize: 12,
      fontWeight: '600',
      letterSpacing: 0.4,
    },
    endBtn: {
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.sessionHairline,
      backgroundColor: colors.sessionChipBg,
      paddingVertical: 14,
      paddingHorizontal: spacing.lg,
      minWidth: 220,
      alignItems: 'center',
    },
    endBtnPressed: { backgroundColor: colors.sessionGlowSoft },
    endBtnText: {
      color: colors.sessionTextMuted,
      fontSize: 15,
      fontWeight: '500',
      letterSpacing: 0.2,
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
    permTitle: {
      ...typography.title,
      fontWeight: '500',
      color: colors.sessionText,
      textAlign: 'center',
    },
    permBody: {
      ...typography.body,
      color: colors.sessionTextMuted,
      textAlign: 'center',
      lineHeight: 22,
    },
  });
}
