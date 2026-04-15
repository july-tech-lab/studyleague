import { TabScreen } from "@/components/layout/TabScreen";
import { Text } from "@/components/Themed";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Tabs } from "@/components/ui/Tabs";
import Colors from "@/constants/Colors";
import { useGroups } from "@/hooks/useGroups";
import { useAuth } from "@/utils/authContext";
import { Group } from "@/utils/queries";
import { useTheme } from "@/utils/themeContext";
import { useRouter } from "expo-router";
import { Eye, EyeOff, Globe, Lock, Pencil, Plus, Search, Shield, Trash2, Trophy, UserPlus, Users } from "lucide-react-native";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Pressable,
  StyleSheet,
  Switch,
  View,
} from "react-native";

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
    updateGroup: updateGroupHook,
    deleteGroup: deleteGroupHook,
    leaveGroup: leaveGroupHook,
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
  const [updateLoading, setUpdateLoading] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [editGroupName, setEditGroupName] = useState("");
  const [editGroupDescription, setEditGroupDescription] = useState("");
  const [editGroupVisibility, setEditGroupVisibility] = useState<"public" | "private">("private");
  const [editRequiresApproval, setEditRequiresApproval] = useState(false);
  const [editGroupPassword, setEditGroupPassword] = useState("");
  const [editShowGroupPassword, setEditShowGroupPassword] = useState(false);
  const [groupTab, setGroupTab] = useState<"my" | "public">("my");

  const [editPasswordChanged, setEditPasswordChanged] = useState(false);
  const [removingGroupId, setRemovingGroupId] = useState<string | null>(null);
  const [removeGroupTarget, setRemoveGroupTarget] = useState<Group | null>(null);

  const openEditModal = (g: Group) => {
    setEditingGroup(g);
    setEditGroupName(g.name);
    setEditGroupDescription(g.description ?? "");
    setEditGroupVisibility(g.visibility);
    setEditRequiresApproval(g.requires_admin_approval);
    setEditGroupPassword("");
    setEditPasswordChanged(false);
    setEditShowGroupPassword(false);
  };

  const closeEditModal = () => {
    setEditingGroup(null);
    setEditGroupName("");
    setEditGroupDescription("");
    setEditGroupVisibility("private");
    setEditRequiresApproval(false);
    setEditGroupPassword("");
    setEditPasswordChanged(false);
    setEditShowGroupPassword(false);
  };

  const handleUpdateGroup = async () => {
    if (!editingGroup?.id || !editGroupName.trim()) {
      Alert.alert(t("groups.errors.nameRequired"));
      return;
    }

    setUpdateLoading(true);
    try {
      await updateGroupHook(editingGroup.id, {
        name: editGroupName.trim(),
        description: editGroupDescription.trim() || null,
        visibility: editGroupVisibility,
        requires_admin_approval: editRequiresApproval,
        ...(editPasswordChanged && { join_password: editGroupPassword.trim() || null }),
      });
      closeEditModal();
    } catch (error: any) {
      console.error("Error updating group:", error);
      const errorMessage = error?.message ?? t("groups.errors.unknown");
      Alert.alert(t("groups.edit.updateError"), errorMessage);
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert(t("groups.errors.nameRequired"));
      return;
    }

    if (!user?.id) {
      Alert.alert(t("groups.errors.create"), "User not authenticated");
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
      const errorMessage = error?.message || error?.error?.message || JSON.stringify(error) || t("groups.errors.unknown");
      Alert.alert(t("groups.errors.create"), errorMessage);
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
        Alert.alert(t("groups.errors.join"), error.message ?? t("groups.errors.unknown"));
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
      Alert.alert(t("groups.errors.search"), error.message ?? t("groups.errors.unknown"));
    } finally {
      setSearchingCode(false);
    }
  };

  const handleRemoveMyGroup = async (g: Group, isCreator: boolean) => {
    if (!user?.id) return;
    setRemovingGroupId(g.id);
    try {
      if (isCreator) {
        await deleteGroupHook(g.id);
      } else {
        await leaveGroupHook(g.id);
      }
      if (editingGroup?.id === g.id) {
        closeEditModal();
      }
      setRemoveGroupTarget(null);
    } catch (error: any) {
      console.error("Error removing group:", error);
      Alert.alert(
        isCreator ? t("groups.errors.delete") : t("groups.errors.leave"),
        error?.message ?? t("groups.errors.unknown")
      );
    } finally {
      setRemovingGroupId(null);
    }
  };

  const renderBadge = (visibility: Group["visibility"]) => {
    const isPublic = visibility === "public";
    const Icon = isPublic ? Globe : Lock;
    return (
      <View
        style={[
          styles.badge,
          {
            backgroundColor: isPublic ? theme.primaryTint : theme.surfaceElevated,
          },
        ]}
      >
        <Icon size={12} color={isPublic ? theme.primaryDark : theme.textMuted} />
        <Text
          variant="caption"
          style={[
            styles.badgeText,
            { color: isPublic ? theme.primaryDark : theme.textMuted },
          ]}
        >
          {isPublic ? t("groups.create.public") : t("groups.create.private")}
        </Text>
      </View>
    );
  };

  const renderGroupCard = (g: Group, showJoinButton: boolean) => {
    const isCreator = g.created_by === user?.id;
    const isRemoving = removingGroupId === g.id;
    return (
    <Card variant="border" style={styles.groupCard}>
      <View style={styles.groupCardContent}>
        <View style={styles.groupCardMain}>
          <View style={styles.groupCardHeader}>
            <Text variant="subtitle" style={styles.groupTitle} numberOfLines={1}>
              {g.name}
            </Text>
            <View style={styles.badgeRow}>
              {renderBadge(g.visibility)}
              {g.requires_admin_approval && (
                <Shield size={16} color={theme.textMuted} style={styles.shieldIcon} />
              )}
            </View>
          </View>
          {g.description ? (
            <Text variant="caption" colorName="textMuted" style={styles.groupDesc} numberOfLines={2}>
              {g.description}
            </Text>
          ) : null}
          <View style={styles.memberRow}>
            <Users size={14} color={theme.textMuted} />
            <Text variant="caption" colorName="textMuted" style={styles.memberCount}>
              {t("groups.membersCount", { count: g.member_count ?? 0 })}
            </Text>
          </View>
          <View style={styles.groupMetaRow}>
            <Text variant="micro" colorName="textMuted" style={styles.groupMeta}>
              {t("groups.code")}: {g.invite_code}
            </Text>
            {g.requires_admin_approval ? (
              <Text variant="micro" colorName="textMuted" style={styles.groupMeta}>
                {t("groups.adminApprovalRequired")}
              </Text>
            ) : null}
            {g.has_password ? (
              <Text variant="micro" colorName="textMuted" style={styles.groupMeta}>
                {t("groups.passwordRequired")}
              </Text>
            ) : null}
          </View>
        </View>
        <View style={styles.groupCardActions}>
          {showJoinButton ? (
            <Button
              iconLeft={UserPlus}
              title={t("groups.joinGroup")}
              variant="primary"
              onPress={() => setSelectedGroup(g)}
              size="sm"
              style={styles.joinButton}
            />
          ) : (
            <View style={styles.groupCardActionRow}>
              {isCreator ? (
                <Button
                  iconLeft={Pencil}
                  iconOnly
                  variant="ghost"
                  size="xs"
                  onPress={() => openEditModal(g)}
                  accessibilityLabel={t("groups.edit.title")}
                  disabled={isRemoving}
                  style={[styles.iconButton, { backgroundColor: theme.primaryTint }]}
                />
              ) : null}
              <Button
                iconLeft={Trash2}
                iconOnly
                variant="ghost"
                size="xs"
                onPress={() => setRemoveGroupTarget(g)}
                accessibilityLabel={
                  isCreator ? t("groups.delete.accessibility") : t("groups.leave.accessibility")
                }
                loading={isRemoving}
                disabled={isRemoving}
                style={[styles.iconButton, { backgroundColor: theme.primaryTint }]}
              />
            </View>
          )}
        </View>
      </View>
    </Card>
  );
};

  return (
    <TabScreen
      title={t("groups.title", "Groupes")}
      rightAction={
        <View style={styles.headerActions}>
          <Button
            iconLeft={Trophy}
            iconOnly
            variant="secondary"
            size="lg"
            onPress={() => router.push("/(tabs)/leaderboard")}
            accessibilityLabel={t("tabs.leaderboard")}
            style={styles.headerIconButton}
          />
          <Button
            iconLeft={Plus}
            iconOnly
            variant="primary"
            size="lg"
            onPress={() => setModalVisible(true)}
            accessibilityLabel={t("groups.create.title", "Create group")}
            style={styles.headerIconButton}
          />
        </View>
      }
    >
        <View style={{ gap: 12 }}>
          <View style={styles.searchRow}>
            <Input
              placeholder={t("groups.searchPlaceholder", "Search...")}
              value={searchCode}
              onChangeText={setSearchCode}
              leftIcon={Search}
              containerStyle={{ flex: 1 }}
              onSubmitEditing={handleSearchGroupByCode}
            />
            <Button
              title={searchingCode ? "..." : t("common.actions.search")}
              variant="primary"
              onPress={handleSearchGroupByCode}
              disabled={searchingCode || !searchCode.trim()}
              loading={searchingCode}
              size="sm"
            />
          </View>

          <Tabs
            options={[
              { value: "my", label: `${t("groups.myGroups")} (${groups.length})` },
              { value: "public", label: `${t("groups.publicGroups")} (${publicGroups.length})` },
            ]}
            value={groupTab}
            onChange={(v) => setGroupTab(v as "my" | "public")}
          />

          {groupTab === "my" ? (
            groups.length === 0 ? (
              <Text variant="body" align="center" colorName="textMuted" style={styles.emptyText}>
                {t("groups.noGroupsYet")}
              </Text>
            ) : (
              <View style={styles.groupCardsContainer}>
                {groups.map((g) => <View key={g.id}>{renderGroupCard(g, false)}</View>)}
              </View>
            )
          ) : (
            <>
              {publicGroups.length === 0 ? (
                <Text variant="body" align="center" colorName="textMuted" style={styles.emptyText}>
                  {t("groups.noPublicGroups", "Aucun groupe public disponible")}
                </Text>
              ) : (
                <View style={styles.groupCardsContainer}>
                  {filteredPublicGroups.map((g) => <View key={g.id}>{renderGroupCard(g, true)}</View>)}
                </View>
              )}
            </>
          )}
        </View>

      <Modal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title={t("groups.create.title", "Créer un groupe")}
        padding={20}
        actions={{
          cancel: {
            label: t("common.actions.cancel"),
            onPress: () => setModalVisible(false),
            variant: "outline",
          },
          confirm: {
            label: createLoading ? t("groups.create.creating") : t("common.actions.create"),
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
        visible={!!editingGroup}
        onClose={closeEditModal}
        title={t("groups.edit.title")}
        padding={20}
        actions={{
          cancel: {
            label: t("common.actions.cancel"),
            onPress: closeEditModal,
            variant: "outline",
          },
          confirm: {
            label: updateLoading ? t("common.status.saving") : t("common.actions.save"),
            onPress: handleUpdateGroup,
            variant: "primary",
            disabled: updateLoading,
            loading: updateLoading,
          },
        }}
      >
        <Input
          placeholder={t("groups.create.namePlaceholder")}
          value={editGroupName}
          onChangeText={setEditGroupName}
          containerStyle={{ marginBottom: 16 }}
        />

        <Input
          placeholder={t("groups.create.descriptionPlaceholder")}
          value={editGroupDescription}
          onChangeText={setEditGroupDescription}
          containerStyle={{ marginBottom: 10 }}
        />

        <Input
          placeholder={t("groups.edit.passwordPlaceholder")}
          value={editGroupPassword}
          secureTextEntry={!editShowGroupPassword}
          rightIcon={editShowGroupPassword ? EyeOff : Eye}
          onRightIconPress={() => setEditShowGroupPassword((v) => !v)}
          onChangeText={(text) => {
            setEditGroupPassword(text);
            setEditPasswordChanged(true);
          }}
          containerStyle={{ marginBottom: 10 }}
        />

        <View style={[styles.toggleRow, { marginBottom: 10 }]}>
          <Text variant="bodyStrong">{t("groups.create.visibility")}</Text>
          <View style={styles.toggleChips}>
            {(["private", "public"] as const).map((value) => (
              <Pressable
                key={value}
                onPress={() => setEditGroupVisibility(value)}
                style={[
                  styles.chip,
                  {
                    borderColor:
                      editGroupVisibility === value ? theme.primaryDark : theme.divider,
                    backgroundColor:
                      editGroupVisibility === value
                        ? theme.primaryDark + "22"
                        : theme.surface,
                  },
                ]}
              >
                <Text
                  variant="subtitle"
                  style={{
                    color: editGroupVisibility === value ? theme.primaryDark : theme.text,
                    fontWeight: "600",
                  }}
                >
                  {value === "public" ? t("groups.create.public") : t("groups.create.private")}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.toggleRow}>
          <Text variant="bodyStrong">{t("groups.create.adminApproval")}</Text>
          <Switch
            value={editRequiresApproval}
            onValueChange={setEditRequiresApproval}
            trackColor={{ false: theme.divider, true: theme.primary }}
            thumbColor={editRequiresApproval ? theme.primaryDark : "#f4f3f4"}
          />
        </View>
      </Modal>

      <Modal
        visible={!!removeGroupTarget}
        dismissible={removingGroupId !== removeGroupTarget?.id}
        onClose={() => {
          if (removingGroupId === removeGroupTarget?.id) return;
          setRemoveGroupTarget(null);
        }}
        title={
          removeGroupTarget?.created_by === user?.id
            ? t("groups.delete.confirmTitle")
            : t("groups.leave.confirmTitle")
        }
        padding={20}
        actions={{
          cancel: {
            label: t("common.actions.cancel"),
            onPress: () => setRemoveGroupTarget(null),
            variant: "outline",
            disabled: removingGroupId === removeGroupTarget?.id,
          },
          confirm: {
            label:
              removeGroupTarget?.created_by === user?.id
                ? t("groups.delete.confirm")
                : t("groups.leave.confirm"),
            onPress: () => {
              if (!removeGroupTarget || !user?.id) return;
              const isCreator = removeGroupTarget.created_by === user.id;
              void handleRemoveMyGroup(removeGroupTarget, isCreator);
            },
            variant:
              removeGroupTarget?.created_by === user?.id ? "destructive" : "primary",
            loading: removingGroupId === removeGroupTarget?.id,
            disabled: removingGroupId === removeGroupTarget?.id,
          },
        }}
      >
        <Text variant="body" colorName="textMuted" style={{ marginTop: 4 }}>
          {removeGroupTarget?.created_by === user?.id
            ? t("groups.delete.confirmMessage")
            : t("groups.leave.confirmMessage")}
        </Text>
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
            label: t("common.actions.cancel"),
            onPress: () => {
              setSelectedGroup(null);
              setJoinPassword("");
            },
            variant: "outline",
          },
          confirm: {
            label: joinLoading ? t("groups.joinModal.joining") : t("common.actions.join"),
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
    groupCard: {},
    groupCardsContainer: { gap: 10 },
    groupCardContent: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    groupCardMain: { flex: 1, minWidth: 0 },
    groupCardHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      marginBottom: 4,
    },
    groupTitle: { fontWeight: "700", flex: 1 },
    badgeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    badge: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 12,
      paddingHorizontal: 8,
      paddingVertical: 4,
      gap: 4,
    },
    badgeText: { fontWeight: "600" },
    shieldIcon: { marginLeft: 2 },
    groupDesc: { marginBottom: 6 },
    memberRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    memberCount: {},
    groupMetaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
    groupMeta: {},
    groupCardActions: { alignSelf: "flex-start" },
    groupCardActionRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    iconButton: { borderRadius: 12 },
    joinButton: {},
    headerActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    headerIconButton: {
      width: 56,
      height: 56,
      borderRadius: 28,
      minWidth: 56,
      minHeight: 56,
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
    searchRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  });
