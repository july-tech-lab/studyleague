import { Button } from "@/components/ui/Button";
import Colors from "@/constants/Colors";
import { Text } from "@/components/Themed";
import { LucideIcon } from "lucide-react-native";
import React from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/utils/themeContext";

export interface HeaderProps {
  title: string;
  subtitle?: string;
  rightAction?: React.ReactNode;
  rightIcon?: {
    icon: LucideIcon;
    onPress?: () => void;
    accessibilityLabel?: string;
    disabled?: boolean;
    badge?: React.ReactNode;
  };
  theme?: typeof Colors.light;
}

export default function Header({ title, subtitle, rightAction, rightIcon, theme }: HeaderProps) {
  const defaultTheme = useTheme();
  const headerTheme = theme ?? defaultTheme;
  const insets = useSafeAreaInsets();
  const styles = createStyles(headerTheme, insets);

  const renderRightAction = () => {
    if (rightIcon) {
      const IconComponent = rightIcon.icon;
      return (
        <View style={styles.headerIconWrapper}>
          <Button
            iconLeft={IconComponent}
            iconOnly
            variant="primary"
            size="md"
            onPress={rightIcon.onPress}
            disabled={rightIcon.disabled}
            accessibilityLabel={rightIcon.accessibilityLabel}
            style={[styles.headerIconButton, { backgroundColor: "transparent" }]}
          />
          {rightIcon.badge && (
            <View style={styles.badgeContainer}>{rightIcon.badge}</View>
          )}
        </View>
      );
    }
    if (rightAction) {
      return <View style={styles.rightActionWrapper}>{rightAction}</View>;
    }
    return null;
  };

  const rightActionElement = renderRightAction();

  return (
    <View style={[styles.header, { backgroundColor: headerTheme.primaryDark }]}>
      <View style={styles.titleContainer}>
        <Text 
          variant="h1" 
          style={{ color: headerTheme.onPrimaryDark }}
          align="center"
        >
          {title}
        </Text>
        {subtitle && (
          <Text 
            variant="subtitle" 
            style={{ color: headerTheme.onPrimaryDark, opacity: 0.85 }}
            align="center"
          >
            {subtitle}
          </Text>
        )}
      </View>
      {rightActionElement && (
        <View style={[styles.rightActionContainer, { top: insets.top + 30 }]}>
          {rightActionElement}
        </View>
      )}
    </View>
  );
}

const createStyles = (theme: typeof Colors.light, insets: { top: number }) =>
  StyleSheet.create({
    header: {
      paddingTop: Math.max(insets.top + 30, 60),
      paddingBottom: 30,
      paddingHorizontal: 24,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      position: "relative",
    },
    titleContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    headerSubtitle: {
      fontSize: 14,
      fontWeight: "600",
      opacity: 0.85,
      marginTop: 4,
      textAlign: "center",
    },
    rightActionContainer: {
      position: "absolute",
      right: 24,
      // top is set dynamically based on safe area insets
    },
    rightActionWrapper: {
      // Wrapper for custom rightAction to maintain positioning
    },
    headerIconWrapper: {
      position: "relative",
      alignItems: "center",
      justifyContent: "center",
    },
    headerIconButton: {
      // Button component handles sizing via iconOnly prop
    },
    badgeContainer: {
      position: "absolute",
      top: -4,
      right: -4,
      zIndex: 1,
    },
  });
