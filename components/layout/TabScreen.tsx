import { Screen, ScreenProps } from "@/components/layout/Screen";
import Header, { HeaderProps } from "@/components/layout/Header";
import { View, StyleSheet } from "react-native";

interface TabScreenProps extends Omit<ScreenProps, "variant" | "safeTop"> {
  // Header props
  title: string;
  subtitle?: string;
  rightAction?: React.ReactNode;
  rightIcon?: HeaderProps["rightIcon"];
  
  // Screen props (variant and safeTop are fixed for tabs)
  variant?: never; // Prevent setting variant - always "tabs"
  safeTop?: never; // Prevent setting safeTop - Header handles it
}

/**
 * Tab screen wrapper that combines Header + Screen.
 * 
 * This component provides the standard tab page structure:
 * - Header (handles top safe area and title)
 * - Screen variant="tabs" (handles content spacing and bottom safe area for tab bar)
 * 
 * Each component has a single responsibility:
 * - Header: Presentational header UI
 * - Screen: Layout and spacing
 * - TabScreen: Composition of both
 * 
 * @example
 * <TabScreen title="Dashboard">
 *   <Text>Content here</Text>
 * </TabScreen>
 * 
 * @example
 * <TabScreen 
 *   title="Profile" 
 *   rightIcon={{ icon: LogOut, onPress: handleSignOut }}
 * >
 *   <Text>Profile content</Text>
 * </TabScreen>
 */
export function TabScreen({
  title,
  subtitle,
  rightAction,
  rightIcon,
  children,
  ...screenProps
}: TabScreenProps) {
  return (
    <View style={styles.container}>
      <Header 
        title={title}
        subtitle={subtitle}
        rightAction={rightAction}
        rightIcon={rightIcon}
      />
      <Screen 
        variant="tabs"
        safeTop={false} // Header handles top safe area
        safeBottom={true} // Need bottom safe area for tab bar
        {...screenProps}
      >
        {children}
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
