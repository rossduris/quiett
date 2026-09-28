import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StreakSheet } from '@/components/StreakSheet';
import { TAB_BAR_CLEARANCE } from '@/components/QuiettTabBar';
import { StatsRow } from '@/components/profile/StatsRow';
import { CalendarCard } from '@/components/profile/CalendarCard';
import { RecentMornings } from '@/components/profile/RecentMornings';
import { ProfileLinks } from '@/components/profile/ProfileLinks';
import { AccountRow } from '@/components/profile/AccountRow';
import { pressedStyle } from '@/components/home/home-styles';
import { spacing, typography } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';
import { useThemeColors } from '@/lib/theme-provider';
import { usePremium } from '@/lib/premium-provider';
import { useAccountUiEnabled } from '@/lib/dev-flags';
import { useProfileState } from '@/lib/use-profile-state';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { isPremium } = usePremium();
  const accountUi = useAccountUiEnabled();
  const p = useProfileState();
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
        <StatsRow
          current={p.streak.count}
          best={p.bestStreak}
          mornings={p.totalMornings}
          hasMornings={p.hasMornings}
          onOpenStreak={() => setShowStreakSheet(true)}
        />
        <CalendarCard
          completedDays={p.completedDays}
          schedule={p.schedule}
          firstMonth={p.firstMonth}
          now={p.now}
        />
        <RecentMornings days={p.recentDays} unlockTimes={p.unlockTimes} intentionsByDay={p.intentionsByDay} />
        <ProfileLinks isPremium={isPremium} earnedBadges={p.earnedBadges} />
        {accountUi ? (
          <AccountRow
            account={p.account}
            onSignIn={() => void p.onSignIn()}
            onSignOut={() => void p.onSignOut()}
          />
        ) : null}
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
    content: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  });
}
