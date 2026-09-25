import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { spacing } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';
import type { PoseStatus } from '@/lib/pose/types';
import { useThemeColors } from '@/lib/theme-provider';

type Props = {
  status: PoseStatus;
  confidence?: number;
  showConfidence?: boolean;
};

/**
 * Gentle, second-person guidance for each gate. No warnings, no red — the chip
 * just tells you the next small thing to do. `inFrame` lights the dot peach.
 */
export function poseGuidance(status: PoseStatus): { label: string; inFrame: boolean } {
  switch (status) {
    case 'holding':
      return { label: 'You\u2019re in frame', inFrame: true };
    case 'fidgeting':
      return { label: 'Settle in\u2026 stay still', inFrame: false };
    case 'hands_near':
      return { label: 'Let your hands rest', inFrame: false };
    case 'not_upright':
      return { label: 'Prop your phone up, facing you', inFrame: false };
    case 'too_dark':
      return { label: 'A little more light helps', inFrame: false };
    default:
      return { label: 'Bring your face into the circle', inFrame: false };
  }
}

/** Gates: prop phone → more light (softer) → face in circle → hands resting → stillness. */
export function PoseStatusChip({ status, confidence, showConfidence }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { label, inFrame } = poseGuidance(status);

  return (
    <View
      style={[styles.chip, inFrame && styles.chipInFrame]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={label}
      accessibilityLiveRegion="polite"
    >
      <View style={[styles.dot, inFrame && styles.dotInFrame]} />
      <Text style={styles.label}>{label}</Text>
      {showConfidence && confidence != null ? (
        <Text style={styles.conf}>{Math.round(confidence * 100)}%</Text>
      ) : null}
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    chip: {
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.sessionHairline,
      backgroundColor: colors.sessionChipBg,
    },
    chipInFrame: {
      backgroundColor: colors.sessionGlowSoft,
      borderColor: colors.sessionGlow,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.sessionTextMuted,
      opacity: 0.7,
    },
    dotInFrame: { backgroundColor: colors.sessionGlow, opacity: 1 },
    label: {
      fontSize: 14,
      fontWeight: '500',
      letterSpacing: 0.1,
      color: colors.sessionText,
    },
    conf: { color: colors.sessionTextMuted, fontSize: 12, marginLeft: 2 },
  });
}
