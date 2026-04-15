import { TabScreen } from "@/components/layout/TabScreen";
import { AcademicPathModal } from "@/components/profile/AcademicPathModal";
import { Text } from "@/components/Themed";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ListCard, ListItem } from "@/components/ui/ListCard";
import { Modal } from "@/components/ui/Modal";
import { StatCard } from "@/components/ui/StatCard";
import { Tabs } from "@/components/ui/Tabs";
import {
  categoryNeedsYearStep,
  YEARS_BY_CATEGORY,
} from "@/constants/academicPath";
import type { CategoryId } from "@/constants/categories";
import Colors from "@/constants/Colors";
import {
  CUSTOM_SUBJECT_CREATE_SWATCHES,
  getSubjectDisplayName,
  PROFILE_POPULAR_SUBJECT_KEYS,
  SUBJECT_CATALOG,
  type SubjectKey,
} from "@/constants/subjectCatalog";
import { useDashboard } from "@/hooks/useDashboard";
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
  sortSubjectsForDisplay,
  Subject,
  updateOwnedSubjectName,
  updateUserProfile,
  updateUserSubjectCustomization,
} from "@/utils/queries";
import { useTheme, useThemePreference } from "@/utils/themeContext";
import { formatDuration, formatDurationCompact } from "@/utils/time";
import { useRouter } from "expo-router";
// FAMILY_CONTROLS_DISABLED: Shield, ShieldAlert removed from imports (re-add when enabling)
import {
  ChevronDown,
  Clock,
  Eye,
  EyeOff,
  Flame,
  Globe,
  GraduationCap,
  LogOut,
  Moon,
  Pencil,
  Plus,
  Save,
  Sparkles,
  Timer,
  Trash,
  User,
  X,
} from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";




const ACADEMIC_CATEGORY_IDS: CategoryId[] = [
  "primaire",
  "college",
  "lycee",
  "prepa",
  "universite",
  "autres",
];

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
  const { user, signOut, deleteAccount, isLoading, updateUserMetadata } = useAuth();
  const router = useRouter();
  const { t, i18n } = useTranslation();

  // Use profile hook for data fetching
  const {
    profile,
    subjects,
    allSubjects,
    hiddenSubjects,
    subjectTotals,
    sessionTotals,
    loading,
    error: profileError,
    refetch: refetchProfile,
  } = useProfile({
    userId: user?.id ?? null,
    autoLoad: true,
  });

  const { longestSessionSeconds } = useDashboard(user?.id ?? null);

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
  const [showAddSubjectPanel, setShowAddSubjectPanel] = useState(false);
  const [bankListModalVisible, setBankListModalVisible] = useState(false);
  const [customSubjectName, setCustomSubjectName] = useState("");
  const [customCreateColor, setCustomCreateColor] = useState(
    CUSTOM_SUBJECT_CREATE_SWATCHES[0] ?? "#60B3E3"
  );
  const [savingSubject, setSavingSubject] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmModalVisible, setDeleteConfirmModalVisible] = useState(false);
  const [subjectToDelete, setSubjectToDelete] = useState<Subject | null>(null);
  const [accountActionLoading, setAccountActionLoading] = useState<"signout" | "delete" | null>(null);
  const [activeTab, setActiveTab] = useState<"stats" | "subjects" | "settings">("stats");
  const [updatingColor, setUpdatingColor] = useState(false);
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [savingDisplayName, setSavingDisplayName] = useState(false);
  const [displayNameMessage, setDisplayNameMessage] = useState<string | null>(null);
  const [displayNameError, setDisplayNameError] = useState<string | null>(null);
  const [editSubjectModalVisible, setEditSubjectModalVisible] = useState(false);
  const [subjectToEdit, setSubjectToEdit] = useState<Subject | null>(null);
  const [editSubjectNameInput, setEditSubjectNameInput] = useState("");
  const [savingSubjectRename, setSavingSubjectRename] = useState(false);
  const [restoringHiddenId, setRestoringHiddenId] = useState<string | null>(null);
  const [academicPathModalVisible, setAcademicPathModalVisible] = useState(false);
  const [academicPathMessage, setAcademicPathMessage] = useState<string | null>(null);

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

  const academicPathSummary = useMemo(() => {
    const c = profile?.academic_category;
    if (!c || !ACADEMIC_CATEGORY_IDS.includes(c as CategoryId)) {
      return t("profile.academicPath.notSet");
    }
    const catId = c as CategoryId;
    const catLabel = t(`categories.${catId}`);
    if (!categoryNeedsYearStep(catId)) return catLabel;
    const y = YEARS_BY_CATEGORY[catId].find(
      (x) => x.id === profile.academic_year_key
    );
    if (!y) return catLabel;
    return `${catLabel} · ${t(`onboarding.years.${y.labelKey}`)}`;
  }, [profile?.academic_category, profile?.academic_year_key, t]);

  const xpFormatted = useMemo(
    () =>
      new Intl.NumberFormat(i18n.language?.startsWith("fr") ? "fr-FR" : "en-US").format(
        profile?.xp_total ?? 0
      ),
    [profile?.xp_total, i18n.language]
  );

  const statCards: StatCardData[] = useMemo(
    () => [
      {
        icon: Clock,
        label: t("common.totalTime"),
        value: formatDurationCompact(sessionTotals.totalSeconds),
        iconColor,
      },
      {
        icon: Timer,
        label: t("dashboard.longestSession"),
        value: formatDurationCompact(longestSessionSeconds),
        iconColor,
      },
      {
        icon: Sparkles,
        label: t("profile.stats.xp"),
        value: xpFormatted,
        iconColor: theme.secondaryDark,
      },
      {
        icon: Flame,
        label: t("profile.stats.streak"),
        value: t("profile.stats.streakValue", { count: profile?.current_streak ?? 0 }),
        iconColor: theme.secondaryDark,
      },
    ],
    [
      sessionTotals,
      longestSessionSeconds,
      iconColor,
      t,
      xpFormatted,
      theme.secondaryDark,
      profile?.current_streak,
    ]
  );

  const handleCreateCustomSubject = async () => {
    if (!user?.id) return;
    const trimmed = customSubjectName.trim();
    if (!trimmed) return;
    setSavingSubject(true);
    setAddError(null);
    try {
      await createAndAttachSubject(user.id, trimmed, {
        color: customCreateColor,
        icon: "bookmark",
      });
      await refetchProfile();
      setCustomSubjectName("");
      setCustomCreateColor(CUSTOM_SUBJECT_CREATE_SWATCHES[0] ?? "#60B3E3");
    } catch (err: any) {
      setAddError(err?.message ?? t("profile.subjects.addError", "Impossible d'ajouter la matière"));
    } finally {
      setSavingSubject(false);
    }
  };

  const handleAddPopularBankSubject = async (key: SubjectKey) => {
    if (!user?.id) return;
    const entry = SUBJECT_CATALOG[key];
    if (!entry) return;
    const catalogRow = allSubjects.find((s) => s.bank_key === key);
    setSavingSubject(true);
    setAddError(null);
    setBankListModalVisible(false);
    try {
      if (catalogRow) {
        await attachSubjectToUser(user.id, catalogRow.id);
      } else {
        const name = t(`subjectCatalog.${key}`);
        await createAndAttachSubject(user.id, name, {
          bankKey: key,
          color: entry.defaultColor,
          icon: entry.icon,
        });
      }
      await refetchProfile();
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

  const handleRestoreHiddenSubject = async (subject: Subject) => {
    if (!user?.id) return;
    setRestoringHiddenId(subject.id);
    try {
      await attachSubjectToUser(user.id, subject.id);
      await refetchProfile();
    } catch (err: any) {
      Alert.alert(
        t("timer.errorTitle", "Erreur"),
        err?.message ?? t("profile.subjects.restoreError", "Impossible de réactiver la matière.")
      );
    } finally {
      setRestoringHiddenId(null);
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

  const handleUpdateColor = async (subject: Subject, color: string | null) => {
    if (!user?.id) return;
    setUpdatingColor(true);
    try {
      await updateUserSubjectCustomization(user.id, subject.id, {
        custom_color: color,
      });
      await refetchProfile();
      setSubjectToEdit((prev) =>
        prev && prev.id === subject.id ? { ...prev, custom_color: color } : prev
      );
    } catch (err: any) {
      Alert.alert(
        t("timer.errorTitle", "Erreur"),
        err?.message ?? t("timer.errorSave", "Impossible de sauvegarder.")
      );
    } finally {
      setUpdatingColor(false);
    }
  };

  const openEditSubjectModal = (subject: Subject) => {
    setSubjectToEdit(subject);
    const owned = subject.owner_id != null && subject.owner_id === user?.id;
    setEditSubjectNameInput(owned ? subject.name : "");
    setEditSubjectModalVisible(true);
  };

  const closeEditSubjectModal = () => {
    setEditSubjectModalVisible(false);
    setSubjectToEdit(null);
    setEditSubjectNameInput("");
  };

  const handleSaveSubjectRename = async () => {
    if (!user?.id || !subjectToEdit) return;
    const trimmed = editSubjectNameInput.trim();
    if (!trimmed) return;
    setSavingSubjectRename(true);
    try {
      await updateOwnedSubjectName(subjectToEdit.id, user.id, trimmed);
      await refetchProfile();
      closeEditSubjectModal();
    } catch (err: any) {
      Alert.alert(
        t("timer.errorTitle", "Erreur"),
        err?.message ?? t("profile.subjects.renameError", "Impossible de renommer la matière.")
      );
    } finally {
      setSavingSubjectRename(false);
    }
  };

  const userAttachedSubjectIds = useMemo(() => {
    const ids = new Set<string>();
    subjects.forEach((s) => ids.add(s.id));
    hiddenSubjects.forEach((s) => ids.add(s.id));
    return ids;
  }, [subjects, hiddenSubjects]);

  const userBankKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const s of subjects) {
      if (s.bank_key) keys.add(s.bank_key);
    }
    for (const s of hiddenSubjects) {
      if (s.bank_key) keys.add(s.bank_key);
    }
    return keys;
  }, [subjects, hiddenSubjects]);

  /** Popular catalog entries the user can still add (attach or create-with-bank-key). */
  const availablePopularBankEntries = useMemo(() => {
    const out: { key: SubjectKey; label: string; dotColor: string }[] = [];
    for (const key of PROFILE_POPULAR_SUBJECT_KEYS) {
      const entry = SUBJECT_CATALOG[key];
      if (!entry) continue;
      const catalogRow = allSubjects.find((s) => s.bank_key === key);
      if (catalogRow) {
        if (userAttachedSubjectIds.has(catalogRow.id)) continue;
      } else if (userBankKeys.has(key)) {
        continue;
      }
      out.push({
        key,
        label: t(`subjectCatalog.${key}`),
        dotColor: entry.defaultColor,
      });
    }
    return out;
  }, [allSubjects, t, userAttachedSubjectIds, userBankKeys]);

  const subjectsOrdered = useMemo(
    () => sortSubjectsForDisplay(subjects),
    [subjects]
  );

  const hiddenSubjectsOrdered = useMemo(
    () => sortSubjectsForDisplay(hiddenSubjects),
    [hiddenSubjects]
  );

  // Build tree from allSubjects for consistent colors (includes hidden subjects with study time)
  const allSubjectsTree = useMemo(
    () => buildSubjectTree(allSubjects),
    [allSubjects]
  );

  const subjectColorById = useMemo(() => {
    return createSubjectColorMap(
      allSubjectsTree,
      theme.subjectPalette ?? [],
      theme.primary
    );
  }, [allSubjectsTree, theme.subjectPalette, theme.primary]);

  /** Total study time per root subject (all-time), same source as before profile/stats refactor. */
  const subjectTotalsForBreakdown = useMemo(() => {
    const totalsById = new Map(subjectTotals.map((r) => [r.parentId, r]));
    return subjectsOrdered
      .map((s) => {
        const row = totalsById.get(s.id);
        return {
          parentId: s.id,
          parentName: getSubjectDisplayName(s, t),
          totalSeconds: row?.totalSeconds ?? 0,
        };
      })
      .sort((a, b) => b.totalSeconds - a.totalSeconds);
  }, [subjectsOrdered, subjectTotals, t]);

  /** All-time seconds per subject id (for disabling permanent delete when study time exists). */
  const subjectTotalSecondsById = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of subjectTotals) {
      m.set(r.parentId, r.totalSeconds);
    }
    return m;
  }, [subjectTotals]);

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
          <View style={styles.settingsCards}>
            <View style={styles.settingsCard}>
              <View style={styles.settingsCardRow}>
                <User size={22} color={theme.text} strokeWidth={2} />
                <Text variant="subtitle" style={styles.settingsCardLabelFill}>
                  {t("profile.displayName.label", "Display name")}
                </Text>
              </View>
              <Text variant="caption" colorName="textMuted" style={styles.settingsDisplayNameHint}>
                {t("profile.displayName.hint")}
              </Text>
              <View style={styles.displayNameEditorRow}>
                <Input
                  value={displayNameInput}
                  onChangeText={setDisplayNameInput}
                  placeholder={t("profile.displayName.placeholder", "Your name")}
                  autoCapitalize="words"
                  error={displayNameError || undefined}
                  containerStyle={styles.displayNameInputWrap}
                  fieldStyle={styles.displayNameInputField}
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
              {displayNameMessage ? (
                <Text variant="micro" style={[styles.settingsDisplayNameFeedback, { color: theme.success ?? theme.primary }]}>
                  {displayNameMessage}
                </Text>
              ) : null}
            </View>

            <View style={styles.settingsCard}>
              <View style={styles.settingsCardRow}>
                <Globe size={22} color={theme.text} strokeWidth={2} />
                <Text variant="subtitle" style={styles.settingsCardLabel}>
                  {t("profile.language.label")}
                </Text>
                <View style={styles.segmentTrack}>
                  {(["fr", "en"] as const).map((lng) => {
                    const active = (i18n.language.startsWith("fr") ? "fr" : "en") === lng;
                    return (
                      <Pressable
                        key={lng}
                        onPress={() => handleLanguageChange(lng)}
                        style={({ pressed }) => [
                          styles.segmentCell,
                          active && styles.segmentCellActive,
                          !active && pressed && styles.segmentCellPressed,
                        ]}
                      >
                        <Text
                          variant="caption"
                          style={[styles.segmentLabel, active && styles.segmentLabelActive]}
                        >
                          {lng === "fr" ? t("profile.language.french") : t("profile.language.english")}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>

            <View style={styles.settingsCard}>
              <View style={styles.settingsCardRow}>
                <Moon size={22} color={theme.text} strokeWidth={2} />
                <Text variant="subtitle" style={styles.settingsCardLabel}>
                  {t("profile.theme.label", "Theme")}
                </Text>
                <View style={styles.segmentTrack}>
                  {(["light", "dark"] as const).map((mode) => {
                    const active = colorScheme === mode;
                    return (
                      <Pressable
                        key={mode}
                        onPress={() => handleThemeChange(mode)}
                        style={({ pressed }) => [
                          styles.segmentCell,
                          active && styles.segmentCellActive,
                          !active && pressed && styles.segmentCellPressed,
                        ]}
                      >
                        <Text
                          variant="caption"
                          style={[styles.segmentLabel, active && styles.segmentLabelActive]}
                        >
                          {mode === "light"
                            ? t("profile.theme.light", "Light")
                            : t("profile.theme.dark", "Dark")}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>

            <View>
              <Pressable
                onPress={() => {
                  setAcademicPathMessage(null);
                  setAcademicPathModalVisible(true);
                }}
                style={({ pressed }) => [
                  styles.settingsCard,
                  styles.settingsCardPressable,
                  pressed && styles.settingsCardPressed,
                ]}
              >
                <View style={styles.settingsCardRow}>
                  <GraduationCap size={22} color={theme.text} strokeWidth={2} />
                  <View style={styles.academicPathTextCol}>
                    <Text variant="subtitle">{t("profile.academicPath.label")}</Text>
                    <Text variant="caption" colorName="textMuted" numberOfLines={2}>
                      {academicPathSummary}
                    </Text>
                  </View>
                  <Text
                    variant="caption"
                    style={[styles.academicPathChange, { color: theme.primaryDark }]}
                  >
                    {t("profile.academicPath.change")}
                  </Text>
                </View>
              </Pressable>
              {academicPathMessage ? (
                <Text
                  variant="micro"
                  style={[
                    styles.settingsDisplayNameFeedback,
                    { color: theme.success ?? theme.primary },
                  ]}
                >
                  {academicPathMessage}
                </Text>
              ) : null}
            </View>

            {/* FAMILY_CONTROLS_DISABLED: Study mode settings hidden for App Store submission.
                To re-enable, restore the settingBlock with Shield/ShieldAlert icons,
                permission button, and iOS app picker. */}

            <Pressable
              onPress={handleSignOut}
              disabled={accountActionLoading === "signout" || isLoading}
              style={({ pressed }) => [
                styles.settingsCard,
                styles.settingsCardPressable,
                (accountActionLoading === "signout" || isLoading) && styles.settingsCardDisabled,
                pressed && styles.settingsCardPressed,
              ]}
            >
              <View style={styles.settingsCardRow}>
                <LogOut size={22} color={theme.text} strokeWidth={2} />
                <Text variant="subtitle" style={[styles.settingsCardLabel, styles.settingsCardLabelFill]}>
                  {accountActionLoading === "signout"
                    ? t("profile.account.signOutLoading", "Signing out...")
                    : t("profile.account.signOut", "Sign out")}
                </Text>
                {accountActionLoading === "signout" ? (
                  <ActivityIndicator size="small" color={theme.primaryDark} />
                ) : null}
              </View>
            </Pressable>

            <Pressable
              onPress={handleDeleteAccount}
              disabled={accountActionLoading === "delete"}
              style={({ pressed }) => [
                styles.settingsCard,
                styles.settingsCardDanger,
                styles.settingsCardPressable,
                accountActionLoading === "delete" && styles.settingsCardDisabled,
                pressed && styles.settingsCardDangerPressed,
              ]}
            >
              <View style={styles.settingsCardRow}>
                <Trash size={22} color={theme.danger} strokeWidth={2} />
                <Text variant="subtitle" style={[styles.settingsCardLabelFill, { color: theme.danger }]}>
                  {accountActionLoading === "delete"
                    ? t("common.status.deleting")
                    : t("profile.account.delete")}
                </Text>
                {accountActionLoading === "delete" ? (
                  <ActivityIndicator size="small" color={theme.danger} />
                ) : null}
              </View>
            </Pressable>
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
                  {Array.from(
                    { length: Math.ceil(statCards.length / 2) },
                    (_, rowIdx) => (
                      <View key={rowIdx} style={styles.statsRow}>
                        {statCards
                          .slice(rowIdx * 2, rowIdx * 2 + 2)
                          .map((stat) => (
                            <StatCard
                              key={stat.label}
                              icon={stat.icon}
                              value={stat.value}
                              label={stat.label}
                              iconColor={stat.iconColor}
                            />
                          ))}
                      </View>
                    )
                  )}
                </View>

                {subjectTotalsForBreakdown.length > 0 && (
                  <View style={styles.breakdownSection}>
                    <View style={[styles.subjectsHeaderRow, styles.statsBreakdownHeader]}>
                      <View style={styles.sectionTitleGroup}>
                        <Text variant="subtitle" style={[styles.subjectsSectionTitle, styles.statsBreakdownTitle]}>
                          {t("profile.subjects.breakdownTitle")}
                        </Text>
                        {sessionTotals.totalSeconds > 0 ? (
                          <Text variant="caption" colorName="textMuted" style={styles.subjectsCount}>
                            {formatDurationCompact(sessionTotals.totalSeconds)}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    <ListCard padding={8} style={styles.subjectsListCard}>
                      {subjectTotalsForBreakdown.map((row, index) => {
                        const subjectColor = subjectColorById[row.parentId] ?? theme.primary;
                        return (
                          <ListItem
                            key={row.parentId}
                            style={{ pointerEvents: "box-none" }}
                            isLast={index === subjectTotalsForBreakdown.length - 1}
                            paddingVertical={6}
                            paddingHorizontal={6}
                          >
                            <View style={[styles.subjectInfo, styles.subjectRowInner, { pointerEvents: "none" }]}>
                              <View
                                style={[
                                  styles.subjectColorBadge,
                                  { backgroundColor: subjectColor },
                                ]}
                              />
                              <Text variant="micro" colorName="textMuted" style={styles.subjectNameText}>
                                {row.parentName}
                              </Text>
                            </View>
                            <View style={[styles.subjectBreakdownTimeWrap, { pointerEvents: "none" }]}>
                              <Text
                                variant="micro"
                                colorName="textMuted"
                                style={styles.subjectBreakdownTime}
                              >
                                {formatDuration(row.totalSeconds)}
                              </Text>
                            </View>
                          </ListItem>
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
                <Text
                  variant="subtitle"
                  style={styles.subjectsSectionTitle}
                >
                  {t("profile.subjects.title", "My subjects")}
                </Text>
                <Text variant="caption" colorName="textMuted" style={styles.subjectsCount}>
                  {subjects.length > 0 ? `${subjects.length}` : ""}
                </Text>
              </View>
            </View>

            {user?.id ? (
              <>
                <Pressable
                  onPress={() => {
                    setAddError(null);
                    setShowAddSubjectPanel((open) => !open);
                  }}
                  style={({ pressed }) => [
                    styles.addSubjectToggle,
                    {
                      borderColor: pressed ? theme.primary : theme.divider,
                      opacity: pressed ? 0.92 : 1,
                    },
                  ]}
                >
                  {showAddSubjectPanel ? (
                    <X size={18} color={theme.textMuted} strokeWidth={2} />
                  ) : (
                    <Plus size={18} color={theme.textMuted} strokeWidth={2} />
                  )}
                  <Text variant="body" style={[styles.addSubjectToggleText, { color: theme.textMuted }]}>
                    {showAddSubjectPanel
                      ? t("common.actions.cancel")
                      : t("profile.subjects.addSubjectAction", "Add subject")}
                  </Text>
                </Pressable>

                {showAddSubjectPanel ? (
                  <View
                    style={[
                      styles.addSubjectPanel,
                      {
                        backgroundColor: theme.surface,
                        borderColor: theme.divider,
                      },
                    ]}
                  >
                    {availablePopularBankEntries.length > 0 ? (
                      <View>
                        <Text variant="caption" colorName="textMuted" style={styles.addSubjectSectionLabel}>
                          {t("profile.subjects.popularLabel", "Popular subjects")}
                        </Text>
                        <Pressable
                          onPress={() => setBankListModalVisible(true)}
                          disabled={savingSubject}
                          style={[
                            styles.bankSelectTrigger,
                            {
                              borderColor: theme.primaryDark,
                              backgroundColor: theme.surface,
                            },
                          ]}
                        >
                          <Text variant="body" style={{ color: theme.textMuted, flex: 1 }} numberOfLines={1}>
                            {t(
                              "profile.subjects.selectSubjectPlaceholder",
                              "Select a subject to add..."
                            )}
                          </Text>
                          <ChevronDown size={20} color={theme.textMuted} strokeWidth={2} />
                        </Pressable>
                      </View>
                    ) : null}

                    <View>
                      <Text variant="caption" colorName="textMuted" style={styles.addSubjectSectionLabel}>
                        {t("profile.subjects.customCreateLabel", "Or create your own")}
                      </Text>
                      <View style={styles.customCreateRow}>
                        <Input
                          value={customSubjectName}
                          onChangeText={(text) => {
                            setCustomSubjectName(text);
                            if (addError) setAddError(null);
                          }}
                          placeholder={t("timer.addSubjectPlaceholder", "Subject name")}
                          editable={!savingSubject}
                          containerStyle={styles.customCreateInput}
                          onSubmitEditing={handleCreateCustomSubject}
                          returnKeyType="done"
                        />
                        <Button
                          iconLeft={Save}
                          iconOnly
                          variant="primary"
                          size="sm"
                          onPress={handleCreateCustomSubject}
                          disabled={savingSubject || !customSubjectName.trim()}
                          loading={savingSubject}
                          accessibilityLabel={t("common.actions.save")}
                          style={styles.customCreateSaveButton}
                        />
                      </View>
                      <View style={styles.colorCreateRow}>
                        {CUSTOM_SUBJECT_CREATE_SWATCHES.map((hex) => {
                          const selected = customCreateColor === hex;
                          return (
                            <Pressable
                              key={hex}
                              onPress={() => setCustomCreateColor(hex)}
                              disabled={savingSubject}
                              style={[
                                styles.colorCreateRing,
                                selected && {
                                  borderColor: theme.primaryDark,
                                  borderWidth: 2,
                                },
                              ]}
                            >
                              <View style={[styles.colorCreateInner, { backgroundColor: hex }]} />
                            </Pressable>
                          );
                        })}
                      </View>
                      {addError ? (
                        <Text variant="caption" style={{ color: theme.danger, marginTop: 4 }}>
                          {addError}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ) : null}
              </>
            ) : null}

            {loading ? (
              <View style={styles.subjectsCard}>
                <Text variant="body" align="center" style={{ paddingVertical: 20, color: theme.textMuted }}>{t("common.status.loading")}</Text>
              </View>
              ) : subjects.length === 0 ? (
              <View style={styles.subjectsCard}>
                <Text variant="body" align="center" style={{ paddingVertical: 20, color: theme.textMuted }}>
                  {t("profile.subjects.empty", "No subjects yet")}
                </Text>
              </View>
            ) : (
              <ListCard padding={8} style={styles.subjectsListCard}>
                {subjectsOrdered.map((subjectRow, index) => {
                  const isDeleting = deletingId === subjectRow.id;
                  const subjectColor = subjectColorById[subjectRow.id] ?? theme.primary;
                  const isOwnedSubject =
                    subjectRow.owner_id != null && subjectRow.owner_id === user?.id;
                  const ownedSubjectRecordedSeconds = subjectTotalSecondsById.get(subjectRow.id) ?? 0;
                  const canPermanentlyDeleteOwned =
                    isOwnedSubject && ownedSubjectRecordedSeconds === 0;

                  return (
                    <ListItem
                      key={subjectRow.id}
                      style={{ pointerEvents: "box-none" }}
                      isLast={index === subjectsOrdered.length - 1}
                      paddingVertical={6}
                      paddingHorizontal={6}
                    >
                      <View style={[styles.subjectInfo, styles.subjectRowInner, { pointerEvents: "none" }]}>
                        <View
                          style={[
                            styles.subjectColorBadge,
                            { backgroundColor: subjectColor },
                          ]}
                        />
                        <Text variant="micro" colorName="textMuted" style={styles.subjectNameText}>
                          {getSubjectDisplayName(subjectRow, t)}
                        </Text>
                      </View>

                      <View style={[styles.subjectActions, { pointerEvents: "box-none" }]}>
                        {isDeleting ? (
                          <ActivityIndicator size="small" color={theme.textMuted} />
                        ) : (
                          <>
                            <Button
                              iconLeft={Pencil}
                              iconOnly
                              variant="ghost"
                              size="xs"
                              onPress={() => openEditSubjectModal(subjectRow)}
                              accessibilityLabel={t("profile.subjects.editSubject", "Edit subject")}
                              style={[styles.taskIconButton, { backgroundColor: theme.primaryTint }]}
                            />
                            <Button
                              iconLeft={EyeOff}
                              iconOnly
                              variant="ghost"
                              size="xs"
                              onPress={() => {
                                if (user?.id) {
                                  confirmDeleteSubject(subjectRow);
                                }
                              }}
                              accessibilityLabel={t("profile.subjects.hideSubject", "Hide subject")}
                              style={[styles.taskIconButton, { backgroundColor: theme.primaryTint }]}
                            />
                            {isOwnedSubject ? (
                              <Button
                                iconLeft={Trash}
                                iconOnly
                                variant="ghost"
                                size="xs"
                                onPress={() => handleDeleteOwnedSubject(subjectRow)}
                                disabled={!canPermanentlyDeleteOwned}
                                accessibilityLabel={
                                  canPermanentlyDeleteOwned
                                    ? t("profile.subjects.deleteOwnedPermanentA11y", "Delete custom subject")
                                    : t(
                                        "profile.subjects.deleteOwnedDisabledA11y",
                                        "Cannot delete: study time is recorded. Hide the subject instead."
                                      )
                                }
                                style={[
                                  styles.taskIconButton,
                                  { backgroundColor: theme.primaryTint },
                                  !canPermanentlyDeleteOwned && styles.subjectActionDisabled,
                                ]}
                              />
                            ) : null}
                          </>
                        )}
                      </View>
                    </ListItem>
                  );
                })}
              </ListCard>
            )}

            {!loading && (
              <View style={styles.subjectsInactiveBlock}>
                <Text variant="subtitle" style={styles.subjectsInactiveTitle}>
                  {t("profile.subjects.inactiveTitle", "Hidden subjects")}
                </Text>
                <Text variant="caption" colorName="textMuted" style={styles.subjectsInactiveHint}>
                  {t("profile.subjects.inactiveHint")}
                </Text>
                {hiddenSubjectsOrdered.length > 0 ? (
                  <ListCard padding={8} style={styles.subjectsListCard}>
                    {hiddenSubjectsOrdered.map((hiddenRow, index) => {
                      const isRestoring = restoringHiddenId === hiddenRow.id;
                      const subjectColor = subjectColorById[hiddenRow.id] ?? theme.primary;
                      return (
                        <ListItem
                          key={hiddenRow.id}
                          style={{ pointerEvents: "box-none" }}
                          isLast={index === hiddenSubjectsOrdered.length - 1}
                          paddingVertical={6}
                          paddingHorizontal={6}
                        >
                          <View style={[styles.subjectInfo, styles.subjectRowInner, { pointerEvents: "none" }]}>
                            <View
                              style={[
                                styles.subjectColorBadge,
                                { backgroundColor: subjectColor, opacity: 0.65 },
                              ]}
                            />
                            <Text variant="micro" colorName="textMuted" style={styles.subjectNameInactive}>
                              {getSubjectDisplayName(hiddenRow, t)}
                            </Text>
                          </View>
                          <View style={[styles.subjectActions, { pointerEvents: "box-none" }]}>
                            {isRestoring ? (
                              <ActivityIndicator size="small" color={theme.textMuted} />
                            ) : (
                              <Button
                                iconLeft={Eye}
                                iconOnly
                                variant="ghost"
                                size="xs"
                                onPress={() => handleRestoreHiddenSubject(hiddenRow)}
                                accessibilityLabel={t("profile.subjects.restoreSubject", "Show subject again")}
                                style={[styles.taskIconButton, { backgroundColor: theme.primaryTint }]}
                              />
                            )}
                          </View>
                        </ListItem>
                      );
                    })}
                  </ListCard>
                ) : (
                  <Text variant="micro" colorName="textMuted" style={styles.subjectsInactiveEmpty}>
                    {t("profile.subjects.inactiveEmpty")}
                  </Text>
                )}
              </View>
            )}
          </>
        )}

      {user?.id ? (
        <AcademicPathModal
          visible={academicPathModalVisible}
          onClose={() => setAcademicPathModalVisible(false)}
          userId={user.id}
          academicCategory={profile?.academic_category}
          academicYearKey={profile?.academic_year_key}
          specialtyKeys={profile?.specialty_keys}
          onSaved={async ({ category, yearId }) => {
            await updateUserMetadata({
              category,
              academic_year_key: yearId,
            });
            await refetchProfile();
            setAcademicPathMessage(t("profile.academicPath.success"));
          }}
        />
      ) : null}

      <Modal
        visible={bankListModalVisible}
        onClose={() => setBankListModalVisible(false)}
        title={t("profile.subjects.popularLabel", "Popular subjects")}
        padding={20}
        actions={{
          cancel: {
            label: t("common.actions.cancel"),
            onPress: () => setBankListModalVisible(false),
            variant: "outline",
            disabled: savingSubject,
          },
        }}
      >
        <ScrollView style={styles.bankListScroll} keyboardShouldPersistTaps="handled">
          {availablePopularBankEntries.map((item) => (
            <TouchableOpacity
              key={item.key}
              style={styles.bankListRow}
              onPress={() => handleAddPopularBankSubject(item.key)}
              disabled={savingSubject}
            >
              <View style={[styles.bankListDot, { backgroundColor: item.dotColor }]} />
              <Text variant="body" style={{ flex: 1, color: theme.text }}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {savingSubject ? (
          <View style={{ marginTop: 12, alignItems: "center" }}>
            <ActivityIndicator size="small" color={theme.primary} />
          </View>
        ) : null}
      </Modal>

      {/* Hide subject confirmation */}
      <Modal
        visible={deleteConfirmModalVisible}
        onClose={handleCancelDelete}
        title={t("profile.subjects.deleteTitle", "Retirer la matière ?")}
        padding={20}
        actions={{
          cancel: {
            label: t("common.actions.cancel"),
            onPress: handleCancelDelete,
            variant: "outline",
          },
          confirm: {
            label: t("profile.subjects.hideConfirm", "Hide"),
            onPress: handleConfirmDelete,
            variant: "primary",
            iconLeft: EyeOff,
          },
        }}
      >
        <Text variant="body" style={{ color: theme.textMuted }}>
          {t("profile.subjects.deleteMessage", "Cette matière sera retirée de votre profil.")}
        </Text>
      </Modal>

      <Modal
        visible={editSubjectModalVisible}
        onClose={closeEditSubjectModal}
        title={
          subjectToEdit &&
          subjectToEdit.owner_id != null &&
          subjectToEdit.owner_id === user?.id
            ? t("profile.subjects.editTitle", "Edit subject")
            : t("profile.subjects.customizeColor", "Customize color")
        }
        padding={20}
        actions={
          subjectToEdit && subjectToEdit.owner_id != null && subjectToEdit.owner_id === user?.id
            ? {
                cancel: {
                  label: t("common.actions.cancel"),
                  onPress: closeEditSubjectModal,
                  variant: "outline",
                  disabled: savingSubjectRename,
                },
                confirm: {
                  label: t("common.actions.save"),
                  onPress: handleSaveSubjectRename,
                  variant: "primary",
                  iconLeft: Save,
                  disabled: savingSubjectRename || !editSubjectNameInput.trim(),
                  loading: savingSubjectRename,
                },
              }
            : {
                confirm: {
                  label: t("common.actions.done", "Done"),
                  onPress: closeEditSubjectModal,
                  variant: "primary",
                },
              }
        }
      >
        {subjectToEdit ? (
          <>
            {subjectToEdit.owner_id != null && subjectToEdit.owner_id === user?.id ? (
              <Input
                value={editSubjectNameInput}
                onChangeText={setEditSubjectNameInput}
                placeholder={t("profile.subjects.editNamePlaceholder", "Subject name")}
                autoFocus
                editable={!savingSubjectRename}
                containerStyle={{ marginBottom: 12 }}
              />
            ) : (
              <Text variant="body" style={{ marginBottom: 12, color: theme.text }}>
                {getSubjectDisplayName(subjectToEdit, t)}
              </Text>
            )}
            <Text variant="body" style={{ marginBottom: 12, color: theme.textMuted }}>
              {t("profile.subjects.colorPickerSubtitle", "Select a color for {{name}}", {
                name: getSubjectDisplayName(subjectToEdit, t),
              })}
            </Text>
            <View style={styles.colorPickerGrid}>
              <TouchableOpacity
                style={[
                  styles.colorOption,
                  !subjectToEdit.custom_color && styles.colorOptionSelected,
                  { borderColor: theme.divider },
                ]}
                onPress={() => handleUpdateColor(subjectToEdit, null)}
                disabled={updatingColor || savingSubjectRename}
              >
                <View style={[styles.colorSwatch, { backgroundColor: theme.divider }]}>
                  <Text variant="caption" style={{ color: theme.textMuted }}>
                    D
                  </Text>
                </View>
                <Text variant="caption" style={{ marginTop: 4, color: theme.textMuted }}>
                  {t("profile.subjects.defaultColor", "Default")}
                </Text>
              </TouchableOpacity>
              {(theme.subjectPalette ?? []).map((color, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.colorOption,
                    subjectToEdit.custom_color === color && styles.colorOptionSelected,
                    { borderColor: theme.divider },
                  ]}
                  onPress={() => handleUpdateColor(subjectToEdit, color)}
                  disabled={updatingColor || savingSubjectRename}
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
        ) : null}
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
      marginBottom: 8,
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
      marginBottom: 4,
    },
    subjectsSectionTitle: {
      marginTop: 6,
      marginBottom: 6,
      fontWeight: "600",
      fontSize: 14,
    },
    subjectsCount: {
      fontSize: 11,
    },
    addSubjectToggle: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 12,
      marginBottom: 12,
      borderRadius: 14,
      borderWidth: 2,
      borderStyle: "dashed",
    },
    addSubjectToggleText: {
      fontWeight: "600",
      fontSize: 14,
    },
    addSubjectPanel: {
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      padding: 16,
      marginBottom: 16,
      gap: 16,
    },
    addSubjectSectionLabel: {
      fontWeight: "600",
      marginBottom: 8,
    },
    bankSelectTrigger: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 2,
      gap: 8,
    },
    customCreateRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      marginBottom: 10,
    },
    customCreateInput: {
      flex: 1,
      marginBottom: 0,
      minWidth: 0,
    },
    customCreateSaveButton: {
      marginTop: 2,
    },
    colorCreateRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
      alignItems: "center",
    },
    colorCreateRing: {
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: "transparent",
      alignItems: "center",
      justifyContent: "center",
    },
    colorCreateInner: {
      width: 24,
      height: 24,
      borderRadius: 12,
    },
    bankListScroll: {
      maxHeight: 320,
    },
    bankListRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 12,
      paddingHorizontal: 4,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.divider ?? theme.border,
    },
    bankListDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    subjectsListCard: {
      marginBottom: 12,
    },
    subjectsInactiveBlock: {
      marginTop: 8,
    },
    subjectsInactiveTitle: {
      marginTop: 4,
      marginBottom: 4,
      fontWeight: "600",
      fontSize: 14,
      color: theme.textMuted,
    },
    subjectsInactiveHint: {
      marginBottom: 8,
      fontSize: 11,
    },
    subjectsInactiveEmpty: {
      fontSize: 12,
      fontStyle: "italic",
    },
    subjectRowInner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    subjectNameText: {
      fontWeight: "500",
    },
    subjectNameInactive: {
      fontWeight: "500",
      opacity: 0.9,
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
      gap: 4,
    },
    subjectColorBadge: {
      width: 10,
      height: 10,
      borderRadius: 5,
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
    breakdownSection: { marginTop: 0, marginBottom: 20 },
    statsBreakdownHeader: {
      marginBottom: 2,
    },
    statsBreakdownTitle: {
      marginTop: 0,
      marginBottom: 4,
    },
    subjectBreakdownTimeWrap: {
      justifyContent: "center",
      marginLeft: 10,
      flexShrink: 0,
    },
    subjectBreakdownTime: {
      fontWeight: "600",
      fontVariant: ["tabular-nums"],
    },
    taskIconButton: { borderRadius: 12 },
    subjectActionDisabled: { opacity: 0.4 },

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


    // Settings tab — cartes (langue, thème, compte)
    settingsCards: {
      gap: 12,
      paddingBottom: 8,
    },
    settingsCard: {
      backgroundColor: theme.surface,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    settingsDisplayNameHint: {
      marginTop: 8,
      lineHeight: 18,
    },
    settingsDisplayNameFeedback: {
      marginTop: 8,
    },
    displayNameEditorRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginTop: 10,
    },
    displayNameInputWrap: {
      flex: 1,
      minWidth: 0,
    },
    displayNameInputField: {
      backgroundColor: theme.surfaceElevated,
    },
    settingsCardRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    academicPathTextCol: {
      flex: 1,
      minWidth: 0,
      gap: 4,
    },
    academicPathChange: {
      fontWeight: "600",
      flexShrink: 0,
    },
    settingsCardLabel: {
      flex: 1,
      minWidth: 0,
      flexShrink: 1,
    },
    settingsCardLabelFill: {
      flex: 1,
    },
    settingsCardPressable: {},
    settingsCardPressed: {
      opacity: 0.92,
    },
    settingsCardDisabled: {
      opacity: 0.55,
    },
    settingsCardDanger: {
      borderColor: theme.danger,
      borderWidth: 1,
      backgroundColor: theme.dangerTint ?? "rgba(249,112,70,0.08)",
    },
    settingsCardDangerPressed: {
      opacity: 0.9,
    },
    segmentTrack: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 999,
      backgroundColor: theme.surfaceElevated,
      padding: 3,
      gap: 2,
      flexShrink: 0,
    },
    segmentCell: {
      paddingVertical: 7,
      paddingHorizontal: 12,
      borderRadius: 999,
      minWidth: 72,
      alignItems: "center",
      justifyContent: "center",
    },
    segmentCellActive: {
      backgroundColor: theme.primaryDark,
    },
    segmentCellPressed: {
      opacity: 0.8,
    },
    segmentLabel: {
      fontWeight: "600",
      fontSize: 13,
      color: theme.text,
    },
    segmentLabelActive: {
      color: theme.onPrimaryDark,
    },
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
  });

