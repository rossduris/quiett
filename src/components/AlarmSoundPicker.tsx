import { useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { radii, spacing, typography } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';
import { useThemeColors } from '@/lib/theme-provider';
import {
  ALARM_SOUND_SECTIONS,
  alarmSoundsBySection,
  type SoundOption,
} from '@/constants/sounds';
import { previewIds, startPreview, usePreviewPlayer, useStopPreviewWhenHidden } from '@/lib/audio';

type Props = {
  visible: boolean;
  selectedId: string;
  onClose: () => void;
  onSelect: (id: string) => void | Promise<void>;
};

export function AlarmSoundPicker({ visible, selectedId, onClose, onSelect }: Props) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { playingId, toggle } = usePreviewPlayer();
  useStopPreviewWhenHidden(visible);

  /** Row tap selects and plays it (keeps playing if it already is). */
  const pick = async (opt: SoundOption) => {
    await onSelect(opt.id);
    const id = previewIds.alarm(opt.id);
    if (opt.url != null && playingId !== id) void startPreview(id, opt.url, 'alarm');
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.sheet, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.sheetHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sheetEyebrow}>Step 1</Text>
            <Text style={styles.sheetTitle}>Wake-up alarm</Text>
            <Text style={styles.sheetLead}>
              Rings until you're still, and on the lock screen. Tap to hear it. Intense cuts
              through; laid-back is softer. System uses the iOS default.
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
          {ALARM_SOUND_SECTIONS.map((section) => {
            const opts = alarmSoundsBySection(section.id);
            if (opts.length === 0) return null;
            return (
              <View key={section.id} style={styles.section}>
                <Text style={styles.sectionTitle}>{section.label}</Text>
                <Text style={styles.sectionHint}>{section.hint}</Text>
                <View style={styles.list}>
                  {opts.map((opt) => {
                    const selected = opt.id === selectedId;
                    const playing = playingId === previewIds.alarm(opt.id);
                    return (
                      <Pressable
                        key={opt.id}
                        accessibilityRole="button"
                        accessibilityLabel={`Wake-up alarm: ${opt.label}`}
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
                            name={
                              selected
                                ? 'volume-high'
                                : opt.section === 'system'
                                  ? 'phone-portrait-outline'
                                  : 'volume-medium-outline'
                            }
                            size={18}
                            color={selected ? colors.calm : colors.textMuted}
                          />
                          <Text style={[styles.rowTitle, selected && styles.rowTitleSelected]}>
                            {opt.label}
                          </Text>
                        </View>
                        <View style={styles.rowRight}>
                          {selected ? (
                            <Ionicons name="checkmark-circle" size={18} color={colors.calm} />
                          ) : null}
                          {opt.url != null ? (
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={playing ? 'Stop preview' : `Preview ${opt.label}`}
                              accessibilityState={{ selected: playing }}
                              hitSlop={8}
                              onPress={() => toggle(previewIds.alarm(opt.id), opt.url!, 'alarm')}
                              style={({ pressed }) => [
                                styles.previewBtn,
                                playing && styles.previewBtnActive,
                                pressed && styles.pressed,
                              ]}
                            >
                              <Ionicons
                                name={playing ? 'stop' : 'play'}
                                size={14}
                                color={playing ? colors.calm : colors.text}
                              />
                            </Pressable>
                          ) : null}
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
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  sectionHint: { color: colors.textDim, fontSize: 12, lineHeight: 17, marginBottom: 2 },
  list: { gap: spacing.sm },
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
    borderColor: colors.calm,
    backgroundColor: colors.calmSoft,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  rowTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
  rowTitleSelected: { color: colors.calm },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
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
