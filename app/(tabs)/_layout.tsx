import { useTheme } from "@/utils/themeContext";
import { Tabs } from "expo-router";
import * as Haptics from "expo-haptics";
import { BarChart2, Clock, ListChecks, Palette, User, UsersRound } from "lucide-react-native";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TabsLayout() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const makeTabIcon = (IconComponent: typeof Clock, label: string) => {
    const TabIcon = ({ color, focused }: { color: string; focused: boolean }) => (
      <View style={styles.tabButton}>
        <View
          style={[
            styles.iconBubble,
            focused && { backgroundColor: theme.primaryTint },
            focused && styles.iconBubbleFocused,
          ]}
        >
          <IconComponent
            size={22}
            color={focused ? theme.primary : color}
            strokeWidth={2.2}
          />
        </View>
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
          fontSize: 12,
          fontWeight: "500",
        },
        tabBarButton: (props) => (
          <TouchableOpacity
            {...props}
            onPress={(e) => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              props.onPress?.(e);
            }}
            activeOpacity={0.7}
          />
        ),
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
        name="dashboard"
        options={{
          title: t("tabs.stats"),
          tabBarIcon: makeTabIcon(BarChart2, t("tabs.stats")),
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
          href: null, // Hide from tab bar
          title: t("tabs.leaderboard", "Classement"),
        }}
      />

      <Tabs.Screen
        name="groups"
        options={{
          title: t("tabs.groups", "Groupes"),
          tabBarIcon: makeTabIcon(UsersRound, t("tabs.groups", "Groupes")),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: t("tabs.profile"),
          tabBarIcon: makeTabIcon(User, t("tabs.profile")),
        }}
      />

      {/* TEMPORARY: Color palette page for theme visualization - remove when done */}
      <Tabs.Screen
        name="color-palette"
        options={{
          title: t("tabs.colorPalette"),
          tabBarIcon: makeTabIcon(Palette, t("tabs.colorPalette")),
        }}
      />
    </Tabs>
  );
}

const createStyles = (theme: typeof Colors.light) =>
  StyleSheet.create({
    tabButton: {
      alignItems: "center",
      justifyContent: "center",
    },
    iconBubble: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
    },
    iconBubbleFocused: {
      transform: [{ scale: 1.06 }],
    },
  });
