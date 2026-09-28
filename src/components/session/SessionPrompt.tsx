import { memo } from 'react';
import { StyleSheet, Text, View, type TextStyle } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

type Props = {
  prompt: string;
  note?: string;
  promptStyle: TextStyle;
  noteStyle: TextStyle;
  height: number;
};

/** One prompt at a time: each new line slowly fades in as the last fades out (fades only, so it suits Reduce Motion too). */
export const SessionPrompt = memo(function SessionPrompt({ prompt, note, promptStyle, noteStyle, height }: Props) {
  return (
    <View style={[styles.box, { height }]} accessible accessibilityLiveRegion="polite" accessibilityLabel={note ? `${prompt}. ${note}` : prompt}>
      <Animated.View key={prompt} entering={FadeIn.duration(900)} exiting={FadeOut.duration(450)} style={styles.layer}>
        <Text style={promptStyle}>{prompt}</Text>
      </Animated.View>
      {note ? (
        <Animated.View key={`n:${note}`} entering={FadeIn.delay(300).duration(900)} exiting={FadeOut.duration(450)} style={[styles.layer, styles.noteLayer]}>
          <Text style={noteStyle}>{note}</Text>
        </Animated.View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  box: { alignSelf: 'stretch' },
  layer: { position: 'absolute', left: 0, right: 0, top: 0, alignItems: 'center' },
  noteLayer: { top: 40 },
});
