import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography } from '@/constants/theme';
import { ALARM_SOUNDS, type SoundOption } from '@/constants/sounds';
import { previewSoundUrl } from '@/lib/audio';

type Props = {
  visible: boolean;
  selectedId: string;
  onClose: () => void;
  onSelect: (id: string) => void | Promise<void>;
};

export function AlarmSoundPicker({ visible, selectedId, onClose, onSelect }: Props) {
  const insets = useSafeAreaInsets();
  const [previewing, setPreviewing] = useState(false);

  const pick = async (opt: SoundOption) => {
    await onSelect(opt.id);
    if (!previewing) {
      setPreviewing(true);
      try {
        await previewSoundUrl(opt.url);
      } finally {
        setPreviewing(false);
      }
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.sheet, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.sheetHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sheetTitle}>Alarm sound</Text>
            <Text style={styles.sheetLead}>
              Harsh wake tone while the morning gate is not held.
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
          {ALARM_SOUNDS.map((opt) => {
            const selected = opt.id === selectedId;
            return (
              <Pressable
                key={opt.id}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => void pick(opt)}
                style={({ pressed }) => [
                  styles.row,
                  selected && styles.rowSelected,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.rowLeft}>
                  <Ionicons
                    name={selected ? 'volume-high' : 'volume-medium-outline'}
                    size={18}
                    color={selected ? colors.calm : colors.textMuted}
                  />
                  <Text style={[styles.rowTitle, selected && styles.rowTitleSelected]}>
                    {opt.label}
                  </Text>
                </View>
                {selected ? (
                  <Ionicons name="checkmark-circle" size={18} color={colors.calm} />
                ) : null}
              </Pressable>
            );
          })}
          {previewing ? <Text style={styles.previewHint}>Previewing…</Text> : null}
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
  content: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowSelected: {
    borderColor: 'rgba(61,207,176,0.55)',
    backgroundColor: 'rgba(61,207,176,0.08)',
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  rowTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
  rowTitleSelected: { color: colors.calm },
  previewHint: {
    color: colors.textDim,
    fontSize: 12,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  pressed: { opacity: 0.8 },
});
