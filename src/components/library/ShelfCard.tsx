import { memo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LibraryTrackMark } from '@/components/LibraryTrackMark';
import { SceneLockBadge } from '@/components/SceneCover';
import { PreviewOverlay } from '@/components/PreviewOverlay';
import { TrackCover } from '@/components/TrackCover';
import { radii, spacing, typography } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';
import { kindLabel, type UnlockTrack } from '@/constants/unlock-tracks';
import { previewA11yActions } from '@/lib/preview-a11y';
import { CARD_H, CARD_W, SCENE_ART_H, frostPill, playFab, pillText, pressedStyle } from './library-styles';
import { hapticSelect } from '@/lib/haptics';

type Props = {
  track: UnlockTrack;
  /** Premium track and the user is not Premium: tapping opens the paywall, no preview. */
  locked: boolean;
  selected: boolean;
  previewing: boolean;
  /** Generative scene covers (release) vs the dev 'classic' single-mark tiles. */
  scenes: boolean;
  colors: ColorTokens;
  styles: ShelfCardStyles;
  onSelect: (track: UnlockTrack) => void;
  onPreview: (track: UnlockTrack) => void;
};

function ShelfCardBase({ track, locked, selected, previewing, scenes, colors, styles, onSelect, onPreview }: Props) {
  const preview = locked ? undefined : () => onPreview(track);
  const status = locked ? ', Premium. Opens Quiett Premium' : selected ? ', selected for your next morning' : '';

  const button = preview
    ? {
        playing: previewing,
        onPress: preview,
        colors,
        size: 32,
        iconSize: 14,
        style: styles.fab,
        activeStyle: styles.fabActive,
        accessibilityLabel: `${previewing ? 'Stop' : 'Play'} preview of ${track.title}`,
      }
    : null;

  const renderCard = (slot: ReactNode) => {
  const badges = (
    <View style={styles.top}>
      {selected ? (
        <View style={styles.pill}>
          <Ionicons name="checkmark" size={11} color={colors.calm} />
          <Text style={[styles.pillText, { color: colors.calm }]}>Selected</Text>
        </View>
      ) : locked ? (
        <View style={styles.pill}>
          <Ionicons name="sparkles" size={11} color={colors.calm} />
          <Text style={[styles.pillText, { color: colors.text }]}>Premium</Text>
        </View>
      ) : (
        <View />
      )}
      {slot}
    </View>
  );

  const text = (
    <>
      <Text style={styles.title} numberOfLines={2}>
        {track.title}
      </Text>
      <Text style={styles.meta} numberOfLines={1}>
        {track.durationLabel} · {track.mood}
      </Text>
    </>
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${track.title}, ${track.durationLabel}, ${kindLabel(track.kind)}${status}`}
      {...previewA11yActions(previewing, preview)}
      onPress={() => {
        hapticSelect();
        onSelect(track);
      }}
      style={({ pressed }) => [styles.card, selected && styles.cardSelected, pressed && pressedStyle]}
    >
      {scenes ? (
        <View style={styles.sceneCard}>
          <View style={styles.art}>
            <TrackCover trackId={track.id} size={CARD_W - 2} height={SCENE_ART_H} locked={locked} animate={previewing} defer />
            <View style={styles.overlay}>{badges}</View>
          </View>
          <View style={styles.sceneBottom}>{text}</View>
        </View>
      ) : (
        <View style={[styles.classicCard, { backgroundColor: track.accentSoft }]}>
          {badges}
          <View style={styles.markWrap}>
            <LibraryTrackMark trackId={track.id} kind={track.kind} color={track.accent} size={72} />
            {locked ? <SceneLockBadge size={22} style={styles.classicLock} /> : null}
          </View>
          <View style={styles.classicBottom}>{text}</View>
        </View>
      )}
    </Pressable>
  );
  };

  return <PreviewOverlay button={button} renderRow={renderCard} />;
}

export const ShelfCard = memo(ShelfCardBase);

export type ShelfCardStyles = ReturnType<typeof createShelfCardStyles>;

/** Built once per shelf and passed down, so 28 cards don't each build a stylesheet. */
export function createShelfCardStyles(colors: ColorTokens) {
  return StyleSheet.create({
    card: {
      width: CARD_W,
      height: CARD_H,
      borderRadius: radii.lg,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardSelected: { borderColor: colors.calm },
    sceneCard: { flex: 1, backgroundColor: colors.bgCard },
    art: { height: SCENE_ART_H, overflow: 'hidden' },
    overlay: { position: 'absolute', top: 0, left: 0, right: 0 },
    sceneBottom: { flex: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.xs, justifyContent: 'center' },
    classicCard: { flex: 1, justifyContent: 'space-between' },
    markWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.sm },
    classicLock: { position: 'absolute', right: spacing.sm, bottom: 0 },
    classicBottom: { padding: spacing.md, gap: spacing.xs },
    top: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      padding: spacing.sm,
    },
    pill: frostPill(colors),
    pillText,
    title: { ...typography.body, color: colors.text, fontWeight: '700' },
    meta: { ...typography.caption, color: colors.textMuted, fontWeight: '600' },
    fab: playFab(colors, 32),
    fabActive: { backgroundColor: colors.calmSoft, borderColor: colors.calm },
  });
}
