import { useMemo, useState } from 'react';
import { useAfterFirstPaint } from '@/lib/use-after-first-paint';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ProfileAvatar } from '@/components/ProfileAvatar';
import { ScreenHeader, useSafeBack } from '@/components/ScreenHeader';
import { radii, spacing, typography } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';
import {
  NAME_MAX,
  normalizeName,
  pickProfilePhoto,
  removeProfilePhoto,
  saveProfileName,
  saveProfilePhotoFrom,
  useProfileIdentity,
  validateName,
} from '@/lib/profile-identity';
import { useThemeColors } from '@/lib/theme-provider';
import Animated, { FadeIn, FadeOut, ZoomIn, interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { EnterStagger } from '@/components/EnterStagger';
import { hapticSoft, hapticSuccess, hapticWarning } from '@/lib/haptics';
import { DURATION, EASE, SPRING_BOUNCY } from '@/lib/motion';
import { usePressScale } from '@/lib/use-press-scale';
import { useReduceMotion } from '@/lib/use-reduce-motion';

/** Edit the local profile: photo (library) + display name. Stays on this device. */
export default function EditProfileScreen() {
  const goBack = useSafeBack('/profile');
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const identity = useProfileIdentity();

  // null until the user types: the field shows the stored name, then their draft.
  const [draft, setDraft] = useState<string | null>(null);
  const name = draft ?? (identity.loaded ? (identity.name ?? '') : '');
  const [busyPhoto, setBusyPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const reduce = useReduceMotion();
  // Only animate photo swaps made on this screen, not the initial load.
  const settled = useAfterFirstPaint(identity.loaded);
  const avatarPress = usePressScale(0.95);
  // Name field border warms to the accent while focused.
  const focus = useSharedValue(0);
  const borderIdle = colors.border;
  const borderFocus = colors.calm;
  const inputCardAnim = useAnimatedStyle(() => ({
    borderColor: interpolateColor(focus.value, [0, 1], [borderIdle, borderFocus]),
  }));
  const setFocused = (on: boolean) => {
    focus.set(withTiming(on ? 1 : 0, { duration: DURATION.base, easing: EASE }));
  };


  const error = validateName(name);
  const hasChanges = normalizeName(name) !== (identity.name ?? '');

  const onPickPhoto = async () => {
    if (busyPhoto) return;
    setBusyPhoto(true);
    try {
      const res = await pickProfilePhoto();
      if (res.status === 'unavailable') {
        Alert.alert('Photos aren’t available yet', 'Choosing a photo needs the latest version of Quiett on this iPhone.');
        return;
      }
      if (res.status === 'picked') {
        await saveProfilePhotoFrom(res.uri);
        hapticSoft();
      }
    } catch (e) {
      console.warn('[quiett profile] save photo', e);
      hapticWarning();
      Alert.alert('Couldn’t use that photo', 'Try another one.');
    } finally {
      setBusyPhoto(false);
    }
  };

  const onRemovePhoto = () => {
    void removeProfilePhoto();
  };

  const onSave = async () => {
    if (error || saving) return;
    setSaving(true);
    try {
      await saveProfileName(name);
      hapticSuccess();
      goBack();
    } finally {
      setSaving(false);
    }
  };

  const displayLen = normalizeName(name).length;

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Your profile" fallbackHref="/profile" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <EnterStagger index={0} style={styles.hero}>
          <Pressable
            onPress={() => void onPickPhoto()}
            onPressIn={avatarPress.handlers.onPressIn}
            onPressOut={avatarPress.handlers.onPressOut}
            accessibilityRole="button"
            accessibilityLabel={identity.photoUri ? 'Change profile photo' : 'Choose a profile photo'}
            style={styles.avatarBtn}
          >
            <Animated.View style={[styles.avatarBox, avatarPress.style]}>
              {/* New photo (or initials) cross-fades in over the old one. */}
              <Animated.View
                key={identity.photoUri ?? 'initials'}
                entering={
                  !settled || reduce
                    ? undefined
                    : ZoomIn.springify().damping(SPRING_BOUNCY.damping ?? 11).stiffness(SPRING_BOUNCY.stiffness ?? 220).withInitialValues({ transform: [{ scale: 0.86 }] })
                }
                exiting={reduce ? undefined : FadeOut.duration(DURATION.base)}
                style={styles.avatarLayer}
              >
                <ProfileAvatar name={normalizeName(name) || null} photoUri={identity.photoUri} size={104} />
              </Animated.View>
            </Animated.View>
            <View style={styles.cameraBadge}>
              {busyPhoto ? (
                <ActivityIndicator size="small" color={colors.onAccent} />
              ) : (
                <Ionicons name="image-outline" size={16} color={colors.onAccent} />
              )}
            </View>
          </Pressable>
          <View style={styles.photoActions}>
            <Pressable
              onPress={() => void onPickPhoto()}
              accessibilityRole="button"
              hitSlop={8}
              style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
            >
              <Text style={styles.chipText}>{identity.photoUri ? 'Change photo' : 'Choose photo'}</Text>
            </Pressable>
            {identity.photoUri ? (
              <Animated.View entering={FadeIn.duration(DURATION.base)} exiting={FadeOut.duration(DURATION.fast)}>
              <Pressable
                onPress={onRemovePhoto}
                accessibilityRole="button"
                hitSlop={8}
                style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
              >
                <Text style={styles.chipTextMuted}>Remove photo</Text>
              </Pressable>
              </Animated.View>
            ) : null}
          </View>
        </EnterStagger>

        <EnterStagger index={1}>
        <Animated.View style={[styles.inputCard, inputCardAnim]}>
          <Text style={styles.label} nativeID="profile-name-label">
            Your name
          </Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={(t) => {
              setDraft(t.replace(/\n/g, ''));
            }}
            placeholder="What should we call you?"
            placeholderTextColor={colors.textDim}
            keyboardAppearance={colors.statusBarStyle === 'light' ? 'dark' : 'light'}
            selectionColor={colors.calm}
            maxLength={NAME_MAX + 8}
            autoCapitalize="words"
            autoCorrect={false}
            textContentType="nickname"
            returnKeyType="done"
            onSubmitEditing={() => void onSave()}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            accessibilityLabel="Your name"
            accessibilityLabelledBy="profile-name-label"
          />
          <View style={styles.inputFoot}>
            <Text style={styles.error} accessibilityLiveRegion="polite">
              {error ?? ''}
            </Text>
            <Text style={[styles.charCount, displayLen > NAME_MAX && styles.charCountOver]}>
              {displayLen} / {NAME_MAX}
            </Text>
          </View>
        </Animated.View>
        </EnterStagger>

        <EnterStagger index={2}>
          <Text style={styles.footnote}>
            Your name and photo stay on this iPhone. Your name shows in your greeting on Home.
          </Text>
        </EnterStagger>
      </ScrollView>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + spacing.md }]}>
        <PrimaryButton label="Save" onPress={() => void onSave()} disabled={!hasChanges || !!error || saving} />
      </View>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    scroll: { flex: 1 },
    content: { paddingHorizontal: spacing.lg, gap: spacing.xl },
    hero: { alignItems: 'center', gap: spacing.md, paddingTop: spacing.md },
    avatarBtn: { borderRadius: radii.full },
    avatarBox: { width: 104, height: 104 },
    avatarLayer: { position: 'absolute', left: 0, top: 0 },
    cameraBadge: {
      position: 'absolute',
      right: 2,
      bottom: 2,
      width: 30,
      height: 30,
      borderRadius: radii.full,
      backgroundColor: colors.accentStrong,
      borderWidth: 2,
      borderColor: colors.bg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    photoActions: { flexDirection: 'row', gap: spacing.sm },
    chip: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radii.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bgCard,
    },
    chipText: { ...typography.caption, color: colors.text, fontWeight: '600' },
    chipTextMuted: { ...typography.caption, color: colors.textMuted, fontWeight: '600' },
    inputCard: {
      backgroundColor: colors.bgCard,
      borderRadius: radii.xl,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
      gap: spacing.sm,
    },
    label: { ...typography.caption, color: colors.textDim, fontWeight: '700', letterSpacing: 0.4 },
    input: { color: colors.text, fontSize: 18, lineHeight: 24, paddingVertical: spacing.xs },
    inputFoot: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    error: { ...typography.caption, color: colors.alarm, flex: 1 },
    charCount: { color: colors.textDim, fontSize: 12 },
    charCountOver: { color: colors.alarm, fontWeight: '600' },
    footnote: { ...typography.caption, color: colors.textDim, textAlign: 'center', lineHeight: 18 },
    bottom: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, backgroundColor: colors.bg },
    pressed: { opacity: 0.75 },
  });
}
