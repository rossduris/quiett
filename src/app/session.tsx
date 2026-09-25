import { useEffect, useMemo, useRef, useState, type ElementRef } from 'react';
import { AppState, Linking, StyleSheet, Text, View, type AppStateStatus } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { StatusBar } from 'expo-status-bar';
import {
  isLivePoseCameraAvailable,
  QuiettPoseCameraView,
} from 'quiett-pose';
import { EmergencyHoldButton } from '@/components/EmergencyHoldButton';
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

/** Friendly duration for the pre-lock copy ("Then 2 minutes of quiet"). */
function friendlyDuration(minutes: SitMinutes): string {
  if (minutes === 0.5) return '30 seconds';
  return `${minutes} minutes`;
}

export default function SessionScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<SessionPhase>('alarming');
  const [sitMinutes, setSitMinutes] = useState<SitMinutes>(DEFAULT_SIT_MINUTES);
  const [durationReady, setDurationReady] = useState(false);
  const [pose, setPose] = useState<PoseStatus>('absent');
  const [confirmLeft, setConfirmLeft] = useState(CONFIRM_HOLD_MS);
  const [sitLeft, setSitLeft] = useState(() => sitDurationMs(DEFAULT_SIT_MINUTES));
  const durationMs = sitDurationMs(sitMinutes);
  const [cameraReady, setCameraReady] = useState(false);
  const [wakeIntention, setWakeIntention] = useState('');

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
    if (permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [permission, requestPermission]);

  // Returning from iOS Settings: re-read camera permission so the session continues.
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
          params: {
            streak: String(streak.count),
            ...(wakeIntention.trim() ? { intention: wakeIntention.trim() } : {}),
          },
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

  const timerLabel = phase === 'meditating' ? formatMmSs(sitLeft) : friendlyDuration(sitMinutes);

  const confirmProgress = 1 - confirmLeft / CONFIRM_HOLD_MS;
  const sitProgress = durationMs > 0 ? 1 - sitLeft / durationMs : 0;

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
                : 'Camera access is off for Quiett. Turn it on in Settings, then come back to settle in. It all happens on your phone \u2014 nothing is sent anywhere.'}
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
          {/* No casual "Not now" during a real alarm: the only way out is the same
              emergency hold as the session (resets streak, reschedules, stops audio). */}
          <EmergencyHoldButton onConfirm={() => dispatch({ type: 'EMERGENCY_DISMISS' })} />
        </View>
      </View>
    );
  }

  const cameraView = preferLive ? (
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
            camera={cameraView}
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
  intention: {
    ...typography.body,
    fontStyle: 'italic',
    color: colors.sessionTextMuted,
    textAlign: 'center',
    paddingTop: spacing.xs,
    paddingHorizontal: spacing.lg,
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
  permTitle: { ...typography.title, fontWeight: '500', color: colors.sessionText, textAlign: 'center' },
  permBody: {
    ...typography.body,
    color: colors.sessionTextMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
});
}
