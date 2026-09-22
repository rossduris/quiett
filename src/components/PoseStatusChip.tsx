import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '@/constants/theme';
import type { PoseStatus } from '@/lib/pose/types';

type Props = {
  status: PoseStatus;
  confidence?: number;
  showConfidence?: boolean;
};

function labelFor(status: PoseStatus): { label: string; tone: string } {
  switch (status) {
    case 'holding':
      return { label: 'looking · still', tone: colors.calm };
    case 'fidgeting':
      return { label: 'hold still', tone: colors.warning };
    case 'hands_near':
      return { label: 'hands away', tone: colors.warning };
    case 'not_upright':
      return { label: 'prop phone', tone: colors.warning };
    case 'too_dark':
      return { label: 'more light', tone: colors.warning };
    default:
      return { label: 'face camera', tone: colors.alarm };
  }
}

/** Gates: prop phone → more light → face camera → hands away → hold still. */
export function PoseStatusChip({ status, confidence, showConfidence }: Props) {
  const { label, tone } = labelFor(status);

  return (
    <View style={[styles.chip, { borderColor: tone }]}>
      <View style={[styles.dot, { backgroundColor: tone }]} />
      <Text style={[styles.label, { color: tone }]}>{label}</Text>
      {showConfidence && confidence != null ? (
        <Text style={styles.conf}>{Math.round(confidence * 100)}%</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: 'rgba(10,18,32,0.62)',
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  conf: { color: colors.textDim, fontSize: 11, marginLeft: 2 },
});
