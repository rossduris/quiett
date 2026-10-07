import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ALL_BADGES, type Badge } from '@/constants/badges';
import { spacing, typography } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';
import type { BadgeId } from '@/lib/storage';
import { useThemeColors } from '@/lib/theme-provider';
import { BadgeDetailSheet } from './BadgeDetailSheet';
import { BadgeMedallion } from './BadgeMedallion';
import { MedalSheen } from '@/components/MedalSheen';
import { createProfileStyles } from './profile-styles';
import { SectionHeader } from './SectionHeader';
import { EmptyState } from '@/components/EmptyState';

const MEDAL = 64;

/** Horizontal strip of illustrated medallions (earned first, in list order). Tap for detail. */
export function MilestonesRow({ earnedIds }: { earnedIds: readonly BadgeId[] }) {
  const router = useRouter();
  const colors = useThemeColors();
  const shared = useMemo(() => createProfileStyles(colors), [colors]);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const earned = useMemo(() => new Set(earnedIds), [earnedIds]);
  const ordered = useMemo(
    () => [...ALL_BADGES.filter((b) => earned.has(b.id)), ...ALL_BADGES.filter((b) => !earned.has(b.id))],
    [earned],
  );
  const [open, setOpen] = useState<Badge | null>(null);
  const count = ALL_BADGES.filter((b) => earned.has(b.id)).length;

  return (
    <View style={shared.section}>
      <SectionHeader
        label={`Milestones · ${count} of ${ALL_BADGES.length}`}
        action={{ label: 'See all', onPress: () => router.push('/milestones'), accessibilityLabel: 'See all milestones' }}
      />
      {count === 0 ? (
        <EmptyState scene="ring" title="Your first milestone is one morning away" body="Milestones come from showing up, one quiet morning at a time." />
      ) : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
        style={styles.scroll}
      >
        {ordered.map((b, i) => {
          const isEarned = earned.has(b.id);
          return (
            <Pressable
              key={b.id}
              onPress={() => setOpen(b)}
              accessibilityRole="button"
              accessibilityLabel={`${b.label}, ${isEarned ? 'earned' : 'not yet earned'}`}
              style={({ pressed }) => [styles.item, pressed && shared.pressed]}
            >
              <MedalSheen size={MEDAL} play={isEarned} delay={500 + Math.min(i, 5) * 140} id={`sheen-row-${b.id}`}>
                <BadgeMedallion badge={b} earned={isEarned} size={MEDAL} colors={colors} idPrefix={`row-${b.id}`} />
              </MedalSheen>
              <Text style={[styles.label, !isEarned && styles.labelLocked]} numberOfLines={2}>
                {b.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <BadgeDetailSheet badge={open} earned={open ? earned.has(open.id) : false} onClose={() => setOpen(null)} />
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    // Bleed to the screen edges so the strip scrolls under the page padding.
    scroll: { marginHorizontal: -spacing.lg },
    strip: { paddingHorizontal: spacing.lg, gap: 10, paddingVertical: spacing.xs },
    item: { width: MEDAL + 8, alignItems: 'center', gap: spacing.xs },
    label: { ...typography.caption, fontSize: 12, lineHeight: 15, color: colors.text, textAlign: 'center', fontWeight: '500' },
    labelLocked: { color: colors.textDim },
  });
}
