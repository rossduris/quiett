import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LibraryTrackMark } from '@/components/LibraryTrackMark';
import { SurpriseOffNote } from '@/components/SurpriseOffNote';
import { TrackCover } from '@/components/TrackCover';
import { PlayButton } from '@/components/PlayButton';
import { radii, spacing, typography } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';
import { kindLabel, type UnlockTrack } from '@/constants/unlock-tracks';
import { previewA11yActions, previewButtonA11yHidden } from '@/lib/preview-a11y';
import { useThemeColors } from '@/lib/theme-provider';
import { chip, chipActive, playFab, pressedStyle } from './library-styles';

export const ART_H = 132;

type Props = {
  track: UnlockTrack;
  locked: boolean;
  previewing: boolean;
  scenes: boolean;
  surpriseMe: boolean;
  surpriseOffTick: number;
  onToggleSurprise: () => void;
  onPreview: (track: UnlockTrack) => void;
};

/** "Your next meditation": the selected track. Not tappable itself; only its play button acts. */
export function FeaturedCard({
  track,
  locked,
  previewing,
  scenes,
  surpriseMe,
  surpriseOffTick,
  onToggleSurprise,
  onPreview,
}: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [width, setWidth] = useState(0);
  const onLayout = useCallback((e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width)), []);
  const preview = locked ? undefined : () => onPreview(track);
  const meta = `${kindLabel(track.kind)} · ${track.durationLabel}${surpriseMe ? ' · rotating' : ''}`;

  return (
    <View style={styles.wrap}>
      <View style={styles.top}>
        <SurpriseOffNote
          trigger={surpriseOffTick}
          style={styles.eyebrowNote}
          fallback={<Text style={styles.eyebrow}>Your next meditation</Text>}
        />
        <Pressable
          accessibilityRole="switch"
          accessibilityLabel="Surprise me"
          accessibilityHint="Picks a different meditation each morning"
          accessibilityState={{ checked: surpriseMe }}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          onPress={onToggleSurprise}
          style={({ pressed }) => [styles.surprise, surpriseMe && styles.surpriseOn, pressed && pressedStyle]}
        >
          <Ionicons name="shuffle-outline" size={14} color={surpriseMe ? colors.calm : colors.textDim} />
          <Text style={[styles.surpriseText, surpriseMe && styles.surpriseTextOn]}>Surprise me</Text>
        </Pressable>
      </View>

      <View
        accessible
        accessibilityLabel={`Your next meditation: ${track.title}. ${track.blurb} ${kindLabel(track.kind)}, 2 minutes${
          surpriseMe ? ', rotating each morning' : ''
        }.`}
        {...previewA11yActions(previewing, preview)}
        onLayout={scenes ? onLayout : undefined}
        style={[
          styles.card,
          scenes ? styles.cardScene : { backgroundColor: track.accentSoft, borderColor: track.accent },
        ]}
      >
        {scenes ? (
          <View style={styles.art}>
            {width > 0 ? <TrackCover trackId={track.id} size={width - 2} height={ART_H} animate /> : null}
          </View>
        ) : (
          <View style={styles.markWrap}>
            <LibraryTrackMark trackId={track.id} kind={track.kind} color={track.accent} size={88} />
          </View>
        )}
        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={1}>
            {track.title}
          </Text>
          <Text style={styles.blurb} numberOfLines={2}>
            {track.blurb}
          </Text>
          <Text style={styles.meta}>{meta}</Text>
        </View>
        {preview ? (
          <PlayButton
            {...previewButtonA11yHidden}
            playing={previewing}
            onPress={preview}
            colors={colors}
            size={36}
            iconSize={16}
            style={styles.fab}
            activeStyle={styles.fabActive}
          />
        ) : null}
      </View>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    wrap: { paddingHorizontal: spacing.lg, gap: spacing.sm },
    top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    eyebrow: { ...typography.eyebrow, color: colors.textDim },
    eyebrowNote: { ...typography.eyebrow, color: colors.calm },
    surprise: { ...chip(colors), minHeight: 32, paddingHorizontal: spacing.sm },
    surpriseOn: chipActive(colors),
    surpriseText: { ...typography.caption, color: colors.textDim, fontWeight: '700' },
    surpriseTextOn: { color: colors.calm },
    card: {
      minHeight: 168,
      borderRadius: radii.xl,
      borderWidth: 1,
      overflow: 'hidden',
      paddingTop: spacing.md,
      paddingHorizontal: spacing.md,
      justifyContent: 'space-between',
    },
    cardScene: { paddingTop: 0, paddingHorizontal: 0, backgroundColor: colors.bgCard, borderColor: colors.border },
    art: { height: ART_H, overflow: 'hidden' },
    markWrap: { alignItems: 'flex-start', paddingLeft: spacing.xs },
    body: { padding: spacing.md, paddingTop: spacing.sm, gap: spacing.xs },
    title: { ...typography.title, color: colors.text },
    blurb: { ...typography.body, color: colors.textMuted, lineHeight: 22 },
    meta: { ...typography.caption, color: colors.textDim, fontWeight: '600', marginTop: 2 },
    fab: { ...playFab(colors, 36), position: 'absolute', top: spacing.md, right: spacing.md },
    fabActive: { backgroundColor: colors.calmSoft, borderColor: colors.calm },
  });
}
