import { Text } from "@/components/Themed";
import { Card } from "@/components/ui/Card";
import Colors from "@/constants/Colors";
import { formatFriendActivityEndedAgo } from "@/utils/friendActivityTime";
import { useTheme } from "@/utils/themeContext";
import { formatDurationCompact } from "@/utils/time";
import type { FriendActivityItem } from "@/utils/queries";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Image, StyleSheet, View } from "react-native";

const FALLBACK_SUBJECT_TINT = "#4AC9CC";

function initialsFromUsername(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return "?";
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return `${p[0][0] ?? ""}${p[1][0] ?? ""}`.toUpperCase();
}

type Props = {
  item: FriendActivityItem;
};

export function FriendActivityCard({ item }: Props) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const tint = item.subject_color || FALLBACK_SUBJECT_TINT;
  const when = formatFriendActivityEndedAgo(item.ended_at, t, i18n.language);
  const duration = formatDurationCompact(item.duration_seconds);
  const showImage =
    typeof item.friend_avatar_url === "string" &&
    (item.friend_avatar_url.startsWith("http://") ||
      item.friend_avatar_url.startsWith("https://"));

  return (
    <Card variant="border" style={styles.card}>
      <View style={styles.row}>
        <View style={[styles.avatarWrap, { borderColor: tint }]}>
          {showImage ? (
            <Image source={{ uri: item.friend_avatar_url! }} style={styles.avatarImg} />
          ) : (
            <View style={[styles.avatarFallback, { backgroundColor: tint + "33" }]}>
              <Text variant="caption" style={[styles.avatarInitials, { color: tint }]}>
                {initialsFromUsername(item.friend_username)}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.body}>
          <Text variant="bodyStrong" numberOfLines={1} style={styles.username}>
            {item.friend_username}
          </Text>
          <View style={styles.subjectRow}>
            <View style={[styles.subjectDot, { backgroundColor: tint }]} />
            <Text variant="body" numberOfLines={1} style={styles.subjectName}>
              {item.subject_name}
            </Text>
          </View>
          <Text variant="caption" colorName="textMuted" style={styles.meta}>
            {duration} · {when}
          </Text>
        </View>
      </View>
    </Card>
  );
}

const createStyles = (theme: typeof Colors.light) =>
  StyleSheet.create({
    card: { paddingVertical: 12, paddingHorizontal: 14 },
    row: { flexDirection: "row", alignItems: "center", gap: 12 },
    avatarWrap: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: StyleSheet.hairlineWidth,
      overflow: "hidden",
      alignItems: "center",
      justifyContent: "center",
    },
    avatarImg: { width: "100%", height: "100%" },
    avatarFallback: {
      width: "100%",
      height: "100%",
      alignItems: "center",
      justifyContent: "center",
    },
    avatarInitials: { fontWeight: "700" },
    body: { flex: 1, minWidth: 0, gap: 2 },
    username: { fontWeight: "700" },
    subjectRow: { flexDirection: "row", alignItems: "center", gap: 8, minWidth: 0 },
    subjectDot: { width: 8, height: 8, borderRadius: 4 },
    subjectName: { flex: 1, minWidth: 0 },
    meta: { marginTop: 2 },
  });
