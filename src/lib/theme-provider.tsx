import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { Appearance } from 'react-native';
import {
  DEFAULT_THEME_ID,
  getTheme,
  type ColorTokens,
  type Theme,
  type ThemeId,
} from '@/constants/themes';
import { loadThemeId, saveThemeId } from '@/lib/storage';

type ThemeContextValue = {
  theme: Theme;
  colors: ColorTokens;
  themeId: ThemeId;
  setTheme: (id: ThemeId) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Quiett theme provider.
 *
 * Loads the user's saved theme preference (or default) and provides it to all children.
 * Theme changes are persisted to AsyncStorage and update immediately.
 */
export function ThemeProvider({ children }: PropsWithChildren) {
  const [themeId, setThemeIdState] = useState<ThemeId>(DEFAULT_THEME_ID);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const savedId = await loadThemeId();
      if (!alive) return;
      setThemeIdState(savedId);
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const setTheme = async (id: ThemeId) => {
    setThemeIdState(id);
    await saveThemeId(id);
  };

  const theme = getTheme(themeId);

  // Native chrome (alerts, keyboard, action sheets, pickers) follows the in-app theme,
  // not the system setting: light peach -> 'light', night teal -> 'dark'.
  const nativeScheme = theme.colors.statusBarStyle === 'dark' ? 'light' : 'dark';
  useEffect(() => {
    Appearance.setColorScheme(nativeScheme);
  }, [nativeScheme]);

  const value: ThemeContextValue = {
    theme,
    colors: theme.colors,
    themeId,
    setTheme,
  };

  // Don't render children until theme is loaded to avoid flash
  if (!ready) return null;

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * Hook to access the current theme.
 *
 * Usage:
 * ```tsx
 * const { colors, theme, setTheme } = useTheme();
 * <View style={{ backgroundColor: colors.bg }}>
 *   <Text style={{ color: colors.text }}>Hello</Text>
 * </View>
 * ```
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}

/**
 * Hook that returns just the colors for convenience.
 *
 * Usage:
 * ```tsx
 * const colors = useThemeColors();
 * ```
 */
export function useThemeColors(): ColorTokens {
  return useTheme().colors;
}
