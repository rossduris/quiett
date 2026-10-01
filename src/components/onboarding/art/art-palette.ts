import type { ColorTokens } from '@/constants/themes';
import { mix } from '@/lib/scene-gen';

/**
 * Colours for the onboarding scenes, derived from the active theme so every illustration
 * recolours with peachCream / nightTeal. Pure (no React) so the box preview can reuse it.
 */
export type ArtPalette = {
  light: boolean;
  skyTop: string;
  skyBottom: string;
  sun: string;
  sunCore: string;
  glow: string;
  hillFar: string;
  hillMid: string;
  hillNear: string;
  figure: string;
  phone: string;
  phoneScreen: string;
  line: string;
  accent: string;
  accentSoft: string;
  card: string;
  ink: string;
  inkMuted: string;
};

export function artPalette(colors: ColorTokens): ArtPalette {
  const light = colors.statusBarStyle === 'dark';
  const { bg, calm, sunrise, text } = colors;
  return {
    light,
    skyTop: light ? mix(bg, sunrise, 0.06) : bg,
    skyBottom: light ? mix(bg, sunrise, 0.34) : mix(bg, sunrise, 0.22),
    sun: sunrise,
    sunCore: mix(sunrise, '#FFFFFF', light ? 0.45 : 0.3),
    glow: colors.sessionGlow,
    hillFar: mix(bg, calm, light ? 0.2 : 0.1),
    hillMid: mix(bg, calm, light ? 0.36 : 0.2),
    hillNear: mix(bg, calm, light ? 0.55 : 0.32),
    figure: light ? mix(text, calm, 0.25) : mix(bg, '#FFFFFF', 0.82),
    phone: light ? mix(bg, text, 0.82) : mix(bg, '#FFFFFF', 0.18),
    phoneScreen: light ? mix(bg, sunrise, 0.18) : mix(bg, calm, 0.18),
    line: light ? mix(bg, text, 0.18) : mix(bg, '#FFFFFF', 0.16),
    accent: calm,
    accentSoft: mix(bg, calm, light ? 0.18 : 0.2),
    card: colors.bgCard,
    ink: text,
    inkMuted: colors.textMuted,
  };
}
