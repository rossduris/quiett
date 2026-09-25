import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AppState,
  BackHandler,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCameraPermissions } from 'expo-camera';
import DateTimePicker from '@react-native-community/datetimepicker';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LockInAura } from '@/components/LockInAura';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SessionBackdrop } from '@/components/SessionBackdrop';
import { radii, spacing, typography } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';
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
  syncOsAlarm,
  type OsAlarmPermissionState,
} from '@/lib/os-alarm';
import {
  clearWakeResolved,
  formatWeekdayHint,
  loadAlarmPrefs,
  loadEveningReminderPrefs,
  saveAlarmPrefs,
  saveEveningReminderPrefs,
  saveOnboardingComplete,
  type AlarmPrefs,
  type Weekday,
} from '@/lib/storage';
import { useThemeColors } from '@/lib/theme-provider';

const BRAND_MARK = require('../../assets/images/icon.png');

const STEPS = ['welcome', 'how', 'time', 'alarm', 'camera', 'reminder', 'practice'] as const;
type StepId = (typeof STEPS)[number];

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

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
  return parseTime(hhmm).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

type Action = { label: string; onPress: () => void; a11yHint?: string };

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [stepIndex, setStepIndex] = useState(0);
  const step: StepId = STEPS[stepIndex]!;

  const [alarm, setAlarm] = useState<AlarmPrefs>({
    time: '07:00',
    enabled: true,
    weekdays: [1, 2, 3, 4, 5, 6, 7],
  });
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);
  const [alarmPerm, setAlarmPerm] = useState<OsAlarmPermissionState>('notDetermined');
  const [camera, requestCamera, getCamera] = useCameraPermissions();
  const [notifStatus, setNotifStatus] = useState<'granted' | 'denied' | 'undetermined'>(
    'undetermined',
  );
  const [reminderOn, setReminderOn] = useState(false);
  const [reminderTime, setReminderTime] = useState('20:00');
  const [busy, setBusy] = useState(false);
  const launchedPractice = useRef(false);

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
    void refreshStatuses();
    return () => {
      alive = false;
    };
  }, [refreshStatuses]);

  // Coming back from iOS Settings: pick up any permission the user just changed.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshStatuses();
    });
    return () => sub.remove();
  }, [refreshStatuses]);

  // After the practice run (finished or ended early) we land back here → go Home.
  useFocusEffect(
    useCallback(() => {
      if (!launchedPractice.current) return;
      launchedPractice.current = false;
      router.replace('/(tabs)');
    }, [router]),
  );

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

  const saveTimeAndContinue = async () => {
    const prefs: AlarmPrefs = { ...alarm, enabled: true };
    await saveAlarmPrefs(prefs);
    await clearWakeResolved();
    if (alarmPerm === 'authorized') void syncOsAlarm(prefs);
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

  const allowAlarms = async () => {
    setBusy(true);
    try {
      const state = await requestOsAlarmPermission();
      setAlarmPerm(state);
      if (state === 'authorized') {
        const prefs = await loadAlarmPrefs();
        void syncOsAlarm({ ...prefs, enabled: true });
        next();
      }
    } finally {
      setBusy(false);
    }
  };

  const allowCamera = async () => {
    const res = await requestCamera();
    if (res.granted) next();
  };

  const turnOnReminder = async () => {
    setBusy(true);
    try {
      const granted = await requestNotificationPermissions();
      setNotifStatus(granted ? 'granted' : 'denied');
      if (!granted) return;
      await saveEveningReminderPrefs({ enabled: true, time: reminderTime });
      await scheduleEveningReminder();
      setReminderOn(true);
      next();
    } finally {
      setBusy(false);
    }
  };

  // ── Step content ───────────────────────────────────────────────────────────

  const wakeSummary = `${displayTime(alarm.time)}, ${formatWeekdayHint(alarm.weekdays)}`;
  const cameraGranted = camera?.granted ?? false;
  const cameraBlocked = !!camera && !camera.granted && !camera.canAskAgain;

  let content: ReactNode = null;
  let primary: Action;
  let secondary: Action | undefined;
  let note: { text: string; tone: 'ok' | 'info' } | undefined;
  let skip: (() => void) | undefined;

  switch (step) {
    case 'welcome':
      content = (
        <View style={styles.centerBlock}>
          <Image
            source={BRAND_MARK}
            style={styles.brandMark}
            accessibilityIgnoresInvertColors
            accessible
            accessibilityLabel="Quiett sun logo"
          />
          <Text style={styles.wordmark}>Quiett</Text>
          <Text style={[styles.title, styles.textCenter]} accessibilityRole="header">
            An alarm that turns off once you’ve settled in.
          </Text>
          <Text style={[styles.body, styles.textCenter]}>
            Wake up, get still for two quiet minutes, then begin your day.
          </Text>
        </View>
      );
      primary = { label: 'Get started', onPress: next };
      break;

    case 'how':
      content = (
        <View style={styles.block}>
          <Text style={styles.title} accessibilityRole="header">
            How mornings work
          </Text>
          <View style={styles.duskCard} accessible={false}>
            <SessionBackdrop />
            <View style={styles.miniWindow}>
              <LockInAura size={88} level={1} color={colors.sessionGlow} />
              <View style={styles.miniCircle}>
                <Ionicons name="sunny-outline" size={30} color={colors.sessionText} />
              </View>
            </View>
          </View>
          <Beat
            styles={styles}
            colors={colors}
            icon="alarm-outline"
            n={1}
            title="Your alarm rings"
            body="At your wake time, the alarm plays until you settle in."
          />
          <Beat
            styles={styles}
            colors={colors}
            icon="phone-portrait-outline"
            n={2}
            title="Prop your phone and settle in"
            body="Face your phone, get comfortable, and be still for a moment."
          />
          <Beat
            styles={styles}
            colors={colors}
            icon="leaf-outline"
            n={3}
            title="Two quiet minutes"
            body="Stay with it for 2 minutes and the alarm turns off. Your morning begins."
          />
        </View>
      );
      primary = { label: 'Continue', onPress: next };
      skip = next;
      break;

    case 'time':
      content = (
        <View style={styles.block}>
          <Text style={styles.title} accessibilityRole="header">
            When do you want to wake?
          </Text>
          <Text style={styles.body}>
            Pick a time and the days Quiett should ring. You can change this anytime on Home.
          </Text>
          <Pressable
            onPress={() => Platform.OS === 'android' && setShowAndroidPicker(true)}
            accessibilityRole={Platform.OS === 'android' ? 'button' : 'text'}
            accessibilityLabel={`Wake time ${displayTime(alarm.time)}`}
            style={styles.timeCard}
          >
            <Text style={styles.bigTime}>{displayTime(alarm.time)}</Text>
            {Platform.OS === 'ios' ? (
              <DateTimePicker
                value={parseTime(alarm.time)}
                mode="time"
                display="spinner"
                locale="en_US"
                is24Hour={false}
                onValueChange={onTimeChange}
                themeVariant={colors.statusBarStyle === 'dark' ? 'light' : 'dark'}
                textColor={colors.text}
                style={styles.picker}
              />
            ) : showAndroidPicker ? (
              <DateTimePicker
                value={parseTime(alarm.time)}
                mode="time"
                display="spinner"
                is24Hour={false}
                onValueChange={onTimeChange}
                onDismiss={() => setShowAndroidPicker(false)}
              />
            ) : (
              <Text style={styles.caption}>Tap to change</Text>
            )}
          </Pressable>
          <View style={styles.dayPills}>
            {DAY_LABELS.map((label, i) => {
              const day = (i + 1) as Weekday;
              const selected = alarm.weekdays.includes(day);
              return (
                <Pressable
                  key={day}
                  onPress={() => toggleDay(day)}
                  style={[styles.pill, selected && styles.pillSelected]}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.pillText, selected && styles.pillTextSelected]}>
                    {label}
                  </Text>
                </Pressable>
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

    case 'alarm':
      content = (
        <PrimingBlock
          styles={styles}
          colors={colors}
          icon="alarm-outline"
          title="Let Quiett wake you, even when locked"
          body={`iOS will ask to allow alarms. Quiett only uses this for your wake-up: ${wakeSummary}.`}
        />
      );
      if (alarmPerm === 'authorized') {
        note = { text: 'Alarms are on. You’re all set.', tone: 'ok' };
        primary = { label: 'Continue', onPress: next };
      } else if (alarmPerm === 'denied') {
        note = {
          text: `Alarms are off for Quiett. Turn them on in Settings so it can ring at ${displayTime(alarm.time)}.`,
          tone: 'info',
        };
        primary = { label: 'Open Settings', onPress: () => void openOsAlarmSettings() };
        secondary = { label: 'Continue for now', onPress: next };
      } else if (alarmPerm === 'unavailable') {
        note = {
          text: 'This device can’t schedule Quiett’s alarm right now — it needs a recent iOS version with alarm support. You can still finish setup and practice.',
          tone: 'info',
        };
        primary = { label: 'Continue', onPress: next };
      } else {
        primary = { label: 'Allow alarms', onPress: () => void allowAlarms() };
      }
      break;

    case 'camera':
      content = (
        <PrimingBlock
          styles={styles}
          colors={colors}
          icon="camera-outline"
          title="Your camera checks you’re settled"
          body="In the morning, the front camera makes sure you’re still and facing your phone. It all happens on your iPhone — video never leaves it."
        />
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

    case 'reminder':
      content = (
        <PrimingBlock
          styles={styles}
          colors={colors}
          icon="moon-outline"
          title="A gentle evening nudge"
          body={`Get a quiet reminder at ${displayTime(reminderTime)} with tomorrow’s wake-up time. Optional — change or turn it off in Settings.`}
        />
      );
      if (reminderOn) {
        note = { text: 'Evening reminder is on.', tone: 'ok' };
        primary = { label: 'Continue', onPress: next };
      } else if (notifStatus === 'denied') {
        note = {
          text: 'Notifications are off for Quiett. You can turn them on later in Settings.',
          tone: 'info',
        };
        primary = { label: 'Continue', onPress: next };
        secondary = { label: 'Open Settings', onPress: () => void Linking.openSettings() };
      } else {
        primary = { label: 'Turn on reminder', onPress: () => void turnOnReminder() };
        secondary = { label: 'Not now', onPress: next };
      }
      break;

    case 'practice':
    default:
      content = (
        <PrimingBlock
          styles={styles}
          colors={colors}
          icon="play-circle-outline"
          title="Try it once, now"
          body="A 30-second practice shows exactly how a morning feels. The alarm sound plays, so set your volume to a comfortable level. It doesn’t count toward your streak."
        />
      );
      primary = { label: 'Start practice', onPress: () => void finish(true) };
      secondary = { label: 'Maybe later', onPress: () => void finish(false) };
      break;
  }

  return (
    <View style={styles.screen}>
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
        <View
          style={styles.dots}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={`Step ${stepIndex + 1} of ${STEPS.length}`}
        >
          {STEPS.map((id, i) => (
            <View
              key={id}
              style={[
                styles.dot,
                i < stepIndex && styles.dotDone,
                i === stepIndex && styles.dotActive,
              ]}
            />
          ))}
        </View>
        <View style={[styles.topSide, styles.topSideRight]}>
          {skip ? (
            <Pressable
              onPress={skip}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Skip"
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
        <Animated.View key={step} entering={FadeIn.duration(320)} style={styles.stepWrap}>
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
          disabled={busy}
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

type Styles = ReturnType<typeof createStyles>;
type IconName = keyof typeof Ionicons.glyphMap;

function Beat({
  styles,
  colors,
  icon,
  n,
  title,
  body,
}: {
  styles: Styles;
  colors: ColorTokens;
  icon: IconName;
  n: number;
  title: string;
  body: string;
}) {
  return (
    <View style={styles.beat} accessible accessibilityLabel={`${n}. ${title}. ${body}`}>
      <View style={styles.beatIcon}>
        <Ionicons name={icon} size={20} color={colors.calm} />
      </View>
      <View style={styles.beatText}>
        <Text style={styles.beatTitle}>{title}</Text>
        <Text style={styles.beatBody}>{body}</Text>
      </View>
    </View>
  );
}

function PrimingBlock({
  styles,
  colors,
  icon,
  title,
  body,
}: {
  styles: Styles;
  colors: ColorTokens;
  icon: IconName;
  title: string;
  body: string;
}) {
  return (
    <View style={styles.centerBlock}>
      <View style={styles.primingIcon}>
        <Ionicons name={icon} size={40} color={colors.calm} />
      </View>
      <Text style={[styles.title, styles.textCenter]} accessibilityRole="header">
        {title}
      </Text>
      <Text style={[styles.body, styles.textCenter]}>{body}</Text>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.sm,
    },
    topSide: { width: 56, height: 36, justifyContent: 'center' },
    topSideRight: { alignItems: 'flex-end' },
    iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    skip: { color: colors.textMuted, fontSize: 15, fontWeight: '500' },
    dots: { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 6 },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
    dotDone: { backgroundColor: colors.calm, opacity: 0.45 },
    dotActive: { width: 18, backgroundColor: colors.calm },
    scroll: { flex: 1 },
    scrollContent: { flexGrow: 1, paddingHorizontal: spacing.lg },
    stepWrap: { flex: 1, justifyContent: 'center', paddingVertical: spacing.lg },
    block: { gap: spacing.md },
    centerBlock: { alignItems: 'center', gap: spacing.md },
    textCenter: { textAlign: 'center' },
    brandMark: { width: 112, height: 112, borderRadius: 28, marginBottom: spacing.sm },
    wordmark: {
      color: colors.calm,
      fontSize: 14,
      fontWeight: '600',
      letterSpacing: 2,
      textTransform: 'uppercase',
    },
    title: { ...typography.title, color: colors.text },
    body: { ...typography.body, color: colors.textMuted, lineHeight: 24 },
    caption: { ...typography.caption, color: colors.textDim },
    duskCard: {
      height: 168,
      borderRadius: radii.xl,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      marginVertical: spacing.xs,
    },
    miniWindow: { width: 88, height: 88 },
    miniCircle: {
      ...StyleSheet.absoluteFill,
      borderRadius: 44,
      backgroundColor: colors.sessionBgMid,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.sessionHairline,
      alignItems: 'center',
      justifyContent: 'center',
    },
    beat: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
    beatIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.calmSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    beatText: { flex: 1, gap: 2 },
    beatTitle: { ...typography.subtitle, fontSize: 17, color: colors.text },
    beatBody: { ...typography.body, fontSize: 15, color: colors.textMuted, lineHeight: 21 },
    timeCard: {
      alignItems: 'center',
      backgroundColor: colors.bgCard,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: spacing.md,
      marginTop: spacing.sm,
    },
    bigTime: { ...typography.heroSm, color: colors.text, fontVariant: ['tabular-nums'] },
    picker: { alignSelf: 'stretch', height: 160 },
    dayPills: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
    pill: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: radii.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bgElevated,
      alignItems: 'center',
    },
    pillSelected: { backgroundColor: colors.calmSoft, borderColor: colors.calm },
    pillText: { color: colors.textMuted, fontSize: 13, fontWeight: '500' },
    pillTextSelected: { color: colors.calm, fontWeight: '700' },
    primingIcon: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: colors.calmSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
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
    secondaryBtn: { paddingVertical: 12, alignItems: 'center' },
    secondaryText: { color: colors.textMuted, fontSize: 15, fontWeight: '500' },
    secondarySpacer: { height: 44 },
    pressed: { opacity: 0.7 },
  });
}
