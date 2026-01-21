import { TabScreen } from "@/components/layout/TabScreen";
import { Text } from "@/components/Themed";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ListCard, ListItem } from "@/components/ui/ListCard";
import { Modal } from "@/components/ui/Modal";
import { SubjectPicker } from "@/components/ui/SubjectPicker";
import { Tabs } from "@/components/ui/Tabs";
import Colors from "@/constants/Colors";
import { useProfile } from "@/hooks/useProfile";
import { changeLanguage } from "@/i18n";
import { useAuth } from "@/utils/authContext";
import { createSubjectColorMap } from "@/utils/color";
import {
  attachSubjectToUser,
  buildSubjectTree,
  createAndAttachSubject,
  deleteSubject,
  hideUserSubject,
  permanentlyDeleteSubject,
  Subject,
  updateUserProfile,
  updateUserSubjectCustomization,
} from "@/utils/queries";
import { useTheme, useThemePreference } from "@/utils/themeContext";
import { formatDuration } from "@/utils/time";
import { useRouter } from "expo-router";
import { Clock, Flame, LogOut, Palette, Plus, Save, Search, Star, Target, Trash, Trophy } from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  TouchableOpacity,
  View
} from "react-native";




// Types
interface StatItem {
  icon: any;
  label: string;
  value: string;
  sublabel?: string;
}

export default function ProfileScreen() {
  const { colorScheme, setPreference } = useThemePreference();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { user, signOut, deleteAccount, isLoading } = useAuth();
  const router = useRouter();
  const { t, i18n } = useTranslation();

  // Use profile hook for data fetching
  const {
    profile,
    subjects,
    allSubjects,
    subjectTotals,
    sessionTotals,
    leaderboardRank: rankLabel,
    loading,
    error: profileError,
    refetch: refetchProfile,
  } = useProfile({
    userId: user?.id ?? null,
    autoLoad: true,
  });

  // Initialize display name input when profile loads
  useEffect(() => {
    if (profile?.username) {
      setDisplayNameInput(profile.username);
    }
  }, [profile?.username]);

  // Sync preferences from database to AsyncStorage when profile loads
  // Note: We only depend on the specific preference fields, not the entire profile object
  // to avoid unnecessary re-runs when other profile fields change
  const themePref = profile?.theme_preference;
  const langPref = profile?.language_preference;
  useEffect(() => {
    if (!profile) return;

    // Sync theme preference
    if (themePref === "light" || themePref === "dark") {
      setPreference(themePref);
    } else {
      // Default to "light" if null
      setPreference("light");
    }

    // Sync language preference
    if (langPref === "en" || langPref === "fr") {
      changeLanguage(langPref);
    }
    // If null, i18n will use device locale (already handled by languageDetector)
  }, [profile, themePref, langPref, setPreference]);

  // UI state
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [selectedParentSubjectId, setSelectedParentSubjectId] = useState<string | null>(null);
  const [savingSubject, setSavingSubject] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmModalVisible, setDeleteConfirmModalVisible] = useState(false);
  const [subjectToDelete, setSubjectToDelete] = useState<Subject | null>(null);
  const [accountActionLoading, setAccountActionLoading] = useState<"signout" | "delete" | null>(null);
  const [activeTab, setActiveTab] = useState<"stats" | "subjects" | "settings">("stats");
  const [colorPickerVisible, setColorPickerVisible] = useState(false);
  const [subjectForColor, setSubjectForColor] = useState<Subject | null>(null);
  const [updatingColor, setUpdatingColor] = useState(false);
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [savingDisplayName, setSavingDisplayName] = useState(false);
  const [displayNameMessage, setDisplayNameMessage] = useState<string | null>(null);
  const [displayNameError, setDisplayNameError] = useState<string | null>(null);
  
  const handleLanguageChange = async (lng: "en" | "fr") => {
    if (!user?.id) return;
    try {
      // Update language in i18n
      await changeLanguage(lng);
      // Save to database
      await updateUserProfile(user.id, { language_preference: lng });
      // Refetch profile to get updated data
      await refetchProfile();
    } catch (err: any) {
      console.error("Error updating language preference", err);
      // Still update language even if database save fails
      await changeLanguage(lng);
    }
  };

  const handleThemeChange = async (mode: "light" | "dark") => {
    if (!user?.id) return;
    try {
      // Update theme preference
      setPreference(mode);
      // Save to database
      await updateUserProfile(user.id, { theme_preference: mode });
      // Refetch profile to get updated data
      await refetchProfile();
    } catch (err: any) {
      console.error("Error updating theme preference", err);
      // Still update theme even if database save fails
      setPreference(mode);
    }
  };

  // Combine profile error with local error state for display
  const error = profileError ? profileError.message : null;

  const stats: StatItem[] = useMemo(
    () => [
      {
        icon: Clock,
        label: t("profile.stats.totalTime"),
        value: formatDuration(sessionTotals.monthSeconds),
        sublabel: t("profile.stats.thisMonth"),
      },
      {
        icon: Flame,
        label: t("profile.stats.streak"),
        value:
          profile?.current_streak !== undefined
            ? t("profile.stats.streakValue", { count: profile.current_streak })
            : "--",
        sublabel:
          profile?.longest_streak !== undefined
            ? t("profile.stats.streakRecord", { count: profile.longest_streak })
            : undefined,
      },
      {
        icon: Target,
        label: t("profile.stats.sessions"),
        value: sessionTotals.count ? `${sessionTotals.count}` : "--",
        sublabel: t("profile.stats.sessionsCompleted"),
      },
      { icon: Trophy, label: t("profile.stats.rank"), value: rankLabel ?? "--" },
      {
        icon: Star,
        label: t("profile.stats.average"),
        value: formatDuration(sessionTotals.avgSeconds),
        sublabel: t("profile.stats.perSession"),
      },
    ],
    [profile, rankLabel, sessionTotals, t]
  );

  const handleCreateSubject = async () => {
    if (!user?.id) return;
    const trimmed = newSubjectName.trim();
    if (!trimmed) return;
    setSavingSubject(true);
    setAddError(null);
    try {
      await createAndAttachSubject(user.id, trimmed, selectedParentSubjectId);
      // Refetch profile to get updated data
      await refetchProfile();
      setNewSubjectName("");
      setSelectedParentSubjectId(null);
      setAddModalVisible(false);
    } catch (err: any) {
      setAddError(err?.message ?? t("profile.subjects.addError", "Impossible d'ajouter la matière"));
    } finally {
      setSavingSubject(false);
    }
  };

  const handleSaveDisplayName = async () => {
    const trimmed = displayNameInput.trim();
    setDisplayNameMessage(null);
    setDisplayNameError(null);
    if (trimmed.length < 3) {
      setDisplayNameError(t("profile.displayName.error", "Name must be at least 3 characters."));
      return;
    }
    if (!user?.id) {
      setDisplayNameError(t("onboarding.userMissing", "User session missing. Please sign in again."));
      return;
    }
    setSavingDisplayName(true);
    try {
      // Update profile in database
      await updateUserProfile(user.id, { username: trimmed });
      // Refetch profile to get updated data
      await refetchProfile();
      setDisplayNameMessage(t("profile.displayName.success", "Display name updated."));
    } catch (err: any) {
      setDisplayNameError(err?.message ?? t("profile.displayName.errorSave", "Unable to update name."));
    } finally {
      setSavingDisplayName(false);
    }
  };

  const handleRemoveSubject = async (subject: Subject) => {
    if (!user?.id) return;
    setDeletingId(subject.id);
    try {
      await hideUserSubject(user.id, subject.id);
      // Refetch profile to get updated data
      await refetchProfile();
    } catch (err: any) {
      Alert.alert(
        t("profile.subjects.deleteErrorTitle", "Impossible de retirer"),
        err?.message ?? t("profile.subjects.deleteError", "Réessayez plus tard.")
      );
    } finally {
      setDeletingId(null);
    }
  };

  const confirmDeleteSubject = (subject: Subject) => {
    if (!user?.id) {
      console.warn("Cannot delete subject: user not available");
      return;
    }
    setSubjectToDelete(subject);
    setDeleteConfirmModalVisible(true);
  };

  const handleConfirmDelete = () => {
    if (subjectToDelete) {
      handleRemoveSubject(subjectToDelete);
      setDeleteConfirmModalVisible(false);
      setSubjectToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setDeleteConfirmModalVisible(false);
    setSubjectToDelete(null);
  };

  const handleOpenColorPicker = (subject: Subject) => {
    setSubjectForColor(subject);
    setColorPickerVisible(true);
  };

  const handleUpdateColor = async (color: string | null) => {
    if (!user?.id || !subjectForColor) return;
    setUpdatingColor(true);
    try {
      await updateUserSubjectCustomization(user.id, subjectForColor.id, {
        custom_color: color,
      });
      await refetchProfile();
      setColorPickerVisible(false);
      setSubjectForColor(null);
    } catch (err: any) {
      Alert.alert(
        t("timer.errorTitle", "Erreur"),
        err?.message ?? t("timer.errorSave", "Impossible de sauvegarder.")
      );
    } finally {
      setUpdatingColor(false);
    }
  };

  const availableSubjects = useMemo(() => {
    const visibleIds = new Set(subjects.map(s => s.id));
    return allSubjects.filter(s => !visibleIds.has(s.id));
  }, [allSubjects, subjects]);

  // Filter available subjects based on search query
  const filteredSubjects = useMemo(() => {
    if (!newSubjectName.trim()) {
      return availableSubjects;
    }
    const query = newSubjectName.trim().toLowerCase();
    return availableSubjects.filter(subject =>
      subject.name.toLowerCase().includes(query)
    );
  }, [availableSubjects, newSubjectName]);

  // Check if there's an exact match
  const exactMatch = useMemo(() => {
    if (!newSubjectName.trim()) return null;
    const query = newSubjectName.trim().toLowerCase();
    return filteredSubjects.find(subject =>
      subject.name.toLowerCase() === query
    ) || null;
  }, [filteredSubjects, newSubjectName]);

  // Build hierarchical subject tree (includes both parents and children)
  const subjectTree = useMemo(
    () => buildSubjectTree(subjects),
    [subjects]
  );

  // Create color map for subjects using shared utility with tree structure
  // Use allSubjects to ensure we have colors for all subjects (including those in subjectTotals)
  const subjectColorById = useMemo(() => {
    const allSubjectsTree = buildSubjectTree(allSubjects);
    return createSubjectColorMap(
      allSubjectsTree,
      theme.subjectPalette ?? [],
      theme.primary
    );
  }, [allSubjects, theme.subjectPalette, theme.primary]);

  const handleAddExistingSubject = async (subject: Subject) => {
    if (!user?.id) return;
    setSavingSubject(true);
    setAddError(null);
    try {
      await attachSubjectToUser(user.id, subject.id);
      // Refetch profile to get updated data
      await refetchProfile();
      // Close modal after successful addition
      setAddModalVisible(false);
    } catch (err: any) {
      setAddError(err?.message ?? t("profile.subjects.addError", "Impossible d'ajouter la matière"));
    } finally {
      setSavingSubject(false);
    }
  };

  const handleDeleteOwnedSubject = (subject: Subject) => {
    if (!user?.id || subject.owner_id !== user.id) return;
    Alert.alert(
      t("profile.subjects.deleteTitle", "Retirer la matière ?"),
      t("profile.subjects.deleteMessage", "Cette matière sera retirée de votre profil."),
      [
        { text: t("common.cancel", "Annuler"), style: "cancel" },
        {
          text: t("common.delete", "Supprimer"),
          style: "destructive",
          onPress: async () => {
            setDeletingId(subject.id);
            try {
              // Try to permanently delete (hard delete) if no study time recorded
              // Falls back to soft delete if there's study time
              try {
                await permanentlyDeleteSubject(subject.id, user.id);
              } catch (err: any) {
                // If hard delete fails due to study sessions, use soft delete instead
                if (err?.message?.includes("study time")) {
                  await deleteSubject(subject.id);
                } else {
                  throw err;
                }
              }
              // Refetch profile to get updated data
              await refetchProfile();
            } catch (err: any) {
              Alert.alert(
                t("profile.subjects.deleteErrorTitle", "Impossible de retirer"),
                err?.message ?? t("profile.subjects.deleteError", "Réessayez plus tard.")
              );
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  const handleSignOut = async () => {
    setAccountActionLoading("signout");
    try {
      await signOut();
      router.replace("/(auth)/signin");
    } finally {
      setAccountActionLoading(null);
    }
  };

  const handleDeleteAccount = () => {
    if (!user?.id) return;
    Alert.alert(
      t("profile.account.deleteTitle", "Delete account?"),
      t("profile.account.deleteMessage", "This will remove your data permanently."),
      [
        { text: t("common.cancel", "Annuler"), style: "cancel" },
        {
          text: t("profile.account.deleteConfirm", "Delete"),
          style: "destructive",
          onPress: async () => {
            setAccountActionLoading("delete");
            try {
              await deleteAccount();
              router.replace("/(auth)/signin");
            } catch (err: any) {
              Alert.alert(
                t("profile.account.deleteErrorTitle", "Unable to delete account"),
                err?.message ?? t("profile.account.deleteError", "Please try again.")
              );
            } finally {
              setAccountActionLoading(null);
            }
          },
        },
      ]
    );
  };

  return (
    <TabScreen
      title={profile?.username ?? t("profile.defaultTitle")}
      rightIcon={{
        icon: LogOut,
        onPress: handleSignOut,
        accessibilityLabel: t("profile.account.signOut", "Sign out"),
        disabled: accountActionLoading === "signout" || isLoading,
      }}
    >
        <Tabs
          options={[
            { value: "stats", label: t("profile.tabs.stats", "Stats") },
            { value: "subjects", label: t("profile.tabs.subjects", "Subjects") },
            { value: "settings", label: t("profile.tabs.settings", "Settings") },
          ]}
          value={activeTab}
          onChange={setActiveTab}
        />

        {activeTab === "settings" && (
          <>
            <View style={styles.sectionBlock}>
              <Text variant="h2" style={{ marginTop: 12, marginBottom: 12 }}>
                {t("profile.displayName.title", "Display name")}
              </Text>
              <View style={styles.displayNameRow}>
                <Input
                  value={displayNameInput}
                  onChangeText={setDisplayNameInput}
                  placeholder={t("profile.displayName.placeholder", "Your name")}
                  autoCapitalize="words"
                  error={displayNameError || undefined}
                  containerStyle={{ flex: 1 }}
                />
                <Button
                  iconLeft={Save}
                  iconOnly
                  variant="primary"
                  size="sm"
                  onPress={handleSaveDisplayName}
                  disabled={savingDisplayName || !displayNameInput.trim()}
                  loading={savingDisplayName}
                  accessibilityLabel={savingDisplayName ? t("profile.displayName.saving", "Saving...") : t("profile.displayName.save", "Save")}
                />
              </View>
              {displayNameError ? (
                <Text variant="body" align="center" style={{ marginTop: 6, color: theme.danger ?? "#f33" }}>{displayNameError}</Text>
              ) : null}
              {displayNameMessage ? (
                <Text variant="body" align="center" style={{ marginTop: 6, color: theme.success ?? theme.primary }}>{displayNameMessage}</Text>
              ) : null}
            </View>

            <View style={styles.sectionBlock}>
              <Text variant="h2" style={{ marginBottom: 12 }}>
                {t("profile.language.label")}
              </Text>
              <View style={styles.pillRow}>
                {(["fr", "en"] as const).map((lng) => {
                  const active = i18n.language.startsWith(lng);
                  return (
                    <Button
                      key={lng}
                      title={lng === "fr" ? t("profile.language.french") : t("profile.language.english")}
                      variant={active ? "primary" : "outline"}
                      shape="pill"
                      size="sm"
                      onPress={() => handleLanguageChange(lng)}
                    />
                  );
                })}
              </View>
            </View>

            <View style={styles.sectionBlock}>
              <Text variant="h2" style={{ marginBottom: 12 }}>
                {t("profile.theme.label", "Theme")}
              </Text>
              <View style={styles.pillRow}>
                {(["light", "dark"] as const).map(mode => {
                  const isActive = colorScheme === mode;
                  return (
                    <Button
                      key={mode}
                      title={mode === "light" ? t("profile.theme.light", "Light") : t("profile.theme.dark", "Dark")}
                      variant={isActive ? "primary" : "outline"}
                      shape="pill"
                      size="sm"
                      onPress={() => handleThemeChange(mode)}
                    />
                  );
                })}
              </View>
            </View>

            <View style={styles.sectionBlock}>
              <Text variant="h2" style={{ marginBottom: 12 }}>
                {t("profile.account.title", "Account")}
              </Text>
              <View style={styles.accountActions}>
                <Button
                  title={accountActionLoading === "signout"
                    ? t("profile.account.signOutLoading", "Signing out...")
                    : t("profile.account.signOut", "Sign out")}
                  variant="primary"
                  onPress={handleSignOut}
                  disabled={accountActionLoading === "signout" || isLoading}
                  loading={accountActionLoading === "signout"}
                  fullWidth
                />

                <Button
                  title={accountActionLoading === "delete"
                    ? t("profile.account.deleting", "Deleting...")
                    : t("profile.account.delete", "Delete account")}
                  variant="destructive"
                  onPress={handleDeleteAccount}
                  disabled={accountActionLoading === "delete"}
                  loading={accountActionLoading === "delete"}
                  fullWidth
                />
              </View>
            </View>
          </>
        )}

        {activeTab === "stats" && (
          <>
            {loading ? (
              <Text variant="body" align="center" style={{ marginTop: 12 }}>{t("profile.loading")}</Text>
            ) : error ? (
              <Text variant="body" align="center" style={{ marginTop: 12, color: theme.danger ?? "#f66" }}>{error}</Text>
            ) : (
              <>
                <Text variant="h2" style={{ marginTop: 12, marginBottom: 12 }}>
                  {t("profile.stats.title", "My stats")}
                </Text>

                <ListCard>
                  {stats.map((stat) => (
                    <ListItem key={stat.label}>
                      <View style={styles.iconBox}>
                        <stat.icon size={20} color={theme.textMuted} />
                      </View>
                      <View style={styles.statInfo}>
                        <Text variant="body" colorName="textMuted">{stat.label}</Text>
                      </View>
                      <View style={styles.statValues}>
                        <Text variant="subtitle" style={{ fontWeight: "600" }}>{stat.value}</Text>
                        {stat.sublabel && <Text variant="caption" colorName="textMuted">{stat.sublabel}</Text>}
                      </View>
                    </ListItem>
                  ))}
                </ListCard>

                {subjectTotals.length > 0 && (
                  <View style={styles.breakdownSection}>
                    <View style={styles.sectionTitleGroup}>
                      <Text variant="h2" style={{ marginTop: 24, marginBottom: 12 }}>
                        {t("profile.subjects.breakdownTitle", "Temps total par matière (avec sous-tags)")}
                      </Text>
                      <Text variant="caption" colorName="textMuted">
                        {subjectTotals.length > 0 ? `${subjectTotals.length}` : ""}
                      </Text>
                    </View>

                    <ListCard>
                      {subjectTotals.map((row) => {
                        // Find the parent subject in the tree to get its children
                        const parentNode = subjectTree.find((node) => node.id === row.parentId);
                        const subjectColor = subjectColorById[row.parentId] ?? theme.primary;
                        
                        return (
                          <React.Fragment key={row.parentId}>
                            {/* Parent subject with total time */}
                            <ListItem pointerEvents="box-none">
                              <View style={[styles.subjectInfo, { flexDirection: "row", alignItems: "center", gap: 8 }]} pointerEvents="none">
                                <View
                                  style={[
                                    styles.subjectColorBadge,
                                    { backgroundColor: subjectColor },
                                  ]}
                                />
                                <Text variant="body" colorName="textMuted">{row.parentName}</Text>
                              </View>
                              <View style={styles.subjectActions} pointerEvents="box-none">
                                <Text variant="subtitle">{formatDuration(row.totalSeconds)}</Text>
                              </View>
                            </ListItem>
                            
                            {/* Child subjects (indented, if they exist) */}
                            {parentNode?.children.map((child) => {
                              const childColor = subjectColorById[child.id] ?? subjectColor;
                              return (
                                <ListItem key={child.id} pointerEvents="box-none" style={{ paddingLeft: 24 }}>
                                  <View style={[styles.subjectInfo, { flexDirection: "row", alignItems: "center", gap: 8 }]} pointerEvents="none">
                                    <View
                                      style={[
                                        styles.subjectColorBadge,
                                        { backgroundColor: childColor },
                                      ]}
                                    />
                                    <Text variant="body" colorName="textMuted">{child.name}</Text>
                                  </View>
                                  <View style={styles.subjectActions} pointerEvents="box-none">
                                    <Text variant="caption" colorName="textMuted">—</Text>
                                  </View>
                                </ListItem>
                              );
                            })}
                          </React.Fragment>
                        );
                      })}
                    </ListCard>
                  </View>
                )}
              </>
            )}
          </>
        )}

        {activeTab === "subjects" && (
          <>
            <View style={styles.subjectsHeaderRow}>
              <View style={styles.sectionTitleGroup}>
                <Text variant="h2" style={{ marginTop: 12, marginBottom: 12 }}>
                  {t("profile.subjects.title", "My subjects")}
                </Text>
                <Text variant="caption" colorName="textMuted">
                  {subjects.length > 0 ? `${subjects.length}` : ""}
                </Text>
              </View>
              {user?.id && (
                <Button
                  title={t("profile.subjects.add", "Add")}
                  variant="primary"
                  size="sm"
                  onPress={() => setAddModalVisible(true)}
                />
              )}
            </View>

            {loading ? (
              <View style={styles.subjectsCard}>
                <Text variant="body" align="center" style={{ paddingVertical: 20, color: theme.textMuted }}>{t("common.loading")}</Text>
              </View>
              ) : subjectTree.length === 0 ? (
              <View style={styles.subjectsCard}>
                <Text variant="body" align="center" style={{ paddingVertical: 20, color: theme.textMuted }}>
                  {t("profile.subjects.empty", "No subjects yet")}
                </Text>
              </View>
            ) : (
              <ListCard>
                {subjectTree.map((parent) => {
                  const isDeleting = deletingId === parent.id;
                  const subjectColor = subjectColorById[parent.id] ?? theme.primary;
                  
                  return (
                    <React.Fragment key={parent.id}>
                      {/* Parent subject */}
                      <ListItem pointerEvents="box-none">
                        <View style={[styles.subjectInfo, { flexDirection: "row", alignItems: "center", gap: 8 }]} pointerEvents="none">
                          <View
                            style={[
                              styles.subjectColorBadge,
                              { backgroundColor: subjectColor },
                            ]}
                          />
                          <Text variant="body" colorName="textMuted">{parent.name}</Text>
                        </View>

                        <View style={styles.subjectActions} pointerEvents="box-none">
                          {isDeleting ? (
                            <ActivityIndicator size="small" color={theme.textMuted} />
                          ) : (
                            <>
                              <Button
                                iconLeft={Palette}
                                iconOnly
                                variant="ghost"
                                size="sm"
                                onPress={() => handleOpenColorPicker(parent)}
                                accessibilityLabel={t("profile.subjects.customizeColor", "Customize color")}
                              />
                              <Button
                                iconLeft={Trash}
                                iconOnly
                                variant="ghost"
                                size="sm"
                                onPress={() => {
                                  if (user?.id) {
                                    confirmDeleteSubject(parent);
                                  }
                                }}
                                accessibilityLabel={t("profile.subjects.delete", "Delete subject")}
                              />
                            </>
                          )}
                        </View>
                      </ListItem>
                      
                      {/* Child subjects (indented) */}
                      {parent.children.map((child) => {
                        const isDeletingChild = deletingId === child.id;
                        const childColor = subjectColorById[child.id] ?? subjectColor;
                        
                        return (
                          <ListItem key={child.id} pointerEvents="box-none" style={{ paddingLeft: 24 }}>
                            <View style={[styles.subjectInfo, { flexDirection: "row", alignItems: "center", gap: 8 }]} pointerEvents="none">
                              <View
                                style={[
                                  styles.subjectColorBadge,
                                  { backgroundColor: childColor },
                                ]}
                              />
                              <Text variant="body" colorName="textMuted">{child.name}</Text>
                            </View>

                            <View style={styles.subjectActions} pointerEvents="box-none">
                              {isDeletingChild ? (
                                <ActivityIndicator size="small" color={theme.textMuted} />
                              ) : (
                                <>
                                  <Button
                                    iconLeft={Palette}
                                    iconOnly
                                    variant="ghost"
                                    size="sm"
                                    onPress={() => handleOpenColorPicker(child)}
                                    accessibilityLabel={t("profile.subjects.customizeColor", "Customize color")}
                                  />
                                  <Button
                                    iconLeft={Trash}
                                    iconOnly
                                    variant="ghost"
                                    size="sm"
                                    onPress={() => {
                                      if (user?.id) {
                                        confirmDeleteSubject(child);
                                      }
                                    }}
                                    accessibilityLabel={t("profile.subjects.delete", "Delete subject")}
                                  />
                                </>
                              )}
                            </View>
                          </ListItem>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </ListCard>
            )}
          </>
        )}

      <Modal
        visible={addModalVisible}
        onClose={() => {
          setNewSubjectName("");
          setSelectedParentSubjectId(null);
          setAddError(null);
          setAddModalVisible(false);
        }}
        title={t("timer.addSubjectTitle", "Ajouter une matière")}
        actions={{
          cancel: {
            label: t("timer.cancel", "Annuler"),
            onPress: () => {
              setNewSubjectName("");
              setSelectedParentSubjectId(null);
              setAddError(null);
              setAddModalVisible(false);
            },
            variant: "secondary",
            disabled: savingSubject,
          },
          confirm: {
            label: savingSubject 
              ? t("timer.saving", "Enregistrement...") 
              : exactMatch 
                ? t("profile.subjects.add", "Ajouter")
                : t("profile.subjects.createNew", "Créer"),
            onPress: exactMatch 
              ? () => handleAddExistingSubject(exactMatch)
              : handleCreateSubject,
            variant: "primary",
            disabled: savingSubject || !newSubjectName.trim(),
            loading: savingSubject,
          },
        }}
      >
        <Input
          value={newSubjectName}
          onChangeText={setNewSubjectName}
          placeholder={t("profile.subjects.searchPlaceholder", "Rechercher ou créer une matière")}
          leftIcon={Search}
          autoFocus
          editable={!savingSubject}
          error={addError || undefined}
          containerStyle={{ marginBottom: 12 }}
        />
        
        <SubjectPicker
          subjects={subjects}
          selectedSubjectId={selectedParentSubjectId}
          onSelect={setSelectedParentSubjectId}
          placeholder={t("profile.subjects.parentPlaceholder", "Parent subject (optional)")}
          containerStyle={{ marginBottom: 12 }}
          parentsOnly={true}
        />

        {newSubjectName.trim() && filteredSubjects.length > 0 && (
          <View style={styles.searchResults}>
            <Text variant="caption" colorName="textMuted" style={{ marginBottom: 8, fontWeight: "600" }}>
              {t("profile.subjects.searchResults", "Résultats de recherche")}
            </Text>
            {filteredSubjects.slice(0, 8).map((subject) => {
              const isOwner = subject.owner_id === user?.id;
              const isDeleting = deletingId === subject.id;
              const isExactMatch = exactMatch?.id === subject.id;
              return (
                <View 
                  key={subject.id} 
                  style={[
                    styles.availableRow,
                    isExactMatch && { backgroundColor: theme.primaryTint, borderColor: theme.primary }
                  ]}
                >
                  <Text variant="body" style={{ flex: 1 }}>{subject.name}</Text>
                  <View style={styles.availableActions}>
                    {isOwner && (
                      <Button
                        iconLeft={Trash}
                        iconOnly
                        variant="ghost"
                        size="sm"
                        onPress={() => handleDeleteOwnedSubject(subject)}
                        disabled={isDeleting || savingSubject}
                        loading={isDeleting}
                        accessibilityLabel={t("profile.subjects.delete", "Delete subject")}
                      />
                    )}
                    <Button
                      iconLeft={Plus}
                      iconOnly
                      variant={isExactMatch ? "primary" : "ghost"}
                      size="sm"
                      onPress={() => handleAddExistingSubject(subject)}
                      disabled={savingSubject || isDeleting}
                      accessibilityLabel={t("profile.subjects.add", "Add subject")}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {!newSubjectName.trim() && availableSubjects.length > 0 && (
          <View style={styles.availableList}>
            <Text variant="caption" colorName="textMuted" style={{ marginBottom: 8, fontWeight: "600" }}>
              {t("profile.subjects.available", "Matières disponibles")}
            </Text>
            {availableSubjects.slice(0, 8).map((subject) => {
              const isOwner = subject.owner_id === user?.id;
              const isDeleting = deletingId === subject.id;
              return (
                <View key={subject.id} style={styles.availableRow}>
                  <Text variant="body" style={{ flex: 1 }}>{subject.name}</Text>
                  <View style={styles.availableActions}>
                    {isOwner && (
                      <Button
                        iconLeft={Trash}
                        iconOnly
                        variant="ghost"
                        size="sm"
                        onPress={() => handleDeleteOwnedSubject(subject)}
                        disabled={isDeleting || savingSubject}
                        loading={isDeleting}
                        accessibilityLabel={t("profile.subjects.delete", "Delete subject")}
                      />
                    )}
                    <Button
                      iconLeft={Plus}
                      iconOnly
                      variant="ghost"
                      size="sm"
                      onPress={() => handleAddExistingSubject(subject)}
                      disabled={savingSubject || isDeleting}
                      accessibilityLabel={t("profile.subjects.add", "Add subject")}
                    />
                  </View>
                </View>
              );
            })}
            {availableSubjects.length > 8 && (
              <Text variant="caption" colorName="textMuted" style={{ marginTop: 4 }}>
                {t("profile.subjects.moreAvailable", "+ de matières disponibles")}
              </Text>
            )}
          </View>
        )}

        {newSubjectName.trim() && filteredSubjects.length === 0 && (
          <View style={styles.createHint}>
            <Text variant="caption" colorName="textMuted" style={{ marginBottom: 4 }}>
              {t("profile.subjects.noResults", "Aucun résultat trouvé")}
            </Text>
            <Text variant="body" colorName="textMuted" style={{ fontSize: 13 }}>
              {t("profile.subjects.createHint", "Appuyez sur \"Créer\" pour créer une nouvelle matière nommée \"{{name}}\"", { name: newSubjectName.trim() })}
            </Text>
          </View>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={deleteConfirmModalVisible}
        onClose={handleCancelDelete}
        title={t("profile.subjects.deleteTitle", "Retirer la matière ?")}
        actions={{
          cancel: {
            label: t("common.cancel", "Annuler"),
            onPress: handleCancelDelete,
            variant: "secondary",
          },
          confirm: {
            label: t("common.delete", "Supprimer"),
            onPress: handleConfirmDelete,
            variant: "destructive",
          },
        }}
      >
        <Text variant="body" style={{ color: theme.textMuted }}>
          {t("profile.subjects.deleteMessage", "Cette matière sera retirée de votre profil.")}
        </Text>
      </Modal>

      {/* Color Picker Modal */}
      <Modal
        visible={colorPickerVisible}
        onClose={() => {
          setColorPickerVisible(false);
          setSubjectForColor(null);
        }}
        title={t("profile.subjects.colorPickerTitle", "Choose color")}
        actions={{
          cancel: {
            label: t("common.cancel", "Annuler"),
            onPress: () => {
              setColorPickerVisible(false);
              setSubjectForColor(null);
            },
            variant: "secondary",
            disabled: updatingColor,
          },
        }}
      >
        {subjectForColor && (
          <>
            <Text variant="body" style={{ marginBottom: 16, color: theme.textMuted }}>
              {t("profile.subjects.colorPickerSubtitle", "Select a color for {{name}}", { name: subjectForColor.name })}
            </Text>
            <View style={styles.colorPickerGrid}>
              {/* Default option */}
              <TouchableOpacity
                style={[
                  styles.colorOption,
                  !subjectForColor.custom_color && styles.colorOptionSelected,
                  { borderColor: theme.divider },
                ]}
                onPress={() => handleUpdateColor(null)}
                disabled={updatingColor}
              >
                <View style={[styles.colorSwatch, { backgroundColor: theme.divider }]}>
                  <Text variant="caption" style={{ color: theme.textMuted }}>D</Text>
                </View>
                <Text variant="caption" style={{ marginTop: 4, color: theme.textMuted }}>
                  {t("profile.subjects.defaultColor", "Default")}
                </Text>
              </TouchableOpacity>
              {/* Palette colors */}
              {(theme.subjectPalette ?? []).map((color, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.colorOption,
                    subjectForColor.custom_color === color && styles.colorOptionSelected,
                    { borderColor: theme.divider },
                  ]}
                  onPress={() => handleUpdateColor(color)}
                  disabled={updatingColor}
                >
                  <View style={[styles.colorSwatch, { backgroundColor: color }]} />
                  <Text variant="caption" style={{ marginTop: 4, color: theme.textMuted }}>
                    {index + 1}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {updatingColor && (
              <View style={{ marginTop: 16, alignItems: "center" }}>
                <ActivityIndicator size="small" color={theme.primary} />
              </View>
            )}
          </>
        )}
      </Modal>
    </TabScreen>
  );
}

const createStyles = (theme: typeof Colors.light) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },

    // HEADER (styles moved to Header component)

    // Content
    iconBox: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: theme.surfaceElevated,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 16,
    },
    statInfo: { flex: 1 },
    // Note: Typography handled by Themed Text component with variant prop
    statValues: { alignItems: 'flex-end' },
    langRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 16,
      gap: 12,
    },
    // Note: Typography handled by Themed Text component with variant prop
    langButtons: { flexDirection: "row", gap: 8 },
    langButton: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    langButtonActive: {
      backgroundColor: theme.primaryDark,
      color: theme.onPrimary ?? "#fff",
      borderColor: theme.primary,
    },

    themeRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 16,
      gap: 12,
    },
    themeLabel: { color: theme.text, fontWeight: "600" },
    themeToggle: { flexDirection: "row", gap: 8 },
    themePill: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    themePillActive: {
      backgroundColor: theme.primaryDark,
      borderColor: theme.primary,
    },
    // Note: Typography handled by Themed Text component with variant prop

    // Sections
    subjectsHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    subjectsCard: {
      marginBottom: 16,
      backgroundColor: theme.surface,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.divider ?? theme.border,
      padding: 12,
      elevation: 1,
    },
    subjectInfo: {
      flex: 1,
    },
    subjectActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    subjectColorBadge: {
      width: 16,
      height: 16,
      borderRadius: 8,
    },
    colorPickerGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
      marginTop: 8,
    },
    colorOption: {
      alignItems: "center",
      padding: 12,
      borderRadius: 12,
      borderWidth: 2,
      minWidth: 70,
    },
    colorOptionSelected: {
      borderColor: theme.primary,
      backgroundColor: theme.primaryTint,
    },
    colorSwatch: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    deleteButton: {
      minWidth: 36,
      minHeight: 36,
      paddingVertical: 4,
      paddingHorizontal: 6,
      borderRadius: 8,
      backgroundColor: theme.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.divider ?? theme.border,
      alignItems: "center",
      justifyContent: "center",
    },
    deleteButtonPressed: {
      opacity: 0.6,
      backgroundColor: theme.surfaceElevated,
    },
        
    sectionTitleBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: theme.surfaceElevated,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.divider ?? theme.border,
      marginBottom: 12,
      gap: 12,
    },
    sectionTitleGroup: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: 8,
    },
    sectionHeaderActions: { flexDirection: "row", alignItems: "center", gap: 12 },
    addSubjectLink: { color: theme.secondary, fontWeight: "700", fontSize: 14 },
    // NOTE: addSubjectButton styles removed - not used (subjects are added via modal)
    sectionSubtitle: { color: theme.textMuted, fontSize: 12 },
    subjectRow: {
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 12,
      backgroundColor: theme.surfaceElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.divider ?? theme.border,
    },
    // Note: Typography handled by Themed Text component with variant prop
    breakdownSection: { marginBottom: 24 },
    // Note: Typography handled by Themed Text component with variant prop

    // Account actions
    accountCard: {
      marginTop: 18,
      backgroundColor: theme.surface,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.divider ?? theme.border,
      padding: 14,
      gap: 8,
      elevation: 1,
    },
    // NOTE: accountButton styles removed - now using Button component
    accountActions: { gap: 8 },


    // Settings pills
    sectionBlock: {
      marginBottom: 24,
      gap: 8,
    },
    pillRow: { flexDirection: "row", gap: 8 },
    // NOTE: pillButton styles removed - now using Button component with shape="pill"

    // Display name edit
    displayNameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    displayNameInput: {
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      flex: 1,
      // Note: Input component handles typography
    },
    // NOTE: displayNameSave styles removed - now using Button component

    // NOTE: Modal styles removed - now using Modal component from components/ui
    // Note: Typography handled by Themed Text component with variant prop
    availableList: {
      marginBottom: 10,
      gap: 6,
    },
    searchResults: {
      marginBottom: 10,
      gap: 6,
    },
    availableRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 10,
      backgroundColor: theme.surfaceElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.divider ?? theme.border,
    },
    // Note: Typography handled by Themed Text component with variant prop
    availableActions: { flexDirection: "row", alignItems: "center", gap: 8 },
    // NOTE: availableIconButton styles removed - now using Button component
    // Note: Typography handled by Themed Text component with variant prop
    createHint: {
      padding: 12,
      borderRadius: 10,
      backgroundColor: theme.surfaceElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.divider ?? theme.border,
    },
  });

