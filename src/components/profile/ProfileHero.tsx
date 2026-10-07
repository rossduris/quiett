import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { IntentionCard } from '@/components/home/IntentionCard';
import { AnimatedScene } from '@/components/onboarding/art/AnimatedScene';
import { artPalette } from '@/components/onboarding/art/art-palette';
import { profileHeroLayout } from '@/components/onboarding/art/scene-layouts';
import { ProfileAvatar } from '@/components/ProfileAvatar';
import { radii, spacing, typography } from '@/constants/theme';
import type { ColorTokens } from '@/constants/themes';
import { useThemeColors } from '@/lib/theme-provider';
import { useReduceMotion } from '@/lib/use-reduce-motion';
import { useBump } from '@/lib/use-bump';
import { hapticSoft } from '@/lib/haptics';

type Props = {
  name: string | null;
  photoUri: string | null;
  streak: number;
  best: number;
  mornings: number;
  hasMornings: boolean;
  intention: string;
  onEditProfile: () => void;
  onOpenStreak: () => void;
  onEditIntention: () => void;
};

export const HERO_HEIGHT = 340;
const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;

/**
 * Profile hero: avatar + name over an animated dawn (onboarding scene system), the current
 * streak large, best streak and lifetime mornings small, and the wake-up intention. The only
 * Profile surface with a sheen. Reduce Motion: the scene rests and content appears without motion.
 */
export const ProfileHero = memo(function ProfileHero(props: Props) {
  const { name, photoUri, streak, best, mornings, hasMornings, intention, onEditProfile, onOpenStreak, onEditIntention } = props;
  // Streak ticked up since this screen last rendered (e.g. back from /success): pop + soft haptic.
  const streakBump = useBump(streak, 0.12, hapticSoft);
  const flameBump = useBump(streak, 0.25);
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const reduceMotion = useReduceMotion();
  const { width: screenW } = useWindowDimensions();
  const w = Math.round(screenW - spacing.lg * 2);
  const h = HERO_HEIGHT;
  const palette = useMemo(() => artPalette(colors), [colors]);
  const layout = useMemo(() => profileHeroLayout(w, h, palette), [w, h, palette]);
  const enter = (delay: number) => (reduceMotion ? FadeIn.duration(1) : FadeInDown.delay(delay).duration(520));

  return (
    <View style={[styles.wrap, { width: w, height: h }]}>
      <AnimatedScene layout={layout} reduceMotion={reduceMotion} radius={radii.xl} style={StyleSheet.absoluteFill} />
      {/* Sheen: a soft diagonal highlight across the top-left. */}
      <Svg width={w} height={h} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <LinearGradient id="profile-hero-sheen" x1="0" y1="0" x2="0.9" y2="0.7">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={palette.light ? 0.45 : 0.14} />
            <Stop offset="0.45" stopColor="#FFFFFF" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width={w} height={h} rx={radii.xl} fill="url(#profile-hero-sheen)" />
      </Svg>

      <View style={styles.content}>
        <Animated.View entering={enter(60)}>
          <Pressable
            onPress={onEditProfile}
            accessibilityRole="button"
            accessibilityLabel={name ? `${name}. Edit name and photo` : 'Add your name and photo'}
            style={({ pressed }) => [styles.identity, pressed && styles.pressed]}
          >
            <ProfileAvatar name={name} photoUri={photoUri} size={52} />
            <View style={styles.identityText}>
              <Text style={name ? styles.name : styles.namePlaceholder} numberOfLines={1}>
                {name ?? 'Add your name'}
              </Text>
              <Text style={styles.edit} numberOfLines={1}>
                {name ? 'Edit profile' : 'And a photo, if you like'}
              </Text>
            </View>
          </Pressable>
        </Animated.View>

        <Animated.View entering={enter(160)} style={styles.streakBlock}>
          <Pressable
            onPress={onOpenStreak}
            accessibilityRole="button"
            accessibilityLabel={`Current streak, ${days(streak)}`}
            accessibilityHint="Opens streak details"
            style={({ pressed }) => [styles.streakPress, pressed && styles.pressed]}
          >
            <View style={styles.streakRow}>
              <Animated.View style={[styles.streakNumWrap, streakBump]}>
                <Text style={styles.streakNum} allowFontScaling={false}>
                  {streak}
                </Text>
              </Animated.View>
              <Animated.View style={[styles.streakUnit, flameBump]}>
                <Ionicons name={streak > 0 ? 'flame' : 'flame-outline'} size={20} color={streak > 0 ? colors.calm : colors.textDim} />
                <Text style={styles.streakLabel}>day streak</Text>
              </Animated.View>
            </View>
          </Pressable>
          {hasMornings ? (
            <View style={styles.stats} accessible accessibilityLabel={`Best streak ${days(best)}. ${mornings} mornings unlocked`}>
              <Text style={styles.stat}>
                <Text style={styles.statNum}>{best}</Text> best
              </Text>
              <View style={styles.statDot} />
              <Text style={styles.stat}>
                <Text style={styles.statNum}>{mornings}</Text> {mornings === 1 ? 'morning' : 'mornings'}
              </Text>
            </View>
          ) : (
            <Text style={styles.stat}>Your first morning starts the streak.</Text>
          )}
        </Animated.View>

        <Animated.View entering={enter(260)}>
          <IntentionCard intention={intention} onPress={onEditIntention} compact />
        </Animated.View>
      </View>
    </View>
  );
});

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    wrap: {
      alignSelf: 'center',
      borderRadius: radii.xl,
      overflow: 'hidden',
      backgroundColor: colors.bgCard,
      shadowColor: '#000',
      shadowOpacity: colors.statusBarStyle === 'dark' ? 0.08 : 0.3,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 3,
    },
    content: { flex: 1, padding: spacing.lg, justifyContent: 'space-between' },
    identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, alignSelf: 'flex-start', maxWidth: '85%' },
    identityText: { flexShrink: 1, gap: 1 },
    name: { ...typography.subtitle, color: colors.text, fontWeight: '700' },
    namePlaceholder: { ...typography.subtitle, color: colors.textMuted, fontWeight: '600' },
    edit: { ...typography.caption, color: colors.textMuted },
    streakBlock: { gap: spacing.xs },
    streakPress: { alignSelf: 'flex-start' },
    streakNumWrap: { transformOrigin: 'left bottom' },
    streakRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
    streakNum: { ...typography.display, color: colors.text, lineHeight: 76, fontVariant: ['tabular-nums'] },
    streakUnit: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingBottom: 14 },
    streakLabel: { ...typography.body, color: colors.textMuted, fontWeight: '500' },
    stats: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    stat: { ...typography.caption, color: colors.textMuted },
    statNum: { color: colors.text, fontWeight: '700' },
    statDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: colors.textDim },
    pressed: { opacity: 0.75 },
  });
}
