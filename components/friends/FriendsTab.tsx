import { Text } from "@/components/Themed";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { useFriends } from "@/hooks/useFriends";
import Colors from "@/constants/Colors";
import { useTheme } from "@/utils/themeContext";
import { Timer, UserPlus, Users } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import { AddFriendModal } from "@/components/friends/AddFriendModal";
import { FriendActivityCard } from "@/components/friends/FriendActivityCard";

const SKELETON_TINT = "#4AC9CC";

type Props = {
  userId: string | null;
};

export function FriendsTab({ userId }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [subView, setSubView] = useState<"activity" | "manage">("activity");
  const [addOpen, setAddOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const {
    activity,
    friendships,
    pendingReceived,
    pendingSent,
    acceptedFriends,
    loading,
    refreshing,
    error,
    onRefresh,
    sendRequest,
    accept,
    removeOrDecline,
  } = useFriends(userId);

  const handleRemove = (friendshipId: string, username: string) => {
    Alert.alert(
      t("friends.removeConfirmTitle"),
      t("friends.removeConfirmMessage", { name: username }),
      [
        { text: t("common.actions.cancel"), style: "cancel" },
        {
          text: t("friends.remove"),
          style: "destructive",
          onPress: () => {
            setBusyId(friendshipId);
            void removeOrDecline(friendshipId).finally(() => setBusyId(null));
          },
        },
      ]
    );
  };

  if (!userId) {
    return (
      <View style={styles.centerBox}>
        <Text variant="body" colorName="textMuted" align="center">
          {t("friends.notSignedIn")}
        </Text>
      </View>
    );
  }

  const listHeaderExtras =
    subView === "activity" ? (
      <View style={{ gap: 12 }}>
        {loading && activity.length === 0 ? (
          <View style={{ gap: 10 }}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={[styles.skeletonCard, { borderColor: theme.border }]}>
                <View style={[styles.skeletonAvatar, { backgroundColor: SKELETON_TINT + "22" }]} />
                <View style={{ flex: 1, gap: 8 }}>
                  <View style={[styles.skeletonLine, { backgroundColor: theme.divider }]} />
                  <View
                    style={[styles.skeletonLineShort, { backgroundColor: theme.divider }]}
                  />
                </View>
              </View>
            ))}
          </View>
        ) : null}
        {error ? (
          <Text variant="caption" colorName="textMuted" align="center">
            {t("friends.loadError")}
          </Text>
        ) : null}
      </View>
    ) : null;

  return (
    <View style={[styles.flex, styles.friendsTabOuter]}>
      <Tabs
        variant="iconPills"
        options={[
          {
            value: "activity",
            label: t("friends.activity"),
            icon: Timer,
          },
          {
            value: "manage",
            label: t("friends.manageLink"),
            icon: Users,
          },
        ]}
        value={subView}
        onChange={(v) => setSubView(v as "activity" | "manage")}
      />

      <View style={styles.addFriendRow}>
        <Button
          title={t("friends.addFriend")}
          variant="primary"
          size="sm"
          iconLeft={UserPlus}
          onPress={() => setAddOpen(true)}
          style={{ alignSelf: "flex-end" }}
        />
      </View>

      {subView === "activity" ? (
        <FlatList
          style={styles.flex}
          data={activity}
          keyExtractor={(item) => item.session_id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
          }
          ListHeaderComponent={listHeaderExtras}
          renderItem={({ item }) => <FriendActivityCard item={item} />}
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyWrap}>
                <Users size={40} color={theme.textMuted} style={{ marginBottom: 8 }} />
                <Text variant="body" colorName="textMuted" align="center">
                  {t("friends.emptyActivity")}
                </Text>
              </View>
            ) : null
          }
        />
      ) : (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
          }
        >
          {pendingReceived.length > 0 ? (
            <View style={styles.block}>
              <Text variant="caption" colorName="textMuted" style={styles.blockTitle}>
                {t("friends.sectionAwaitingValidation")}
              </Text>
              {pendingReceived.map((f) => (
                <View key={f.id} style={styles.requestRow}>
                  <View style={styles.friendLeft}>
                    <MiniAvatar username={f.other_user.username} url={f.other_user.avatar_url} />
                    <View style={styles.pendingNameCol}>
                      <Text variant="body" numberOfLines={1}>
                        {f.other_user.username}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.requestActions}>
                    <Button
                      title={t("friends.accept")}
                      size="xs"
                      variant="primary"
                      loading={busyId === f.id}
                      disabled={busyId !== null}
                      onPress={() => {
                        setBusyId(f.id);
                        void accept(f.id).finally(() => setBusyId(null));
                      }}
                    />
                    <Button
                      title={t("friends.decline")}
                      size="xs"
                      variant="outline"
                      disabled={busyId !== null}
                      onPress={() => {
                        setBusyId(f.id);
                        void removeOrDecline(f.id).finally(() => setBusyId(null));
                      }}
                    />
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          {pendingSent.length > 0 ? (
            <View style={[styles.block, { marginTop: pendingReceived.length > 0 ? 20 : 0 }]}>
              <Text variant="caption" colorName="textMuted" style={styles.blockTitle}>
                {t("friends.sectionYourPendingRequests")}
              </Text>
              {pendingSent.map((f) => (
                <View key={f.id} style={styles.sentPendingRow}>
                  <View style={styles.friendLeft}>
                    <MiniAvatar username={f.other_user.username} url={f.other_user.avatar_url} />
                    <View style={styles.pendingNameCol}>
                      <Text variant="body" numberOfLines={1}>
                        {f.other_user.username}
                      </Text>
                      <Text variant="micro" colorName="textMuted">
                        {t("friends.awaitingTheirResponse")}
                      </Text>
                    </View>
                  </View>
                  <Button
                    title={t("friends.cancelRequest")}
                    size="xs"
                    variant="outline"
                    loading={busyId === f.id}
                    disabled={busyId !== null}
                    onPress={() => {
                      setBusyId(f.id);
                      void removeOrDecline(f.id).finally(() => setBusyId(null));
                    }}
                  />
                </View>
              ))}
            </View>
          ) : null}

          <View
            style={[
              styles.block,
              {
                marginTop:
                  pendingReceived.length > 0 || pendingSent.length > 0 ? 20 : 0,
              },
            ]}
          >
            <Text variant="caption" colorName="textMuted" style={styles.blockTitle}>
              {t("friends.friendsListTitle")}
            </Text>
            {acceptedFriends.length === 0 ? (
              <Text variant="body" colorName="textMuted">
                {t("friends.emptyFriends")}
              </Text>
            ) : (
              acceptedFriends.map((f) => (
                <View key={f.id} style={styles.friendRow}>
                  <View style={styles.friendLeft}>
                    <MiniAvatar username={f.other_user.username} url={f.other_user.avatar_url} />
                    <Text variant="body" numberOfLines={1} style={{ flex: 1 }}>
                      {f.other_user.username}
                    </Text>
                  </View>
                  <Button
                    title={t("friends.remove")}
                    size="xs"
                    variant="soft"
                    loading={busyId === f.id}
                    disabled={busyId !== null}
                    onPress={() => handleRemove(f.id, f.other_user.username)}
                  />
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}

      <AddFriendModal
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        currentUserId={userId}
        friendships={friendships}
        onSendRequest={sendRequest}
      />
    </View>
  );
}

function MiniAvatar({ username, url }: { username: string; url: string | null }) {
  const showImage =
    typeof url === "string" && (url.startsWith("http://") || url.startsWith("https://"));
  const initials =
    username.trim().split(/\s+/).filter(Boolean).length >= 1
      ? username.trim().slice(0, 2).toUpperCase()
      : "?";
  return (
    <View style={{ width: 36, height: 36, borderRadius: 18, overflow: "hidden" }}>
      {showImage ? (
        <Image source={{ uri: url! }} style={{ width: "100%", height: "100%" }} />
      ) : (
        <View
          style={{
            flex: 1,
            backgroundColor: "#4AC9CC33",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text variant="micro" style={{ fontWeight: "700", color: "#4AC9CC" }}>
            {initials}
          </Text>
        </View>
      )}
    </View>
  );
}

const createStyles = (theme: typeof Colors.light) =>
  StyleSheet.create({
    flex: { flex: 1 },
    friendsTabOuter: { gap: 12 },
    addFriendRow: {
      flexDirection: "row",
      justifyContent: "flex-end",
      alignItems: "center",
    },
    centerBox: { flex: 1, justifyContent: "center", padding: 24 },
    listContent: { paddingBottom: 24, flexGrow: 1 },
    block: { gap: 10 },
    blockTitle: { fontWeight: "600", marginBottom: 4 },
    requestRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.divider,
    },
    requestActions: { flexDirection: "row", gap: 8, flexShrink: 0 },
    pendingNameCol: { flex: 1, minWidth: 0 },
    sentPendingRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.divider,
    },
    friendRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.divider,
    },
    friendLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 },
    emptyWrap: { paddingTop: 48, paddingHorizontal: 16, alignItems: "center" },
    skeletonCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
    },
    skeletonAvatar: { width: 44, height: 44, borderRadius: 22 },
    skeletonLine: { height: 14, borderRadius: 6, width: "70%" },
    skeletonLineShort: { height: 12, borderRadius: 6, width: "45%" },
  });
