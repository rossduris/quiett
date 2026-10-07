import { useEffect, useMemo, useRef } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LibraryTrackMark } from '@/components/LibraryTrackMark';
import { TrackCover } from '@/components/TrackCover';
import { useCoverStyle } from '@/lib/scene-cover-pref';
import { radii, spacing, typography } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';
import { meditationSoundById } from '@/constants/sounds';
import { followPreviewSelection, previewIds, usePreviewPlayer, useStopPreviewWhenHidden } from '@/lib/audio';
import { useThemeColors } from '@/lib/theme-provider';
import { useShowGuided } from '@/lib/dev-flags';
import { previewA11yActions } from '@/lib/preview-a11y';
import { PreviewOverlay } from '@/components/PreviewOverlay';
import {
  kindLabel,
  kindSectionHint,
  unlockTracksByKind,
  visibleKinds,
  type UnlockTrack,
  type UnlockTrackKind,
} from '@/constants/unlock-tracks';


type Props = {
  visible: boolean;
  selectedId: string;
  onClose: () => void;
  onSelect: (track: UnlockTrack) => void;
};

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

export function UnlockTrackPicker({ visible, selectedId, onClose, onSelect }: Props) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { playingId, toggle } = usePreviewPlayer();
  // Selecting a row while a preview plays hands the preview to the new track; it keeps playing
  // after the sheet closes (Home's meditation row picks up the halo). Any other close stops it.
  const handoff = useRef<string | null>(null);
  useEffect(() => {
    if (visible) handoff.current = null;
  }, [visible]);
  useStopPreviewWhenHidden(visible, () => handoff.current);
  const coverStyle = useCoverStyle();
  // Guided shelf is hidden for launch (dev switch brings it back).
  const guidedOn = useShowGuided();

  const preview = (track: UnlockTrack) => {
    const url = meditationSoundById(track.playbackSoundId).url;
    if (url == null) return;
    toggle(previewIds.track(track.id), url, 'track');
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.sheet, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.sheetHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sheetEyebrow}>Step 2</Text>
            <Text style={styles.sheetTitle}>Meditation</Text>
            <Text style={styles.sheetLead}>
              Your 2-minute meditation, once you’re still. {guidedOn ? 'Guided, tones & music' : 'Tones & music'} or ambient.
              Tap play to preview.
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
            hitSlop={12}
            style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
          >
            <Ionicons name="close" size={20} color={colors.textMuted} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
          showsVerticalScrollIndicator={false}
        >
          {visibleKinds(guidedOn).map((kind) => {
            const tracks = unlockTracksByKind(kind);
            return (
              <View key={kind} style={styles.section}>
                <View style={styles.sectionHead}>
                  <Ionicons name={kindIcon(kind)} size={16} color={colors.mist} />
                  <Text style={styles.sectionTitle}>{kindLabel(kind)}</Text>
                </View>
                <Text style={styles.sectionHint}>{kindSectionHint(kind)}</Text>

                <View style={styles.list}>
                  {tracks.map((track) => {
                    const selected = track.id === selectedId;
                    const playing = playingId === previewIds.track(track.id);
                    return (
                      <PreviewOverlay
                        key={track.id}
                        button={{
                          playing,
                          onPress: () => preview(track),
                          colors,
                          size: 34,
                          iconSize: 14,
                          style: styles.previewBtn,
                          activeStyle: styles.previewBtnActive,
                          accessibilityLabel: `${playing ? 'Stop' : 'Play'} preview of ${track.title}`,
                        }}
                        renderRow={(slot) => (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Meditation: ${track.title}`}
                        accessibilityState={{ selected }}
                        {...previewA11yActions(playing, () => preview(track))}
                        onPress={() => {
                          const id = previewIds.track(track.id);
                          if (playingId != null) {
                            followPreviewSelection(id, meditationSoundById(track.playbackSoundId).url, 'track');
                            handoff.current = id;
                          }
                          onSelect(track);
                        }}
                        style={({ pressed }) => [
                          styles.row,
                          selected && styles.rowSelected,
                          pressed && styles.pressed,
                        ]}
                      >
                        {coverStyle !== 'classic' ? (
                          <View style={[styles.art, styles.artScene]}>
                            <TrackCover trackId={track.id} size={50} radius={13} animate={playing} defer />
                          </View>
                        ) : (
                          <View
                            style={[
                              styles.art,
                              { backgroundColor: track.accentSoft, borderColor: track.accent },
                            ]}
                          >
                            <LibraryTrackMark
                              trackId={track.id}
                              kind={track.kind}
                              color={track.accent}
                              size={28}
                            />
                          </View>
                        )}
                        <View style={styles.rowBody}>
                          <View style={styles.rowTop}>
                            <Text style={styles.rowTitle} numberOfLines={1}>
                              {track.title}
                            </Text>
                            {selected ? <Ionicons name="checkmark-circle" size={18} color={colors.calm} /> : null}
                          </View>
                          <Text style={styles.rowBlurb} numberOfLines={2}>
                            {track.blurb}
                          </Text>
                          <Text style={styles.rowMeta}>
                            {track.durationLabel} · {track.mood}
                          </Text>
                        </View>
                        {slot}
                      </Pressable>
                        )}
                      />
                    );
                  })}
                </View>
              </View>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
  sheet: { flex: 1, backgroundColor: colors.bg },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  sheetEyebrow: {
    color: colors.calm,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  sheetTitle: { ...typography.title, color: colors.text, fontSize: 24 },
  sheetLead: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginTop: 4 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  content: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  section: { gap: spacing.sm },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  sectionHint: { color: colors.textDim, fontSize: 12, lineHeight: 17 },
  list: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  rowSelected: {
    borderColor: colors.calm,
    backgroundColor: colors.calmSoft,
  },
  art: {
    width: 52,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  artScene: { borderColor: colors.border },
  rowBody: { flex: 1, gap: 3 },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  rowTitle: { color: colors.text, fontSize: 16, fontWeight: '600', flexShrink: 1 },
  rowBlurb: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  rowMeta: { color: colors.textDim, fontSize: 11, fontWeight: '600', marginTop: 2 },
  previewBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  previewBtnActive: {
    backgroundColor: colors.calmSoft,
    borderColor: colors.calm,
  },
  pressed: { opacity: 0.8 },
  });
}
