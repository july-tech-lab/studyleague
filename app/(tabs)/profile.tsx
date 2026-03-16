import { TabScreen } from "@/components/layout/TabScreen";
import { Text } from "@/components/Themed";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ListCard, ListItem } from "@/components/ui/ListCard";
import { Modal } from "@/components/ui/Modal";
import { StatCard } from "@/components/ui/StatCard";
import { SubjectPicker } from "@/components/ui/SubjectPicker";
import { Tabs } from "@/components/ui/Tabs";
import Colors from "@/constants/Colors";
import { useDashboard } from "@/hooks/useDashboard";
import { useProfile } from "@/hooks/useProfile";
import { useStudyMode } from "@/hooks/useStudyMode";
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
import { formatDuration, formatDurationCompact } from "@/utils/time";
import { useRouter } from "expo-router";
import { Award, Clock, Flame, Globe, LogOut, Moon, Palette, Plus, Save, Search, Shield, ShieldAlert, Sun, Timer, Trash, Trophy, User, Zap } from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View
} from "react-native";




// Types
interface StatCardData {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  label: string;
  value: string;
  iconColor: string;
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

  const { longestSessionSeconds, bestSubjectName } = useDashboard(user?.id ?? null);

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

  // Study mode hook
  const {
    hasPermission: hasFocusPermission,
    isLoading: focusModeLoading,
    requestPermission: requestFocusPermission,
    presentAppPicker,
  } = useStudyMode();
  
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

  const iconColor = theme.primary;

  const statCards: StatCardData[] = useMemo(
    () => [
      {
        icon: Clock,
        label: t("common.totalTime"),
        value: formatDurationCompact(sessionTotals.totalSeconds),
        iconColor,
      },
      {
        icon: Flame,
        label: t("profile.stats.streak"),
        value:
          profile?.current_streak !== undefined
            ? t("profile.stats.streakValue", { count: profile.current_streak })
            : "--",
        iconColor,
      },
      {
        icon: Zap,
        label: t("profile.stats.sessions"),
        value: String(sessionTotals.count ?? 0),
        iconColor,
      },
      {
        icon: Trophy,
        label: t("tabs.leaderboard"),
        value: rankLabel ?? "--",
        iconColor,
      },
      {
        icon: Timer,
        label: t("dashboard.longestSession"),
        value: formatDurationCompact(longestSessionSeconds),
        iconColor,
      },
      {
        icon: Award,
        label: t("dashboard.bestSubject"),
        value: bestSubjectName ?? "--",
        iconColor,
      },
    ],
    [profile, rankLabel, sessionTotals, longestSessionSeconds, bestSubjectName, iconColor, t]
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
  // Use subjects (visible) for the Subjects tab
  const subjectTree = useMemo(
    () => buildSubjectTree(subjects),
    [subjects]
  );

  // Build tree from allSubjects for Stats tab (subjectTotals may include hidden subjects)
  const allSubjectsTree = useMemo(
    () => buildSubjectTree(allSubjects),
    [allSubjects]
  );

  // Create color map for subjects using shared utility with tree structure
  // Use allSubjects to ensure consistent colors across all pages (profile, index) and for all subjects
  // This ensures subjects in subjectTotals (which may not be in subjects) get the same colors
  const subjectColorById = useMemo(() => {
    return createSubjectColorMap(
      allSubjectsTree,
      theme.subjectPalette ?? [],
      theme.primary
    );
  }, [allSubjectsTree, theme.subjectPalette, theme.primary]);

  // "Total time per subject" uses same subjects as Subjects tab, ordered by total time (high to low)
  const subjectTotalsForBreakdown = useMemo(() => {
    const totalsById = new Map(subjectTotals.map((r) => [r.parentId, r]));
    return subjectTree
      .map((parent) => {
        const row = totalsById.get(parent.id);
        return {
          parentId: parent.id,
          parentName: parent.name,
          totalSeconds: row?.totalSeconds ?? 0,
        };
      })
      .sort((a, b) => b.totalSeconds - a.totalSeconds);
  }, [subjectTree, subjectTotals]);

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
        { text: t("common.actions.cancel"), style: "cancel" },
        {
          text: t("common.actions.delete"),
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
        { text: t("common.actions.cancel"), style: "cancel" },
        {
          text: t("common.actions.delete"),
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
      title={profile?.username ?? t("profile.userFallback", "User")}
      subtitle={user?.email ?? undefined}
      leftAction={
        <View style={[styles.avatarCircle, styles.avatarCircleHeader, { backgroundColor: theme.primary }]}>
          <User size={28} color="#FFFFFF" strokeWidth={2} />
        </View>
      }
      rightIcon={{
        icon: LogOut,
        onPress: handleSignOut,
        accessibilityLabel: t("profile.account.signOut", "Sign out"),
        disabled: accountActionLoading === "signout" || isLoading,
      }}
    >
        <Tabs
          options={[
            { value: "stats", label: t("tabs.stats") },
            { value: "subjects", label: t("profile.tabs.subjects", "Subjects") },
            { value: "settings", label: t("profile.tabs.settings", "Settings") },
          ]}
          value={activeTab}
          onChange={setActiveTab}
        />

        {activeTab === "settings" && (
          <View style={styles.settingsList}>
            <View style={styles.settingBlock}>
              <Text variant="body" colorName="textMuted" style={{ marginBottom: 10 }}>
                {t("profile.displayName.hint")}
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
                  accessibilityLabel={savingDisplayName ? t("common.status.saving") : t("common.actions.save")}
                />
              </View>
              {displayNameError ? (
                <Text variant="micro" style={{ marginTop: 6, color: theme.danger ?? "#f33" }}>{displayNameError}</Text>
              ) : null}
              {displayNameMessage ? (
                <Text variant="micro" style={{ marginTop: 6, color: theme.success ?? theme.primary }}>{displayNameMessage}</Text>
              ) : null}
            </View>

            <View style={styles.settingBlock}>
              <View style={styles.settingRow}>
                <Globe size={22} color={theme.textMuted} />
                <Text variant="subtitle" style={{ flex: 1, marginLeft: 12 }}>{t("profile.language.label")}</Text>
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
            </View>

            <View style={styles.settingBlock}>
              <View style={styles.settingRow}>
                {colorScheme === "dark" ? (
                  <Moon size={22} color={theme.textMuted} />
                ) : (
                  <Sun size={22} color={theme.textMuted} />
                )}
                <Text variant="subtitle" style={{ flex: 1, marginLeft: 12 }}>{t("profile.theme.label", "Theme")}</Text>
                <View style={styles.pillRow}>
                  {(["light", "dark"] as const).map((mode) => {
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
            </View>

            <View style={styles.settingBlock}>
              <View style={styles.settingRowWithIcon}>
                {hasFocusPermission ? (
                  <Shield size={22} color={theme.success} />
                ) : (
                  <ShieldAlert size={22} color={theme.danger} />
                )}
                <View style={styles.settingLabelButtonRow}>
                  <Text variant="subtitle">{t("profile.studyMode.title", "Study Mode")}</Text>
                  {!hasFocusPermission && (
                    <Button
                    title={t("common.grantPermission")}
                    variant="primary"
                    size="sm"
                    onPress={async () => {
                      const granted = await requestFocusPermission();
                      if (!granted) {
                        Alert.alert(
                          t("timer.permissionDenied"),
                          Platform.OS === 'ios'
                            ? t("timer.permissionRequestIOS")
                            : t("timer.openSettings")
                        );
                      }
                    }}
                    disabled={focusModeLoading}
                    loading={focusModeLoading}
                  />
                  )}
                </View>
              </View>
              <Text variant="micro" colorName="textMuted" style={{ marginTop: 8 }}>
                {hasFocusPermission
                  ? t("profile.studyMode.permissionGranted", "Focus mode permission is granted")
                  : t("profile.studyMode.permissionNotGranted", "Focus mode permission is required to track study time")}
              </Text>
              {Platform.OS === 'ios' && hasFocusPermission && (
                <>
                  <View style={[styles.settingRowWithIcon, { marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}>
                    <Shield size={22} color={theme.primary} />
                    <View style={styles.settingLabelButtonRow}>
                      <Text variant="subtitle">{t("profile.studyMode.appsToBlock", "Apps to Block")}</Text>
                      <Button
                      title={t("common.selectApps")}
                      variant="outline"
                      size="sm"
                      onPress={async () => {
                        const selected = await presentAppPicker();
                        if (!selected) {
                          Alert.alert(
                            t("timer.noAppsSelected"),
                            t("timer.noAppsSelectedDescription")
                          );
                        } else {
                          Alert.alert(
                            t("profile.studyMode.appsSelected", "Apps Selected"),
                            t("profile.studyMode.appsSelectedMessage", "Your app selection has been saved. These apps will be blocked when you start a study session.")
                          );
                        }
                      }}
                      disabled={focusModeLoading}
                      loading={focusModeLoading}
                    />
                    </View>
                  </View>
                  <Text variant="micro" colorName="textMuted" style={{ marginTop: 8 }}>
                    {t("profile.studyMode.appsDescription", "Select which apps should be blocked during study sessions (e.g., WhatsApp, Snapchat, Instagram).")}
                  </Text>
                </>
              )}
            </View>

            <View style={styles.settingBlock}>
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
                    ? t("common.status.deleting")
                    : t("profile.account.delete")}
                  variant="destructive"
                  onPress={handleDeleteAccount}
                  disabled={accountActionLoading === "delete"}
                  loading={accountActionLoading === "delete"}
                  fullWidth
                />
              </View>
            </View>
          </View>
        )}

        {activeTab === "stats" && (
          <>
            {loading ? (
              <Text variant="body" align="center" style={{ marginTop: 12 }}>{t("common.status.loading")}</Text>
            ) : error ? (
              <Text variant="body" align="center" style={{ marginTop: 12, color: theme.danger ?? "#f66" }}>{error}</Text>
            ) : (
              <>
                <View style={styles.statsGrid}>
                  {[statCards.slice(0, 3), statCards.slice(3, 6)].map((row, rowIdx) => (
                    <View key={rowIdx} style={styles.statsRow}>
                      {row.map((stat) => (
                        <StatCard
                          key={stat.label}
                          icon={stat.icon}
                          value={stat.value}
                          label={stat.label}
                          iconColor={stat.iconColor}
                        />
                      ))}
                    </View>
                  ))}
                </View>

                {subjectTotalsForBreakdown.length > 0 && (
                  <View style={styles.breakdownSection}>
                    <Text variant="h2" style={{ marginTop: 24, marginBottom: 12 }}>
                      {t("profile.subjects.breakdownTitle", "Time per subject")}
                    </Text>

                    <View style={styles.barChartSection}>
                      {subjectTotalsForBreakdown.map((row) => {
                        const subjectColor = subjectColorById[row.parentId] ?? theme.primary;
                        const maxSeconds = Math.max(...subjectTotalsForBreakdown.map((r) => r.totalSeconds), 1);
                        const barWidthPercent = (row.totalSeconds / maxSeconds) * 100;
                        return (
                          <View key={row.parentId} style={styles.barRow}>
                            <View style={styles.barHeader}>
                              <Text variant="subtitle" colorName="textMuted" style={styles.barLabel}>
                                {row.parentName}
                              </Text>
                              <Text variant="subtitle" style={styles.barValue}>
                                {formatDuration(row.totalSeconds)}
                              </Text>
                            </View>
                            <View style={[styles.barBg, { backgroundColor: theme.divider }]}>
                              <View
                                style={[
                                  styles.barFill,
                                  { width: `${barWidthPercent}%`, backgroundColor: subjectColor },
                                ]}
                              />
                            </View>
                          </View>
                        );
                      })}
                    </View>
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
                  title={t("common.actions.add")}
                  variant="primary"
                  size="sm"
                  onPress={() => setAddModalVisible(true)}
                />
              )}
            </View>

            {loading ? (
              <View style={styles.subjectsCard}>
                <Text variant="body" align="center" style={{ paddingVertical: 20, color: theme.textMuted }}>{t("common.status.loading")}</Text>
              </View>
              ) : subjectTree.length === 0 ? (
              <View style={styles.subjectsCard}>
                <Text variant="body" align="center" style={{ paddingVertical: 20, color: theme.textMuted }}>
                  {t("profile.subjects.empty", "No subjects yet")}
                </Text>
              </View>
            ) : (
              <ListCard>
                {subjectTree.map((parent, index) => {
                  const isDeleting = deletingId === parent.id;
                  const subjectColor = subjectColorById[parent.id] ?? theme.primary;

                  return (
                    <ListItem
                      key={parent.id}
                      pointerEvents="box-none"
                      isLast={index === subjectTree.length - 1}
                    >
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
        title={t("common.addSubject")}
        actions={{
          cancel: {
            label: t("common.actions.cancel"),
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
              ? t("common.status.saving") 
              : exactMatch 
                ? t("common.actions.add")
                : t("profile.subjects.create"),
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
          placeholder={t("common.parentSubjectPlaceholder")}
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
                      accessibilityLabel={t("common.addSubject")}
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
                      accessibilityLabel={t("common.addSubject")}
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
            label: t("common.actions.cancel"),
            onPress: handleCancelDelete,
            variant: "secondary",
          },
          confirm: {
            label: t("common.actions.delete"),
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
            label: t("common.actions.cancel"),
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
    profileHeader: {
      alignItems: "center",
      paddingVertical: 20,
      paddingBottom: 12,
    },
    avatarCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 12,
    },
    avatarCircleHeader: {
      width: 48,
      height: 48,
      borderRadius: 24,
      marginBottom: 0,
    },
    profileName: {
      fontWeight: "700",
      marginBottom: 4,
    },
    profileEmail: {
      fontSize: 14,
    },
    statsGrid: {
      gap: 10,
      marginBottom: 24,
    },
    statsRow: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 10,
    },
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
    barChartSection: { gap: 4 },
    barRow: { marginBottom: 12 },
    barHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
    barLabel: {},
    barValue: { fontWeight: "600" },
    barBg: {
      height: 8,
      borderRadius: 4,
      overflow: "hidden",
    },
    barFill: { height: "100%", borderRadius: 4 },
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


    // Settings tab flat layout
    settingsList: { gap: 0 },
    settingBlock: {
      paddingVertical: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.divider ?? theme.border,
    },
    settingRowTouchable: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 14,
      paddingHorizontal: 4,
      gap: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.divider ?? theme.border,
    },
    // Settings pills
    sectionBlock: {
      marginBottom: 24,
      gap: 8,
    },
    labelPillRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    pillRow: { flexDirection: "row", gap: 8 },
    // NOTE: pillButton styles removed - now using Button component with shape="pill"
    settingRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    settingRowWithIcon: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    settingLabelButtonRow: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    settingInfo: {
      flex: 1,
    },
    settingHeader: {
      flexDirection: "row",
      alignItems: "center",
    },
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

