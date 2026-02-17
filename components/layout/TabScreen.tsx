import { Screen, ScreenProps } from "@/components/layout/Screen";
import Header, { HeaderProps } from "@/components/layout/Header";
import { View, StyleSheet } from "react-native";

interface TabScreenProps extends Omit<ScreenProps, "variant" | "safeTop"> {
  // Header props
  title?: string;
  subtitle?: string;
  leftAction?: React.ReactNode;
  rightAction?: React.ReactNode;
  rightIcon?: HeaderProps["rightIcon"];
  hideHeader?: boolean;
  
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
  title = "",
  subtitle,
  leftAction,
  rightAction,
  rightIcon,
  hideHeader,
  children,
  ...screenProps
}: TabScreenProps) {
  const showHeader = !hideHeader;

  return (
    <View style={styles.container}>
      {showHeader && (
        <Header
          title={title}
          subtitle={subtitle}
          leftAction={leftAction}
          rightAction={rightAction}
          rightIcon={rightIcon}
        />
      )}
      <Screen
        variant="tabs"
        safeTop={hideHeader}
        safeBottom={true}
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
