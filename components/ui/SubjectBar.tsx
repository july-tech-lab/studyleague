import { Text } from "@/components/Themed";
import { useTheme } from "@/utils/themeContext";
import React from "react";
import { StyleSheet, View } from "react-native";

export type SubjectBarProps = {
  color: string;
  name: string;
  /** Pre-formatted value shown on the right (duration, "x / y", percent, etc.). */
  value: string;
  /** Fill width of the bar, 0–100 (clamped). */
  fillPercent: number;
};

export function SubjectBar({ color, name, value, fillPercent }: SubjectBarProps) {
  const theme = useTheme();
  const pct = Math.min(100, Math.max(0, fillPercent));

  return (
    <View style={styles.row}>
      <View style={styles.header}>
        <View style={styles.labelWithDot}>
          <View style={[styles.dot, { backgroundColor: color }]} />
          <Text variant="caption" colorName="textMuted" style={styles.label} numberOfLines={1}>
            {name}
          </Text>
        </View>
        <Text variant="caption" colorName="textMuted">
          {value}
        </Text>
      </View>
      <View style={[styles.track, { backgroundColor: theme.border }]}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    marginBottom: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  labelWithDot: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  label: {
    flexShrink: 1,
  },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    marginTop: 4,
  },
  fill: {
    height: "100%",
    borderRadius: 4,
  },
});
