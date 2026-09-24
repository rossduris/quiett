import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LibraryTrackMark } from '@/components/LibraryTrackMark';
import { radii, spacing, typography } from '@/constants/theme';
import { useThemeColors } from '@/lib/theme-provider';
import { TAB_BAR_CLEARANCE } from '@/components/QuiettTabBar';
import { meditationSoundById } from '@/constants/sounds';
import {
  DEFAULT_UNLOCK_TRACK_ID,
  kindLabel,
  kindSectionHint,
  pickSurpriseTrack,
  unlockTrackById,
  unlockTracksByKind,
  type UnlockTrack,
  type UnlockTrackKind,
} from '@/constants/unlock-tracks';
import { previewIds, stopPreview, usePreviewPlayer } from '@/lib/audio';
import {
  loadSurpriseMe,
  loadUnlockTrackId,
  saveSurpriseMe,
  saveUnlockTrackId,
  markLibraryCategoryUsed,
} from '@/lib/storage';
import type { ColorTokens } from '@/constants/themes';

type Filter = 'all' | UnlockTrackKind;

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'guided', label: 'Guided' },
  { id: 'music', label: 'Healing' },
  { id: 'ambient', label: 'Ambient' },
];

const SECTION_ORDER: UnlockTrackKind[] = ['guided', 'music', 'ambient'];

const CARD_W = 156;
const CARD_H = 196;

function ShelfCard({
  track,
  selected,
  previewing,
  onPress,
  onPreview,
  colors,
}: {
  track: UnlockTrack;
  selected?: boolean;
  previewing?: boolean;
  onPress?: () => void;
  onPreview?: () => void;
  colors: ReturnType<typeof useThemeColors>;
}) {
  const disabled = track.locked;
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected, disabled }}
      accessibilityLabel={`${track.title}, ${track.durationLabel}, ${kindLabel(track.kind)}${
        track.locked ? ', premium coming soon' : selected ? ', selected for next morning' : ''
      }`}
      disabled={disabled}
      onPress={onPress && !disabled ? onPress : undefined}
      style={({ pressed }) => [
        styles.shelfCard,
        selected && styles.shelfCardSelected,
        pressed && !disabled && styles.pressed,
        disabled && styles.shelfCardLocked,
      ]}
    >
      <View style={[styles.shelfCardBg, { backgroundColor: track.accentSoft }]}>
        <View style={styles.shelfCardTop}>
          {selected ? (
            <View style={styles.selectedBadge}>
              <Text style={styles.selectedBadgeText}>Selected</Text>
            </View>
          ) : track.locked ? (
            <View style={styles.premiumBadge}>
              <Text style={styles.premiumBadgeText}>Premium</Text>
            </View>
          ) : (
            <View />
          )}
          {!disabled && onPreview ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                previewing ? 'Stop preview' : `Preview ${track.title}`
              }
              hitSlop={8}
              onPress={() => onPreview()}
              style={({ pressed }) => [
                styles.previewFab,
                previewing && styles.previewFabActive,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name={previewing ? 'stop' : 'play'}
                size={14}
                color={previewing ? colors.calm : colors.text}
              />
            </Pressable>
          ) : null}
        </View>
        <View style={styles.shelfMarkWrap}>
          <LibraryTrackMark trackId={track.id} kind={track.kind} color={track.accent} size={72} />
        </View>
        <View style={styles.shelfCardBottom}>
          <Text style={styles.shelfCardTitle} numberOfLines={2}>
            {track.title}
          </Text>
          <Text style={styles.shelfCardMeta}>
            {track.durationLabel} · {track.mood}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedId, setSelectedId] = useState(DEFAULT_UNLOCK_TRACK_ID);
  const [surpriseMe, setSurpriseMe] = useState(false);
  const { playingId, toggle: togglePreview } = usePreviewPlayer();
  const isPreviewing = (trackId: string) => playingId === previewIds.track(trackId);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const [id, surprise] = await Promise.all([loadUnlockTrackId(), loadSurpriseMe()]);
        if (!alive) return;
        setSelectedId(id);
        setSurpriseMe(surprise);
      })();
      return () => {
        alive = false;
        stopPreview();
      };
    }, []),
  );

  useEffect(() => {
    return () => {
      stopPreview();
    };
  }, []);

  const selectedTrack = useMemo(() => unlockTrackById(selectedId), [selectedId]);

  const onSelectTrack = async (track: UnlockTrack) => {
    if (track.locked) return;
    const saved = await saveUnlockTrackId(track.id);
    setSelectedId(saved);
    if (surpriseMe) {
      setSurpriseMe(false);
      await saveSurpriseMe(false);
    }
    
    if (track.kind === 'guided') {
      await markLibraryCategoryUsed('guided');
    } else if (track.kind === 'music') {
      await markLibraryCategoryUsed('healing');
    } else if (track.kind === 'ambient') {
      await markLibraryCategoryUsed('ambient');
    }
  };

  const onToggleSurprise = async () => {
    const next = !surpriseMe;
    setSurpriseMe(next);
    await saveSurpriseMe(next);
    if (next) {
      const picked = pickSurpriseTrack(selectedId);
      const id = await saveUnlockTrackId(picked.id);
      setSelectedId(id);
    }
  };

  const onPreview = (track: UnlockTrack) => {
    if (track.locked) return;
    const sound = meditationSoundById(track.playbackSoundId);
    if (sound.url == null) return;
    togglePreview(previewIds.track(track.id), sound.url, 'track');
  };

  const sections = useMemo(() => {
    if (filter === 'all') return SECTION_ORDER;
    return [filter];
  }, [filter]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg, paddingTop: insets.top + spacing.md }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + TAB_BAR_CLEARANCE },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={[styles.screenTitle, { color: colors.text }]}>Library</Text>
          <Text style={[styles.lead, { color: colors.textMuted }]}>
            Guided, healing tones, and ambient for tomorrow morning. Swipe each shelf —
            pick freely, nothing locked behind finishing another track.
          </Text>
        </View>

        {/* Now playing next — Hatch-style featured card */}
        <View style={styles.heroWrap}>
          <View style={styles.heroTop}>
            <Text style={[styles.heroEyebrow, { color: colors.textDim }]}>Now playing next</Text>
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: surpriseMe }}
              onPress={() => void onToggleSurprise()}
              style={({ pressed }) => [
                styles.surprisePill,
                surpriseMe && styles.surprisePillOn,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name="shuffle-outline"
                size={14}
                color={surpriseMe ? colors.calm : colors.textDim}
              />
              <Text style={[styles.surpriseText, surpriseMe && styles.surpriseTextOn]}>
                Surprise me
              </Text>
            </Pressable>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() => {
              if (!selectedTrack.locked) setFilter(selectedTrack.kind);
            }}
            style={({ pressed }) => [styles.heroCard, pressed && styles.pressed]}
          >
            <View
              style={[
                styles.heroBg,
                {
                  backgroundColor: selectedTrack.accentSoft,
                  borderColor: selectedTrack.accent,
                },
              ]}
            >
              <View style={styles.heroMarkWrap}>
                <LibraryTrackMark
                  trackId={selectedTrack.id}
                  kind={selectedTrack.kind}
                  color={selectedTrack.accent}
                  size={88}
                />
              </View>
              <View style={styles.heroBody}>
                <Text style={styles.heroTitle}>{selectedTrack.title}</Text>
                <Text style={styles.heroBlurb} numberOfLines={2}>
                  {selectedTrack.blurb}
                </Text>
                <Text style={styles.heroMeta}>
                  {kindLabel(selectedTrack.kind)} · {selectedTrack.durationLabel}
                  {surpriseMe ? ' · rotating' : ''}
                </Text>
              </View>
              {!selectedTrack.locked ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    isPreviewing(selectedTrack.id) ? 'Stop preview' : `Preview ${selectedTrack.title}`
                  }
                  onPress={() => onPreview(selectedTrack)}
                  style={({ pressed }) => [
                    styles.previewFab,
                    styles.heroPreviewFab,
                    isPreviewing(selectedTrack.id) && styles.previewFabActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons
                    name={isPreviewing(selectedTrack.id) ? 'stop' : 'play'}
                    size={16}
                    color={isPreviewing(selectedTrack.id) ? colors.calm : colors.text}
                  />
                </Pressable>
              ) : null}
            </View>
          </Pressable>
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
                <Text style={styles.sectionTitle}>{kindLabel(kind)}</Text>
                <Text style={styles.sectionCount}>{tracks.length}</Text>
              </View>
              <Text style={styles.sectionLead}>{kindSectionHint(kind)}</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.shelfRow}
                decelerationRate="fast"
                snapToInterval={CARD_W + spacing.sm}
              >
                {tracks.map((track) => (
                  <ShelfCard
                    key={track.id}
                    track={track}
                    selected={selectedId === track.id}
                    previewing={isPreviewing(track.id)}
                    onPress={() => void onSelectTrack(track)}
                    colors={colors}
                    onPreview={() => onPreview(track)}
                  />
                ))}
              </ScrollView>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: {
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  header: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  screenTitle: { ...typography.title, color: colors.text },
  lead: { ...typography.body, color: colors.textMuted, lineHeight: 24 },
  heroWrap: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
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
  surprisePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  surprisePillOn: {
    backgroundColor: colors.calmSoft,
    borderColor: colors.calm,
  },
  surpriseText: { color: colors.textDim, fontSize: 12, fontWeight: '700' },
  surpriseTextOn: { color: colors.calm },
  heroCard: {
    borderRadius: radii.xl,
    overflow: 'hidden',
    borderWidth: 0,
  },
  heroBg: {
    minHeight: 168,
    borderRadius: radii.xl,
    borderWidth: 1,
    overflow: 'hidden',
    paddingTop: spacing.md,
    paddingHorizontal: spacing.md,
    justifyContent: 'space-between',
  },
  heroMarkWrap: {
    alignItems: 'flex-start',
    paddingLeft: spacing.xs,
  },
  heroBody: {
    padding: spacing.md,
    paddingTop: spacing.sm,
    gap: 6,
    zIndex: 1,
  },
  heroTitle: { ...typography.subtitle, color: colors.text, fontSize: 24 },
  heroBlurb: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  heroMeta: { color: colors.textDim, fontSize: 12, fontWeight: '600', marginTop: 2 },
  heroPreviewFab: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    zIndex: 2,
  },
  filters: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
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
    borderColor: colors.calm,
  },
  filterText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  filterTextActive: { color: colors.calm },
  section: { gap: spacing.sm, marginTop: spacing.xs },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  sectionCount: { color: colors.textDim, fontSize: 13, fontWeight: '600' },
  sectionLead: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: spacing.lg,
  },
  shelfRow: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  shelfCard: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  shelfCardSelected: {
    borderColor: colors.calm,
  },
  shelfCardLocked: { opacity: 0.72 },
  shelfCardBg: { flex: 1, justifyContent: 'space-between' },
  shelfMarkWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  shelfCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: spacing.sm,
    zIndex: 1,
  },
  shelfCardBottom: {
    padding: spacing.md,
    gap: 4,
    zIndex: 1,
  },
  shelfCardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  shelfCardMeta: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  premiumBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  premiumBadgeText: { color: colors.textDim, fontSize: 10, fontWeight: '700' },
  selectedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.calmSoft,
  },
  selectedBadgeText: { color: colors.calm, fontSize: 10, fontWeight: '700' },
  previewFab: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  previewFabActive: {
    backgroundColor: colors.calmSoft,
    borderColor: colors.calm,
  },
  pressed: { opacity: 0.85 },
});
}
