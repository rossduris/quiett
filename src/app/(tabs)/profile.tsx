import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StreakSheet } from '@/components/StreakSheet';
import { TAB_BAR_CLEARANCE } from '@/components/QuiettTabBar';
import { ProfileHero } from '@/components/profile/ProfileHero';
import { EnterStagger } from '@/components/EnterStagger';
import { InsightCard } from '@/components/profile/InsightCard';
import { MilestonesRow } from '@/components/profile/MilestonesRow';
import { CalendarCard } from '@/components/profile/CalendarCard';
import { MorningJournal } from '@/components/profile/MorningJournal';
import { ProfileLinks } from '@/components/profile/ProfileLinks';
import { AccountRow } from '@/components/profile/AccountRow';
import { pressedStyle } from '@/components/home/home-styles';
import { spacing, typography } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';
import { useThemeColors } from '@/lib/theme-provider';
import { usePremium } from '@/lib/premium-provider';
import { useAccountUiEnabled } from '@/lib/dev-flags';
import { useProfileState } from '@/lib/use-profile-state';
import { useProfileIdentity } from '@/lib/profile-identity';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { isPremium } = usePremium();
  const accountUi = useAccountUiEnabled();
  const p = useProfileState();
  const identity = useProfileIdentity();
  const [showStreakSheet, setShowStreakSheet] = useState(false);

  const onShare = async () => {
    const message =
      p.streak.count > 0
        ? `I'm on a ${p.streak.count}-day Quiett streak (${p.totalMornings} mornings unlocked). Stay still — then the morning begins.`
        : `Building mornings with Quiett. Stay still — then the morning begins.`;
    try {
      await Share.share({ message });
    } catch {
      // User dismissed or share unavailable.
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.topBar}>
        <Text style={styles.title} accessibilityRole="header">
          Profile
        </Text>
        {p.hasMornings ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Share streak"
            hitSlop={12}
            onPress={() => void onShare()}
            style={({ pressed }) => [styles.iconBtn, pressed && pressedStyle]}
          >
            <Ionicons name="share-outline" size={24} color={colors.text} />
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Settings"
          hitSlop={12}
          onPress={() => router.push('/settings')}
          style={({ pressed }) => [styles.iconBtn, pressed && pressedStyle]}
        >
          <Ionicons name="settings-outline" size={24} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + TAB_BAR_CLEARANCE }]}
        showsVerticalScrollIndicator={false}
      >
        <ProfileHero
          name={identity.name}
          photoUri={identity.photoUri}
          streak={p.streak.count}
          best={p.bestStreak}
          mornings={p.totalMornings}
          hasMornings={p.hasMornings}
          intention={p.wakeIntention}
          onEditProfile={() => router.push('/edit-profile')}
          onOpenStreak={() => setShowStreakSheet(true)}
          onEditIntention={() => router.push('/wake-intention')}
        />
        {p.insights.length ? (
          <EnterStagger index={0} base={240}>
            <InsightCard insights={p.insights} />
          </EnterStagger>
        ) : null}
        <EnterStagger index={1} base={240}>
        <CalendarCard
          completedDays={p.completedDays}
          schedule={p.schedule}
          firstMonth={p.firstMonth}
          now={p.now}
        />
        </EnterStagger>
        <EnterStagger index={2} base={240}>
        <MorningJournal
          days={p.recentDays}
          unlockTimes={p.unlockTimes}
          intentionsByDay={p.intentionsByDay}
          onChangeIntention={() => router.push('/wake-intention')}
        />
        </EnterStagger>
        <EnterStagger index={3} base={240}>
          <MilestonesRow earnedIds={p.earnedBadgeIds} />
        </EnterStagger>
        <EnterStagger index={4} base={240}>
          <ProfileLinks isPremium={isPremium} />
        </EnterStagger>
        {accountUi ? <AccountRow /> : null}
      </ScrollView>

      <StreakSheet
        visible={showStreakSheet}
        onClose={() => setShowStreakSheet(false)}
        streak={p.streak}
        completedDays={p.completedDays}
        alarm={p.alarm}
        unlockedToday={p.unlockedToday}
        now={showStreakSheet ? new Date() : p.now}
      />
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
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
    },
    title: { ...typography.title, color: colors.text, flex: 1 },
    iconBtn: { padding: spacing.xs },
    scroll: { flex: 1 },
    content: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs, gap: spacing.xl },
  });
}
