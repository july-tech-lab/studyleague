import { Text } from "@/components/Themed";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import Colors from "@/constants/Colors";
import {
  searchPublicProfilesByUsername,
  type FriendProfileBrief,
  type FriendshipWithOther,
} from "@/utils/queries";
import { useTheme } from "@/utils/themeContext";
import { UserPlus } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, View } from "react-native";

const INITIALS_FALLBACK = "#4AC9CC";

function initialsFromUsername(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return "?";
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return `${p[0][0] ?? ""}${p[1][0] ?? ""}`.toUpperCase();
}

type Props = {
  visible: boolean;
  onClose: () => void;
  currentUserId: string;
  friendships: FriendshipWithOther[];
  onSendRequest: (addresseeId: string) => Promise<void>;
};

export function AddFriendModal({
  visible,
  onClose,
  currentUserId,
  friendships,
  onSendRequest,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [results, setResults] = useState<FriendProfileBrief[]>([]);
  const [searching, setSearching] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);

  useEffect(() => {
    const tmr = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(tmr);
  }, [query]);

  const linkedIds = useMemo(() => {
    return new Set(friendships.map((f) => f.other_user.id));
  }, [friendships]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!visible || debounced.length < 3) {
        setResults([]);
        return;
      }
      setSearching(true);
      try {
        const rows = await searchPublicProfilesByUsername(currentUserId, debounced);
        if (!cancelled) {
          setResults(rows);
        }
      } catch (e) {
        console.error("searchPublicProfilesByUsername", e);
        if (!cancelled) {
          setResults([]);
        }
      } finally {
        if (!cancelled) {
          setSearching(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, debounced, currentUserId]);

  const pendingSent = useMemo(
    () => friendships.filter((f) => f.status === "pending" && f.requester_id === currentUserId),
    [friendships, currentUserId]
  );

  const handleSend = useCallback(
    async (profile: FriendProfileBrief) => {
      if (linkedIds.has(profile.id)) return;
      setSendingId(profile.id);
      try {
        await onSendRequest(profile.id);
        Alert.alert(t("friends.requestSent"));
      } catch (e: unknown) {
        const code = (e as { code?: string })?.code;
        if (code === "23505") {
          Alert.alert(t("friends.errors.duplicateRequest"));
        } else {
          Alert.alert(t("friends.errors.sendFailed"));
        }
      } finally {
        setSendingId(null);
      }
    },
    [linkedIds, onSendRequest, t]
  );

  const resetAndClose = () => {
    setQuery("");
    setDebounced("");
    setResults([]);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      onClose={resetAndClose}
      title={t("friends.addFriend")}
      padding={20}
      actions={{
        cancel: {
          label: t("common.actions.cancel"),
          onPress: resetAndClose,
          variant: "outline",
        },
      }}
    >
      <Input
        placeholder={t("friends.searchPlaceholder")}
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        autoCorrect={false}
        containerStyle={{ marginBottom: 12 }}
      />
      {searching ? (
        <View style={styles.loader}>
          <ActivityIndicator color={theme.primary} />
        </View>
      ) : debounced.length >= 3 && results.length === 0 ? (
        <Text variant="caption" colorName="textMuted" align="center">
          {t("friends.noResults")}
        </Text>
      ) : (
        <ScrollView style={styles.results} keyboardShouldPersistTaps="handled">
          {results.map((p) => {
            const linked = linkedIds.has(p.id);
            const showImage =
              typeof p.avatar_url === "string" &&
              (p.avatar_url.startsWith("http://") || p.avatar_url.startsWith("https://"));
            return (
              <View key={p.id} style={styles.resultRow}>
                <View style={styles.resultLeft}>
                  <View style={[styles.smallAvatar, { borderColor: theme.border }]}>
                    {showImage ? (
                      <Image source={{ uri: p.avatar_url! }} style={styles.smallAvatarImg} />
                    ) : (
                      <View
                        style={[
                          styles.smallAvatarFallback,
                          { backgroundColor: INITIALS_FALLBACK + "33" },
                        ]}
                      >
                        <Text variant="micro" style={{ color: INITIALS_FALLBACK, fontWeight: "700" }}>
                          {initialsFromUsername(p.username)}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text variant="body" numberOfLines={1} style={styles.resultName}>
                    {p.username}
                  </Text>
                </View>
                <Button
                  size="xs"
                  variant={linked ? "soft" : "primary"}
                  iconLeft={UserPlus}
                  title={linked ? t("friends.pendingSent") : t("friends.add")}
                  disabled={linked || sendingId === p.id}
                  loading={sendingId === p.id}
                  onPress={() => void handleSend(p)}
                />
              </View>
            );
          })}
        </ScrollView>
      )}

      {pendingSent.length > 0 ? (
        <View style={styles.pendingBlock}>
          <Text variant="caption" colorName="textMuted" style={styles.pendingTitle}>
            {t("friends.pendingSentSection")}
          </Text>
          {pendingSent.map((f) => (
            <View key={f.id} style={styles.pendingRow}>
              <Text variant="body" numberOfLines={1} style={{ flex: 1 }}>
                {f.other_user.username}
              </Text>
              <Text variant="micro" colorName="textMuted">
                {t("friends.pendingSent")}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </Modal>
  );
}

const createStyles = (theme: typeof Colors.light) =>
  StyleSheet.create({
    loader: { paddingVertical: 24, alignItems: "center" },
    results: { maxHeight: 220 },
    resultRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.divider,
    },
    resultLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 },
    resultName: { flex: 1, minWidth: 0 },
    smallAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      overflow: "hidden",
    },
    smallAvatarImg: { width: "100%", height: "100%" },
    smallAvatarFallback: { flex: 1, alignItems: "center", justifyContent: "center" },
    pendingBlock: { marginTop: 16, gap: 8 },
    pendingTitle: { fontWeight: "600" },
    pendingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  });
