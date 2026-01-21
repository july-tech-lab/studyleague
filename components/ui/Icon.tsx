import { LucideIcon } from "lucide-react-native";
import React from "react";

import { useTheme } from "@/utils/themeContext";

type IconProps = React.ComponentProps<LucideIcon> & {
  as: LucideIcon;
};

export function Icon({ as: IconComponent, size = 20, strokeWidth = 2, color, ...rest }: IconProps) {
  const palette = useTheme();
  const iconColor = color ?? palette.text;

  return <IconComponent size={size} strokeWidth={strokeWidth} color={iconColor} {...rest} />;
}
