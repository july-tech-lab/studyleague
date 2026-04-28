import { TabScreen } from "@/components/layout/TabScreen";
import { Text } from "@/components/Themed";
import { Tabs } from "@/components/ui/Tabs";
import Colors from "@/constants/Colors";
import { useAuth } from "@/utils/authContext";
import { fetchLeaderboardByPeriod, LeaderboardEntry } from "@/utils/queries";
import { useTheme } from "@/utils/themeContext";
import { formatStatMinutes } from "@/utils/time";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import React from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

type Period = "week" | "month" | "year";

const labels = {
  week: "common.period.week",
  month: "common.period.month",
  year: "common.period.year",
} as const;

const periodOptions: { value: Period; label: keyof typeof labels }[] = [
  { value: "week", label: "week" },
  { value: "month", label: "month" },
  { value: "year", label: "year" },
];

const LAST_RANK_STORAGE_PREFIX = "@tymii/leaderboard_last_rank";

export default function LeaderboardScreen() {
  const { user } = useAuth();
  const theme = useTheme();
  const router = useRouter();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const [period, setPeriod] = React.useState<Period>("week");
  const [leaderboard, setLeaderboard] = React.useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [refreshing, setRefreshing] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [rankDelta, setRankDelta] = React.useState<number | null>(null);
  const { t } = useTranslation();

  const loadLeaderboard = React.useCallback(
    async (selectedPeriod: Period, options?: { isRefresh?: boolean }) => {
      if (options?.isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const data = await fetchLeaderboardByPeriod(selectedPeriod, user?.id ?? null);
        setLeaderboard(data);
      } catch (err) {
        console.error("Erreur chargement classement", err);
        setError(t("leaderboard.errorLoading"));
      } finally {
        if (options?.isRefresh) {
          setRefreshing(false);
        } else {
          setLoading(false);
        }
      }
    },
    [t, user?.id]
  );

  React.useEffect(() => {
    loadLeaderboard(period);
  }, [period, loadLeaderboard]);

  React.useEffect(() => {
    if (!user?.id || leaderboard.length === 0) {
      setRankDelta(null);
      return;
    }
    const idx = leaderboard.findIndex((e) => e.userId === user.id);
    if (idx < 0) {
      setRankDelta(null);
      return;
    }
    const rank = idx + 1;
    const storageKey = `${LAST_RANK_STORAGE_PREFIX}:${user.id}:${period}`;
    let cancelled = false;
    (async () => {
      try {
        const prev = await AsyncStorage.getItem(storageKey);
        if (cancelled) return;
        if (prev != null && prev !== "") {
          const prevNum = parseInt(prev, 10);
          if (!Number.isNaN(prevNum) && prevNum !== rank) {
            setRankDelta(prevNum - rank);
          } else {
            setRankDelta(null);
          }
        } else {
          setRankDelta(null);
        }
        await AsyncStorage.setItem(storageKey, String(rank));
      } catch {
        if (!cancelled) setRankDelta(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [leaderboard, user?.id, period]);

  const handleRefresh = React.useCallback(() => {
    loadLeaderboard(period, { isRefresh: true });
  }, [loadLeaderboard, period]);

  const handleBack = React.useCallback(() => {
    router.back();
  }, [router]);

  const renderRow = (entry: LeaderboardEntry, index: number) => {
    const rank = index + 1;
    const isCurrentUser = user?.id === entry.userId;
    const timeStr = formatStatMinutes(Math.max(0, Math.floor(entry.totalSeconds / 60)));

    const inner = (
      <>
        <Text
          variant="body"
          style={[
            styles.rankNumber,
            { minWidth: 28 },
            isCurrentUser ? { color: theme.primary } : { color: theme.textMuted },
          ]}
        >
          {rank}
        </Text>
        <View style={styles.nameBlock}>
          {isCurrentUser ? (
            <>
              <Text variant="bodyStrong" style={styles.youLabel}>
                {t("leaderboard.you")}
              </Text>
              <Text variant="micro" colorName="primary" style={styles.itsYou}>
                {t("leaderboard.itsYou")}
              </Text>
            </>
          ) : (
            <Text variant="body" numberOfLines={1} style={styles.peerName}>
              {entry.username}
            </Text>
          )}
        </View>
        <View style={styles.timeBlock}>
          <Text
            variant="body"
            style={[styles.timeValue, isCurrentUser && styles.timeValueEmphasis]}
            align="right"
          >
            {timeStr}
          </Text>
          {isCurrentUser &&
            rankDelta != null &&
            rankDelta !== 0 &&
            (rankDelta > 0 ? (
              <Text variant="micro" colorName="textMuted" align="right" style={styles.trend}>
                {t("leaderboard.rankUpPlaces", { count: rankDelta })}
              </Text>
            ) : (
              <Text variant="micro" colorName="textMuted" align="right" style={styles.trend}>
                {t("leaderboard.rankDownPlaces", { count: Math.abs(rankDelta) })}
              </Text>
            ))}
        </View>
      </>
    );

    if (isCurrentUser) {
      return (
        <View key={entry.userId} style={[styles.selfCard, { borderColor: `${theme.primary}55` }]}>
          <View style={styles.rowInner}>{inner}</View>
        </View>
      );
    }

    return (
      <View
        key={entry.userId}
        style={[styles.plainRow, index < leaderboard.length - 1 && styles.plainRowDivider]}
      >
        {inner}
      </View>
    );
  };

  return (
    <TabScreen
      title={t("tabs.leaderboard")}
      leftAction={
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <ChevronLeft size={24} color={theme.text} />
        </TouchableOpacity>
      }
    >
      <View style={{ gap: 12 }}>
        <Tabs
          options={periodOptions.map((option) => ({
            value: option.value,
            label: t(labels[option.label]),
          }))}
          value={period}
          onChange={setPeriod}
        />

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
              {t("leaderboard.empty")}
            </Text>
          ) : (
            <View>{leaderboard.map(renderRow)}</View>
          )}
        </ScrollView>
      </View>
    </TabScreen>
  );
}

const createStyles = (theme: typeof Colors.light) =>
  StyleSheet.create({
    backButton: {
      padding: 8,
      marginLeft: -8,
      justifyContent: "center",
      alignItems: "center",
    },

    listWrapper: {
      paddingHorizontal: 20,
      paddingBottom: 24,
      paddingTop: 4,
      flexGrow: 1,
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

    plainRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 14,
      paddingHorizontal: 8,
    },
    plainRowDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },

    selfCard: {
      borderRadius: 16,
      backgroundColor: theme.primaryTint,
      borderWidth: StyleSheet.hairlineWidth,
      marginVertical: 6,
    },
    rowInner: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 14,
      paddingHorizontal: 8,
    },

    rankNumber: {
      fontWeight: "600",
      textAlign: "left",
    },
    nameBlock: {
      flex: 1,
      minWidth: 0,
      justifyContent: "center",
      paddingLeft: 8,
    },
    peerName: { fontWeight: "400", color: theme.text },
    youLabel: { fontWeight: "700", color: theme.text },
    itsYou: { marginTop: 2 },
    timeBlock: {
      alignItems: "flex-end",
      justifyContent: "center",
      marginLeft: 8,
      minWidth: 72,
    },
    timeValue: { fontWeight: "400", color: theme.text },
    timeValueEmphasis: { fontWeight: "700" },
    trend: { marginTop: 4 },
  });
