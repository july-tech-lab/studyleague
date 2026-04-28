import { Text } from "@/components/Themed";
import Colors from "@/constants/Colors";
import { useTheme } from "@/utils/themeContext";
import type { LucideIcon } from "lucide-react-native";
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";

export type TabOption<T extends string = string> = {
  value: T;
  label: string;
  /** Used when variant is "iconPills". */
  icon?: LucideIcon;
};

type TabsProps<T extends string = string> = {
  options: TabOption<T>[];
  value: T;
  onChange: (value: T) => void;
  style?: ViewStyle;
  /** Segmented track (default), separate rounded pills with icons, or underline. */
  variant?: "segmented" | "iconPills" | "underline";
};

export function Tabs<T extends string = string>({
  options,
  value,
  onChange,
  style,
  variant = "segmented",
}: TabsProps<T>) {
  const theme = useTheme();
  const styles = createStyles(theme);

  if (variant === "underline") {
    return (
      <View style={[styles.underlineTrack, style]}>
        {options.map((option) => {
          const isActive = value === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [
                styles.underlineButton,
                isActive && styles.underlineButtonActive,
                pressed && styles.underlineButtonPressed,
              ]}
            >
              <Text
                variant="subtitle"
                style={[
                  styles.underlineText,
                  isActive && styles.underlineTextActive,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  if (variant === "iconPills") {
    return (
      <View style={[styles.iconPillsRow, style]}>
        {options.map((option) => {
          const isActive = value === option.value;
          const Icon = option.icon;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [
                styles.iconPill,
                isActive ? styles.iconPillActive : styles.iconPillInactive,
                pressed && styles.iconPillPressed,
              ]}
            >
              {Icon ? (
                <Icon
                  size={18}
                  color={isActive ? theme.onPrimaryDark : theme.textMuted}
                  strokeWidth={2}
                />
              ) : null}
              <Text
                variant="subtitle"
                style={[
                  styles.iconPillText,
                  isActive ? styles.iconPillTextActive : styles.iconPillTextInactive,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  return (
    <View style={[styles.segmentedTrack, style]}>
      {options.map((option) => {
        const isActive = value === option.value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[
              styles.segmentedButton,
              isActive && styles.segmentedButtonActive,
            ]}
          >
            <Text
              variant="subtitle"
              style={[
                styles.segmentedText,
                isActive && styles.segmentedTextActive,
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const createStyles = (theme: typeof Colors.light) =>
  StyleSheet.create({
    underlineTrack: {
      flexDirection: "row",
      alignSelf: "stretch",
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
      marginBottom: 8,
      gap: 10,
    },
    underlineButton: {
      flex: 1,
      minWidth: 0,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 11,
      paddingHorizontal: 12,
      borderBottomWidth: 2,
      borderBottomColor: "transparent",
      marginBottom: -StyleSheet.hairlineWidth,
    },
    underlineButtonActive: {
      borderBottomColor: theme.primary,
    },
    underlineButtonPressed: {
      opacity: 0.7,
    },
    underlineText: {
      color: theme.textMuted,
      fontWeight: "400",
    },
    underlineTextActive: {
      color: theme.text,
      fontWeight: "600",
    },

    segmentedTrack: {
      flexDirection: "row",
      alignItems: "stretch",
      alignSelf: "stretch",
      marginBottom: 8,
      padding: 3,
      backgroundColor: theme.primaryTint,
      borderRadius: 10,
      gap: 3,
    },
    segmentedButton: {
      flex: 1,
      minWidth: 0,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 8,
      paddingHorizontal: 8,
      borderRadius: 8,
      backgroundColor: "transparent",
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: "transparent",
    },
    segmentedButtonActive: {
      backgroundColor: theme.surface,
      ...Platform.select({
        ios: {
          shadowColor: theme.shadow,
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.14,
          shadowRadius: 2.5,
        },
        android: {
          elevation: 2,
        },
      }),
    },
    segmentedText: {
      color: theme.textMuted,
      fontWeight: "600",
    },
    segmentedTextActive: {
      color: theme.text,
      fontWeight: "700",
    },
    iconPillsRow: {
      flexDirection: "row",
      alignSelf: "stretch",
      marginBottom: 8,
      gap: 10,
    },
    iconPill: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 11,
      paddingHorizontal: 12,
      borderRadius: 12,
    },
    iconPillInactive: {
      backgroundColor: theme.surface,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: theme.border,
    },
    iconPillActive: {
      backgroundColor: theme.primary,
      borderWidth: 0,
    },
    iconPillPressed: {
      opacity: 0.92,
    },
    iconPillText: {
      fontWeight: "600",
    },
    iconPillTextInactive: {
      color: theme.text,
    },
    iconPillTextActive: {
      color: theme.onPrimaryDark,
    },
  });
