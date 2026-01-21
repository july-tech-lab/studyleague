import { useTheme } from "@/utils/themeContext";
import Colors from "@/constants/Colors";
import { Text } from "@/components/Themed";
import { Pressable, StyleSheet, View, ViewStyle } from "react-native";

export type TabOption<T extends string = string> = {
  value: T;
  label: string;
};

type TabsProps<T extends string = string> = {
  options: TabOption<T>[];
  value: T;
  onChange: (value: T) => void;
  style?: ViewStyle;
};

export function Tabs<T extends string = string>({
  options,
  value,
  onChange,
  style,
}: TabsProps<T>) {
  const theme = useTheme();
  const styles = createStyles(theme);

  return (
    <View style={[styles.container, style]}>
      {options.map((option) => {
        const isActive = value === option.value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.button, isActive && styles.buttonActive]}
          >
            <Text
              variant="subtitle"
              style={[styles.buttonText, isActive && styles.buttonTextActive]}
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
    container: {
      flexDirection: "row",
      justifyContent: "space-around",
      marginHorizontal: 0,
      paddingHorizontal: 0,
      marginTop: 0,
      marginBottom: 16,
      backgroundColor: "transparent",
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      gap: 8,
    },
    button: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 12,
    },
    buttonActive: {
      borderBottomWidth: 3,
      borderBottomColor: theme.primaryDark,
    },
    buttonText: {
      color: theme.textMuted,
      // Typography handled by Themed Text variant
      fontWeight: "600",
    },
    buttonTextActive: {
      color: theme.primaryDark,
      fontWeight: "800",
    },
  });
