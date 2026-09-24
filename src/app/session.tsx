import { useEffect, useMemo, useRef, useState, type ElementRef } from 'react';
import { AppState, StyleSheet, Text, View, type AppStateStatus } from 'react-native';
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
import { EmergencyHoldButton } from '@/components/EmergencyHoldButton';
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
  sitDurationLabel,
  sitDurationMs,
  type SessionEvent,
  type SessionPhase,
} from '@/lib/session-machine';
import {
  breakStreak,
  DEFAULT_SIT_MINUTES,
  isWakeResolvedToday,
  loadAlarmPrefs,
  loadSitMinutes,
  recordSuccessfulSit,
  type SitMinutes,
  loadWakeIntention,
} from '@/lib/storage';
import {
  armMeditationDeadMan,
  clearMeditationDeadMan,
  completeOsAlarmAndReschedule,
  prepareBailSoundCarriers,
  rearmOsAlarmAfterBail,
  silenceOsRingForSession,
} from '@/lib/os-alarm';
import type { ColorTokens } from '@/constants/themes';
import { useThemeColors } from '@/lib/theme-provider';

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

export default function SessionScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<SessionPhase>('alarming');
  const [sitMinutes, setSitMinutes] = useState<SitMinutes>(DEFAULT_SIT_MINUTES);
  const [durationReady, setDurationReady] = useState(false);
  const [pose, setPose] = useState<PoseStatus>('absent');
  const [confirmLeft, setConfirmLeft] = useState(CONFIRM_HOLD_MS);
  const [sitLeft, setSitLeft] = useState(() => sitDurationMs(DEFAULT_SIT_MINUTES));
  const durationMs = sitDurationMs(sitMinutes);
  const durationLabel = sitDurationLabel(sitMinutes);
  const [cameraReady, setCameraReady] = useState(false);
  const [wakeIntention, setWakeIntention] = useState('');

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
    let alive = true;
    (async () => {
      const [minutes, intention] = await Promise.all([loadSitMinutes(), loadWakeIntention()]);
      if (!alive) return;
      setSitMinutes(minutes);
      setSitLeft(sitDurationMs(minutes));
      setDurationReady(true);
      setWakeIntention(intention);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // OS AlarmKit + in-app harsh alarm must not dual-play: silence system ring, keep ours.
  const missionDone = useRef(false);
  useEffect(() => {
    void (async () => {
      await silenceOsRingForSession();
      // Pre-register custom-sound carriers while foreground (bail backups after lock).
      void prepareBailSoundCarriers();
      // Slide-to-stop / Sit handoff: resume user's selected alarm tone until prop+unlock.
      await playHarshAlarm();
    })();
    return () => {
      if (!missionDone.current) {
        void stopAllAudio();
        void rearmOsAlarmAfterBail();
      }
    };
  }, []);

  // Gate pose → phase while backgrounded so a dead camera does not exit meditating
  // before bail re-arm runs (POSE_BROKEN would bounce meditating → alarming).
  const appActive = useRef(AppState.currentState === 'active');
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  useEffect(() => {
    let inactiveArm: ReturnType<typeof setTimeout> | null = null;
    const clearInactiveArm = () => {
      if (inactiveArm) {
        clearTimeout(inactiveArm);
        inactiveArm = null;
      }
    };

    const onAppState = (state: AppStateStatus) => {
      if (missionDone.current) return;
      if (state === 'active') {
        clearInactiveArm();
        appActive.current = true;
        // Back in /session — kill OS nag; resume the right in-app bed by phase.
        void silenceOsRingForSession().then(() => {
          if (phaseRef.current === 'meditating') {
            void crossfadeToMeditation();
            // Restore dead-man after silence cancelled backups.
            void armMeditationDeadMan();
          } else {
            void playHarshAlarm();
          }
        });
        return;
      }
      if (state === 'inactive') {
        // App switcher: JS still runs briefly — arm now so force-quit still nags.
        // Short debounce so Control Center peeks that return to active cancel the arm.
        appActive.current = false;
        clearInactiveArm();
        inactiveArm = setTimeout(() => {
          if (missionDone.current) return;
          if (AppState.currentState === 'active') return;
          void rearmOsAlarmAfterBail();
          void stopAllAudio();
        }, 250);
        return;
      }
      if (state === 'background') {
        clearInactiveArm();
        appActive.current = false;
        void rearmOsAlarmAfterBail();
        void stopAllAudio();
      }
    };
    const sub = AppState.addEventListener('change', onAppState);
    return () => {
      clearInactiveArm();
      sub.remove();
    };
  }, []);


  // Force-quit during countdown skips background JS — keep a native backup armed ahead.
  useEffect(() => {
    if (phase !== 'meditating') {
      void clearMeditationDeadMan();
      return;
    }
    let alive = true;
    const tick = () => {
      if (!alive || missionDone.current) return;
      if (!appActive.current) return;
      void armMeditationDeadMan();
    };
    tick();
    const id = setInterval(tick, 5_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [phase]);

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
    // Ignore pose loss while backgrounded/inactive — camera freeze is not a real break,
    // and it was aborting meditating before swipe-away could re-arm.
    if (!appActive.current) return;
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

    if (phase === 'meditating' && durationReady) {
      void crossfadeToMeditation();
      if (sitStart.current == null) sitStart.current = Date.now();
      interval = setInterval(() => {
        const start = sitStart.current;
        if (!start) return;
        const elapsed = sitAccrued.current + (Date.now() - start);
        const left = durationMs - elapsed;
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
  }, [phase, durationMs, durationReady]);

  useEffect(() => {
    if (phase === 'completed') {
      void (async () => {
        missionDone.current = true;
        await stopAllAudio();
        const streak = await recordSuccessfulSit();
        const prefs = await loadAlarmPrefs();
        await completeOsAlarmAndReschedule(prefs);
        releaseAudio();
        router.replace({
          pathname: '/success',
          params: { streak: String(streak.count) },
        });
      })();
    }
    if (phase === 'emergency') {
      void (async () => {
        missionDone.current = true;
        await stopAllAudio();
        await breakStreak();
        // Keep tomorrow's schedule; ring already silenced at session open.
        const prefs = await loadAlarmPrefs();
        await completeOsAlarmAndReschedule(prefs);
        releaseAudio();
        router.replace('/emergency');
      })();
    }
  }, [phase, router]);

  useEffect(
    () => () => {
      void stopAllAudio();
      releaseAudio();
    },
    [],
  );

  const timerLabel =
    phase === 'meditating'
      ? formatMmSs(sitLeft)
      : durationLabel.replace(' (dev)', '');

  const confirmProgress = 1 - confirmLeft / CONFIRM_HOLD_MS;
  const sitProgress = durationMs > 0 ? 1 - sitLeft / durationMs : 0;
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
            isActive={phase !== 'completed' && phase !== 'emergency'}
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
          <PoseStatusChip status={pose} />
          {wakeIntention.length > 0 && phase === 'meditating' && (
            <Text style={styles.intention}>{wakeIntention}</Text>
          )}
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
          <EmergencyHoldButton onConfirm={() => dispatch({ type: 'EMERGENCY_DISMISS' })} />
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
  intention: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    opacity: 0.85,
    paddingTop: spacing.xs,
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
