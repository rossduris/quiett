import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ElementRef } from 'react';
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
import { PoseDebugOverlay, PoseDebugReadout } from '@/components/PoseDebugOverlay';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SessionBackdrop } from '@/components/SessionBackdrop';
import { SessionChrome } from '@/components/SessionChrome';
import { spacing, typography } from '@/constants/theme';
import { rollSurpriseTrack } from '@/lib/surprise-session';
import {
  crossfadeToMeditation,
  handoffBacktrackToSuccess,
  playHarshAlarm,
  releaseAudio,
  stopAllAudio,
} from '@/lib/audio';
import {
  captureFromCameraRef,
  createOnDevicePoseDetector,
} from '@/lib/pose';
import type { PoseDiagnostics, PoseStatus } from '@/lib/pose/types';
import { usePoseDebugOverlay, usePoseDetectorMode } from '@/lib/pose-dev-pref';
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
  loadAlarmPrefs,
  loadSitMinutes,
  recordSuccessfulSit,
  loadStreak,
  loadEarnedBadges,
  type SitMinutes,
  type BadgeId,
  loadWakeIntention,
  loadUnlockTrackId,
  loadSurpriseMe,
} from '@/lib/storage';
import { useGentleBrightness } from '@/lib/gentle-brightness';
import {
  armMeditationDeadMan,
  clearMeditationDeadMan,
  finalizeWakeResolution,
  prepareBailSoundCarriers,
  rearmOsAlarmAfterBail,
  silenceOsRingForSession,
  syncOsAlarm,
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
  // Read by the completion effect (keyed on phase only) without re-running it.
  const wakeIntentionRef = useRef('');
  useLayoutEffect(() => {
    wakeIntentionRef.current = wakeIntention;
  });
  const [trackId, setTrackId] = useState<string | null>(null);
  const [bottomH, setBottomH] = useState(96);
  const [topH, setTopH] = useState(40);
  // Night-friendly: at dawn the screen eases up gently from the user's own brightness (restored on exit).
  useGentleBrightness(true);

  const preferLive = isLivePoseCameraAvailable();
  const cameraRef = useRef<ElementRef<typeof CameraView>>(null);
  const confirmStart = useRef<number | null>(null);
  const sitStart = useRef<number | null>(null);
  const sitAccrued = useRef(0);
  const finishing = useRef(false);

  // Pose detector: body2d by default (auto-falls back to legacy); dev Settings can pick one (incl. 3D). Overlay: dev only.
  const poseDetectorMode = usePoseDetectorMode();
  const poseDebugOverlay = usePoseDebugOverlay() && __DEV__;
  const poseDebugOverlayRef = useRef(poseDebugOverlay);
  useLayoutEffect(() => {
    poseDebugOverlayRef.current = poseDebugOverlay;
  });
  const [poseDiag, setPoseDiag] = useState<PoseDiagnostics | undefined>(undefined);
  const [poseFps, setPoseFps] = useState<number | undefined>(undefined);
  const lastDiagAt = useRef<number | null>(null);

  const detector = useMemo(
    () =>
      preferLive
        ? createOnDevicePoseDetector({ mode: 'live', detector: poseDetectorMode })
        : createOnDevicePoseDetector({
            mode: 'capture',
            captureFrame: captureFromCameraRef(cameraRef),
          }),
    [preferLive, poseDetectorMode],
  );

  const dispatch = (event: SessionEvent) => {
    setPhase((prev) => reduceSession(prev, event));
  };

  const [surpriseOn, setSurpriseOn] = useState(false);
  const [prefsReady, setPrefsReady] = useState(false);
  const surpriseRolled = useRef(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [minutes, intention, track, surprise] = await Promise.all([
        loadSitMinutes(),
        loadWakeIntention(),
        loadUnlockTrackId().catch(() => null),
        loadSurpriseMe(),
      ]);
      if (!alive) return;
      setSurpriseOn(surprise);
      // Surprise me does not reveal a track until the meditation starts.
      if (!surprise) setTrackId(track);
      setSitMinutes(minutes);
      setSitLeft(sitDurationMs(minutes));
      setDurationReady(true);
      setWakeIntention(intention);
      setPrefsReady(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // OS AlarmKit + in-app harsh alarm must not dual-play: silence system ring, keep ours.
  const missionDone = useRef(false);
  /** Shared across remounts so a deferred bail re-arm from a raced unmount can be cancelled. */
  const bailRearmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (bailRearmTimer.current) {
      clearTimeout(bailRearmTimer.current);
      bailRearmTimer.current = null;
    }
    void (async () => {
      await silenceOsRingForSession();
      if (cancelled) return;
      // Pre-register custom-sound carriers while foreground (bail backups after lock).
      void prepareBailSoundCarriers();
      // Stop / Settle-in handoff: resume user's selected alarm tone until pose+unlock.
      await playHarshAlarm();
    })();
    return () => {
      cancelled = true;
      if (missionDone.current) return;
      void stopAllAudio();
      // Defer bail re-arm briefly so a Strict Mode remount / Gate replace race does not
      // arm a backup and bounce the wake before /session sticks (permission CTA stays put).
      if (bailRearmTimer.current) clearTimeout(bailRearmTimer.current);
      bailRearmTimer.current = setTimeout(() => {
        bailRearmTimer.current = null;
        if (missionDone.current) return;
        void rearmOsAlarmAfterBail();
      }, 500);
    };
  }, []);

  // Gate pose → phase while backgrounded so a dead camera does not exit meditating
  // before bail re-arm runs (POSE_BROKEN would bounce meditating → alarming).
  const appActive = useRef(AppState.currentState === 'active');
  const phaseRef = useRef(phase);
  useLayoutEffect(() => {
    phaseRef.current = phase;
  });

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
      if (poseDebugOverlayRef.current && sample.diagnostics) {
        const d = sample.diagnostics;
        const prev = lastDiagAt.current;
        if (prev !== d.timestamp) {
          if (prev != null && d.timestamp > prev) {
            const inst = 1000 / (d.timestamp - prev);
            setPoseFps((f) => (f == null ? inst : f * 0.8 + inst * 0.2));
          }
          lastDiagAt.current = d.timestamp;
          setPoseDiag(d);
        }
      }
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

    if (phase === 'meditating' && durationReady && prefsReady) {
      void (async () => {
        if (surpriseOn && !surpriseRolled.current) {
          surpriseRolled.current = true;
          const id = await rollSurpriseTrack();
          setTrackId(id);
        }
        await crossfadeToMeditation();
      })();
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
  }, [phase, durationMs, durationReady, prefsReady, surpriseOn]);

  useEffect(() => {
    // Resolve every wake flag BEFORE navigating. AlarmHandoffGate re-runs on pathname
    // change; if sticky/handoff still look "live" it will bounce straight back into
    // /session (the hours-later reopen + end-early-noop bug). Reschedule can trail.
    if (phase === 'completed') {
      missionDone.current = true;
      // The backtrack keeps playing into /success (fades out when the user leaves it);
      // only the alarm and voice stop here.
      handoffBacktrackToSuccess();
      void (async () => {
        try {
          await finalizeWakeResolution();
        } catch (e) {
          console.warn('[quiett] finalize wake', e);
        }
        // Snapshot streak + badges so /success can animate exactly what changed (no guesses).
        const [prevStreak, prevBadges] = await Promise.all([
          loadStreak().catch(() => null),
          loadEarnedBadges().catch((): BadgeId[] => []),
        ]);
        const streak = await recordSuccessfulSit();
        const newBadges = (await loadEarnedBadges().catch(() => prevBadges)).filter((b) => !prevBadges.includes(b));
        router.replace({
          pathname: '/success',
          params: {
            streak: String(streak.count),
            ...(prevStreak ? { prev: String(prevStreak.count) } : {}),
            ...(newBadges.length ? { badges: newBadges.join(',') } : {}),
            ...(wakeIntentionRef.current.trim() ? { intention: wakeIntentionRef.current.trim() } : {}),
          },
        });
        try {
          const prefs = await loadAlarmPrefs();
          if (prefs.enabled) await syncOsAlarm(prefs);
        } catch (e) {
          console.warn('[quiett] reschedule alarm', e);
        } finally {
          releaseAudio();
        }
      })();
    }
    if (phase === 'emergency') {
      missionDone.current = true;
      void stopAllAudio();
      void (async () => {
        try {
          // Must finish before replace('/emergency') — Gate watches pathname.
          await finalizeWakeResolution();
        } catch (e) {
          console.warn('[quiett] finalize wake', e);
        }
        await breakStreak().catch((e) => console.warn('[quiett] break streak', e));
        router.replace('/emergency');
        try {
          const prefs = await loadAlarmPrefs();
          if (prefs.enabled) await syncOsAlarm(prefs);
        } catch (e) {
          console.warn('[quiett] reschedule alarm', e);
        } finally {
          releaseAudio();
        }
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
      detectorMode={poseDetectorMode}
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

      <SessionChrome
        phase={phase}
        pose={pose}
        confirmProgress={confirmProgress}
        sitProgress={sitProgress}
        timerLabel={formatMmSs(sitLeft)}
        durationLabel={friendlyDuration(sitMinutes)}
        secondsLeft={phase === 'meditating' ? Math.ceil(sitLeft / 1000) : undefined}
        trackId={trackId}
        wakeIntention={wakeIntention}
        debugOverlay={poseDebugOverlay}
        topInset={insets.top + spacing.sm + topH}
        bottomInset={insets.bottom + spacing.md + bottomH}
        camera={
          poseDebugOverlay && preferLive ? (
            <PoseDebugOverlay diagnostics={poseDiag}>{cameraView}</PoseDebugOverlay>
          ) : (
            cameraView
          )
        }
      />

      <View
        pointerEvents="box-none"
        style={[
          styles.ui,
          {
            paddingTop: insets.top + spacing.sm,
            paddingBottom: insets.bottom + spacing.md,
          },
        ]}
      >
        <View style={styles.top} pointerEvents="box-none" onLayout={(e) => setTopH(e.nativeEvent.layout.height)}>
          {poseDebugOverlay ? <PoseDebugReadout diagnostics={poseDiag} fps={poseFps} /> : null}
        </View>

        <View style={styles.bottom} onLayout={(e) => setBottomH(e.nativeEvent.layout.height)}>
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
