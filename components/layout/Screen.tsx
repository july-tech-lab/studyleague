import {
  ScrollView,
  ScrollViewProps,
  View,
  ViewProps,
  ViewStyle,
  StyleProp,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/utils/themeContext";

type BaseProps = {
  padding?: number;
  paddingHorizontal?: number;
  paddingVertical?: number;
  paddingTop?: number;
  paddingBottom?: number;
  gap?: number;
  safeTop?: boolean;
  safeBottom?: boolean;
};

type ScreenVariant = "default" | "auth" | "tabs";

const PRESETS: Record<ScreenVariant, Partial<BaseProps>> = {
  default: {},
  auth: {
    safeTop: true,
    safeBottom: true,
    paddingHorizontal: 26,
    paddingTop: 60,
    paddingBottom: 20,
    gap: 12,
  },
  tabs: {
    safeTop: false, // Header handles top safe area
    safeBottom: true, // Need bottom safe area for tab bar
    padding: 20,
    gap: 12,
  },
};

type ScrollModeProps = Omit<ScrollViewProps, "contentContainerStyle"> &
  BaseProps & {
    variant?: ScreenVariant;
    scroll?: true;
    contentContainerStyle?: StyleProp<ViewStyle>;
  };

type ViewModeProps = ViewProps &
  BaseProps & {
    variant?: ScreenVariant;
    scroll: false;
  };

type ScreenProps = ScrollModeProps | ViewModeProps;

/**
 * Base layout component with consistent padding, safe area handling, and theme background.
 * 
 * This is a layout-only component - it handles spacing and safe areas, but not UI elements like headers.
 * For tab screens with headers, use TabScreen instead.
 * 
 * Features:
 * - Consistent padding (default: 20px)
 * - Safe area inset handling for notches/home bars (configurable per edge)
 * - Theme-aware background color
 * - Gap spacing between direct children (default: 12px)
 * - Optional scrolling (default: true) - set scroll={false} when using FlatList or other scrollable children
 * - Keyboard-friendly defaults for forms
 * - Variants: "auth" | "tabs" | "default"
 * 
 * @example
 * // Auth screen (via layout)
 * <Screen variant="auth">
 *   <Text>Content</Text>
 * </Screen>
 * 
 * @example
 * // Tab screen content (use TabScreen wrapper instead)
 * <Screen variant="tabs">
 *   <Text>Content</Text>
 * </Screen>
 * 
 * @example
 * // Custom padding and gap
 * <Screen paddingHorizontal={20} paddingVertical={16} gap={12}>
 *   <View>Item 1</View>
 *   <View>Item 2</View>
 * </Screen>
 * 
 * @example
 * // Non-scrolling container (for FlatList, etc.)
 * <Screen scroll={false}>
 *   <FlatList data={items} renderItem={...} />
 * </Screen>
 */
export function Screen(props: ScreenProps) {
  const {
    children,
    variant = "default",
    padding,
    paddingHorizontal,
    paddingVertical,
    paddingTop,
    paddingBottom,
    gap,
    safeTop,
    safeBottom,
    scroll = true,
    style,
    ...rest
  } = props;

  const insets = useSafeAreaInsets();
  const theme = useTheme();

  // Apply preset, then allow explicit props to override (only if defined)
  const preset = PRESETS[variant];
  const merged: BaseProps = {
    ...preset,
    // Only override preset values if explicitly provided
    ...(padding !== undefined && { padding }),
    ...(paddingHorizontal !== undefined && { paddingHorizontal }),
    ...(paddingVertical !== undefined && { paddingVertical }),
    ...(paddingTop !== undefined && { paddingTop }),
    ...(paddingBottom !== undefined && { paddingBottom }),
    ...(gap !== undefined && { gap }),
    ...(safeTop !== undefined && { safeTop }),
    ...(safeBottom !== undefined && { safeBottom }),
  };

  // Use explicit values if provided, otherwise fall back to preset or defaults
  const ph = merged.paddingHorizontal ?? merged.padding ?? 20;
  const pv = merged.paddingVertical ?? merged.padding ?? 20;
  
  // Use explicit paddingTop/paddingBottom if provided, otherwise use paddingVertical
  const baseTopPadding = merged.paddingTop ?? pv;
  const baseBottomPadding = merged.paddingBottom ?? pv;

  const finalSafeTop = merged.safeTop ?? false;
  const finalSafeBottom = merged.safeBottom ?? true;
  const finalGap = merged.gap ?? 12;

  const topPadding = baseTopPadding + (finalSafeTop ? insets.top : 0);
  const bottomPadding = baseBottomPadding + (finalSafeBottom ? Math.max(insets.bottom, 12) : 0);

  const baseContentStyle: ViewStyle = {
    paddingHorizontal: ph,
    paddingTop: topPadding,
    paddingBottom: bottomPadding,
    gap: finalGap,
  };

  if (!scroll) {
    // Render as View when scroll={false} (for FlatList, etc.)
    // Note: contentContainerStyle is not available in View mode
    return (
      <View
        style={[
          { flex: 1, backgroundColor: theme.background },
          baseContentStyle,
          style,
        ]}
        {...(rest as ViewProps)}
      >
        {children}
      </View>
    );
  }

  // Render as ScrollView with keyboard-friendly defaults
  const { contentContainerStyle, ...scrollProps } = rest as ScrollModeProps;

  return (
    <ScrollView
      style={[{ backgroundColor: theme.background }, style]}
      contentContainerStyle={[
        { ...baseContentStyle, flexGrow: 1 },
        contentContainerStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      {...scrollProps}
    >
      {children}
    </ScrollView>
  );
}
