import { useThemePreference } from "@/utils/themeContext";

// Returns the effective app-wide color scheme (light or dark), falling back to light.
export const useColorScheme = () => {
  const { colorScheme } = useThemePreference();
  return colorScheme;
};
