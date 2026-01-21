/**
 * Native typography scales for iOS and Android.
 * 
 * IMPORTANT: When using these styles with <Text /> components,
 * ensure allowFontScaling remains enabled (default: true) to support
 * user accessibility preferences for text size.
 */
import { Platform } from "react-native";

const ios = {
  display: { fontSize: 34, lineHeight: 42, fontWeight: "700" as const },
  h1: { fontSize: 28, lineHeight: 36, fontWeight: "700" as const },
  h2: { fontSize: 22, lineHeight: 28, fontWeight: "700" as const },
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
  h2: { fontSize: 20, lineHeight: 26, fontWeight: "700" as const },
  subtitle: { fontSize: 14, lineHeight: 20, fontWeight: "400" as const },
  body: { fontSize: 16, lineHeight: 22, fontWeight: "400" as const },
  bodyStrong: { fontSize: 16, lineHeight: 22, fontWeight: "600" as const },
  micro: { fontSize: 12, lineHeight: 16, fontWeight: "400" as const },
  caption: { fontSize: 11, lineHeight: 14, fontWeight: "400" as const },
};

const typography: TypographyScale =
  Platform.select({ ios, android, default: ios }) ?? ios;

export default typography;
