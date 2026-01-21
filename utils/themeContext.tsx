import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Appearance, ColorSchemeName } from "react-native";
import Colors from "@/constants/Colors";

type ThemePreference = Exclude<ColorSchemeName, "no-preference"> | null;

type ThemeContextValue = {
  colorScheme: Exclude<ColorSchemeName, "no-preference">;
  preference: ThemePreference;
  setPreference: (pref: ThemePreference) => void;
  ready: boolean;
};

const STORAGE_KEY = "studyleague.theme";

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const normalizeScheme = (
  scheme: ColorSchemeName | null | undefined
): Exclude<ColorSchemeName, "no-preference"> =>
  scheme === "dark" ? "dark" : "light";

export const AppThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [preference, setPreferenceState] = useState<ThemePreference | undefined>(undefined);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored === "light" || stored === "dark") {
          setPreferenceState(stored);
        } else {
          setPreferenceState(null);
        }
      })
      .catch(() => setPreferenceState(null));
  }, []);

  const setPreference = (pref: ThemePreference) => {
    setPreferenceState(pref);

    if (pref) {
      AsyncStorage.setItem(STORAGE_KEY, pref).catch(() => {});
    } else {
      AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
    }
  };

  // Use preference if set, otherwise default to "light" (not system)
  // Default is "light" as per requirements
  const effectiveScheme: Exclude<ColorSchemeName, "no-preference"> = preference ?? "light";
  const ready = preference !== undefined;

  const value = useMemo(
    () => ({
      colorScheme: effectiveScheme,
      preference: preference ?? null,
      setPreference,
      ready,
    }),
    [effectiveScheme, preference, ready]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useThemePreference = () => {
  const ctx = useContext(ThemeContext);

  if (ctx) return ctx;

  const fallbackScheme = normalizeScheme(Appearance.getColorScheme());

  return {
    colorScheme: fallbackScheme,
    preference: null,
    setPreference: () => {},
    ready: true,
  } satisfies ThemeContextValue;
};

/**
 * Hook that returns the current theme object based on the user's color scheme preference.
 * This is the recommended way to access theme colors in components.
 * 
 * @example
 * const theme = useTheme();
 * <View style={{ backgroundColor: theme.background }} />
 */
export const useTheme = () => {
  const { colorScheme } = useThemePreference();
  return Colors[colorScheme ?? "light"];
};

export default ThemeContext;
