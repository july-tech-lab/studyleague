import { LucideIcon } from "lucide-react-native";
import React, { forwardRef, useState } from "react";
import { Text } from "@/components/Themed";
import {
  Pressable,
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from "react-native";

import { useTheme } from "@/utils/themeContext";
import typography from "@/constants/typography";

type InputProps = TextInputProps & {
  label?: string;
  helperText?: string;
  error?: string;
  containerStyle?: ViewStyle;
  leftIcon?: LucideIcon;
  rightIcon?: LucideIcon;
  onRightIconPress?: () => void;
  fieldStyle?: ViewStyle | ViewStyle[];
};

export const Input = forwardRef<TextInput, InputProps>(
  (
    { label, helperText, error, containerStyle, leftIcon: LeftIcon, rightIcon: RightIcon, onRightIconPress,     fieldStyle, style, onFocus, onBlur, ...rest },
    ref
  ) => {
    const colors = useTheme();
    const [focused, setFocused] = useState(false);
    const mergedFieldStyles = Array.isArray(fieldStyle)
      ? fieldStyle.filter(Boolean)
      : fieldStyle
        ? [fieldStyle]
        : [];

    const borderColor = error ? colors.danger : focused ? colors.primaryDark : colors.divider;
    const glowStyles = undefined;

    return (
      <View style={[styles.wrapper, containerStyle]}>
        {label ? (
          <Text variant="subtitle" colorName="textMuted" style={styles.label}>
            {label}
          </Text>
        ) : null}
        <View
          style={[
            styles.field,
            {
              backgroundColor: colors.surface,
              borderColor,
            },
            glowStyles,
            ...mergedFieldStyles,
          ]}
        >
          {LeftIcon ? (
            <LeftIcon size={18} strokeWidth={2} color={colors.textMuted} style={styles.iconLeft} />
          ) : null}
          <TextInput
            ref={ref}
            placeholderTextColor={colors.textMuted}
            style={[
              styles.input,
              { color: colors.text },
              style,
            ]}
            onFocus={(event) => {
              setFocused(true);
              onFocus?.(event);
            }}
            onBlur={(event) => {
              setFocused(false);
              onBlur?.(event);
            }}
            {...rest}
          />
          {RightIcon ? (
            onRightIconPress ? (
              <Pressable onPress={onRightIconPress} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <RightIcon size={18} strokeWidth={2} color={colors.textMuted} style={styles.iconRight} />
              </Pressable>
            ) : (
            <RightIcon size={18} strokeWidth={2} color={colors.textMuted} style={styles.iconRight} />
            )
          ) : null}
        </View>
        {error ? (
          <Text variant="micro" style={[styles.helper, { color: colors.danger }]}>
            {error}
          </Text>
        ) : helperText ? (
          <Text variant="micro" colorName="textMuted" style={styles.helper}>
            {helperText}
          </Text>
        ) : null}
      </View>
    );
  }
);

Input.displayName = "Input";

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
  },
  label: {
    marginBottom: 6,
  },
  field: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  input: {
    flex: 1,
    ...typography.body,
    paddingVertical: 10,
    outlineStyle: 'none',
    outlineWidth: 0,
  },
  helper: {
    marginTop: 6,
  },
  iconLeft: {
    marginRight: 10,
  },
  iconRight: {
    marginLeft: 10,
  },
});
