import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AppState,
  BackHandler,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCameraPermissions } from 'expo-camera';
import DateTimePicker from '@react-native-community/datetimepicker';
import Animated, { FadeIn, FadeInLeft, FadeInRight } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { deviceUses24h, formatClock } from '@/lib/time-format';
import { SpringPill } from '@/components/SpringPill';
import { PrimaryButton } from '@/components/PrimaryButton';
import { AnimatedScene } from '@/components/onboarding/art/AnimatedScene';
import { artPalette } from '@/components/onboarding/art/art-palette';
import {
  alarmCalmLayout,
  snoozeLayout,
  sunriseLayout,
  uprightLayout,
} from '@/components/onboarding/art/scene-layouts';
import { ParallaxHills } from '@/components/onboarding/ParallaxHills';
import { ProgressSegments } from '@/components/onboarding/ProgressSegments';
import { SnoozeChart } from '@/components/onboarding/SnoozeChart';
import {
  CheckRow,
  GoalChoices,
  HowSteps,
  SoundChoices,
  StepText,
  ToneChoices,
} from '@/components/onboarding/OnboardingParts';
import { radii, spacing, typography } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';
import { MORNING_GOALS, SNOOZE_CHART_COPY, morningGoalById, type MorningGoalId } from '@/constants/onboarding';
import { freeUnlockTracks, type UnlockTrack } from '@/constants/unlock-tracks';
import { DEFAULT_ALARM_SOUND_ID, alarmSoundById, meditationSoundById } from '@/constants/sounds';
import { followPreviewSelection, previewIds, stopPreview, usePreviewPlayer } from '@/lib/audio';
import {
  getNotificationPermissionStatus,
  requestNotificationPermissions,
  scheduleEveningReminder,
  syncEveningReminder,
} from '@/lib/notifications';
import {
  getOsAlarmPermission,
  openOsAlarmSettings,
  requestOsAlarmPermission,
  applyAlarmSoundChange,
  syncOsAlarm,
  type OsAlarmPermissionState,
} from '@/lib/os-alarm';
import {
  clearWakeResolved,
  dayKey,
  formatWeekdayHint,
  WEEKDAY_DISPLAY_ORDER,
  WEEKDAY_SHORT,
  loadAlarmPrefs,
  loadAlarmSoundId,
  loadEveningReminderPrefs,
  loadOnboardingGoal,
  loadSurpriseMe,
  loadUnlockTrackId,
  loadWakeIntention,
  nextAlarmDate,
  saveAlarmPrefs,
  saveAlarmSoundId,
  DEFAULT_ALARM,
  saveEveningReminderPrefs,
  saveOnboardingComplete,
  saveOnboardingGoal,
  saveSurpriseMe,
  saveUnlockTrackId,
  saveWakeIntention,
  type AlarmPrefs,
  type Weekday,
} from '@/lib/storage';
import { useThemeColors } from '@/lib/theme-provider';
import { useReduceMotion } from '@/lib/use-reduce-motion';

/**
 * First-run flow: hook → problem → how it works → goal → wake time → alarm tone → first
 * sound → camera (rationale + prompt) → alarms + optional evening reminder (rationale +
 * prompts) → commitment, which starts the practice run or goes Home. No paywall here.
 */
const STEPS = ['welcome', 'problem', 'snooze', 'how', 'goal', 'time', 'tone', 'sound', 'camera', 'alarm', 'commit'] as const;
type StepId = (typeof STEPS)[number];

/** Steps with a full-bleed scene of their own (the background hills step aside). */
const SCENE_STEPS: readonly StepId[] = ['welcome', 'commit'];

/** Preferred picks for variety (music + ambient). Only used if they're free in the catalog. */
const FIRST_SOUND_PREFS = ['music:soft-pad', 'music:warm-drone', 'music:low-cloud', 'ambient:night_crickets', 'ambient:calm_waves'];
const FIRST_SOUND_COUNT = 5;

/** Free, non-guided tracks for the first-sound step — never Premium, whatever the catalog says. */
const FIRST_SOUNDS: readonly UnlockTrack[] = (() => {
  const free = freeUnlockTracks().filter((t) => t.kind !== 'guided');
  const preferred = FIRST_SOUND_PREFS.map((id) => free.find((t) => t.id === id)).filter((t): t is UnlockTrack => t != null);
  const rest = free.filter((t) => !preferred.includes(t));
  return [...preferred, ...rest].slice(0, FIRST_SOUND_COUNT);
})();

function parseTime(hhmm: string): Date {
  const [h, m] = hhmm.split(':').map((n) => parseInt(n, 10));
  const d = new Date();
  d.setHours(Number.isFinite(h) ? h : 7, Number.isFinite(m) ? m : 0, 0, 0);
  return d;
}

function toHhMm(d: Date): string {
  return `${`${d.getHours()}`.padStart(2, '0')}:${`${d.getMinutes()}`.padStart(2, '0')}`;
}

function displayTime(hhmm: string): string {
  return formatClock(parseTime(hhmm));
}

/** "Tomorrow" / "Today" / "Monday" for the next ring. */
function ringDayLabel(date: Date | null, now = new Date()): string {
  if (!date) return 'Tomorrow';
  const key = dayKey(0, date);
  if (key === dayKey(0, now)) return 'Today';
  if (key === dayKey(1, now)) return 'Tomorrow';
  return date.toLocaleDateString([], { weekday: 'long' });
}

type Action = { label: string; onPress: () => void };

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const palette = useMemo(() => artPalette(colors), [colors]);
  const reduceMotion = useReduceMotion();

  const [stepIndex, setStepIndex] = useState(0);
  const step: StepId = STEPS[stepIndex]!;
  // Slide direction: forward when the step index goes up, back when it goes down.
  const [prevStep, setPrevStep] = useState(0);
  const [direction, setDirection] = useState(1);
  if (stepIndex !== prevStep) {
    setDirection(stepIndex > prevStep ? 1 : -1);
    setPrevStep(stepIndex);
  }

  const [alarm, setAlarm] = useState<AlarmPrefs>(() => ({
    ...DEFAULT_ALARM,
    weekdays: [...DEFAULT_ALARM.weekdays],
  }));
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);
  const [alarmPerm, setAlarmPerm] = useState<OsAlarmPermissionState>('notDetermined');
  const [camera, requestCamera, getCamera] = useCameraPermissions();
  const [notifStatus, setNotifStatus] = useState<'granted' | 'denied' | 'undetermined'>(
    'undetermined',
  );
  const [reminderOn, setReminderOn] = useState(false);
  const [reminderTime, setReminderTime] = useState('20:00');
  const [wantReminder, setWantReminder] = useState(true);
  const [goal, setGoal] = useState<MorningGoalId | null>(null);
  const [trackId, setTrackId] = useState<string>(FIRST_SOUNDS[0]?.id ?? '');
  const [toneId, setToneId] = useState(DEFAULT_ALARM_SOUND_ID);
  const [busy, setBusy] = useState(false);
  const launchedPractice = useRef(false);
  const { playingId, toggle: togglePreview } = usePreviewPlayer();

  const refreshStatuses = useCallback(async () => {
    const [perm, notif, reminder] = await Promise.all([
      getOsAlarmPermission(),
      getNotificationPermissionStatus(),
      loadEveningReminderPrefs(),
    ]);
    setAlarmPerm(perm);
    setNotifStatus(notif);
    setReminderOn(reminder.enabled && notif === 'granted');
    setReminderTime(reminder.time);
    void getCamera();
  }, [getCamera]);

  // Prefill from saved prefs (replay / partially set up) and read current permission states.
  useEffect(() => {
    let alive = true;
    void loadAlarmPrefs().then((prefs) => {
      if (alive) setAlarm({ ...prefs, enabled: true });
    });
    void loadOnboardingGoal().then((g) => {
      if (alive && morningGoalById(g)) setGoal(g as MorningGoalId);
    });
    void loadUnlockTrackId().then((id) => {
      if (alive && FIRST_SOUNDS.some((t) => t.id === id)) setTrackId(id);
    });
    void loadAlarmSoundId().then((id) => {
      if (alive) setToneId(alarmSoundById(id).id);
    });
    void refreshStatuses();
    return () => {
      alive = false;
    };
  }, [refreshStatuses]);

  // Previews belong to the step that started them.
  useEffect(() => {
    return () => stopPreview();
  }, [step]);

  // Coming back from iOS Settings: pick up any permission the user just changed.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshStatuses();
    });
    return () => sub.remove();
  }, [refreshStatuses]);

  // Previews only play on the sound step.
  useEffect(() => {
    if (step !== 'sound') stopPreview();
  }, [step]);
  useEffect(() => () => stopPreview(), []);

  // After the practice run (finished or ended early) we land back here → go Home.
  useFocusEffect(
    useCallback(() => {
      if (!launchedPractice.current) return;
      launchedPractice.current = false;
      router.replace('/(tabs)');
    }, [router]),
  );

  const goTo = useCallback((index: number) => {
    setStepIndex(Math.max(0, Math.min(STEPS.length - 1, index)));
  }, []);
  const next = useCallback(() => {
    setStepIndex((i) => Math.min(STEPS.length - 1, i + 1));
  }, []);
  const back = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  // Android hardware back steps backwards instead of leaving onboarding.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stepIndex === 0) return false;
      back();
      return true;
    });
    return () => sub.remove();
  }, [stepIndex, back]);

  const finish = async (practice: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      await saveOnboardingComplete(true);
      // Schedule like Home does — only when alarms are allowed (never re-prompt here).
      if ((await getOsAlarmPermission()) === 'authorized') {
        void syncOsAlarm(await loadAlarmPrefs());
      }
      void syncEveningReminder();
      if (practice) {
        // Prime the camera here (quiet screen) rather than inside the practice alarm.
        if (camera && !camera.granted && camera.canAskAgain) await requestCamera();
        launchedPractice.current = true;
        router.push('/test-morning');
      } else {
        router.replace('/(tabs)');
      }
    } finally {
      setBusy(false);
    }
  };

  // ── Step handlers ──────────────────────────────────────────────────────────

  const saveGoalAndContinue = async () => {
    const chosen = morningGoalById(goal);
    if (chosen) {
      await saveOnboardingGoal(chosen.id);
      // Seed the first wake-up intention, never overwriting one the user wrote.
      if (!(await loadWakeIntention()).trim()) await saveWakeIntention(chosen.intention);
    }
    next();
  };

  const selectTone = (opt: { id: string; url: string | number | null }) => {
    setToneId(opt.id);
    const id = previewIds.alarm(opt.id);
    // Same as the Home sheet: a playing preview follows the new tone, or stops for System
    // default (no in-app file). Nothing playing yet → the row is play/stop.
    if (playingId != null && playingId !== id) followPreviewSelection(id, opt.url, 'alarm');
    else if (opt.url != null) togglePreview(id, opt.url, 'alarm');
    else stopPreview();
  };

  const saveToneAndContinue = async () => {
    stopPreview();
    await saveAlarmSoundId(toneId);
    // The time step may already have scheduled the alarm with the previous tone.
    if (alarmPerm === 'authorized') {
      const prefs = await loadAlarmPrefs();
      void applyAlarmSoundChange({ ...prefs, enabled: true });
    }
    next();
  };

  const saveTimeAndContinue = async () => {
    const prefs: AlarmPrefs = { ...alarm, enabled: true };
    await saveAlarmPrefs(prefs);
    await clearWakeResolved();
    if (alarmPerm === 'authorized') void syncOsAlarm(prefs);
    next();
  };

  const selectSound = (track: UnlockTrack) => {
    setTrackId(track.id);
    const url = meditationSoundById(track.playbackSoundId).url;
    const id = previewIds.track(track.id);
    // Another sound playing → crossfade to this one. Otherwise the row is the play/stop control
    // (this step has no separate play button): tap plays, tapping the playing row stops.
    if (playingId != null && playingId !== id) followPreviewSelection(id, url, 'track');
    else if (url != null) togglePreview(id, url, 'track');
  };

  const saveSoundAndContinue = async () => {
    stopPreview();
    if (trackId) {
      await saveUnlockTrackId(trackId);
      // Picking a sound turns Surprise me off (same as Library).
      if (await loadSurpriseMe()) await saveSurpriseMe(false);
    }
    next();
  };

  const toggleDay = (day: Weekday) => {
    setAlarm((prev) => {
      const set = new Set(prev.weekdays);
      if (set.has(day)) {
        if (set.size === 1) return prev; // keep at least one day
        set.delete(day);
      } else {
        set.add(day);
      }
      return { ...prev, weekdays: Array.from(set).sort((a, b) => a - b) as Weekday[] };
    });
  };

  const onTimeChange = (_e: unknown, date?: Date) => {
    if (Platform.OS === 'android') setShowAndroidPicker(false);
    if (!date) return;
    setAlarm((prev) => ({ ...prev, time: toHhMm(date) }));
  };

  /** Evening reminder opt-in (checkbox on the alarm step). Never blocks moving on. */
  const maybeEnableReminder = async () => {
    if (!wantReminder || reminderOn || notifStatus === 'denied') return;
    const granted = await requestNotificationPermissions();
    setNotifStatus(granted ? 'granted' : 'denied');
    if (!granted) return;
    await saveEveningReminderPrefs({ enabled: true, time: reminderTime });
    await scheduleEveningReminder();
    setReminderOn(true);
  };

  const allowAlarms = async () => {
    setBusy(true);
    try {
      const state = await requestOsAlarmPermission();
      setAlarmPerm(state);
      if (state === 'authorized') {
        const prefs = await loadAlarmPrefs();
        void syncOsAlarm({ ...prefs, enabled: true });
        await maybeEnableReminder();
        next();
      }
    } finally {
      setBusy(false);
    }
  };

  const continueFromAlarm = async () => {
    setBusy(true);
    try {
      await maybeEnableReminder();
      next();
    } finally {
      setBusy(false);
    }
  };

  const allowCamera = async () => {
    const res = await requestCamera();
    if (res.granted) next();
  };

  // ── Scenes (stable per size / theme so animations don't restart on re-render) ──

  const artW = width - spacing.lg * 2;
  const heroH = Math.round(Math.min(280, height * 0.34));
  const sceneH = Math.round(Math.min(220, height * 0.27));
  const welcomeScene = useMemo(() => sunriseLayout(artW, heroH, palette), [artW, heroH, palette]);
  const commitScene = useMemo(() => sunriseLayout(artW, heroH, palette, { rings: true }), [artW, heroH, palette]);
  const problemScene = useMemo(() => snoozeLayout(artW, sceneH, palette), [artW, sceneH, palette]);
  const cameraScene = useMemo(() => uprightLayout(artW, sceneH, palette), [artW, sceneH, palette]);
  const alarmScene = useMemo(() => alarmCalmLayout(artW, sceneH, palette), [artW, sceneH, palette]);

  // ── Step content ───────────────────────────────────────────────────────────

  const wakeSummary = `${displayTime(alarm.time)}, ${formatWeekdayHint(alarm.weekdays)}`;
  const cameraGranted = camera?.granted ?? false;
  const cameraBlocked = !!camera && !camera.granted && !camera.canAskAgain;
  const chosenGoal = morningGoalById(goal);
  const nextRing = nextAlarmDate(alarm.time, alarm.weekdays);

  let content: ReactNode = null;
  let primary: Action;
  let secondary: Action | undefined;
  let note: { text: string; tone: 'ok' | 'info' } | undefined;
  let skip: (() => void) | undefined;
  let primaryDisabled = false;

  switch (step) {
    case 'welcome':
      content = (
        <View style={styles.block}>
          <AnimatedScene layout={welcomeScene} reduceMotion={reduceMotion} radius={radii.xl} />
          <StepText
            eyebrow="Quiett"
            title="Mornings that start quietly."
            body="An alarm that only stops once you’re up and still. Then two calm minutes, before anything else."
            center
          />
        </View>
      );
      primary = { label: 'Get started', onPress: next };
      break;

    case 'problem':
      content = (
        <View style={styles.block}>
          <AnimatedScene layout={problemScene} reduceMotion={reduceMotion} radius={radii.xl} />
          <StepText
            title="Snooze. Scroll. Rush."
            body="Most mornings start with a snooze button and a feed. By the time you’re up, the day already feels loud."
          />
        </View>
      );
      primary = { label: 'There’s a calmer way', onPress: next };
      skip = () => goTo(STEPS.indexOf('goal'));
      break;

    case 'snooze':
      content = (
        <View style={styles.block}>
          <StepText title={SNOOZE_CHART_COPY.title} />
          <SnoozeChart width={artW} reduceMotion={reduceMotion} />
          <Text style={styles.chartCaption}>{SNOOZE_CHART_COPY.stat ?? SNOOZE_CHART_COPY.caption}</Text>
          <Text style={styles.chartFootnote}>{SNOOZE_CHART_COPY.footnote}</Text>
        </View>
      );
      primary = { label: 'Show me how', onPress: next };
      skip = () => goTo(STEPS.indexOf('goal'));
      break;

    case 'how':
      content = (
        <View style={styles.block}>
          <StepText title="How Quiett works" />
          <HowSteps reduceMotion={reduceMotion} />
        </View>
      );
      primary = { label: 'Continue', onPress: next };
      skip = () => goTo(STEPS.indexOf('goal'));
      break;

    case 'goal':
      content = (
        <View style={styles.block}>
          <StepText
            title="What do you want from your mornings?"
            body="Pick one to set your first wake-up intention. You can change it anytime."
          />
          <GoalChoices goals={MORNING_GOALS} selected={goal} onSelect={setGoal} />
        </View>
      );
      primary = { label: 'Continue', onPress: () => void saveGoalAndContinue() };
      primaryDisabled = !goal;
      skip = next;
      break;

    case 'time':
      content = (
        <View style={styles.block}>
          <StepText
            title="When should your morning begin?"
            body="Pick a time and the days to ring. You can change it anytime on Home."
          />
          {/* iOS: a plain View so VoiceOver can reach the picker wheels (a Pressable would
              group them into one element). Android: tap the card to open the dialog. */}
          {Platform.OS === 'ios' ? (
            <View style={styles.timeCard}>
              <Text style={styles.bigTime} maxFontSizeMultiplier={1.3} accessibilityLabel={`Wake time ${displayTime(alarm.time)}`}>
                {displayTime(alarm.time)}
              </Text>
              {/* No locale / is24Hour: iOS follows the device 12/24-hour setting. */}
              <DateTimePicker
                value={parseTime(alarm.time)}
                mode="time"
                display="spinner"
                onValueChange={onTimeChange}
                themeVariant={colors.statusBarStyle === 'dark' ? 'light' : 'dark'}
                textColor={colors.text}
                style={styles.picker}
              />
            </View>
          ) : (
            <Pressable
              onPress={() => setShowAndroidPicker(true)}
              accessibilityRole="button"
              accessibilityLabel={`Wake time ${displayTime(alarm.time)}`}
              accessibilityHint="Opens the time picker"
              style={styles.timeCard}
            >
              <Text style={styles.bigTime} maxFontSizeMultiplier={1.3}>{displayTime(alarm.time)}</Text>
              {showAndroidPicker ? (
                <DateTimePicker
                  value={parseTime(alarm.time)}
                  mode="time"
                  display="spinner"
                  is24Hour={deviceUses24h()}
                  onValueChange={onTimeChange}
                  onDismiss={() => setShowAndroidPicker(false)}
                />
              ) : (
                <Text style={styles.caption}>Tap to change</Text>
              )}
            </Pressable>
          )}
          <View style={styles.dayPills}>
            {WEEKDAY_DISPLAY_ORDER.map((day: Weekday) => {
              const label = WEEKDAY_SHORT[day];
              const selected = alarm.weekdays.includes(day);
              return (
                <SpringPill
                  key={day}
                  selected={selected}
                  label={label}
                  onPress={() => toggleDay(day)}
                  style={styles.pill}
                  selectedStyle={styles.pillSelected}
                  textStyle={styles.pillText}
                  selectedTextStyle={styles.pillTextSelected}
                  accessibilityRole="checkbox"
                  accessibilityLabel={label}
                  accessibilityState={{ checked: selected }}
                />
              );
            })}
          </View>
          <Text style={[styles.caption, styles.textCenter]}>
            Rings {formatWeekdayHint(alarm.weekdays)}
          </Text>
        </View>
      );
      primary = { label: 'Continue', onPress: () => void saveTimeAndContinue() };
      break;

    case 'tone':
      content = (
        <View style={styles.block}>
          <StepText
            title="Choose your alarm"
            body="This rings until you’re still, including on the lock screen. Tap a tone to hear a short preview. You can change it anytime on Home."
          />
          <ToneChoices selected={toneId} playingId={playingId} onSelect={selectTone} />
        </View>
      );
      primary = { label: 'Continue', onPress: () => void saveToneAndContinue() };
      break;

    case 'sound':
      content = (
        <View style={styles.block}>
          <StepText
            title="Pick your first sound"
            body="It plays during your two calm minutes. Tap one to hear it."
          />
          <SoundChoices tracks={FIRST_SOUNDS} selected={trackId} playingId={playingId} onSelect={selectSound} />
          <Text style={[styles.caption, styles.textCenter]}>More sounds live in Library.</Text>
        </View>
      );
      primary = { label: 'Continue', onPress: () => void saveSoundAndContinue() };
      break;

    case 'camera':
      content = (
        <View style={styles.block}>
          <AnimatedScene layout={cameraScene} reduceMotion={reduceMotion} radius={radii.xl} />
          <StepText
            title="Your camera checks you’re up"
            body="In the morning, the front camera sees that you’re upright, still and facing your phone. It all happens on your iPhone. Video never leaves it."
          />
        </View>
      );
      if (cameraGranted) {
        note = { text: 'Camera is ready.', tone: 'ok' };
        primary = { label: 'Continue', onPress: next };
      } else if (cameraBlocked) {
        note = {
          text: 'Camera is off for Quiett. Without it, the alarm can only be ended early with the emergency hold. You can turn it on in Settings anytime.',
          tone: 'info',
        };
        primary = { label: 'Open Settings', onPress: () => void Linking.openSettings() };
        secondary = { label: 'Continue for now', onPress: next };
      } else {
        primary = { label: 'Allow camera', onPress: () => void allowCamera() };
        secondary = { label: 'Not now', onPress: next };
      }
      break;

    case 'alarm': {
      const reminderRow =
        reminderOn || notifStatus === 'denied' ? null : (
          <CheckRow
            checked={wantReminder}
            onToggle={() => setWantReminder((v) => !v)}
            title="Also remind me the evening before"
            body={`A quiet note at ${displayTime(reminderTime)} with tomorrow’s wake-up time.`}
          />
        );
      content = (
        <View style={styles.block}>
          <AnimatedScene layout={alarmScene} reduceMotion={reduceMotion} radius={radii.xl} />
          <StepText
            title="Let Quiett ring, even when locked"
            body={`iOS will ask to allow alarms. Quiett only uses this for your wake-up: ${wakeSummary}.`}
          />
          {reminderRow}
        </View>
      );
      if (alarmPerm === 'authorized') {
        note = { text: reminderOn ? 'Alarms and the evening reminder are on.' : 'Alarms are on. You’re all set.', tone: 'ok' };
        primary = { label: 'Continue', onPress: () => void continueFromAlarm() };
      } else if (alarmPerm === 'denied') {
        note = {
          text: `Alarms are off for Quiett. Turn them on in Settings so it can ring at ${displayTime(alarm.time)}.`,
          tone: 'info',
        };
        primary = { label: 'Open Settings', onPress: () => void openOsAlarmSettings() };
        secondary = { label: 'Continue for now', onPress: () => void continueFromAlarm() };
      } else if (alarmPerm === 'unavailable') {
        note = {
          text: 'This device can’t schedule Quiett’s alarm right now — it needs a recent iOS version with alarm support. You can still finish setup and practice.',
          tone: 'info',
        };
        primary = { label: 'Continue', onPress: () => void continueFromAlarm() };
      } else {
        primary = { label: 'Allow alarms', onPress: () => void allowAlarms() };
      }
      break;
    }

    case 'commit':
    default:
      content = (
        <View style={styles.block}>
          <AnimatedScene layout={commitScene} reduceMotion={reduceMotion} radius={radii.xl} />
          <StepText
            eyebrow="You’re set"
            title={`${ringDayLabel(nextRing)} at ${displayTime(alarm.time)}, your morning begins.`}
            body={chosenGoal?.promise ?? 'Up, still, then two calm minutes. The day can wait that long.'}
            center
          />
          <Text style={[styles.caption, styles.textCenter]}>
            Try it once now: a 30-second practice with the alarm sound, so set a comfortable
            volume. It won’t count toward your streak.
          </Text>
        </View>
      );
      primary = { label: 'Try a 30-second practice', onPress: () => void finish(true) };
      secondary = { label: 'Maybe later', onPress: () => void finish(false) };
      break;
  }

  const entering = reduceMotion
    ? FadeIn.duration(250)
    : (direction > 0 ? FadeInRight : FadeInLeft).duration(380);

  return (
    <View style={styles.screen}>
      <ParallaxHills
        step={stepIndex}
        count={STEPS.length}
        visible={!SCENE_STEPS.includes(step)}
        reduceMotion={reduceMotion}
      />
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.topSide}>
          {stepIndex > 0 ? (
            <Pressable
              onPress={back}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={styles.iconBtn}
            >
              <Ionicons name="chevron-back" size={22} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
        <ProgressSegments count={STEPS.length} index={stepIndex} reduceMotion={reduceMotion} />
        <View style={[styles.topSide, styles.topSideRight]}>
          {skip ? (
            <Pressable
              onPress={skip}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Skip"
              style={styles.skipBtn}
            >
              <Text style={styles.skip}>Skip</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <Animated.View key={step} entering={entering} style={styles.stepWrap}>
          {content}
        </Animated.View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        {note ? (
          <View style={[styles.note, note.tone === 'ok' && styles.noteOk]} accessibilityLiveRegion="polite">
            <Ionicons
              name={note.tone === 'ok' ? 'checkmark-circle' : 'information-circle-outline'}
              size={18}
              color={note.tone === 'ok' ? colors.calm : colors.textMuted}
            />
            <Text style={styles.noteText}>{note.text}</Text>
          </View>
        ) : null}
        <PrimaryButton
          label={primary.label}
          onPress={primary.onPress}
          disabled={busy || primaryDisabled}
          style={styles.primaryBtn}
        />
        {secondary ? (
          <Pressable
            onPress={secondary.onPress}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={secondary.label}
            style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryText}>{secondary.label}</Text>
          </Pressable>
        ) : (
          <View style={styles.secondarySpacer} />
        )}
      </View>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.sm,
    },
    topSide: { width: 56, height: 44, justifyContent: 'center' },
    topSideRight: { alignItems: 'flex-end' },
    iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    skipBtn: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.xs },
    skip: { ...typography.body, fontSize: 15, fontWeight: '500', color: colors.textMuted },
    scroll: { flex: 1 },
    scrollContent: { flexGrow: 1, paddingHorizontal: spacing.lg },
    stepWrap: { flex: 1, justifyContent: 'center', paddingVertical: spacing.md },
    block: { gap: spacing.lg },
    chartCaption: { ...typography.body, color: colors.textMuted, textAlign: 'center', marginTop: -spacing.xs },
    chartFootnote: { ...typography.caption, color: colors.textDim, textAlign: 'center', marginTop: -spacing.md },
    textCenter: { textAlign: 'center' },
    caption: { ...typography.caption, color: colors.textDim },
    timeCard: {
      alignItems: 'center',
      backgroundColor: colors.bgCard,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: spacing.md,
    },
    bigTime: { ...typography.heroSm, color: colors.text, fontVariant: ['tabular-nums'] },
    picker: { alignSelf: 'stretch', height: 160 },
    dayPills: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
    pill: {
      flex: 1,
      minHeight: 44,
      justifyContent: 'center',
      borderRadius: radii.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bgElevated,
      alignItems: 'center',
    },
    pillSelected: { backgroundColor: colors.calmSoft, borderColor: colors.calm },
    pillText: { ...typography.caption, color: colors.textMuted, fontWeight: '500' },
    pillTextSelected: { color: colors.calm, fontWeight: '700' },
    footer: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingTop: spacing.sm },
    note: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: radii.md,
      backgroundColor: colors.bgCard,
      borderWidth: 1,
      borderColor: colors.border,
    },
    noteOk: { backgroundColor: colors.calmSoft, borderColor: colors.calm },
    noteText: { flex: 1, ...typography.caption, fontSize: 14, color: colors.text, lineHeight: 20 },
    primaryBtn: { alignSelf: 'stretch' },
    secondaryBtn: { minHeight: 44, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
    secondaryText: { ...typography.body, fontSize: 15, fontWeight: '500', color: colors.textMuted },
    secondarySpacer: { height: 44 },
    pressed: { opacity: 0.7 },
  });
}
