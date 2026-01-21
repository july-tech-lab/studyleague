import { TabScreen } from "@/components/layout/TabScreen";
import { Tabs } from "@/components/ui/Tabs";
import { useTheme } from "@/utils/themeContext";
import { useAuth } from "@/utils/authContext";
import { fetchLeaderboardByPeriod, LeaderboardEntry } from "@/utils/queries";
import { formatDurationFromMinutes } from "@/utils/time";
import Colors from "@/constants/Colors";
import { Text } from "@/components/Themed";
import React from "react";
import { useTranslation } from "react-i18next";
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StyleSheet,
    View,
} from "react-native";

type Period = "week" | "month" | "year";

const labels = {
  week: "leaderboard.period.week",
  month: "leaderboard.period.month",
  year: "leaderboard.period.year",
} as const;

const periodOptions: { value: Period; label: keyof typeof labels }[] = [
  { value: "week", label: "week" },
  { value: "month", label: "month" },
  { value: "year", label: "year" },
];

export default function LeaderboardScreen() {
  const { user } = useAuth();
  const theme = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const rankPalette = ["#FFD700", "#C0C0C0", "#CD7F32"];
  const [period, setPeriod] = React.useState<Period>("week");
  const [leaderboard, setLeaderboard] = React.useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [refreshing, setRefreshing] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const { t } = useTranslation();

  const formatDuration = React.useCallback((seconds: number) => {
    const minutes = Math.max(0, Math.floor(seconds / 60));
    return formatDurationFromMinutes(minutes);
  }, []);

  const loadLeaderboard = React.useCallback(
    async (selectedPeriod: Period, options?: { isRefresh?: boolean }) => {
      if (options?.isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const data = await fetchLeaderboardByPeriod(selectedPeriod);
        setLeaderboard(data);
      } catch (err) {
        console.error("Erreur chargement classement", err);
        setError(t("leaderboard.errorLoading", "Impossible de charger le classement."));
      } finally {
        if (options?.isRefresh) {
          setRefreshing(false);
        } else {
          setLoading(false);
        }
      }
    },
    [t]
  );

  React.useEffect(() => {
    loadLeaderboard(period);
  }, [period, loadLeaderboard]);

  const handleRefresh = React.useCallback(() => {
    loadLeaderboard(period, { isRefresh: true });
  }, [loadLeaderboard, period]);

  return (
    <TabScreen title={t("leaderboard.title", "Classement")}>
      {/* PERIOD TOGGLE */}
      <Tabs
        options={periodOptions.map(option => ({
          value: option.value,
          label: t(labels[option.label]),
        }))}
        value={period}
        onChange={setPeriod}
      />

      {/* WHITE CARD CONTAINER */}
      <ScrollView
        contentContainerStyle={styles.listWrapper}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.primary}
          />
        }
      >
        <View style={styles.listCard}>
          {loading ? (
            <View style={styles.helperBox}>
              <ActivityIndicator color={theme.primary} />
            </View>
          ) : error ? (
            <Text variant="micro" align="center" colorName="textMuted" style={styles.helperText}>
              {error}
            </Text>
          ) : leaderboard.length === 0 ? (
            <Text variant="micro" align="center" colorName="textMuted" style={styles.helperText}>
              {t("leaderboard.empty", "Aucune donnée pour cette période.")}
            </Text>
          ) : (
            leaderboard.map((entry, index) => {
              const rank = index + 1;
              const rankColor = rankPalette[index] ?? theme.primary;
              const isCurrentUser = user?.id === entry.userId;

              return (
                <View
                  key={entry.userId}
                  style={[
                    styles.row,
                    isCurrentUser && styles.currentUserRow,
                  ]}
                >
                  {/* Rank Circle */}
                  <View style={[styles.rankCircle, { borderColor: rankColor }]}>
                    <Text variant="caption" style={[styles.rankCircleText, { color: rankColor }]}>
                      {rank}
                    </Text>
                  </View>

                  {/* Name */}
                  <View style={styles.nameBox}>
                    <Text
                      variant="body"
                      style={[
                        styles.nameText,
                        isCurrentUser && styles.currentUserText,
                      ]}
                    >
                      {entry.username}
                    </Text>
                  </View>

                  {/* Time */}
                  <Text
                    variant="body"
                    style={[
                      styles.timeText,
                      isCurrentUser && styles.currentUserTimeText,
                    ]}
                  >
                    {formatDuration(entry.totalSeconds)}
                  </Text>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </TabScreen>
  );
}

const createStyles = (theme: typeof Colors.light) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },

    // List card container
    listWrapper: { padding: 20 },
    listCard: {
      backgroundColor: theme.surface,
      borderRadius: 20,
      paddingVertical: 10,
      elevation: 3,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.divider ?? theme.border,
    },
    helperBox: {
      paddingVertical: 24,
      alignItems: "center",
      justifyContent: "center",
    },
    helperText: {
      paddingVertical: 20,
      paddingHorizontal: 16,
    },

    // Row Style
    row: {
      paddingVertical: 16,
      paddingHorizontal: 15,
      flexDirection: "row",
      alignItems: "center",
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    currentUserRow: {
      backgroundColor: theme.primaryTint,
    },

    // Rank circle
    rankCircle: {
      width: 34,
      height: 34,
      borderRadius: 17,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 14,
      backgroundColor: theme.surface,
      borderWidth: StyleSheet.hairlineWidth,
    },
    rankCircleText: { color: theme.text, fontWeight: "600" },

    nameBox: { flex: 1 },
    nameText: { fontWeight: "400" },
    currentUserText: { fontWeight: "600" },

    timeText: { fontWeight: "400" },
    currentUserTimeText: { fontWeight: "600" },
  });
