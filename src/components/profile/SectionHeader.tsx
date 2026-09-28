import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useThemeColors } from '@/lib/theme-provider';
import { createProfileStyles } from './profile-styles';

type Props = {
  label: string;
  /** Optional trailing link ("See all", "Change intention"). */
  action?: { label: string; onPress: () => void; accessibilityLabel?: string };
  /** Plain trailing text when there's no link (e.g. "5 this month"). */
  meta?: string;
};

/** Small uppercase eyebrow above a Profile section, with an optional link on the right. */
export function SectionHeader({ label, action, meta }: Props) {
  const colors = useThemeColors();
  const s = useMemo(() => createProfileStyles(colors), [colors]);
  return (
    <View style={s.sectionHead}>
      <Text style={s.eyebrow} accessibilityRole="header">
        {label}
      </Text>
      {action ? (
        <Pressable
          onPress={action.onPress}
          hitSlop={10}
          accessibilityRole="link"
          accessibilityLabel={action.accessibilityLabel ?? action.label}
          style={({ pressed }) => pressed && s.pressed}
        >
          <Text style={s.link}>{action.label}</Text>
        </Pressable>
      ) : meta ? (
        <Text style={s.meta}>{meta}</Text>
      ) : null}
    </View>
  );
}
