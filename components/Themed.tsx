/**
 * Learn more about Light and Dark modes:
 * https://docs.expo.io/guides/color-schemes/
 */

import { Text as DefaultText, View as DefaultView } from "react-native";

import Colors from "@/constants/Colors";
import typography from "@/constants/typography";
import { useThemePreference } from "@/utils/themeContext";

type ThemeProps = {
  lightColor?: string;
  darkColor?: string;
};

type Theme = typeof Colors.light;
export type ThemeColorName = {
  [K in keyof Theme]: Theme[K] extends string ? K : never;
}[keyof Theme];

export type TypographyVariant = keyof typeof typography;

export type TextAlign = "auto" | "left" | "right" | "center" | "justify";

export type TextProps = ThemeProps &
  DefaultText["props"] & {
    variant?: TypographyVariant;
    colorName?: ThemeColorName;
    align?: TextAlign;
  };

export type ViewProps = ThemeProps & DefaultView["props"];

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: ThemeColorName
): string {
  const { colorScheme } = useThemePreference();
  const themeKey = (colorScheme ?? "light") as keyof typeof Colors;
  return props[themeKey] ?? Colors[themeKey][colorName];
}

/**
 * Themed Text component that preserves accessibility features.
 * 
 * ⚠️ IMPORTANT: Always import from "@/components/Themed", NOT from "react-native"
 * to benefit from typography variants and theme colors.
 * 
 * 📋 QUICK START - 3 conventions to eliminate 90% of hardcoded fontSize:
 * 
 * 1. Screen titles:     <Text variant="h1">Title</Text>
 * 2. Standard text:     <Text>Body text</Text> (uses "body" by default)
 * 3. Secondary info:    <Text variant="micro" colorName="textMuted">Label</Text>
 * 
 * Supports typography variants for consistent, platform-native text styling:
 * - variant="display" | "h1" | "h2" | "subtitle" | "body" | "bodyStrong" | "micro" | "caption"
 * - Defaults to "body" variant if not specified
 * 
 * Supports theme color selection via colorName prop:
 * - colorName="text" | "textMuted" | "primary" | "secondary" | etc.
 * - Defaults to "text" if not specified
 * 
 * Supports text alignment via align prop:
 * - align="auto" | "left" | "right" | "center" | "justify"
 * - Avoids the need for inline textAlign styles
 * - Applied before custom styles, so style prop can override if needed
 * 
 * ⚠️ IMPORTANT: allowFontScaling is enabled by default (true) to support
 * user accessibility preferences. Do not disable it unless absolutely necessary.
 * 
 * @example
 * // Screen title
 * <Text variant="h1">Profil</Text>
 * 
 * // Centered title
 * <Text variant="h1" align="center">Dashboard</Text>
 * 
 * // Standard body text
 * <Text>This is regular body text</Text>
 * 
 * // Secondary/muted text
 * <Text variant="micro" colorName="textMuted">Last updated 2 hours ago</Text>
 */
export function Text(props: TextProps) {
  const {
    style,
    lightColor,
    darkColor,
    variant,
    colorName = "text",
    align,
    ...otherProps
  } = props;

  const resolvedVariant = variant ?? "body";

  const color = useThemeColor(
    { light: lightColor, dark: darkColor },
    colorName
  );

  return (
    <DefaultText
      style={[
        typography[resolvedVariant],
        { color },
        align ? { textAlign: align } : null,
        style,
      ]}
      {...otherProps}
    />
  );
}

export function View(props: ViewProps) {
  const { style, lightColor, darkColor, ...otherProps } = props;
  const backgroundColor = useThemeColor(
    { light: lightColor, dark: darkColor },
    "background"
  );

  return <DefaultView style={[{ backgroundColor }, style]} {...otherProps} />;
}
