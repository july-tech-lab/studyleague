import { LucideIcon } from "lucide-react-native";
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";

import { useTheme } from "@/utils/themeContext";
import Colors from "@/constants/Colors";

type ButtonVariant = "primary" | "secondary" | "destructive" | "outline" | "ghost";
type ButtonSize = "xs" | "sm" | "md" | "lg";
type ButtonShape = "default" | "pill";

type ButtonProps = {
  title?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  shape?: ButtonShape;
  fullWidth?: boolean;
  iconLeft?: LucideIcon;
  iconRight?: LucideIcon;
  loading?: boolean;
  iconOnly?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
} & Omit<PressableProps, "style" | "accessibilityLabel">;

const SIZE: Record<ButtonSize, { pv: number; ph: number; r: number; fs: number; is: number }> = {
  xs: { pv: 8, ph: 12, r: 12, fs: 13, is: 16 },
  sm: { pv: 10, ph: 14, r: 12, fs: 14, is: 16 },
  md: { pv: 12, ph: 18, r: 12, fs: 15, is: 18 },
  lg: { pv: 14, ph: 22, r: 14, fs: 16, is: 20 },
};

const ICON_ONLY_DIM: Record<ButtonSize, number> = { xs: 44, sm: 40, md: 48, lg: 52 };

type ColorSet = (typeof Colors)["light"];

function getPalette(colorSet: ColorSet, variant: ButtonVariant) {
  const base = {
    bg: "transparent",
    pressedBg: colorSet.secondaryTint,
    text: colorSet.primaryDark,
    border: "transparent",
    borderWidth: 0,
  };

  switch (variant) {
    case "primary":
      return { bg: colorSet.primaryDark, pressedBg: colorSet.primary, text: colorSet.onPrimaryDark, border: "transparent", borderWidth: 0 };
    case "secondary":
      return { bg: colorSet.surfaceElevated, pressedBg: colorSet.secondaryTint, text: colorSet.text, border: colorSet.divider, borderWidth: 1 };
    case "destructive":
      return { bg: colorSet.danger, pressedBg: colorSet.dangerDark, text: "#FFFFFF", border: "transparent", borderWidth: 0 };
    case "outline":
      return { ...base, border: colorSet.primaryDark, borderWidth: 1 };
    case "ghost":
    default:
      return base;
  }
}

export function Button({
  title,
  variant = "primary",
  size = "md",
  shape = "default",
  fullWidth,
  iconLeft: IconLeft,
  iconRight: IconRight,
  loading,
  disabled,
  iconOnly,
  accessibilityLabel,
  style,
  textStyle,
  ...rest
}: ButtonProps) {
  const colorSet = useTheme();

  if (__DEV__ && !iconOnly && !title) {
    console.warn("Button: title is required unless iconOnly is true");
  }

  const s = SIZE[size];
  const p = getPalette(colorSet, variant);
  const isDisabled = !!disabled || !!loading;

  const radius = shape === "pill" ? 999 : s.r;
  const iconOnlySize = iconOnly ? ICON_ONLY_DIM[size] : undefined;

  const a11yLabel = accessibilityLabel ?? title ?? "Button";

  const Icon = iconOnly ? (IconLeft || IconRight) : undefined;

  return (
    <Pressable
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityState={{ disabled: isDisabled, busy: !!loading }}
      hitSlop={iconOnly ? 10 : undefined}
      style={({ pressed }) => {
        // Compute box style once for cleaner code
        const boxStyle: ViewStyle = {
          backgroundColor: pressed ? p.pressedBg : p.bg,
          borderColor: p.border,
          borderWidth: p.borderWidth,
          borderRadius: radius,
          opacity: isDisabled ? 0.65 : 1,
          ...(iconOnly
            ? { width: iconOnlySize, height: iconOnlySize, minWidth: iconOnlySize, minHeight: iconOnlySize }
            : { paddingVertical: s.pv, paddingHorizontal: s.ph }),
        };

        return [
          styles.base,
          boxStyle,
          fullWidth && styles.fullWidth,
          iconOnly && styles.iconOnly,
          style,
        ];
      }}
      {...rest}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator color={p.text} size={s.is} />
        ) : iconOnly ? (
          Icon ? <Icon size={s.is} strokeWidth={2} color={p.text} /> : null
        ) : (
          <>
            {IconLeft ? <IconLeft size={s.is} strokeWidth={2} color={p.text} style={styles.iconLeft} /> : null}
            {title ? (
              <Text style={[styles.text, { color: p.text, fontSize: s.fs, lineHeight: s.fs + 6 }, textStyle]}>
                {title}
              </Text>
            ) : null}
            {IconRight ? <IconRight size={s.is} strokeWidth={2} color={p.text} style={styles.iconRight} /> : null}
          </>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: "center", justifyContent: "center" },
  content: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  text: { fontWeight: "600" },
  iconLeft: { marginRight: 8 },
  iconRight: { marginLeft: 8 },
  fullWidth: { width: "100%" },
  iconOnly: { alignItems: "center", justifyContent: "center" },
});
