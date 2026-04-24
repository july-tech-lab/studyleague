import { TabScreen } from "@/components/layout/TabScreen";
import { Text } from "@/components/Themed";
import Colors from "@/constants/Colors";
import { useAuth } from "@/utils/authContext";
import {
  STUDY_PRESENCE_STALE_MS,
  fetchGroupMembersWithPresence,
  type GroupMemberWithPresence,
} from "@/utils/queries";
import { useTheme } from "@/utils/themeContext";
import { formatTime } from "@/utils/time";
import { supabase } from "@/utils/supabase";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, Clock, Flame, User } from "lucide-react-native";
import React from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";

function isPresenceLive(m: GroupMemberWithPresence, now: number): boolean {
  if (!m.isStudying || !m.studyingSince || !m.presenceUpdatedAt) return false;
  const last = new Date(m.presenceUpdatedAt).getTime();
  if (Number.isNaN(last)) return false;
  return now - last < STUDY_PRESENCE_STALE_MS;
}

function liveElapsedSeconds(m: GroupMemberWithPresence, now: number): number {
  if (!isPresenceLive(m, now)) return 0;
  const start = new Date(m.studyingSince as string).getTime();
  if (Number.isNaN(start)) return 0;
  return Math.max(0, Math.floor((now - start) / 1000));
}

export default function GroupLiveScreen() {
  const { id: groupId, name: groupNameParam } = useLocalSearchParams<{
    id?: string;
    name?: string;
  }>();
  const router = useRouter();
  const theme = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const { t } = useTranslation();
  const { user } = useAuth();
  const { width } = useWindowDimensions();

  const [members, setMembers] = React.useState<GroupMemberWithPresence[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [tick, setTick] = React.useState(0);
  const memberIdsRef = React.useRef<Set<string>>(new Set());

  const groupIdSafe = typeof groupId === "string" ? groupId : Array.isArray(groupId) ? groupId[0] : "";
  const groupTitle =
    (typeof groupNameParam === "string" ? groupNameParam : Array.isArray(groupNameParam) ? groupNameParam[0] : null) ??
    t("groups.live.title");

  const load = React.useCallback(async () => {
    if (!groupIdSafe) return;
    setError(null);
    try {
      const data = await fetchGroupMembersWithPresence(groupIdSafe);
      memberIdsRef.current = new Set(data.map((d) => d.userId));
      setMembers(data);
    } catch (e) {
      console.error("group live load", e);
      setError(t("groups.live.loadError"));
      setMembers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [groupIdSafe, t]);

  React.useEffect(() => {
    if (!groupIdSafe) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void load();
  }, [groupIdSafe, load]);

  React.useEffect(() => {
    const tmr = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(tmr);
  }, []);

  React.useEffect(() => {
    if (!groupIdSafe) return;

    const channel = supabase
      .channel(`user_study_presence_group_${groupIdSafe}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_study_presence" },
        (payload) => {
          const row = (payload.new as { user_id?: string } | null) ?? (payload.old as { user_id?: string } | null);
          const uid = row?.user_id;
          if (uid && memberIdsRef.current.has(uid)) {
            void load();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupIdSafe, load]);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    void load();
  }, [load]);

  const nowMs = React.useMemo(() => Date.now(), [members, tick]);

  const activeCount = React.useMemo(
    () => members.filter((m) => isPresenceLive(m, nowMs)).length,
    [members, nowMs]
  );

  const gap = 10;
  const horizontalPadding = 20;
  const cols = 4;
  const cellWidth = Math.floor((width - horizontalPadding * 2 - gap * (cols - 1)) / cols);

  const handleBack = React.useCallback(() => {
    router.back();
  }, [router]);

  return (
    <TabScreen
      title={groupTitle}
      subtitle={t("groups.live.subtitle", { active: activeCount, total: members.length })}
      leftAction={
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <ChevronLeft size={24} color={theme.text} />
        </TouchableOpacity>
      }
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
      >
        {!groupIdSafe ? (
          <Text variant="body" colorName="textMuted" align="center">
            {t("groups.live.missingGroup")}
          </Text>
        ) : loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator color={theme.primary} />
          </View>
        ) : error ? (
          <Text variant="body" colorName="textMuted" align="center">
            {error}
          </Text>
        ) : members.length === 0 ? (
          <Text variant="body" colorName="textMuted" align="center">
            {t("groups.live.empty")}
          </Text>
        ) : (
          <View style={styles.grid}>
            {members.map((m) => {
              const live = isPresenceLive(m, nowMs);
              const secs = live ? liveElapsedSeconds(m, nowMs) : 0;
              const ft = formatTime(secs);
              const timeLabel = live ? `${ft.hours}:${ft.mins}:${ft.secs}` : "—";
              const isSelf = user?.id === m.userId;
              const displayName = m.username?.trim() || t("groups.live.anonymous");

              return (
                <View key={m.userId} style={[styles.cell, { width: cellWidth }]}>
                  <View
                    style={[
                      styles.avatarWrap,
                      {
                        borderColor: live ? theme.primary : theme.border,
                        backgroundColor: live ? theme.primaryTint : theme.surfaceElevated,
                      },
                    ]}
                  >
                    {m.avatarUrl ? (
                      <Image source={{ uri: m.avatarUrl }} style={styles.avatarImg} />
                    ) : (
                      <User size={28} color={live ? theme.primaryDark : theme.textMuted} />
                    )}
                    <View style={[styles.stateIcon, { backgroundColor: theme.surface }]}>
                      {live ? (
                        <Flame size={14} color={theme.warning} />
                      ) : (
                        <Clock size={14} color={theme.textMuted} />
                      )}
                    </View>
                  </View>
                  <Text variant="caption" numberOfLines={1} style={[styles.name, live && { color: theme.primaryDark }]}>
                    {displayName}
                    {isSelf ? t("groups.live.youSuffix") : ""}
                  </Text>
                  <Text variant="micro" colorName="textMuted" numberOfLines={1} style={styles.time}>
                    {timeLabel}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
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
    scrollContent: {
      paddingHorizontal: 20,
      paddingBottom: 24,
    },
    centerBox: {
      paddingVertical: 48,
      alignItems: "center",
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
      justifyContent: "flex-start",
    },
    cell: {
      alignItems: "center",
      marginBottom: 8,
    },
    avatarWrap: {
      width: 64,
      height: 64,
      borderRadius: 20,
      borderWidth: 2,
      alignItems: "center",
      justifyContent: "center",
      overflow: "visible",
    },
    avatarImg: {
      width: 60,
      height: 60,
      borderRadius: 18,
    },
    stateIcon: {
      position: "absolute",
      right: -4,
      top: -4,
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: theme.border,
    },
    name: {
      marginTop: 6,
      fontWeight: "600",
      textAlign: "center",
      width: "100%",
    },
    time: {
      marginTop: 2,
      fontVariant: ["tabular-nums"],
    },
  });
