import { INTER } from "@/constants/typography";
import { useTheme } from "@/utils/themeContext";
import * as Haptics from "expo-haptics";
import { Tabs } from "expo-router";
import { BarChart2, Clock, ListChecks, User, UsersRound } from "lucide-react-native";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, TouchableOpacity, View, ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TabsLayout() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(), []);

  const makeTabIcon = (IconComponent: typeof Clock, label: string) => {
    const TabIcon = ({ color, focused }: { color: string; focused: boolean }) => (
      <View style={styles.tabButton}>
        <IconComponent
          size={22}
          color={focused ? theme.tabIconSelected : color}
          strokeWidth={2.2}
        />
      </View>
    );

    TabIcon.displayName = `TabIcon(${label})`;
    return TabIcon;
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: theme.tabIconSelected,
        tabBarInactiveTintColor: theme.tabIconDefault,
        tabBarStyle: {
          height: 74 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 12),
          paddingTop: 6,
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: {
          fontFamily: INTER.medium,
          fontSize: 12,
          fontWeight: "500",
        },
        tabBarButton: (props) => {
          const focused = props.accessibilityState?.selected;
          const { pointerEvents, style, ...rest } = props as typeof props & {
            pointerEvents?: ViewStyle["pointerEvents"];
          };
          return (
            <TouchableOpacity
              {...(rest as React.ComponentProps<typeof TouchableOpacity>)}
              onPress={(e) => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                props.onPress?.(e);
              }}
              activeOpacity={0.7}
              style={[
                style,
                pointerEvents != null ? { pointerEvents } : null,
                focused && {
                  backgroundColor: theme.primaryTint,
                  borderRadius: 20,
                  marginHorizontal: 4,
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                },
              ]}
            />
          );
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabs.focus"),
          tabBarIcon: makeTabIcon(Clock, t("tabs.focus")),
        }}
      />

      <Tabs.Screen
        name="tasks"
        options={{
          title: t("tabs.tasks"),
          tabBarIcon: makeTabIcon(ListChecks, t("tabs.tasks")),
        }}
      />

      <Tabs.Screen
        name="leaderboard"
        options={{
          href: null, // Hide from tab bar - access via Groups tab
          title: t("tabs.leaderboard"),
        }}
      />

      <Tabs.Screen
        name="groups"
        options={{
          title: t("tabs.groups"),
          tabBarIcon: makeTabIcon(UsersRound, t("tabs.groups")),
        }}
      />

      <Tabs.Screen
        name="dashboard"
        options={{
          title: t("tabs.stats"),
          tabBarIcon: makeTabIcon(BarChart2, t("tabs.stats")),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: t("tabs.profile"),
          tabBarIcon: makeTabIcon(User, t("tabs.profile")),
        }}
      />

      {/* TEMPORARY: Color palette page for theme visualization - not in bar */}
      <Tabs.Screen
        name="color-palette"
        options={{
          href: null, // Hidden from tab bar
        }}
      />
    </Tabs>
  );
}

const createStyles = () =>
  StyleSheet.create({
    tabButton: {
      alignItems: "center",
      justifyContent: "center",
    },
  });
