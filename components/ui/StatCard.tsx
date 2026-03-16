import React from "react";
import { StyleSheet, ViewStyle } from "react-native";

import { Text } from "@/components/Themed";
import { Card } from "@/components/ui/Card";

export interface StatCardProps {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  value: string;
  label: string;
  iconColor?: string;
  style?: ViewStyle;
}

export function StatCard({ icon: Icon, value, label, iconColor, style }: StatCardProps) {
  return (
    <Card variant="border" style={[styles.card, style]}>
      <Icon size={18} color={iconColor} />
      <Text variant="h2" align="center" style={styles.value}>
        {value}
      </Text>
      <Text variant="caption" colorName="textMuted" align="center">
        {label}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    padding: 12,
    alignItems: "center",
    gap: 6,
  },
  value: {
    fontWeight: "700",
    fontSize: 16,
  },
});
