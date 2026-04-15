import { Screen } from "@/components/layout/Screen";
import Colors from "@/constants/Colors";
import { useTheme } from "@/utils/themeContext";
import { Slot } from "expo-router";
import type { ImageStyle, TextStyle, ViewStyle } from "react-native";

export type AuthTheme = typeof Colors.light;

/** Shared chrome for screens in this group (logo row, eyebrow, titles, form spacing). */
export function authLogoRow(): ViewStyle {
  return {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    gap: 8,
    marginBottom: 4,
  };
}

export function authLogoImage(): ImageStyle {
  return { width: 120, height: 120 };
}

export function authEyebrow(theme: AuthTheme): TextStyle {
  return {
    alignSelf: "center",
    color: theme.primary,
    fontWeight: "600",
    letterSpacing: 1.8,
    textTransform: "uppercase",
    marginBottom: 2,
  };
}

export function authTitle(): TextStyle {
  return {
    fontWeight: "600",
    letterSpacing: -0.3,
    marginBottom: 4,
  };
}

export function authFormCard(): ViewStyle {
  return { gap: 12, marginTop: 4 };
}

/**
 * Auth layout: scroll, safe areas, padding, background.
 * Named style helpers above keep screen markup aligned without a separate utils file.
 *
 * Individual auth screens should NOT add their own ScrollView — scrolling is handled here.
 */
export default function AuthLayout() {
  const theme = useTheme();

  return (
    <Screen variant="auth" style={{ backgroundColor: theme.surface }}>
      <Slot />
    </Screen>
  );
}
