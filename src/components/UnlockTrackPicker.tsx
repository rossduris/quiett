import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography } from '@/constants/theme';
import {
  kindLabel,
  kindSectionHint,
  unlockTracksByKind,
  type UnlockTrack,
  type UnlockTrackKind,
} from '@/constants/unlock-tracks';

const KINDS: UnlockTrackKind[] = ['guided', 'music', 'ambient'];

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

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.sheet, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.sheetHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sheetTitle}>Morning sound</Text>
            <Text style={styles.sheetLead}>
              What plays once you stay still. Guided, healing tones, or ambient — pick freely.
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
          {KINDS.map((kind) => {
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
                    const disabled = track.locked;
                    return (
                      <Pressable
                        key={track.id}
                        disabled={disabled}
                        accessibilityRole="button"
                        accessibilityState={{ selected, disabled }}
                        onPress={() => {
                          if (!disabled) onSelect(track);
                        }}
                        style={({ pressed }) => [
                          styles.row,
                          selected && styles.rowSelected,
                          disabled && styles.rowLocked,
                          pressed && !disabled && styles.pressed,
                        ]}
                      >
                        <View
                          style={[
                            styles.art,
                            { backgroundColor: track.accentSoft, borderColor: track.accent },
                          ]}
                        >
                          <Ionicons
                            name={disabled ? 'lock-closed' : kindIcon(kind)}
                            size={16}
                            color={disabled ? colors.textDim : colors.text}
                          />
                        </View>
                        <View style={styles.rowBody}>
                          <View style={styles.rowTop}>
                            <Text style={styles.rowTitle} numberOfLines={1}>
                              {track.title}
                            </Text>
                            {disabled ? (
                              <View style={styles.lockBadge}>
                                <Text style={styles.lockBadgeText}>Premium</Text>
                              </View>
                            ) : selected ? (
                              <Ionicons name="checkmark-circle" size={18} color={colors.calm} />
                            ) : null}
                          </View>
                          <Text style={styles.rowBlurb} numberOfLines={2}>
                            {track.blurb}
                          </Text>
                          <Text style={styles.rowMeta}>
                            {track.durationLabel} · {track.mood}
                          </Text>
                        </View>
                      </Pressable>
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

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: colors.bg },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
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
    borderColor: 'rgba(61,207,176,0.55)',
    backgroundColor: 'rgba(61,207,176,0.08)',
  },
  rowLocked: { opacity: 0.55 },
  art: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  lockBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  lockBadgeText: { color: colors.textDim, fontSize: 10, fontWeight: '700' },
  pressed: { opacity: 0.8 },
});
