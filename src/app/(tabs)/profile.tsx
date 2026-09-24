import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton } from '@/components/PrimaryButton';
import { StreakCalendar } from '@/components/StreakCalendar';
import { StreakSheet } from '@/components/StreakSheet';
import { radii, spacing, typography } from '@/constants/theme';
import { useThemeColors } from '@/lib/theme-provider';
import { TAB_BAR_CLEARANCE } from '@/components/QuiettTabBar';
import { longestScheduledStreak, morningsInMonth } from '@/lib/streak-calendar';
import { isUnlockedForToday } from '@/lib/home-status';
import { SETUP_LEAD, SETUP_NOTE, SETUP_TIPS } from '@/constants/setup-tips';
import {
  loadAccount,
  loadAlarmPrefs,
  loadCompletedDays,
  loadStreak,
  loadUnlockTimestamps,
  loadWakeIntentionsByDay,
  isWakeResolvedToday,
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

function formatHistoryTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
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
  const [unlockTimes, setUnlockTimes] = useState<Record<string, number>>({});
  const [intentionsByDay, setIntentionsByDay] = useState<Record<string, string>>({});
  const [wakeResolved, setWakeResolved] = useState(false);
  const [showStreakSheet, setShowStreakSheet] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date();
    return { year: today.getFullYear(), month: today.getMonth() };
  });

  const load = useCallback(async (isAlive: () => boolean = () => true) => {
    const [acct, strk, days, alrm, stamps, intentions, resolved] = await Promise.all([
      loadAccount(),
      loadStreak(),
      loadCompletedDays(),
      loadAlarmPrefs(),
      loadUnlockTimestamps(),
      loadWakeIntentionsByDay(),
      isWakeResolvedToday(),
    ]);
    if (!isAlive()) return;
    setAccount(acct);
    setStreak(strk);
    setCompletedDays(days);
    setAlarm(alrm);
    setUnlockTimes(Object.fromEntries(stamps.map((t) => [t.day, t.timestamp])));
    setIntentionsByDay(intentions);
    setWakeResolved(resolved);
    setNow(new Date());
  }, []);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void load(() => alive);
      return () => {
        alive = false;
      };
    }, [load]),
  );

  // Foregrounding on a new day re-derives the streak (missed scheduled mornings reset it).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void load();
    });
    return () => sub.remove();
  }, [load]);

  const onSignIn = async () => {
    setAccount(await signInWithAppleStub());
  };

  const onSignOut = async () => {
    setAccount(await signOut());
  };

  const totalMornings = completedDays.length;
  const bestStreak = Math.max(longestScheduledStreak(completedDays, alarm.weekdays), streak.count);
  const unlockedToday = isUnlockedForToday(streak, completedDays, wakeResolved, now);
  const monthMornings = morningsInMonth(
    calendarMonth.year,
    calendarMonth.month,
    completedDays,
  );

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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Share streak"
          hitSlop={12}
          onPress={() => void onShareStreak()}
          style={({ pressed }) => [styles.gearBtn, pressed && styles.pressed]}
        >
          <Ionicons name="share-outline" size={24} color={colors.text} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Settings"
          hitSlop={12}
          onPress={() => router.push('/settings')}
          style={({ pressed }) => [styles.gearBtn, pressed && styles.pressed]}
        >
          <Ionicons name="settings-outline" size={24} color={colors.text} />
        </Pressable>
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

        <View style={styles.totalsRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Current streak, ${streak.count} ${streak.count === 1 ? 'day' : 'days'}. Opens streak details`}
            onPress={() => setShowStreakSheet(true)}
            style={({ pressed }) => [
              styles.totalChip,
              streak.count > 0 && styles.totalChipLit,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.totalValueRow}>
              <Ionicons
                name={streak.count > 0 ? 'flame' : 'flame-outline'}
                size={16}
                color={streak.count > 0 ? colors.calm : colors.textDim}
              />
              <Text style={[styles.totalNum, streak.count > 0 && styles.totalNumLit]}>
                {streak.count}
              </Text>
            </View>
            <Text style={styles.totalLabel}>Current</Text>
          </Pressable>
          <View
            style={styles.totalChip}
            accessible
            accessibilityLabel={`Best streak, ${bestStreak} ${bestStreak === 1 ? 'day' : 'days'}`}
          >
            <View style={styles.totalValueRow}>
              <Ionicons name="trophy-outline" size={16} color={colors.textDim} />
              <Text style={styles.totalNum}>{bestStreak}</Text>
            </View>
            <Text style={styles.totalLabel}>Best</Text>
          </View>
          <View
            style={styles.totalChip}
            accessible
            accessibilityLabel={`Total mornings, ${totalMornings}`}
          >
            <View style={styles.totalValueRow}>
              <Ionicons name="sunny-outline" size={16} color={colors.textDim} />
              <Text style={styles.totalNum}>{totalMornings}</Text>
            </View>
            <Text style={styles.totalLabel}>Mornings</Text>
          </View>
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

        <View style={styles.historyCard}>
          <Text style={styles.historyTitle}>Recent mornings</Text>
          {recentDays.length === 0 ? (
            <Text style={styles.historyEmpty}>
              No mornings yet — unlock one to start history.
            </Text>
          ) : (
            <View style={styles.historyList}>
              {recentDays.map((key) => {
                const stamp = unlockTimes[key];
                const intention = intentionsByDay[key];
                return (
                  <View key={key} style={styles.historyRow}>
                    <View style={styles.historyDot} />
                    <View style={styles.historyBody}>
                      <View style={styles.historyTop}>
                        <Text style={styles.historyDate}>{formatHistoryDay(key)}</Text>
                        <Text style={styles.historyTag}>
                          {stamp != null ? `Unlocked ${formatHistoryTime(stamp)}` : 'Unlocked'}
                        </Text>
                      </View>
                      {intention ? (
                        <Text style={styles.historyIntention} numberOfLines={2}>
                          {`\u201C${intention}\u201D`}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.actionsCard}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/milestones')}
            style={({ pressed }) => [styles.actionRow, pressed && styles.pressed]}
          >
            <View style={styles.actionLeft}>
              <Ionicons name="ribbon-outline" size={20} color={colors.text} />
              <Text style={styles.actionLabel}>Milestones & badges</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textDim} />
          </Pressable>
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

      <StreakSheet
        visible={showStreakSheet}
        onClose={() => setShowStreakSheet(false)}
        streak={streak}
        completedDays={completedDays}
        alarm={alarm}
        unlockedToday={unlockedToday}
        now={now}
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
  screenTitle: {
    ...typography.title,
    color: colors.text,
    flex: 1,
  },
  gearBtn: { padding: 4 },
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
  totalsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  totalChip: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.md - 4,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  totalChipLit: {
    backgroundColor: colors.calmSoft,
    borderColor: colors.calm,
  },
  totalValueRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  totalNum: { color: colors.text, fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  totalNumLit: { color: colors.calm },
  totalLabel: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
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
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: 6,
  },
  historyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 7,
    backgroundColor: colors.calm,
  },
  historyBody: { flex: 1, gap: 2 },
  historyTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  historyIntention: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    fontStyle: 'italic',
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
