import React from "react";
import { StyleSheet, View, ViewProps } from "react-native";

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

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: colors.surface,
          padding,
          borderRadius: radius,
          shadowColor: colors.text,
          ...(variant === "border" && { borderColor: colors.divider }),
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
  elevated: {
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  flat: {
    // No border, no shadow - just background
  },
  border: {
    borderWidth: StyleSheet.hairlineWidth,
  },
});
