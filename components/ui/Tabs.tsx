import { Text } from "@/components/Themed";
import Colors from "@/constants/Colors";
import { useTheme } from "@/utils/themeContext";
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
            style={[
              styles.button,
              isActive && styles.buttonActive,
            ]}
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
      alignItems: "stretch",
      alignSelf: "stretch",
      marginBottom: 8,
      padding: 4,
      backgroundColor: theme.border,
      borderRadius: 12,
      gap: 4,
    },
    button: {
      flex: 1,
      minWidth: 0,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 6,
      paddingHorizontal: 8,
      borderRadius: 8,
    },
    buttonActive: {
      backgroundColor: theme.surface,
      ...Platform.select({
        ios: {
          shadowColor: theme.shadow,
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.12,
          shadowRadius: 2,
        },
        android: {
          elevation: 2,
        },
      }),
    },
    buttonText: {
      color: theme.textMuted,
      fontWeight: "600",
    },
    buttonTextActive: {
      color: theme.text,
      fontWeight: "700",
    },
  });
