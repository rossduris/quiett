import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton } from '@/components/PrimaryButton';
import { spacing, typography } from '@/constants/theme';
import { useThemeColors } from '@/lib/theme-provider';
import { loadWakeIntention, saveWakeIntention } from '@/lib/storage';
import type { ColorTokens } from '@/constants/themes';

export default function WakeIntentionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [text, setText] = useState('');
  const [originalText, setOriginalText] = useState('');

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const loaded = await loadWakeIntention();
        if (!alive) return;
        setText(loaded);
        setOriginalText(loaded);
      })();
      return () => {
        alive = false;
      };
    }, []),
  );

  const onSave = async () => {
    await saveWakeIntention(text);
    router.back();
  };

  const hasChanges = text !== originalText;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Ionicons name="close" size={28} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <Ionicons name="bulb-outline" size={48} color={colors.calm} />
          <Text style={styles.title}>Your wake-up intention</Text>
          <Text style={styles.lead}>
            Why are you waking up? What will you do first? A short text to ground your morning.
          </Text>
        </View>

        <View style={styles.inputCard}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="e.g., Morning light walk, breakfast with family…"
            placeholderTextColor={colors.textDim}
            multiline
            maxLength={120}
            autoFocus
            returnKeyType="done"
            blurOnSubmit
          />
          <Text style={styles.charCount}>{text.length} / 120</Text>
        </View>

        <View style={styles.examples}>
          <Text style={styles.examplesLabel}>Examples</Text>
          <Pressable
            onPress={() => setText('Morning sunlight walk, then journal')}
            style={({ pressed }) => [styles.exampleRow, pressed && styles.pressed]}
          >
            <Text style={styles.exampleText}>Morning sunlight walk, then journal</Text>
          </Pressable>
          <Pressable
            onPress={() => setText('Gratitude practice and coffee')}
            style={({ pressed }) => [styles.exampleRow, pressed && styles.pressed]}
          >
            <Text style={styles.exampleText}>Gratitude practice and coffee</Text>
          </Pressable>
          <Pressable
            onPress={() => setText('Start the day calm and centered')}
            style={({ pressed }) => [styles.exampleRow, pressed && styles.pressed]}
          >
            <Text style={styles.exampleText}>Start the day calm and centered</Text>
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerNote}>
            Your intention shows gently during meditation and on the Morning Unlocked screen.
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + spacing.md }]}>
        <PrimaryButton label="Save" onPress={() => void onSave()} disabled={!hasChanges} />
        {text.length > 0 && (
          <PrimaryButton
            label="Clear"
            variant="ghost"
            onPress={() => setText('')}
          />
        )}
      </View>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
    },
    scroll: { flex: 1 },
    content: {
      paddingHorizontal: spacing.lg,
      gap: spacing.xl,
    },
    hero: {
      alignItems: 'center',
      gap: spacing.md,
      paddingTop: spacing.md,
    },
    title: {
      ...typography.title,
      color: colors.text,
      fontSize: 26,
      textAlign: 'center',
    },
    lead: {
      ...typography.body,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 22,
      maxWidth: 320,
    },
    inputCard: {
      backgroundColor: colors.bgCard,
      borderRadius: 16,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
      gap: spacing.sm,
    },
    input: {
      color: colors.text,
      fontSize: 17,
      lineHeight: 24,
      minHeight: 100,
      textAlignVertical: 'top',
    },
    charCount: {
      color: colors.textDim,
      fontSize: 12,
      textAlign: 'right',
    },
    examples: {
      gap: spacing.sm,
    },
    examplesLabel: {
      color: colors.textDim,
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: spacing.xs,
    },
    exampleRow: {
      backgroundColor: colors.bgCard,
      borderRadius: 12,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    exampleText: {
      color: colors.textMuted,
      fontSize: 15,
      lineHeight: 21,
    },
    footer: {
      paddingTop: spacing.sm,
    },
    footerNote: {
      color: colors.textDim,
      fontSize: 13,
      lineHeight: 19,
      textAlign: 'center',
    },
    bottom: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.bg,
      gap: spacing.sm,
    },
    pressed: { opacity: 0.75 },
  });
}
