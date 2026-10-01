import { useCallback, useMemo } from 'react';
import { FlatList, StyleSheet, Text, View, type ListRenderItem } from 'react-native';
import { spacing, typography } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';
import {
  kindLabel,
  kindSectionHint,
  orderTracksForUser,
  unlockTracksByKind,
  type UnlockTrack,
  type UnlockTrackKind,
} from '@/constants/unlock-tracks';
import { previewIds } from '@/lib/audio';
import { useThemeColors } from '@/lib/theme-provider';
import { ShelfCard, createShelfCardStyles } from './ShelfCard';
import { CARD_GAP, CARD_W } from './library-styles';

type Props = {
  kind: UnlockTrackKind;
  isPremium: boolean;
  selectedId: string;
  playingId: string | null;
  scenes: boolean;
  onSelect: (track: UnlockTrack) => void;
  onPreview: (track: UnlockTrack) => void;
};

const STRIDE = CARD_W + CARD_GAP;

const keyExtractor = (t: UnlockTrack) => t.id;
const getItemLayout = (_: unknown, index: number) => ({ length: CARD_W, offset: spacing.lg + STRIDE * index, index });

/** One horizontal shelf (virtualised: only the cards near the viewport mount their SVG covers). */
export function TrackShelf({ kind, isPremium, selectedId, playingId, scenes, onSelect, onPreview }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const cardStyles = useMemo(() => createShelfCardStyles(colors), [colors]);
  const tracks = useMemo(() => orderTracksForUser(unlockTracksByKind(kind), isPremium), [kind, isPremium]);

  const renderItem = useCallback<ListRenderItem<UnlockTrack>>(
    ({ item }) => (
      <ShelfCard
        track={item}
        locked={item.locked && !isPremium}
        selected={item.id === selectedId}
        previewing={playingId === previewIds.track(item.id)}
        scenes={scenes}
        colors={colors}
        styles={cardStyles}
        onSelect={onSelect}
        onPreview={onPreview}
      />
    ),
    [isPremium, selectedId, playingId, scenes, colors, cardStyles, onSelect, onPreview],
  );

  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <Text style={styles.title} accessibilityRole="header">
          {kindLabel(kind)}
        </Text>
        <Text style={styles.count} accessibilityLabel={`${tracks.length} tracks`}>
          {tracks.length}
        </Text>
      </View>
      <Text style={styles.hint}>{kindSectionHint(kind)}</Text>
      <FlatList
        horizontal
        data={tracks}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        ItemSeparatorComponent={Separator}
        getItemLayout={getItemLayout}
        // ~2.4 cards fit on screen: mount 3, keep one screen either side, add 2 per batch.
        initialNumToRender={3}
        maxToRenderPerBatch={2}
        updateCellsBatchingPeriod={80}
        windowSize={3}
        decelerationRate="fast"
        snapToInterval={STRIDE}
      />
    </View>
  );
}

function Separator() {
  return <View style={{ width: CARD_GAP }} />;
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    section: { gap: spacing.sm, marginTop: spacing.xs },
    head: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
    },
    title: { ...typography.subtitle, color: colors.text, fontWeight: '700' },
    count: { ...typography.caption, color: colors.textDim, fontWeight: '600' },
    hint: { ...typography.caption, color: colors.textMuted, lineHeight: 18, paddingHorizontal: spacing.lg },
    row: { paddingHorizontal: spacing.lg, paddingVertical: spacing.xs },
  });
}
