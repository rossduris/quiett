import { memo } from 'react';
import { StyleSheet, Text, View, type TextStyle } from 'react-native';

type Props = {
  prompt: string;
  note?: string;
  promptStyle: TextStyle;
  noteStyle: TextStyle;
};

/**
 * One title and one hint, in normal flow. Text is replaced in place.
 * A crossfade would keep the old line on screen under the new one.
 */
export const SessionPrompt = memo(function SessionPrompt({ prompt, note, promptStyle, noteStyle }: Props) {
  return (
    <View style={styles.box} accessible accessibilityLiveRegion="polite" accessibilityLabel={note ? `${prompt}. ${note}` : prompt}>
      <Text style={promptStyle} numberOfLines={3}>{prompt}</Text>
      <Text style={[noteStyle, styles.note]} numberOfLines={2}>{note ?? ' '}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  box: { alignSelf: 'stretch', alignItems: 'center' },
  note: { marginTop: 8, minHeight: 18 },
});
