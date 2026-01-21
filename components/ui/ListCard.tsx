import { useTheme } from "@/utils/themeContext";
import React from "react";
import { StyleSheet, View, ViewProps } from "react-native";
import { Card } from "./Card";

export interface ListCardProps extends ViewProps {
  /** Padding for the card container. Default: 12 */
  padding?: number;
  /** Border radius for the card. Default: 16 */
  radius?: 14 | 16 | 20;
  /** Card variant. Default: "border" */
  variant?: "elevated" | "flat" | "border";
  /** Children should be ListItem components */
  children: React.ReactNode;
}

export interface ListItemProps extends ViewProps {
  /** Whether this is the last item (no border will be shown). Auto-detected if not provided. */
  isLast?: boolean;
  /** Vertical padding for the item. Default: 8 */
  paddingVertical?: number;
  /** Horizontal padding for the item. Default: 8 */
  paddingHorizontal?: number;
  /** Children content of the list item */
  children: React.ReactNode;
}

/**
 * A reusable card component for displaying lists with consistent styling and separator lines.
 * 
 * @example
 * <ListCard>
 *   <ListItem>
 *     <Text>Item 1</Text>
 *   </ListItem>
 *   <ListItem>
 *     <Text>Item 2</Text>
 *   </ListItem>
 * </ListCard>
 */
export function ListCard({
  padding = 12,
  radius = 16,
  variant = "border",
  style,
  children,
  ...rest
}: ListCardProps) {
  return (
    <Card
      padding={padding}
      radius={radius}
      variant={variant}
      style={[{ marginBottom: 16 }, style]}
      {...rest}
    >
      <View style={styles.listContainer}>
        {React.Children.map(children, (child: React.ReactNode, index: number) => {
          if (React.isValidElement<ListItemProps>(child) && child.type === ListItem) {
            const childrenArray = React.Children.toArray(children);
            const isLast = index === childrenArray.length - 1;
            return React.cloneElement(child, { isLast });
          }
          return child;
        })}
      </View>
    </Card>
  );
}

/**
 * A list item component that automatically adds separator lines between items.
 * Should be used as a child of ListCard.
 */
export function ListItem({
  isLast = false,
  paddingVertical = 8,
  paddingHorizontal = 8,
  style,
  children,
  ...rest
}: ListItemProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.listItem,
        {
          paddingVertical,
          paddingHorizontal,
          borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
          borderBottomColor: theme.divider ?? theme.border,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  listContainer: {
    gap: 0,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    // Padding and border are set dynamically
  },
});
