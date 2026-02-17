import { Text } from "@/components/Themed";
import { Button } from "@/components/ui/Button";
import Colors from "@/constants/Colors";
import { useTheme } from "@/utils/themeContext";
import { LucideIcon } from "lucide-react-native";
import React from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export interface HeaderProps {
  title: string;
  subtitle?: string;
  leftAction?: React.ReactNode;
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

export default function Header({ title, subtitle, leftAction, rightAction, rightIcon, theme }: HeaderProps) {
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
            size="lg"
            onPress={rightIcon.onPress}
            disabled={rightIcon.disabled}
            accessibilityLabel={rightIcon.accessibilityLabel}
            style={styles.headerIconButton}
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
    <View style={[styles.header, { backgroundColor: headerTheme.background }]}>
      {leftAction && (
        <View style={styles.leftActionContainer}>{leftAction}</View>
      )}
      <View style={styles.titleContainer}>
        <Text
          variant="h1"
          style={{ color: headerTheme.text }}
          align="left"
        >
          {title}
        </Text>
        {subtitle && (
          <Text
            variant="subtitle"
            style={{ color: headerTheme.textMuted }}
            align="left"
          >
            {subtitle}
          </Text>
        )}
      </View>
      {rightActionElement && (
        <View style={styles.rightActionContainer}>{rightActionElement}</View>
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
      alignItems: "flex-start",
      justifyContent: "center",
    },
    headerSubtitle: {
      fontSize: 14,
      fontWeight: "600",
      opacity: 0.85,
      marginTop: 4,
      textAlign: "center",
    },
    leftActionContainer: {
      marginRight: 12,
      justifyContent: "center",
    },
    rightActionContainer: {
      marginLeft: 8,
      justifyContent: "center",
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
      width: 56,
      height: 56,
      borderRadius: 28,
      minWidth: 56,
      minHeight: 56,
    },
    badgeContainer: {
      position: "absolute",
      top: -4,
      right: -4,
      zIndex: 1,
    },
  });
