import { useId, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import type { ColorTokens } from '@/constants/themes';
import { initialsFor } from '@/lib/profile-identity';
import { useThemeColors } from '@/lib/theme-provider';

type Props = {
  name: string | null;
  photoUri: string | null;
  size?: number;
};

/**
 * Round profile avatar: the saved photo, else a soft dawn scene in theme colors with the
 * user's initials (or just the scene when no name is set). Decorative for screen readers —
 * the surrounding control carries the label.
 */
export function ProfileAvatar({ name, photoUri, size = 64 }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors, size), [colors, size]);
  const gradId = `avatar-sky-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const initials = initialsFor(name);

  return (
    <View style={styles.wrap} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {photoUri ? (
        <Image source={{ uri: photoUri }} style={styles.photo} contentFit="cover" transition={150} />
      ) : (
        <>
          <Svg width={size} height={size} viewBox="0 0 100 100">
            <Defs>
              <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.calmSoft} />
                <Stop offset="1" stopColor={colors.sunriseSoft} />
              </LinearGradient>
            </Defs>
            <Circle cx="50" cy="50" r="50" fill={`url(#${gradId})`} />
            <Circle cx="50" cy={initials ? 70 : 62} r="18" fill={colors.sunrise} opacity={0.55} />
            <Path d="M0 72 C 22 62, 40 66, 56 72 S 86 80, 100 70 L 100 100 L 0 100 Z" fill={colors.calm} opacity={0.22} />
            <Path d="M0 82 C 26 76, 52 84, 74 80 S 94 78, 100 80 L 100 100 L 0 100 Z" fill={colors.calm} opacity={0.3} />
          </Svg>
          {initials ? (
            <View style={styles.initialsWrap} pointerEvents="none">
              <Text style={styles.initials} numberOfLines={1} allowFontScaling={false}>
                {initials}
              </Text>
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

function createStyles(colors: ColorTokens, size: number) {
  return StyleSheet.create({
    wrap: {
      width: size,
      height: size,
      borderRadius: size / 2,
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.bgElevated,
    },
    photo: { width: size, height: size },
    initialsWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', paddingBottom: size * 0.08 },
    initials: { color: colors.text, fontSize: Math.round(size * 0.36), fontWeight: '700', letterSpacing: 0.5 },
  });
}
