/**
 * Native typography scales for iOS and Android.
 *
 * IMPORTANT: When using these styles with <Text /> components,
 * ensure allowFontScaling remains enabled (default: true) to support
 * user accessibility preferences for text size.
 *
 * Use `interFontForWeight` (or themed Text) so each weight maps to a real
 * Inter face from @expo-google-fonts/inter instead of faux-bold.
 */
import { Platform, TextStyle } from "react-native";

/** PostScript names from @expo-google-fonts/inter (see app/_layout.tsx useFonts). */
export const INTER = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semiBold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  extraBold: "Inter_800ExtraBold",
} as const;

export function interFontForWeight(
  fontWeight: TextStyle["fontWeight"] | undefined
): string {
  if (fontWeight == null) return INTER.regular;

  if (typeof fontWeight === "string") {
    const norm = fontWeight.toLowerCase().trim();
    if (norm === "normal") return INTER.regular;
    if (norm === "bold") return INTER.bold;
    const n = parseInt(fontWeight, 10);
    if (!Number.isNaN(n)) return interFontForNumericWeight(n);
  }

  if (typeof fontWeight === "number") {
    return interFontForNumericWeight(fontWeight);
  }

  return INTER.regular;
}

function interFontForNumericWeight(n: number): string {
  if (n < 500) return INTER.regular;
  if (n < 600) return INTER.medium;
  if (n < 700) return INTER.semiBold;
  if (n < 800) return INTER.bold;
  return INTER.extraBold;
}

const ios = {
  display: { fontSize: 34, lineHeight: 42, fontWeight: "700" as const },
  h1: { fontSize: 28, lineHeight: 36, fontWeight: "700" as const },
  h2: { fontSize: 20, lineHeight: 26, fontWeight: "700" as const },
  subtitle: { fontSize: 15, lineHeight: 20, fontWeight: "400" as const },
  body: { fontSize: 17, lineHeight: 22, fontWeight: "400" as const },
  bodyStrong: { fontSize: 17, lineHeight: 22, fontWeight: "600" as const },
  micro: { fontSize: 13, lineHeight: 18, fontWeight: "400" as const },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: "400" as const },
};

type TypographyScale = typeof ios;

const android: TypographyScale = {
  display: { fontSize: 32, lineHeight: 40, fontWeight: "700" as const },
  h1: { fontSize: 24, lineHeight: 32, fontWeight: "700" as const },
  h2: { fontSize: 18, lineHeight: 24, fontWeight: "700" as const },
  subtitle: { fontSize: 14, lineHeight: 20, fontWeight: "400" as const },
  body: { fontSize: 16, lineHeight: 22, fontWeight: "400" as const },
  bodyStrong: { fontSize: 16, lineHeight: 22, fontWeight: "600" as const },
  micro: { fontSize: 12, lineHeight: 16, fontWeight: "400" as const },
  caption: { fontSize: 11, lineHeight: 14, fontWeight: "400" as const },
};

const typography: TypographyScale =
  Platform.select({ ios, android, default: ios }) ?? ios;

export default typography;
