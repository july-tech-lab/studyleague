import React from "react";
import { Modal as RNModal, ModalProps as RNModalProps, Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/Themed";
import { useTheme } from "@/utils/themeContext";
import { Button } from "./Button";

type ModalAction = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "destructive" | "outline" | "ghost";
  loading?: boolean;
  disabled?: boolean;
  iconLeft?: React.ComponentType<any>;
};

type ModalProps = Omit<RNModalProps, "children"> & {
  title?: string;
  titleVariant?: "h1" | "h2";
  children: React.ReactNode;
  actions?: {
    cancel?: ModalAction;
    confirm?: ModalAction;
  };
  onClose: () => void;
  dismissible?: boolean; // Allow closing by tapping backdrop
  padding?: number;
};

export function Modal({
  visible,
  onClose,
  title,
  titleVariant = "h2",
  children,
  actions,
  dismissible = true,
  padding = 16,
  ...rest
}: ModalProps) {
  const colors = useTheme();

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      {...rest}
    >
      <View style={[styles.backdrop, { backgroundColor: "rgba(0,0,0,0.35)" }]}>
        {/* Backdrop Pressable - positioned absolutely behind card */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => dismissible && onClose()}
        />
        {/* Card - positioned on top, blocks backdrop touches */}
        {/* View with responder captures touches on card area, preventing backdrop from receiving them */}
        {/* Child Pressables (buttons) will still handle their own touches normally */}
        <View
          style={[styles.card, { backgroundColor: colors.surface, padding }]}
          onStartShouldSetResponder={() => true}
        >
          {title && (
            <Text
              variant={titleVariant}
            >
              {title}
            </Text>
          )}

          <View style={styles.content}>
            {children}
          </View>

          {actions && (
            <View style={styles.actions}>
              {actions.cancel && (
                <Button
                  variant={actions.cancel.variant ?? "ghost"}
                  title={actions.cancel.label}
                  onPress={actions.cancel.onPress}
                  disabled={actions.cancel.disabled}
                  loading={actions.cancel.loading}
                  iconLeft={actions.cancel.iconLeft}
                />
              )}
              {actions.confirm && (
                <Button
                  variant={actions.confirm.variant ?? "primary"}
                  title={actions.confirm.label}
                  onPress={actions.confirm.onPress}
                  disabled={actions.confirm.disabled}
                  loading={actions.confirm.loading}
                  iconLeft={actions.confirm.iconLeft}
                />
              )}
            </View>
          )}
        </View>
      </View>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    borderRadius: 16,
    elevation: 6,
    boxShadow: "0 0 8px 0 rgba(0, 0, 0, 0.15)",
  },
  content: {
    marginVertical: 10,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 12,
  },
});
