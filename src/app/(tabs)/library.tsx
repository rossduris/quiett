import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography } from '@/constants/theme';
import { TAB_BAR_CLEARANCE } from '@/components/QuiettTabBar';
import {
  DEFAULT_UNLOCK_TRACK_ID,
  kindLabel,
  kindSectionHint,
  unlockTrackById,
  unlockTracksByKind,
  type UnlockTrack,
  type UnlockTrackKind,
} from '@/constants/unlock-tracks';
import { loadUnlockTrackId, saveUnlockTrackId } from '@/lib/storage';

type Filter = 'all' | UnlockTrackKind;

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'guided', label: 'Guided' },
  { id: 'music', label: 'Healing' },
  { id: 'ambient', label: 'Ambient' },
];

const SECTION_ORDER: UnlockTrackKind[] = ['guided', 'music', 'ambient'];

function kindIcon(kind: UnlockTrackKind): keyof typeof Ionicons.glyphMap {
  switch (kind) {
    case 'guided':
      return 'mic-outline';
    case 'music':
      return 'musical-notes-outline';
    case 'ambient':
      return 'rainy-outline';
  }
}

function TrackArt({ track, large }: { track: UnlockTrack; large?: boolean }) {
  const size = large ? 72 : 56;
  return (
    <View
      style={[
        styles.art,
        {
          width: size,
          height: size,
          borderRadius: large ? 20 : 16,
          backgroundColor: track.accentSoft,
          borderColor: track.accent,
        },
      ]}
    >
      <View style={[styles.artOrb, { backgroundColor: track.accent, opacity: 0.55 }]} />
      <View style={[styles.artOrbSmall, { backgroundColor: track.accent }]} />
      <Ionicons
        name={track.locked ? 'sparkles-outline' : kindIcon(track.kind)}
        size={large ? 22 : 18}
        color={track.locked ? colors.textMuted : colors.text}
        style={styles.artIcon}
      />
    </View>
  );
}

function TrackCard({
  track,
  selected,
  onPress,
}: {
  track: UnlockTrack;
  selected?: boolean;
  onPress?: () => void;
}) {
  const disabled = track.locked;
  const Wrapper: typeof Pressable | typeof View = onPress && !disabled ? Pressable : View;

  return (
    <Wrapper
      accessibilityRole={onPress && !disabled ? 'button' : 'summary'}
      accessibilityState={
        onPress && !disabled ? { selected: !!selected } : undefined
      }
      accessibilityLabel={`${track.title}, ${track.durationLabel}, ${kindLabel(track.kind)}${
        track.locked ? ', premium coming soon' : selected ? ', selected for next morning' : ''
      }`}
      onPress={onPress && !disabled ? onPress : undefined}
      style={[
        styles.card,
        track.locked && styles.cardPremium,
        selected && styles.cardSelected,
      ]}
    >
      <TrackArt track={track} />
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {track.title}
          </Text>
          {track.locked ? (
            <View style={styles.premiumBadge}>
              <Text style={styles.premiumBadgeText}>Premium</Text>
            </View>
          ) : selected ? (
            <View style={styles.selectedBadge}>
              <Text style={styles.selectedBadgeText}>Selected</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.cardBlurb} numberOfLines={2}>
          {track.blurb}
        </Text>
        <View style={styles.metaRow}>
          <View style={styles.metaPill}>
            <Ionicons name="time-outline" size={12} color={colors.textDim} />
            <Text style={styles.metaText}>{track.durationLabel}</Text>
          </View>
          <View style={styles.metaPill}>
            <Text style={styles.metaText}>{track.mood}</Text>
          </View>
        </View>
      </View>
    </Wrapper>
  );
}

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedId, setSelectedId] = useState(DEFAULT_UNLOCK_TRACK_ID);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const id = await loadUnlockTrackId();
        if (alive) setSelectedId(id);
      })();
      return () => {
        alive = false;
      };
    }, []),
  );

  const selectedTrack = useMemo(() => unlockTrackById(selectedId), [selectedId]);
  const onSelectTrack = async (track: UnlockTrack) => {
    if (track.locked) return;
    const saved = await saveUnlockTrackId(track.id);
    setSelectedId(saved);
  };

  const sections = useMemo(() => {
    if (filter === 'all') return SECTION_ORDER;
    return [filter];
  }, [filter]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.md }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + TAB_BAR_CLEARANCE },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.screenTitle}>Library</Text>
          <Text style={styles.lead}>
            Guided meditations, healing tones, and ambient sound for tomorrow
            morning. Pick freely — nothing is locked behind finishing another track.
          </Text>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <Text style={styles.heroEyebrow}>Now playing next</Text>
            <View style={styles.selectedBadge}>
              <Text style={styles.selectedBadgeText}>Selected</Text>
            </View>
          </View>
          <View style={styles.heroMain}>
            <TrackArt track={selectedTrack} large />
            <View style={styles.heroBody}>
              <Text style={styles.heroTitle}>{selectedTrack.title}</Text>
              <Text style={styles.heroBlurb}>{selectedTrack.blurb}</Text>
              <View style={styles.metaRow}>
                <View style={styles.metaPill}>
                  <Text style={[styles.metaText, { color: colors.mist }]}>
                    {kindLabel(selectedTrack.kind)}
                  </Text>
                </View>
                <View style={styles.metaPill}>
                  <Text style={[styles.metaText, { color: colors.mist }]}>
                    {selectedTrack.durationLabel}
                  </Text>
                </View>
              </View>
            </View>
          </View>
          <Text style={styles.heroFoot}>
            Change anytime on Home or by tapping a track below.
          </Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          {FILTERS.map((item) => {
            const active = filter === item.id;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setFilter(item.id)}
                style={({ pressed }) => [
                  styles.filterChip,
                  active && styles.filterChipActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.filterText, active && styles.filterTextActive]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {sections.map((kind) => {
          const tracks = unlockTracksByKind(kind);
          return (
            <View key={kind} style={styles.section}>
              <View style={styles.sectionHead}>
                <View style={styles.sectionHeadLeft}>
                  <Ionicons name={kindIcon(kind)} size={16} color={colors.mist} />
                  <Text style={styles.sectionTitle}>{kindLabel(kind)}</Text>
                </View>
                <Text style={styles.sectionCount}>{tracks.length}</Text>
              </View>
              <Text style={styles.sectionLead}>{kindSectionHint(kind)}</Text>
              <View style={styles.list}>
                {tracks.map((track) => (
                  <TrackCard
                    key={track.id}
                    track={track}
                    selected={selectedId === track.id}
                    onPress={() => void onSelectTrack(track)}
                  />
                ))}
              </View>
            </View>
          );
        })}

        <View style={styles.footnoteCard}>
          <Ionicons name="library-outline" size={16} color={colors.mist} />
          <Text style={styles.footnote}>
            Browse the full shelf. Premium guided voice is coming as an upgrade —
            free guided, healing tones, and ambient are ready to pick today.
          </Text>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  header: { gap: spacing.sm, marginBottom: spacing.xs },
  screenTitle: { ...typography.title, color: colors.text },
  lead: { ...typography.body, color: colors.textMuted, lineHeight: 24 },
  hero: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroEyebrow: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  heroMain: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  heroBody: { flex: 1, gap: 6 },
  heroTitle: { ...typography.subtitle, color: colors.text, fontSize: 22 },
  heroBlurb: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  heroFoot: { color: colors.textDim, fontSize: 12, lineHeight: 18 },
  filters: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.full,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.calmSoft,
    borderColor: 'rgba(61,207,176,0.45)',
  },
  filterText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  filterTextActive: { color: colors.calm },
  section: { gap: spacing.sm, marginTop: spacing.xs },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '600' },
  sectionCount: { color: colors.textDim, fontSize: 13, fontWeight: '600' },
  sectionLead: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  list: { gap: spacing.sm },
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.bgCard,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  cardPremium: { opacity: 0.9 },
  cardSelected: {
    borderColor: 'rgba(61,207,176,0.55)',
    backgroundColor: 'rgba(61,207,176,0.08)',
  },
  art: {
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  artOrb: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    top: 6,
    right: 4,
  },
  artOrbSmall: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    bottom: 8,
    left: 8,
    opacity: 0.7,
  },
  artIcon: { zIndex: 1 },
  cardBody: { flex: 1, gap: 4 },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  cardTitle: { ...typography.subtitle, color: colors.text, flexShrink: 1 },
  cardBlurb: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: 4,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metaText: { color: colors.textDim, fontSize: 11, fontWeight: '600' },
  premiumBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  premiumBadgeText: { color: colors.textDim, fontSize: 11, fontWeight: '700' },
  selectedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.calmSoft,
  },
  selectedBadgeText: { color: colors.calm, fontSize: 11, fontWeight: '700' },
  footnoteCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  footnote: {
    flex: 1,
    color: colors.textDim,
    fontSize: 12,
    lineHeight: 18,
  },
  pressed: { opacity: 0.8 },
});
