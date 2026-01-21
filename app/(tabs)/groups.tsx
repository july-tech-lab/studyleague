import { TabScreen } from "@/components/layout/TabScreen";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import Colors from "@/constants/Colors";
import { useAuth } from "@/utils/authContext";
import { useTheme } from "@/utils/themeContext";
import { useRouter } from "expo-router";
import { Eye, EyeOff, Plus, Trophy, Users } from "lucide-react-native";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Pressable,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import { Text } from "@/components/Themed";
import { useGroups } from "@/hooks/useGroups";
import { Group } from "@/utils/queries";

export default function GroupsScreen() {
  const { user } = useAuth();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { t } = useTranslation();
  const router = useRouter();

  const {
    groups,
    publicGroups,
    createGroup: createGroupHook,
    joinGroup: joinGroupHook,
    searchGroupByCode: searchGroupByCodeHook,
  } = useGroups({
    userId: user?.id ?? null,
    autoLoad: true,
  });

  const [modalVisible, setModalVisible] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [groupVisibility, setGroupVisibility] = useState<"public" | "private">(
    "private"
  );
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [groupPassword, setGroupPassword] = useState("");
  const [showGroupPassword, setShowGroupPassword] = useState(false);
  const [searchCode, setSearchCode] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [joinPassword, setJoinPassword] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);
  const [searchingCode, setSearchingCode] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert(t("groups.errors.nameRequired"));
      return;
    }

    if (!user?.id) {
      Alert.alert(t("groups.errors.createError"), "User not authenticated");
      return;
    }

    setCreateLoading(true);
    try {
      await createGroupHook({
        name: groupName.trim(),
        description: groupDescription.trim() || null,
        visibility: groupVisibility,
        requires_admin_approval: requiresApproval,
        join_password: groupPassword.trim() || null,
      });
      setModalVisible(false);
      setGroupName("");
      setGroupDescription("");
      setGroupVisibility("private");
      setRequiresApproval(false);
      setGroupPassword("");
      setShowGroupPassword(false);
    } catch (error: any) {
      console.error("Error creating group:", error);
      console.error("Error details:", JSON.stringify(error, null, 2));
      const errorMessage = error?.message || error?.error?.message || JSON.stringify(error) || t("groups.errors.unknownError");
      Alert.alert(t("groups.errors.createError"), errorMessage);
    } finally {
      setCreateLoading(false);
    }
  };

  const handleJoinGroup = async (group: Group, password?: string) => {
    setJoinLoading(true);
    try {
      const status = await joinGroupHook(group, password ?? null);
      
      if (status === "pending") {
        Alert.alert(
          t("groups.success.requestSent"),
          t("groups.success.approvalNeeded")
        );
      }

      setSelectedGroup(null);
      setJoinPassword("");
    } catch (error: any) {
      if (error.message?.includes("ALREADY_MEMBER")) {
        Alert.alert(t("groups.errors.alreadyMember"));
      } else if (error.message?.includes("INVALID_PASSWORD")) {
        Alert.alert(t("groups.errors.invalidPassword"));
      } else if (error.message?.includes("GROUP_NOT_PUBLIC")) {
        Alert.alert(t("groups.errors.notPublic"));
      } else {
        Alert.alert(t("groups.errors.joinError"), error.message ?? t("groups.errors.unknownError"));
      }
    } finally {
      setJoinLoading(false);
    }
  };

  const filteredPublicGroups = useMemo(() => {
    const term = searchCode.trim().toLowerCase();
    if (!term) return publicGroups;
    return publicGroups.filter(
      (g) =>
        g.name.toLowerCase().includes(term) ||
        g.invite_code.toLowerCase().includes(term)
    );
  }, [publicGroups, searchCode]);

  const handleSearchGroupByCode = async () => {
    const code = searchCode.trim();
    if (!code) return;
    setSearchingCode(true);
    try {
      const found = await searchGroupByCodeHook(code);
      if (!found) {
        Alert.alert(t("groups.errors.notFound"));
      } else if (found.visibility !== "public") {
        Alert.alert(t("groups.errors.notPublic"));
      } else {
        setSearchCode(found.invite_code);
      }
    } catch (error: any) {
      Alert.alert(t("groups.errors.searchError"), error.message ?? t("groups.errors.unknownError"));
    } finally {
      setSearchingCode(false);
    }
  };

  const renderBadge = (visibility: Group["visibility"]) => (
    <View
      style={[
        styles.badge,
        {
          borderColor: visibility === "public" ? theme.primaryDark : theme.textMuted,
        },
      ]}
    >
      <Text
        variant="caption"
        style={[
          styles.badgeText,
          { color: visibility === "public" ? theme.primaryDark : theme.textMuted },
        ]}
      >
        {visibility === "public" ? t("groups.create.public") : t("groups.create.private")}
      </Text>
    </View>
  );

  return (
    <TabScreen
      title={t("groups.title", "Groupes")}
      rightIcon={{
        icon: Trophy,
        onPress: () => router.push("/(tabs)/leaderboard"),
      }}
    >
        <Text variant="h2" style={{ marginTop: 12, marginBottom: 12 }}>
          {t("groups.myGroups")}
        </Text>
        {groups.length === 0 ? (
          <Text variant="body" align="center" colorName="textMuted" style={styles.emptyText}>
            {t("groups.noGroupsYet")}
          </Text>
        ) : (
          groups.map((g) => (
            <Pressable key={g.id}>
              <Card variant="border" style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Users size={22} color={theme.primary} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text variant="subtitle" style={styles.groupTitle}>{g.name}</Text>
                  {renderBadge(g.visibility)}
                </View>
                {g.description ? (
                  <Text variant="micro" colorName="textMuted" style={styles.groupDesc}>
                    {g.description}
                  </Text>
                ) : null}
              </View>
              </Card>
            </Pressable>
          ))
        )}

        <Text variant="h2" style={{ marginTop: 24, marginBottom: 12 }}>
          {t("groups.publicGroups")}
        </Text>
        <View style={styles.searchRow}>
          <Input
            placeholder={t("groups.searchPlaceholder", "Code ou nom du groupe")}
            value={searchCode}
            onChangeText={setSearchCode}
            containerStyle={{ flex: 1 }}
          />
          <Button
            title={searchingCode ? "..." : t("groups.search", "Chercher")}
            variant="primary"
            onPress={handleSearchGroupByCode}
            disabled={searchingCode}
            loading={searchingCode}
            size="sm"
          />
        </View>
        {publicGroups.length === 0 ? (
          <Text variant="body" align="center" colorName="textMuted" style={styles.emptyText}>
            {t("groups.noPublicGroups", "Aucun groupe public disponible")}
          </Text>
        ) : (
          filteredPublicGroups.map((g) => (
            <Card key={g.id} variant="border" style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Users size={22} color={theme.primary} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text variant="subtitle" style={styles.groupTitle}>{g.name}</Text>
                  {renderBadge(g.visibility)}
                </View>
                {g.description ? (
                  <Text variant="micro" colorName="textMuted" style={styles.groupDesc}>
                    {g.description}
                  </Text>
                ) : null}
                <Text variant="caption" colorName="textMuted" style={styles.groupMeta}>
                  {t("groups.code", "Code")}: {g.invite_code}
                </Text>
                {g.requires_admin_approval ? (
                  <Text variant="caption" colorName="textMuted" style={styles.groupMeta}>
                    {t("groups.adminApprovalRequired", "Approbation admin requise")}
                  </Text>
                ) : null}
                {g.has_password ? (
                  <Text variant="caption" colorName="textMuted" style={styles.groupMeta}>
                    {t("groups.passwordRequired", "Mot de passe requis")}
                  </Text>
                ) : null}
              </View>
              <Button
                title={t("groups.join", "Rejoindre")}
                variant="outline"
                onPress={() => setSelectedGroup(g)}
                size="sm"
              />
            </Card>
          ))
        )}

      <Button
        iconLeft={Plus}
        iconOnly
        variant="primary"
        onPress={() => setModalVisible(true)}
        style={styles.addButton}
      />

      <Modal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title={t("groups.create.title", "Créer un groupe")}
        padding={20}
        actions={{
          cancel: {
            label: t("common.cancel"),
            onPress: () => setModalVisible(false),
            variant: "outline",
          },
          confirm: {
            label: createLoading ? t("groups.create.creating") : t("common.create"),
            onPress: handleCreateGroup,
            variant: "primary",
            iconLeft: Plus,
            disabled: createLoading,
            loading: createLoading,
          },
        }}
      >
        <Input
          placeholder={t("groups.create.namePlaceholder", "Nom du groupe")}
          value={groupName}
          onChangeText={setGroupName}
          containerStyle={{ marginBottom: 16 }}
        />

        <Input
          placeholder={t("groups.create.descriptionPlaceholder", "Description (optionnel)")}
          value={groupDescription}
          onChangeText={setGroupDescription}
          containerStyle={{ marginBottom: 10 }}
        />

        <Text variant="caption" colorName="textMuted" style={{ marginBottom: 10 }}>
          {t("groups.create.inviteCodeInfo", "Le code d'invitation sera généré automatiquement.")}
        </Text>

        <Input
          placeholder={t("groups.create.passwordPlaceholder", "Mot de passe du groupe (optionnel)")}
          value={groupPassword}
          secureTextEntry={!showGroupPassword}
          rightIcon={showGroupPassword ? EyeOff : Eye}
          onRightIconPress={() => setShowGroupPassword((v) => !v)}
          onChangeText={setGroupPassword}
          containerStyle={{ marginBottom: 10 }}
        />

        <View style={[styles.toggleRow, { marginBottom: 10 }]}>
          <Text variant="bodyStrong">{t("groups.create.visibility", "Visibilité")}</Text>
          <View style={styles.toggleChips}>
            {(["private", "public"] as const).map((value) => (
              <Pressable
                key={value}
                onPress={() => setGroupVisibility(value)}
                style={[
                  styles.chip,
                  {
                    borderColor:
                      groupVisibility === value ? theme.primaryDark : theme.divider,
                    backgroundColor:
                      groupVisibility === value
                        ? theme.primaryDark + "22"
                        : theme.surface,
                  },
                ]}
              >
                <Text
                  variant="subtitle"
                  style={{
                    color: groupVisibility === value ? theme.primaryDark : theme.text,
                    fontWeight: "600",
                  }}
                >
                  {value === "public" ? t("groups.create.public", "Public") : t("groups.create.private", "Privé")}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.toggleRow}>
          <Text variant="bodyStrong">{t("groups.create.adminApproval", "Approbation admin requise")}</Text>
          <Switch
            value={requiresApproval}
            onValueChange={setRequiresApproval}
            trackColor={{ false: theme.divider, true: theme.primary }}
            thumbColor={requiresApproval ? theme.primaryDark : "#f4f3f4"}
          />
        </View>
      </Modal>

      <Modal
        visible={!!selectedGroup}
        onClose={() => {
          setSelectedGroup(null);
          setJoinPassword("");
        }}
        title={t("groups.joinModal.title", { name: selectedGroup?.name })}
        padding={20}
        actions={{
          cancel: {
            label: t("common.cancel"),
            onPress: () => {
              setSelectedGroup(null);
              setJoinPassword("");
            },
            variant: "outline",
          },
          confirm: {
            label: joinLoading ? t("groups.joinModal.joining") : t("groups.join"),
            onPress: () => selectedGroup && handleJoinGroup(selectedGroup, joinPassword),
            variant: "primary",
            disabled: joinLoading,
            loading: joinLoading,
          },
        }}
      >
        <Text variant="caption" colorName="textMuted" style={styles.groupMeta}>
          {t("groups.code")}: {selectedGroup?.invite_code}
        </Text>
        {selectedGroup?.requires_admin_approval ? (
          <Text variant="caption" colorName="textMuted" style={styles.groupMeta}>
            {t("groups.joinModal.adminWillApprove")}
          </Text>
        ) : null}

        {selectedGroup?.has_password ? (
          <Input
            placeholder={t("groups.joinModal.passwordPlaceholder")}
            value={joinPassword}
            secureTextEntry
            onChangeText={setJoinPassword}
          />
        ) : (
          <Text variant="caption" colorName="textMuted" style={styles.groupMeta}>
            {t("groups.joinModal.noPasswordRequired")}
          </Text>
        )}
      </Modal>
    </TabScreen>
  );
}

const createStyles = (theme: typeof Colors.light) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    emptyText: { marginTop: 40 },
    // NOTE: groupCard style removed - now using Card component
    groupTitle: { fontWeight: "700" },
    groupDesc: {},
    badge: {
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    badgeText: { fontWeight: "600" },
    addButton: {
      position: "absolute",
      bottom: 26,
      right: 22,
      width: 60,
      height: 60,
      borderRadius: 30,
    },
    // NOTE: Modal styles removed - now using Modal component from components/ui
    toggleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    toggleChips: {
      flexDirection: "row",
      gap: 8,
    },
    chip: {
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    groupMeta: {},
    // NOTE: primaryButton and outlineButton styles removed - now using Button component
    searchRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  });
