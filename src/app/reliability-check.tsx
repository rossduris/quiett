import { useCallback, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton } from '@/components/PrimaryButton';
import { spacing, typography } from '@/constants/theme';
import { useThemeColors } from '@/lib/theme-provider';
import { loadReliabilityCheckCompleted, saveReliabilityCheckCompleted } from '@/lib/storage';
import type { ColorTokens } from '@/constants/themes';
import { useFocusEffect } from 'expo-router';

type CheckItem = {
  id: string;
  title: string;
  body: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const CHECK_ITEMS: CheckItem[] = [
  {
    id: 'volume',
    title: 'Max ringer volume',
    body: 'Go to Settings > Sounds & Haptics and drag Ringer and Alerts all the way to the right.',
    icon: 'volume-high',
  },
  {
    id: 'buttons',
    title: 'Turn off Change with Buttons',
    body: 'On the same screen (Sounds & Haptics), turn off Change with Buttons so the side buttons can\'t lower your alarm.',
    icon: 'lock-closed',
  },
  {
    id: 'attention',
    title: 'Turn off Attention Aware Features',
    body: 'Go to Settings > Face ID & Passcode > Attention Aware Features. Turn it off so iOS won\'t lower the alarm when you look at the camera during meditation.',
    icon: 'eye-off',
  },
];

export default function ReliabilityCheckScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [completed, setCompleted] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const done = await loadReliabilityCheckCompleted();
        if (!alive) return;
        setCompleted(done);
        if (done) {
          setCheckedItems(new Set(CHECK_ITEMS.map((i) => i.id)));
        }
      })();
      return () => {
        alive = false;
      };
    }, []),
  );

  const toggleItem = (id: string) => {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const allChecked = CHECK_ITEMS.every((item) => checkedItems.has(item.id));

  const onFinish = async () => {
    if (allChecked) {
      await saveReliabilityCheckCompleted(true);
      router.back();
    }
  };

  const onOpenSettings = () => {
    void Linking.openSettings();
  };

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
      >
        <View style={styles.hero}>
          <Ionicons name="alarm-outline" size={48} color={colors.calm} />
          <Text style={styles.title}>Make sure your alarm can wake you</Text>
          <Text style={styles.lead}>
            Quiett can't detect these iPhone settings, but they matter for a reliable morning
            alarm. Check each one:
          </Text>
        </View>

        <View style={styles.checklist}>
          {CHECK_ITEMS.map((item, index) => {
            const checked = checkedItems.has(item.id);
            return (
              <Pressable
                key={item.id}
                onPress={() => toggleItem(item.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked }}
                style={({ pressed }) => [
                  styles.checkItem,
                  checked && styles.checkItemChecked,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.checkTop}>
                  <View style={styles.checkNumber}>
                    <Text style={styles.checkNumberText}>{index + 1}</Text>
                  </View>
                  <View style={styles.checkBody}>
                    <View style={styles.checkTitleRow}>
                      <Ionicons name={item.icon} size={20} color={colors.text} />
                      <Text style={styles.checkTitle}>{item.title}</Text>
                    </View>
                    <Text style={styles.checkText}>{item.body}</Text>
                  </View>
                  <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                    {checked ? <Ionicons name="checkmark" size={18} color={colors.bg} /> : null}
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.actions}>
          <PrimaryButton
            label="Open Settings"
            variant="secondary"
            onPress={onOpenSettings}
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerNote}>
            Mark each item as done once you've checked it. The card on Home will disappear when
            all three are complete.
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + spacing.md }]}>
        <PrimaryButton
          label={allChecked ? 'Done' : `Done (${checkedItems.size}/3)`}
          onPress={() => void onFinish()}
          disabled={!allChecked}
        />
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
    checklist: { gap: spacing.md },
    checkItem: {
      backgroundColor: colors.bgCard,
      borderRadius: 16,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    checkItemChecked: {
      backgroundColor: colors.calmSoft,
      borderColor: colors.calm,
    },
    checkTop: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
    },
    checkNumber: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.bgElevated,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkNumberText: {
      color: colors.textMuted,
      fontSize: 16,
      fontWeight: '700',
    },
    checkBody: { flex: 1, gap: spacing.sm },
    checkTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    checkTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: '600',
    },
    checkText: {
      color: colors.textMuted,
      fontSize: 15,
      lineHeight: 21,
    },
    checkbox: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxChecked: {
      backgroundColor: colors.calm,
      borderColor: colors.calm,
    },
    actions: { gap: spacing.md },
    footer: { paddingTop: spacing.sm },
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
    },
    pressed: { opacity: 0.75 },
  });
}
