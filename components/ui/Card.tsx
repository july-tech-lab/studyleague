import React from "react";
import { StyleSheet, View, ViewProps } from "react-native";

import { hexToRgba } from "@/utils/color";
import { useTheme } from "@/utils/themeContext";

type CardRadius = 14 | 16 | 20;
type CardVariant = "elevated" | "flat" | "border";

type CardProps = ViewProps & {
  padding?: number;
  variant?: CardVariant;
  radius?: CardRadius;
};

export function Card({ 
  padding = 16, 
  variant = "elevated",
  radius = 16,
  style, 
  children, 
  ...rest 
}: CardProps) {
  const colors = useTheme();

  const variantStyles = {
    elevated: styles.elevated,
    flat: styles.flat,
    border: styles.border,
  }[variant];

  const elevatedShadow =
    variant === "elevated"
      ? {
          boxShadow: [
            {
              offsetX: 0,
              offsetY: -8,
              blurRadius: 8,
              color: hexToRgba(colors.text, 0.08),
            },
          ],
          elevation: 4,
        }
      : {};

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: colors.surface,
          padding,
          borderRadius: radius,
          ...(variant === "border" && { borderColor: colors.divider }),
          ...elevatedShadow,
        },
        variantStyles,
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    // Base styles - borderRadius and borderColor set dynamically
  },
  elevated: {},
  flat: {
    // No border, no shadow - just background
  },
  border: {
    borderWidth: StyleSheet.hairlineWidth,
  },
});
