import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton } from '@/components/PrimaryButton';
import { StreakCalendar } from '@/components/StreakCalendar';
import { radii, spacing, typography } from '@/constants/theme';
import { useThemeColors } from '@/lib/theme-provider';
import { TAB_BAR_CLEARANCE } from '@/components/QuiettTabBar';
import { longestScheduledStreak, morningsInMonth, nextStreakGoal } from '@/lib/streak-calendar';
import { SETUP_LEAD, SETUP_NOTE, SETUP_TIPS } from '@/constants/setup-tips';
import {
  loadAccount,
  loadAlarmPrefs,
  loadCompletedDays,
  loadStreak,
  signInWithAppleStub,
  signOut,
  type AccountData,
  type AlarmPrefs,
  type StreakData,
} from '@/lib/storage';
import type { ColorTokens } from '@/constants/themes';

function initialFor(account: AccountData): string {
  const name = account.displayName?.trim();
  if (name) return name.charAt(0).toUpperCase();
  return 'Y';
}

function formatHistoryDay(key: string): string {
  const [y, m, d] = key.split('-').map((n) => parseInt(n, 10));
  if (!y || !m || !d) return key;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [account, setAccount] = useState<AccountData>({
    signedIn: false,
    provider: null,
    displayName: null,
    email: null,
  });
  const [streak, setStreak] = useState<StreakData>({ count: 0, lastCompletedDate: null });
  const [completedDays, setCompletedDays] = useState<string[]>([]);
  const [alarm, setAlarm] = useState<AlarmPrefs>({ time: '07:00', enabled: true, weekdays: [1, 2, 3, 4, 5] });
  const [tipsExpanded, setTipsExpanded] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date();
    return { year: today.getFullYear(), month: today.getMonth() };
  });

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const [acct, strk, days, alrm] = await Promise.all([
          loadAccount(),
          loadStreak(),
          loadCompletedDays(),
          loadAlarmPrefs(),
        ]);
        if (!alive) return;
        setAccount(acct);
        setStreak(strk);
        setCompletedDays(days);
        setAlarm(alrm);
      })();
      return () => {
        alive = false;
      };
    }, []),
  );

  const onSignIn = async () => {
    setAccount(await signInWithAppleStub());
  };

  const onSignOut = async () => {
    setAccount(await signOut());
  };

  const totalMornings = completedDays.length;
  const bestStreak = longestScheduledStreak(completedDays, alarm.weekdays);
  const monthMornings = morningsInMonth(
    calendarMonth.year,
    calendarMonth.month,
    completedDays,
  );
  const nextGoal = nextStreakGoal(streak.count);

  const recentDays = useMemo(
    () => [...completedDays].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0)).slice(0, 10),
    [completedDays],
  );

  const onShareStreak = async () => {
    const message =
      streak.count > 0
        ? `I'm on a ${streak.count}-day Quiett streak (${totalMornings} mornings unlocked). Stay still — then the morning begins.`
        : `Building mornings with Quiett. Stay still — then the morning begins.`;
    try {
      await Share.share({ message });
    } catch {
      // User dismissed or share unavailable — ignore.
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.topBar}>
        <Text style={styles.screenTitle}>Profile</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: TAB_BAR_CLEARANCE + spacing.lg }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.identityCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initialFor(account)}</Text>
          </View>
          <Text style={styles.displayName}>{account.displayName ?? 'You'}</Text>
          {account.email ? <Text style={styles.email}>{account.email}</Text> : null}

          {account.signedIn ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => void onSignOut()}
              style={({ pressed }) => [styles.signOutPill, pressed && styles.pressed]}
            >
              <Text style={styles.signOutText}>Sign out</Text>
            </Pressable>
          ) : (
            <>
              <Text style={styles.signInHint}>Save streak across devices</Text>
              <PrimaryButton label="Sign in with Apple" onPress={() => void onSignIn()} />
            </>
          )}
        </View>

        <View style={styles.statsCard}>
          <View style={styles.statsHero}>
            <Text style={styles.statsBig}>{streak.count}</Text>
            <Text style={styles.statsBigLabel}>day streak</Text>
          </View>
          <View style={styles.statsSecondary}>
            <View style={styles.statCol}>
              <Text style={styles.statsSmallNum}>{totalMornings}</Text>
              <Text style={styles.statsSmallLabel}>Total mornings</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={styles.statsSmallNum}>{bestStreak}</Text>
              <Text style={styles.statsSmallLabel}>Best streak</Text>
            </View>
          </View>
          {nextGoal ? (
            <View style={styles.goalPill}>
              <Ionicons name="flag-outline" size={15} color={colors.calm} />
              <Text style={styles.goalText}>{nextGoal.label}</Text>
            </View>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Share streak"
            onPress={() => void onShareStreak()}
            style={({ pressed }) => [styles.shareBtn, pressed && styles.pressed]}
          >
            <Ionicons name="share-outline" size={18} color={colors.calm} />
            <Text style={styles.shareBtnText}>Share streak</Text>
          </Pressable>
        </View>

        <View style={styles.historyCard}>
          <Text style={styles.historyTitle}>Recent mornings</Text>
          {recentDays.length === 0 ? (
            <Text style={styles.historyEmpty}>
              No mornings yet — unlock one to start history.
            </Text>
          ) : (
            <View style={styles.historyList}>
              {recentDays.map((key) => (
                <View key={key} style={styles.historyRow}>
                  <View style={styles.historyDot} />
                  <Text style={styles.historyDate}>{formatHistoryDay(key)}</Text>
                  <Text style={styles.historyTag}>Unlocked</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.calendarCard}>
          <View style={styles.calendarCardTop}>
            <View>
              <Text style={styles.calendarTitle}>Streak calendar</Text>
              <Text style={styles.calendarSub}>
                {monthMornings} {monthMornings === 1 ? 'morning' : 'mornings'} unlocked
              </Text>
            </View>
          </View>
          <StreakCalendar
            completedDays={completedDays}
            scheduledWeekdays={alarm.weekdays}
            year={calendarMonth.year}
            month={calendarMonth.month}
            onChangeMonth={setCalendarMonth}
          />
        </View>

        <View style={styles.actionsCard}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/settings')}
            style={({ pressed }) => [styles.actionRow, pressed && styles.pressed]}
          >
            <View style={styles.actionLeft}>
              <Ionicons name="settings-outline" size={20} color={colors.text} />
              <Text style={styles.actionLabel}>Settings</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textDim} />
          </Pressable>
        </View>

        <View style={styles.tipsCard}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setTipsExpanded(!tipsExpanded)}
            style={({ pressed }) => [styles.tipsHeader, pressed && styles.pressed]}
          >
            <Text style={styles.tipsHeaderLabel}>How to set up your camera</Text>
            <Ionicons
              name={tipsExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={colors.textMuted}
            />
          </Pressable>
          {tipsExpanded ? (
            <View style={styles.tipsContent}>
              <Text style={styles.tipsLead}>{SETUP_LEAD}</Text>
              {SETUP_TIPS.map((tip) => (
                <View key={tip.title} style={styles.tipCard}>
                  <Text style={styles.tipTitle}>{tip.title}</Text>
                  <Text style={styles.tipBody}>{tip.body}</Text>
                </View>
              ))}
              <Text style={styles.tipsNote}>{SETUP_NOTE}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  screenTitle: {
    ...typography.title,
    color: colors.text,
  },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  identityCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.bgElevated,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.text, fontSize: 28, fontWeight: '600' },
  displayName: { ...typography.subtitle, color: colors.text, fontSize: 20 },
  email: { color: colors.textMuted, fontSize: 14, marginTop: -spacing.xs },
  signInHint: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 15,
    marginTop: spacing.xs,
  },
  signOutPill: {
    marginTop: spacing.sm,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md - 2,
    borderRadius: radii.full,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  signOutText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  statsCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.lg,
  },
  statsHero: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  statsBig: {
    fontSize: 72,
    fontWeight: '200',
    color: colors.calm,
    letterSpacing: -2,
  },
  statsBigLabel: {
    color: colors.textMuted,
    fontSize: 18,
    fontWeight: '500',
  },
  statsSecondary: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xl,
    paddingVertical: spacing.sm,
  },
  statCol: {
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
  },
  statDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: colors.border,
  },
  statsSmallNum: {
    fontSize: 28,
    fontWeight: '600',
    color: colors.text,
    letterSpacing: -0.5,
  },
  statsSmallLabel: {
    color: colors.textDim,
    fontSize: 13,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  goalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    backgroundColor: colors.calmSoft,
    borderWidth: 1,
    borderColor: colors.calm,
  },
  goalText: {
    color: colors.calm,
    fontSize: 13,
    fontWeight: '600',
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md - 2,
    borderRadius: radii.full,
    backgroundColor: colors.calmSoft,
    borderWidth: 1,
    borderColor: colors.calm,
  },
  shareBtnText: {
    color: colors.calm,
    fontSize: 15,
    fontWeight: '700',
  },
  historyCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  historyTitle: {
    ...typography.subtitle,
    color: colors.text,
    fontWeight: '600',
  },
  historyEmpty: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  historyList: { gap: spacing.sm },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 6,
  },
  historyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.calm,
  },
  historyDate: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: '500',
  },
  historyTag: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  calendarCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.lg,
  },
  calendarCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calendarTitle: {
    ...typography.subtitle,
    color: colors.text,
    fontWeight: '600',
  },
  calendarSub: {
    color: colors.textDim,
    fontSize: 13,
    marginTop: spacing.xs,
  },
  actionsCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  actionLabel: {
    ...typography.body,
    color: colors.text,
    fontWeight: '500',
  },
  tipsCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  tipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  tipsHeaderLabel: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  tipsContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  tipsLead: {
    ...typography.body,
    color: colors.textMuted,
    lineHeight: 24,
    marginTop: spacing.md,
  },
  tipCard: {
    backgroundColor: colors.bg,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  tipTitle: { color: colors.text, fontWeight: '600', fontSize: 16 },
  tipBody: { color: colors.textMuted, lineHeight: 22, fontSize: 15 },
  tipsNote: { color: colors.warning, fontSize: 12, lineHeight: 18 },
  pressed: { opacity: 0.75 },
});
}
