import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { spacing } from '@/constants/theme';
import { useThemeColors } from '@/lib/theme-provider';
import { ScreenHeader } from '@/components/ScreenHeader';
import {
  loadCompletedDays,
  loadEarnedBadges,
  loadStreak,
  type BadgeId,
  type StreakData,
} from '@/lib/storage';
import type { ColorTokens } from '@/constants/themes';

type Badge = {
  id: BadgeId;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description: string;
  category: 'streak' | 'milestone' | 'variety';
};

const ALL_BADGES: Badge[] = [
  {
    id: 'first-unlock',
    icon: 'sunny',
    label: 'First Morning',
    description: 'Unlocked your first morning',
    category: 'milestone',
  },
  {
    id: 'streak-3',
    icon: 'flame',
    label: '3-Day Streak',
    description: 'Completed 3 days in a row',
    category: 'streak',
  },
  {
    id: 'streak-7',
    icon: 'flame',
    label: 'Week Warrior',
    description: 'Completed 7 days in a row',
    category: 'streak',
  },
  {
    id: 'streak-14',
    icon: 'flame',
    label: 'Two Weeks',
    description: 'Completed 14 days in a row',
    category: 'streak',
  },
  {
    id: 'streak-21',
    icon: 'flame',
    label: '21-Day Habit',
    description: 'Completed 21 days in a row',
    category: 'streak',
  },
  {
    id: 'streak-30',
    icon: 'flame',
    label: 'Month Mastery',
    description: 'Completed 30 days in a row',
    category: 'streak',
  },
  {
    id: 'streak-60',
    icon: 'flame',
    label: 'Two Months',
    description: 'Completed 60 days in a row',
    category: 'streak',
  },
  {
    id: 'streak-100',
    icon: 'flame',
    label: 'Century',
    description: 'Completed 100 days in a row',
    category: 'streak',
  },
  {
    id: 'mornings-10',
    icon: 'star',
    label: '10 Mornings',
    description: 'Unlocked 10 total mornings',
    category: 'milestone',
  },
  {
    id: 'mornings-50',
    icon: 'star',
    label: '50 Mornings',
    description: 'Unlocked 50 total mornings',
    category: 'milestone',
  },
  {
    id: 'perfect-week',
    icon: 'checkmark-done',
    label: 'Perfect Week',
    description: 'Completed all 7 scheduled days',
    category: 'milestone',
  },
  {
    id: 'tried-guided',
    icon: 'mic',
    label: 'Voice Explorer',
    description: 'Tried a guided meditation',
    category: 'variety',
  },
  {
    id: 'tried-ambient',
    icon: 'musical-notes',
    label: 'Soundscape',
    description: 'Tried an ambient track',
    category: 'variety',
  },
  {
    id: 'tried-healing',
    icon: 'pulse',
    label: 'Frequency',
    description: 'Tried a healing frequency',
    category: 'variety',
  },
];

export default function MilestonesScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [earnedIds, setEarnedIds] = useState<Set<BadgeId>>(new Set());
  const [totalMornings, setTotalMornings] = useState(0);
  const [streak, setStreak] = useState<StreakData>({ count: 0, lastCompletedDate: null });

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const [badges, days, strk] = await Promise.all([
          loadEarnedBadges(),
          loadCompletedDays(),
          loadStreak(),
        ]);
        if (!alive) return;
        setEarnedIds(new Set(badges));
        setTotalMornings(days.length);
        setStreak(strk);
      })();
      return () => {
        alive = false;
      };
    }, []),
  );

  const earnedCount = earnedIds.size;
  const totalCount = ALL_BADGES.length;

  const byCategory = useMemo(() => {
    const groups: Record<string, Badge[]> = {
      streak: [],
      milestone: [],
      variety: [],
    };
    for (const badge of ALL_BADGES) {
      groups[badge.category]?.push(badge);
    }
    return groups;
  }, []);

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Milestones" fallbackHref="/profile" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.summaryCard}>
          <View style={styles.summaryHero}>
            <Text style={styles.summaryBig}>{earnedCount}</Text>
            <Text style={styles.summaryLabel}>
              of {totalCount} {totalCount === 1 ? 'badge' : 'badges'} earned
            </Text>
          </View>
          <View style={styles.summaryStats}>
            <View style={styles.summaryCol}>
              <Ionicons name="flame" size={20} color={colors.calm} />
              <Text style={styles.summaryNum}>{streak.count}</Text>
              <Text style={styles.summaryText}>Current streak</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryCol}>
              <Ionicons name="sunny" size={20} color={colors.calm} />
              <Text style={styles.summaryNum}>{totalMornings}</Text>
              <Text style={styles.summaryText}>Total mornings</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Streak achievements</Text>
          <View style={styles.badgeGrid}>
            {byCategory.streak?.map((badge) => {
              const earned = earnedIds.has(badge.id);
              return (
                <View key={badge.id} style={[styles.badgeCard, !earned && styles.badgeCardLocked]}>
                  <View style={[styles.badgeIcon, !earned && styles.badgeIconLocked]}>
                    <Ionicons
                      name={earned ? badge.icon : 'lock-closed'}
                      size={24}
                      color={earned ? colors.calm : colors.textDim}
                    />
                  </View>
                  <Text style={[styles.badgeLabel, !earned && styles.badgeLabelLocked]}>
                    {badge.label}
                  </Text>
                  <Text style={styles.badgeDesc}>{badge.description}</Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Milestones</Text>
          <View style={styles.badgeGrid}>
            {byCategory.milestone?.map((badge) => {
              const earned = earnedIds.has(badge.id);
              return (
                <View key={badge.id} style={[styles.badgeCard, !earned && styles.badgeCardLocked]}>
                  <View style={[styles.badgeIcon, !earned && styles.badgeIconLocked]}>
                    <Ionicons
                      name={earned ? badge.icon : 'lock-closed'}
                      size={24}
                      color={earned ? colors.calm : colors.textDim}
                    />
                  </View>
                  <Text style={[styles.badgeLabel, !earned && styles.badgeLabelLocked]}>
                    {badge.label}
                  </Text>
                  <Text style={styles.badgeDesc}>{badge.description}</Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Variety</Text>
          <View style={styles.badgeGrid}>
            {byCategory.variety?.map((badge) => {
              const earned = earnedIds.has(badge.id);
              return (
                <View key={badge.id} style={[styles.badgeCard, !earned && styles.badgeCardLocked]}>
                  <View style={[styles.badgeIcon, !earned && styles.badgeIconLocked]}>
                    <Ionicons
                      name={earned ? badge.icon : 'lock-closed'}
                      size={24}
                      color={earned ? colors.calm : colors.textDim}
                    />
                  </View>
                  <Text style={[styles.badgeLabel, !earned && styles.badgeLabelLocked]}>
                    {badge.label}
                  </Text>
                  <Text style={styles.badgeDesc}>{badge.description}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    scroll: { flex: 1 },
    content: {
      paddingHorizontal: spacing.lg,
      gap: spacing.xl,
    },
    summaryCard: {
      backgroundColor: colors.bgCard,
      borderRadius: 16,
      padding: spacing.xl,
      borderWidth: 1,
      borderColor: colors.border,
      gap: spacing.lg,
    },
    summaryHero: {
      alignItems: 'center',
      gap: spacing.xs,
    },
    summaryBig: {
      fontSize: 56,
      fontWeight: '200',
      color: colors.calm,
      letterSpacing: -1.5,
    },
    summaryLabel: {
      color: colors.textMuted,
      fontSize: 16,
      fontWeight: '500',
    },
    summaryStats: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    summaryCol: {
      alignItems: 'center',
      gap: spacing.xs,
    },
    summaryDivider: {
      width: 1,
      backgroundColor: colors.border,
    },
    summaryNum: {
      fontSize: 24,
      fontWeight: '600',
      color: colors.text,
    },
    summaryText: {
      color: colors.textDim,
      fontSize: 12,
      fontWeight: '500',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    section: {
      gap: spacing.md,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: '600',
    },
    badgeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
    },
    badgeCard: {
      width: '47%',
      backgroundColor: colors.bgCard,
      borderRadius: 16,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.calm,
      alignItems: 'center',
      gap: spacing.sm,
    },
    badgeCardLocked: {
      borderColor: colors.border,
      opacity: 0.6,
    },
    badgeIcon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.calmSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeIconLocked: {
      backgroundColor: colors.bgElevated,
    },
    badgeLabel: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '600',
      textAlign: 'center',
    },
    badgeLabelLocked: {
      color: colors.textMuted,
    },
    badgeDesc: {
      color: colors.textDim,
      fontSize: 12,
      textAlign: 'center',
      lineHeight: 16,
    },
  });
}
