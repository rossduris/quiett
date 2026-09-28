import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlarmSoundPicker } from '@/components/AlarmSoundPicker';
import { AlarmCard } from '@/components/home/AlarmCard';
import { EnterStagger } from '@/components/EnterStagger';
import { DayOpenCard } from '@/components/home/DayOpenCard';
import { GetStartedCard, type GetStartedStep } from '@/components/home/GetStartedCard';
import { HomeHeader } from '@/components/home/HomeHeader';
import { IntentionCard } from '@/components/home/IntentionCard';
import { MorningStepsCard } from '@/components/home/MorningStepsCard';
import { ReliabilityCard } from '@/components/home/ReliabilityCard';
import { WeekCard } from '@/components/home/WeekCard';
import { TAB_BAR_CLEARANCE } from '@/components/QuiettTabBar';
import { StreakSheet } from '@/components/StreakSheet';
import { UnlockTrackPicker } from '@/components/UnlockTrackPicker';
import { alarmSoundById } from '@/constants/sounds';
import { spacing } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';
import { unlockTrackById } from '@/constants/unlock-tracks';
import { useCoverStyle } from '@/lib/scene-cover-pref';
import { useThemeColors } from '@/lib/theme-provider';
import { useHomeState } from '@/lib/use-home-state';
import { greetingFor, useProfileIdentity } from '@/lib/profile-identity';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const coverStyle = useCoverStyle();
  const home = useHomeState();
  const identity = useProfileIdentity();
  const greeting = identity.name ? greetingFor(home.now, identity.name) : null;

  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showTrackPicker, setShowTrackPicker] = useState(false);
  const [showAlarmSoundPicker, setShowAlarmSoundPicker] = useState(false);
  const [showStreakSheet, setShowStreakSheet] = useState(false);

  const unlockTrack = useMemo(() => unlockTrackById(home.unlockTrackId), [home.unlockTrackId]);
  const alarmSound = useMemo(() => alarmSoundById(home.alarmSoundId), [home.alarmSoundId]);

  const getStartedSteps: GetStartedStep[] = [
    { key: 'alarm', label: 'Set your alarm', done: home.getStarted.hasSetAlarm, onPress: () => setShowTimePicker(true) },
    {
      key: 'reliability',
      label: 'Make sure it can wake you',
      done: home.getStarted.reliabilityChecked,
      onPress: () => router.push('/reliability-check'),
    },
    { key: 'test', label: 'Try a test morning', done: home.getStarted.hasTriedTest, onPress: () => router.push('/test-morning') },
    { key: 'intention', label: 'Set your intention', done: home.getStarted.hasIntention, onPress: () => router.push('/wake-intention') },
  ];

  const openStreak = () => setShowStreakSheet(true);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.md }]}>
      <HomeHeader
        streakCount={home.streak.count}
        dayOpenQuiet={home.unlockedToday && !home.showDayOpen}
        onOpenStreak={openStreak}
        greeting={greeting}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + TAB_BAR_CLEARANCE }]}
        showsVerticalScrollIndicator={false}
      >
        {home.showDayOpen ? (
          <DayOpenCard
            wakeIntention={home.wakeIntention}
            alarmEnabled={home.alarm.enabled}
            onDismiss={() => void home.dismissDayOpen()}
          />
        ) : null}

        {home.showGetStarted ? (
          <GetStartedCard steps={getStartedSteps} onDismiss={() => void home.dismissGetStarted()} />
        ) : null}

        {home.showReliabilityCard ? <ReliabilityCard onPress={() => router.push('/reliability-check')} /> : null}

        <EnterStagger index={0}>
        <AlarmCard
          alarm={home.alarm}
          alarmSavedAt={home.alarmSavedAt}
          unlockedToday={home.unlockedToday}
          homeNow={home.now}
          pickerOpen={showTimePicker}
          onPickerOpenChange={setShowTimePicker}
          onSetTime={(hhmm) => void home.setAlarmTime(hhmm)}
          onToggleEnabled={() => void home.toggleAlarmEnabled()}
          onToggleWeekday={(day) => void home.toggleWeekday(day)}
        />
        </EnterStagger>

        <EnterStagger index={1}>
          <IntentionCard intention={home.wakeIntention} onPress={() => router.push('/wake-intention')} />
        </EnterStagger>

        <EnterStagger index={2}>
        <MorningStepsCard
          alarmSound={alarmSound}
          unlockTrack={unlockTrack}
          isPremium={home.isPremium}
          surpriseMe={home.surpriseMe}
          surpriseOffTick={home.surpriseOffTick}
          coverStyle={coverStyle}
          onOpenAlarmSound={() => setShowAlarmSoundPicker(true)}
          onOpenTrack={() => setShowTrackPicker(true)}
          onToggleSurprise={() => void home.toggleSurprise()}
        />
        </EnterStagger>

        <EnterStagger index={3}>
        <WeekCard
          completedDays={home.completedDays}
          scheduledWeekdays={home.alarm.weekdays}
          unlockedToday={home.unlockedToday}
          onPress={openStreak}
        />
        </EnterStagger>
      </ScrollView>

      <UnlockTrackPicker
        visible={showTrackPicker}
        selectedId={home.unlockTrackId}
        onClose={() => setShowTrackPicker(false)}
        onSelect={(track) => {
          setShowTrackPicker(false);
          void home.selectUnlockTrack(track);
        }}
      />

      <AlarmSoundPicker
        visible={showAlarmSoundPicker}
        selectedId={home.alarmSoundId}
        onClose={() => setShowAlarmSoundPicker(false)}
        onSelect={(id) => void home.selectAlarmSound(id)}
      />

      <StreakSheet
        visible={showStreakSheet}
        onClose={() => setShowStreakSheet(false)}
        onSeeHistory={() => {
          setShowStreakSheet(false);
          router.push('/profile');
        }}
        streak={home.streak}
        completedDays={home.completedDays}
        alarm={home.alarm}
        unlockedToday={home.unlockedToday}
        now={showStreakSheet ? new Date() : home.now}
      />
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  });
}
