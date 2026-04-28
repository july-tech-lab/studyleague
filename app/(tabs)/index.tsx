import { TabScreen } from "@/components/layout/TabScreen";
import { Text } from "@/components/Themed";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Tabs } from "@/components/ui/Tabs";
import Colors from "@/constants/Colors";
import {
  SUBJECT_CATALOG,
  type SubjectKey,
} from "@/constants/subjectCatalog";
import { useProfile } from '@/hooks/useProfile';
import { useSubjectGoals } from "@/hooks/useSubjectGoals";
import { useSubjects } from "@/hooks/useSubjects";
import { useTasks } from "@/hooks/useTasks";
import { useTimer } from "@/hooks/useTimer";
import { useAuth } from '@/utils/authContext';
import { createSubjectColorMap, hexToRgba } from '@/utils/color';
import {
  buildSubjectTree,
  fetchSessionMinutesForDayAndSubject,
  getGoalMinutesForSubjectOnLocalDate,
  sortSubjectsForDisplay,
} from "@/utils/queries";
import { useTheme } from '@/utils/themeContext';
import { formatDateLabel, getTodayIso } from '@/utils/time';
import { useFocusEffect } from "expo-router";
import { ChevronDown, Flame, Plus, Sparkles, Square } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle as SvgCircle } from "react-native-svg";

/** Case- and accent-insensitive match for subject name / bank_key search (e.g. "franc" → "Français"). */
function foldAccents(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export default function TimerScreen() {
  const { user } = useAuth();
  const theme = useTheme();
  // Ensure theme is always available
  const safeTheme = React.useMemo(() => {
    return theme ?? Colors.light;
  }, [theme]);
  
  const subjectPalette = React.useMemo(
    () => safeTheme?.subjectPalette ?? [],
    [safeTheme?.subjectPalette]
  );
  
  const styles = React.useMemo(() => {
    return createStyles(safeTheme);
  }, [safeTheme]);
  const { t, i18n } = useTranslation();

  // ============================================================================
  // DATA HOOKS (Supabase-related)
  // ============================================================================
  const {
    tasks,
    refetch: refetchTasks,
  } = useTasks({
    userId: user?.id ?? null,
    autoLoad: true,
    filterStatus: ["planned", "in-progress"], // Only active tasks for timer
  });

  const {
    subjects,
    subjectTree,
    selectedSubjectId,
    selectedSubject,
    setSelectedSubjectId,
    createSubject: createSubjectHook,
    attachSubject,
    loading: subjectsLoading,
    getDisplayName,
    refetch: refetchSubjects,
  } = useSubjects({
    userId: user?.id ?? null,
    autoLoad: true,
    autoSelectFirst: true,
  });

  // Use profile hook to get allSubjects with custom_color (same source as profile page)
  const {
    allSubjects: allSubjectsFlat,
    hiddenSubjects,
    profile,
    refetch: refetchProfile,
  } = useProfile({
    userId: user?.id ?? null,
    autoLoad: true,
  });

  const { goals: weeklyGoals, refetch: refetchWeeklyGoals } = useSubjectGoals(
    user?.id ?? null
  );

  useFocusEffect(
    useCallback(() => {
      void refetchWeeklyGoals();
    }, [refetchWeeklyGoals])
  );

  // Build tree from allSubjects for consistent color mapping
  const allSubjects = React.useMemo(
    () => buildSubjectTree(allSubjectsFlat),
    [allSubjectsFlat]
  );

  // ============================================================================
  // UI STATE (Component-only state)
  // ============================================================================
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [listTab, setListTab] = useState<"subjects" | "tasks">("subjects");
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [bankListModalVisible, setBankListModalVisible] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newSubjectCreateColor, setNewSubjectCreateColor] = useState(
    () => safeTheme.subjectPalette?.[0] ?? safeTheme.primary
  );
  const [addSubjectError, setAddSubjectError] = useState<string | null>(null);
  const [savingSubject, setSavingSubject] = useState(false);
  const addSubjectModalWasVisible = React.useRef(false);

  // Reset name/errors/color only when the modal opens — not on every theme
  // palette reference change while open (that was clearing the user's color choice).
  useEffect(() => {
    if (addModalVisible && !addSubjectModalWasVisible.current) {
      setNewSubjectCreateColor(safeTheme.subjectPalette?.[0] ?? safeTheme.primary);
      setAddSubjectError(null);
    }
    addSubjectModalWasVisible.current = addModalVisible;
  }, [addModalVisible, safeTheme.subjectPalette, safeTheme.primary]);

  // Memoize timer callbacks to prevent unnecessary re-renders
  const handleSessionComplete = useCallback(
    async (_sessionId: string, sessionSeconds: number) => {
      const subjectForLog = selectedSubject;
      const minutes = Math.floor(sessionSeconds / 60);

      if (subjectForLog && user?.id) {
        const subjectIdForGoal = subjectForLog.id;
        const dayGoal = getGoalMinutesForSubjectOnLocalDate(
          weeklyGoals,
          subjectIdForGoal,
          new Date()
        );

        let message: string;
        if (dayGoal > 0) {
          const doneToday = await fetchSessionMinutesForDayAndSubject(
            user.id,
            getTodayIso(),
            subjectIdForGoal
          );
          message = t("timer.sessionFinishedWithDailyGoal", {
            minutes,
            subject: getDisplayName(subjectForLog),
            doneToday,
            dayGoal,
          });
        } else {
          message = t("timer.sessionFinishedMessage", {
            minutes,
            subject: getDisplayName(subjectForLog),
          });
        }

        Alert.alert(t("timer.sessionFinishedTitle"), message);
      }

      await refetchTasks();
      await refetchProfile();
    },
    [
      selectedSubject,
      t,
      refetchTasks,
      refetchProfile,
      getDisplayName,
      user?.id,
      weeklyGoals,
    ]
  );

  const handleTimerError = useCallback(
    (error: Error) => {
      Alert.alert(t("timer.errorTitle"), error.message || t("timer.errorSave"));
    },
    [t]
  );

  const {
    isRunning,
    start: timerStart,
    stop: timerStop,
    formattedTime,
    seconds: timerSeconds,
  } = useTimer({
    userId: user?.id ?? null,
    onSessionComplete: handleSessionComplete,
    onError: handleTimerError,
  });

  // Use utility function for color mapping (moved before subjectListData)
  // Use allSubjects for consistent colors across profile and index pages
  const subjectColorById = React.useMemo(
    () => {
      // Use allSubjects if available, otherwise fall back to subjectTree
      const treeForColors = allSubjects.length > 0 ? allSubjects : subjectTree;
      return createSubjectColorMap(treeForColors, subjectPalette, safeTheme.primary);
    },
    [allSubjects, subjectTree, subjectPalette, safeTheme.primary]
  );

  const subjectsOrdered = React.useMemo(
    () => sortSubjectsForDisplay(subjects),
    [subjects]
  );

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

  const addableBankCatalogEntries = useMemo(() => {
    const out: { key: SubjectKey; label: string; dotColor: string }[] = [];
    for (const key of Object.keys(SUBJECT_CATALOG) as SubjectKey[]) {
      const entry = SUBJECT_CATALOG[key];
      if (!entry) continue;
      const catalogRow = allSubjectsFlat.find((s) => s.bank_key === key);
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
  }, [allSubjectsFlat, t, userAttachedSubjectIds, userBankKeys]);

  const addableBankCatalogSorted = useMemo(
    () =>
      [...addableBankCatalogEntries].sort((a, b) =>
        a.label.localeCompare(b.label, undefined, { sensitivity: "base" })
      ),
    [addableBankCatalogEntries]
  );

  const customInputBankSuggestions = useMemo(() => {
    const q = newSubjectName.trim();
    if (!q) return [];
    const qFold = foldAccents(q);
    const matched = addableBankCatalogEntries.filter((item) => {
      const labelFold = foldAccents(item.label);
      const keyFold = foldAccents(item.key.replace(/_/g, " "));
      return labelFold.includes(qFold) || keyFold.includes(qFold);
    });
    matched.sort((a, b) => {
      const aLabel = foldAccents(a.label);
      const bLabel = foldAccents(b.label);
      const aKey = foldAccents(a.key.replace(/_/g, " "));
      const bKey = foldAccents(b.key.replace(/_/g, " "));
      const aStarts = aLabel.startsWith(qFold) || aKey.startsWith(qFold);
      const bStarts = bLabel.startsWith(qFold) || bKey.startsWith(qFold);
      if (aStarts !== bStarts) return aStarts ? -1 : 1;
      return aLabel.length - bLabel.length;
    });
    return matched.slice(0, 12);
  }, [addableBankCatalogEntries, newSubjectName]);

  // One row per matière (plus de regroupement parent / enfant)
  const subjectListData = React.useMemo(() => {
    const primaryColor = safeTheme.primary;
    return subjectsOrdered.map((sub) => {
      const subjectColor = subjectColorById[sub.id] ?? primaryColor;
      return {
        sub,
        subjectColor,
      };
    });
  }, [subjectsOrdered, subjectColorById, safeTheme.primary]);


  // Check if we have a valid subject selected (must exist in tree AND in subjects list)
  // IMPORTANT: This must be defined BEFORE useFocusEffect, useEffect, and handleStart
  const hasValidSubject = React.useMemo(() => !!selectedSubject, [selectedSubject]);

  // Pulse animation for the ring when timer is running
  const pulseOpacity = useSharedValue(0);
  const pulseAnimatedStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));
  useEffect(() => {
    if (isRunning) {
      pulseOpacity.value = withRepeat(
        withTiming(0.4, { duration: 1200 }),
        -1,
        true
      );
    } else {
      pulseOpacity.value = withTiming(0, { duration: 300 });
    }
  }, [isRunning, pulseOpacity]);

  // Refresh tasks and subjects when tab comes into focus
  // This ensures data stays in sync when switching between tabs
  useFocusEffect(
    useCallback(() => {
      refetchTasks();
      refetchSubjects();
      void refetchProfile();
    }, [refetchTasks, refetchSubjects, refetchProfile])
  );

  // Debug effect to log state changes (only in dev, excludes timer seconds updates)
  React.useEffect(() => {
    if (__DEV__) {
      console.log("=== INDEX PAGE STATE DEBUG ===");
      console.log("user?.id:", user?.id);
      console.log("selectedSubjectId:", selectedSubjectId);
      console.log("selectedSubject:", selectedSubject?.name ?? "null");
      console.log("hasValidSubject:", hasValidSubject);
      console.log("subjectTree.length:", subjectTree.length);
      console.log("subjects.length:", subjects.length);
      console.log("isRunning:", isRunning);
      console.log("listTab:", listTab);
      console.log("tasks.length:", tasks.length);
      console.log("subjectsLoading:", subjectsLoading);
    }
    // Note: This effect intentionally excludes timer seconds to avoid spam
    // Timer updates happen every second and are handled separately
  }, [
    user?.id,
    selectedSubjectId,
    selectedSubject?.name,
    hasValidSubject,
    subjectTree.length,
    subjects.length,
    isRunning,
    listTab,
    tasks.length,
    subjectsLoading,
  ]);

  // Timer actions
  const handleStart = async () => {
    if (isRunning) {
      console.warn("Timer already running");
      return;
    }
    
    // Validate subject before starting
    if (!hasValidSubject || !selectedSubject) {
      console.warn("Cannot start timer: no valid subject selected", {
        hasValidSubject,
        selectedSubjectId,
        selectedSubject: !!selectedSubject,
        subjectTreeLength: subjectTree.length,
      });
      Alert.alert(
        t("timer.errorTitle"),
        t("subjects.select.hint")
      );
      return;
    }

    console.log("Starting timer", {
      subjectId: selectedSubjectId,
      subjectName: selectedSubject.name,
      taskId: selectedTaskId,
    });
    
    const started = await timerStart();
    if (!started) {
      Alert.alert(
        t("timer.errorTitle"),
        t("timer.permissionDenied")
      );
    }
  };

  const handleStop = async () => {
    if (!selectedSubject) {
      Alert.alert(t("timer.errorTitle"), t("timer.errorSave"));
      console.warn("Stop session aborted: missing subject");
      return;
    }

    try {
      const result = await timerStop(selectedSubject.id, selectedTaskId ?? null);

      if (!result.saved) {
        Alert.alert(t("timer.sessionNotRecorded"), t("timer.errorSave"));
      }
    } catch (error: any) {
      // Error handling is done in the hook's onError callback
      console.error("Error stopping timer", error);
    }
  };

  const handleAddPopularBankSubject = async (key: SubjectKey) => {
    if (!user?.id) return;
    const entry = SUBJECT_CATALOG[key];
    if (!entry) return;
    const catalogRow = allSubjectsFlat.find((s) => s.bank_key === key);
    setSavingSubject(true);
    setAddSubjectError(null);
    setBankListModalVisible(false);
    try {
      if (catalogRow) {
        await attachSubject(catalogRow.id);
        setSelectedSubjectId(catalogRow.id);
      } else {
        const name = t(`subjectCatalog.${key}`);
        const created = await createSubjectHook(name, {
          bankKey: key,
          color: entry.defaultColor,
          icon: entry.icon,
        });
        setSelectedSubjectId(created.id);
      }
      await refetchProfile();
      await refetchSubjects();
      setNewSubjectName("");
      setAddModalVisible(false);
    } catch (err: any) {
      console.error("Unable to add catalog subject", err);
      setAddSubjectError(
        err?.message ?? t("profile.subjects.addError", "Impossible d'ajouter la matière")
      );
    } finally {
      setSavingSubject(false);
    }
  };

  const handleCreateSubject = async () => {
    const name = newSubjectName.trim();
    if (!name) {
      setAddSubjectError(t("common.errors.unexpected"));
      return;
    }

    setSavingSubject(true);
    setAddSubjectError(null);
    try {
      const created = await createSubjectHook(name, {
        color: newSubjectCreateColor,
        icon: "bookmark",
      });
      setSelectedSubjectId(created.id);
      await refetchProfile();
      await refetchSubjects();
      setNewSubjectName("");
      setAddModalVisible(false);
    } catch (error: any) {
      console.error("Unable to create subject", error);
      setAddSubjectError(error.message ?? t("timer.errorSave"));
    } finally {
      setSavingSubject(false);
    }
  };

  const selectedSubjectLabel = React.useMemo(() => {
    if (!selectedSubject) return t("subjects.select.missing");
    return getDisplayName(selectedSubject);
  }, [selectedSubject, t, getDisplayName]);

  const selectedSubjectColor = React.useMemo(() => {
    if (!selectedSubjectId) return null;
    return subjectColorById[selectedSubjectId] ?? safeTheme.primary;
  }, [selectedSubjectId, subjectColorById, safeTheme.primary]);

  const xpFormattedHeader = React.useMemo(
    () =>
      new Intl.NumberFormat(i18n.language?.startsWith("fr") ? "fr-FR" : "en-US").format(
        profile?.xp_total ?? 0
      ),
    [profile?.xp_total, i18n.language]
  );

  const headerBadges =
    user?.id != null ? (
      <View style={styles.headerBadgesRow}>
        <View
          style={[styles.headerBadge, { backgroundColor: safeTheme.secondaryTint }]}
          accessibilityRole="text"
          accessibilityLabel={t("timer.badges.xpA11y", { formatted: xpFormattedHeader })}
        >
          <Sparkles size={14} color={safeTheme.secondaryDark} />
          <Text style={[styles.headerBadgeText, { color: safeTheme.secondaryDark }]}>
            {xpFormattedHeader} XP
          </Text>
        </View>
        <View
          style={[styles.headerBadge, { backgroundColor: safeTheme.secondaryTint }]}
          accessibilityRole="text"
          accessibilityLabel={`${t("profile.stats.streak")}, ${t("profile.stats.streakValue", {
            count: profile?.current_streak ?? 0,
          })}`}
        >
          <Flame size={14} color={safeTheme.secondaryDark} />
          <Text style={[styles.headerBadgeText, { color: safeTheme.secondaryDark }]}>
            {t("timer.badges.streakShort", { count: profile?.current_streak ?? 0 })}
          </Text>
        </View>
      </View>
    ) : null;

  return (
    <TabScreen
      title={t("tabs.focus")}
      gap={6}
      scroll={false}
      rightAction={headerBadges}
    >
        {/* BIG TIMER */}
        <View style={styles.timerContainer}>
          {/* Circular progress ring (thin track + thicker progress arc) */}
          <View style={styles.timerRingWrapper}>
            {/* Pulse ring (visible when running) */}
            {isRunning && (
              <Animated.View style={[styles.timerPulseRing, pulseAnimatedStyle]} pointerEvents="none">
                <Svg width={236} height={236} style={styles.timerPulseSvg}>
                  <SvgCircle
                    cx={118}
                    cy={118}
                    r={110}
                    stroke={hexToRgba(safeTheme.primary, 0.12)}
                    strokeWidth={3}
                    fill="none"
                  />
                </Svg>
              </Animated.View>
            )}
            <Svg width={220} height={220} style={styles.timerRingSvg}>
              <SvgCircle
                cx={110}
                cy={110}
                r={94}
                stroke={hexToRgba(safeTheme.textMuted, 0.1)}
                strokeWidth={8}
                fill="none"
              />
              <SvgCircle
                cx={110}
                cy={110}
                r={94}
                stroke={safeTheme.primary}
                strokeWidth={15}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={
                  (() => {
                    const circumference = 2 * Math.PI * 94;
                    const progress = isRunning ? Math.min(1, timerSeconds / 1500) : 0;
                    return `${progress * circumference} ${circumference}`;
                  })()
                }
                transform="rotate(-90 110 110)"
              />
            </Svg>
            <View style={styles.timerTextContainer}>
              <View style={styles.timerCenterColumn}>
                <View style={styles.timerInsideSubjectRow}>
                  {selectedSubjectColor ? (
                    <View
                      style={[
                        styles.timerSubjectDotInside,
                        { backgroundColor: selectedSubjectColor },
                      ]}
                    />
                  ) : null}
                  <Text
                    variant="caption"
                    colorName="textMuted"
                    align="center"
                    numberOfLines={2}
                    style={styles.timerInsideSubjectLabel}
                  >
                    {selectedSubjectLabel}
                  </Text>
                </View>
                <Text
                  style={styles.timerText}
                  align="center"
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.72}
                  {...(Platform.OS === "android" ? { includeFontPadding: false } : {})}
                >
                  {formattedTime.hours}:{formattedTime.mins}:{formattedTime.secs}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.focusBadgeSlot}>
            {/* Messages above button (variable height) */}
            <View style={styles.buttonMessagesArea}>
              {!isRunning && !hasValidSubject && (
                <Text variant="micro" colorName="textMuted" align="center">
                  {t("subjects.select.hint")}
                </Text>
              )}
            </View>
            {/* Button always in same place (Start or Stop) */}
            {isRunning ? (
              <Button
                title={t("timer.stop")}
                variant="secondary"
                onPress={handleStop}
                fullWidth
                style={{ backgroundColor: safeTheme.secondary }}
                textStyle={{ color: safeTheme.onPrimaryDark }}
              />
            ) : (
              <Button
                title={t("timer.startButton")}
                variant="primary"
                onPress={(e) => {
                  console.log("Start button pressed", { hasValidSubject, selectedSubjectId, event: e });
                  handleStart();
                }}
                disabled={!hasValidSubject }
                loading={false}
                fullWidth
              />
            )}
          </View>
        </View>

        <Tabs
          variant="underline"
          options={[
            { value: "subjects", label: t("timer.tabSubjects") },
            { value: "tasks", label: t("timer.tabTasks") },
          ]}
          value={listTab}
          onChange={(newTab) => {
            console.log("Tab changed", { from: listTab, to: newTab });
            setListTab(newTab);
          }}
          style={{ marginBottom: 4 }}
        />

        <ScrollView
          style={styles.listScroll}
          contentContainerStyle={styles.listScrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
              {listTab === "subjects" ? (
                subjectsLoading ? (
                  <View style={styles.loaderContainer}>
                    <ActivityIndicator size="large" color={safeTheme.primary} />
                  </View>
                ) : (
                  <View style={styles.listCardStack}>
                    {subjectListData.map((item) => {
                      const sub = item.sub;
                      const subjectColor = item.subjectColor;
                      const isRowActive = selectedSubjectId === sub.id;
                      const disableRowInteraction = isRunning && !isRowActive;

                      return (
                        <TouchableOpacity
                          key={sub.id}
                          activeOpacity={0.85}
                          style={[
                            styles.listRow,
                            styles.listRowCard,
                            isRowActive && {
                              backgroundColor: hexToRgba(subjectColor, 0.08),
                            },
                            disableRowInteraction && { opacity: 0.45 },
                          ]}
                          onPress={() => {
                            if (isRunning && !isRowActive) return;
                            setSelectedSubjectId(sub.id);
                          }}
                          disabled={disableRowInteraction}
                        >
                          <View
                            style={[
                              styles.subjectColorDot,
                              { backgroundColor: subjectColor },
                              disableRowInteraction && { opacity: 0.6 },
                            ]}
                          />
                          <Text
                            variant="subtitle"
                            colorName={isRowActive ? "text" : "textMuted"}
                            style={[
                              isRowActive ? { fontWeight: "600" } : undefined,
                              { flex: 1, minWidth: 0 },
                            ]}
                            numberOfLines={1}
                          >
                            {getDisplayName(sub)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )
            ) : (
              // Show loading indicator for tasks if needed
              tasks.length === 0 && !subjectsLoading ? (
                <View style={styles.loaderContainer}>
                  <Text colorName="textMuted">
                    {t("timer.tasksEmpty")}
                  </Text>
                </View>
              ) : (
                <View style={styles.listCardStack}>
                  {tasks
                    .filter((t) => t.status !== "done" && t.subjectId)
                    .map((task) => {
                      const isSelected = selectedTaskId === task.id;
                      
                      // Get subject info
                      const taskSubject = task.subjectId
                        ? subjects.find((s) => s.id === task.subjectId)
                        : undefined;
                      const subjectName = taskSubject
                        ? getDisplayName(taskSubject)
                        : task.subjectName?.trim()
                          ? getDisplayName({ name: task.subjectName })
                          : t("tasks.form.subject");
                      const taskSubjectId = task.subjectId!;
                      const taskSubjectColor = subjectColorById[taskSubjectId] ?? safeTheme.primary;
                      
                      // Calculate time info
                      const planned = task.plannedMinutes ?? 0;
                      const loggedMinutes = Math.round(task.loggedSeconds / 60);
                      
                      // Format date
                      const todayIso = getTodayIso();
                      const formattedDate = task.scheduledFor 
                        ? (formatDateLabel(task.scheduledFor, todayIso) === "Today" 
                            ? t("tasks.today") 
                            : formatDateLabel(task.scheduledFor, todayIso))
                        : null;
                      
                      return (
                        <TouchableOpacity
                          key={task.id}
                          activeOpacity={0.85}
                          style={[
                            styles.listRow,
                            styles.listRowCard,
                            styles.listRowTask,
                            isSelected && {
                              backgroundColor: hexToRgba(taskSubjectColor, 0.08),
                            },
                          ]}
                          onPress={() => {
                            if (task.subjectId) {
                              setSelectedSubjectId(task.subjectId);
                            }
                            setSelectedTaskId(task.id);
                          }}
                        >
                          <View
                            style={[
                              styles.subjectColorDot,
                              styles.taskRowDot,
                              { backgroundColor: taskSubjectColor },
                            ]}
                          />
                          <View style={styles.taskContent}>
                            <View style={styles.taskHeader}>
                              <Text
                                variant="subtitle"
                                colorName={isSelected ? "text" : "textMuted"}
                                style={[
                                  isSelected ? { fontWeight: "600" } : undefined,
                                  { flex: 1 },
                                ]}
                                numberOfLines={1}
                              >
                                {task.title}
                              </Text>
                              <Text variant="micro" colorName="textMuted" style={styles.timeLabel}>
                                {planned > 0
                                  ? `${loggedMinutes}/${planned} min`
                                  : `${loggedMinutes} min`}
                              </Text>
                            </View>
                            <Text variant="micro" colorName="textMuted" style={styles.taskMeta}>
                              {subjectName}
                              {formattedDate && ` • ${formattedDate}`}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                </View>
              )
            )}
        </ScrollView>

      {/* FLOATING ADD BUTTON (Pour aller vers Profil/Ajout) - Only in subjects tab */}
      {!isRunning && listTab === "subjects" && (
        <Button
          iconLeft={Plus}
          iconOnly
          variant="primary"
          size="lg"
          onPress={(e) => {
            console.log("Add button pressed", { event: e });
            setAddModalVisible(true);
          }}
          style={styles.addButton}
        />
      )}

      {/* Add Subject Modal */}
      <Modal
        visible={addModalVisible}
        onClose={() => {
          setNewSubjectName("");
          setBankListModalVisible(false);
          setAddSubjectError(null);
          setAddModalVisible(false);
        }}
        title={t("timer.addSubjectModalTitle", "Add subject")}
        actions={{
          cancel: {
            label: t("common.actions.cancel"),
            onPress: () => {
              setNewSubjectName("");
              setBankListModalVisible(false);
              setAddSubjectError(null);
              setAddModalVisible(false);
            },
            variant: "ghost",
            disabled: savingSubject,
          },
          confirm: {
            label: savingSubject
              ? t("common.status.saving")
              : t("common.actions.create"),
            onPress: () => void handleCreateSubject(),
            variant: "primary",
            disabled: savingSubject || !newSubjectName.trim(),
            loading: savingSubject,
          },
        }}
      >
        <Input
          value={newSubjectName}
          onChangeText={(text) => {
            setNewSubjectName(text);
            if (addSubjectError) setAddSubjectError(null);
          }}
          placeholder={t("profile.subjects.createSubjectPlaceholder", "Create a subject")}
          autoFocus
          editable={!savingSubject}
          containerStyle={{ marginBottom: 0 }}
          onSubmitEditing={() => Keyboard.dismiss()}
          returnKeyType="done"
          blurOnSubmit
          rightIcon={addableBankCatalogSorted.length > 0 ? ChevronDown : undefined}
          onRightIconPress={
            addableBankCatalogSorted.length > 0
              ? () => setBankListModalVisible(true)
              : undefined
          }
        />
        <View style={styles.addSubjectColorWrap}>
          {(safeTheme.subjectPalette?.length
            ? safeTheme.subjectPalette
            : [safeTheme.primary]
          ).map((hex) => {
            const selected = newSubjectCreateColor === hex;
            return (
              <TouchableOpacity
                key={hex}
                style={[
                  styles.addSubjectColorChip,
                  selected && styles.addSubjectColorChipSelected,
                ]}
                onPress={() => setNewSubjectCreateColor(hex)}
                disabled={savingSubject}
                accessibilityState={{ selected }}
              >
                <View style={[styles.addSubjectColorDot, { backgroundColor: hex }]} />
              </TouchableOpacity>
            );
          })}
        </View>
        {customInputBankSuggestions.length > 0 ? (
          <View
            style={[
              styles.bankSuggestDropdown,
              {
                borderColor: safeTheme.divider,
                backgroundColor: safeTheme.surface,
              },
            ]}
            accessibilityRole="list"
            accessibilityLabel={t("profile.subjects.searchResults", "Search results")}
          >
            <ScrollView
              style={styles.bankSuggestScroll}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
            >
              {customInputBankSuggestions.map((item, idx) => (
                <TouchableOpacity
                  key={item.key}
                  style={[
                    styles.bankListRow,
                    idx === customInputBankSuggestions.length - 1 && styles.bankListRowLast,
                  ]}
                  onPress={() => {
                    Keyboard.dismiss();
                    setNewSubjectName("");
                    void handleAddPopularBankSubject(item.key);
                  }}
                  disabled={savingSubject}
                >
                  <View style={[styles.bankListDot, { backgroundColor: item.dotColor }]} />
                  <Text variant="body" style={{ flex: 1, color: safeTheme.text }}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ) : null}
        {addSubjectError ? (
          <Text variant="caption" style={{ color: safeTheme.danger, marginTop: 8 }}>
            {addSubjectError}
          </Text>
        ) : null}
      </Modal>

      <Modal
        visible={bankListModalVisible}
        onClose={() => setBankListModalVisible(false)}
        title={t("profile.subjects.available", "Available subjects")}
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
          {addableBankCatalogSorted.map((item) => (
            <TouchableOpacity
              key={item.key}
              style={styles.bankListRow}
              onPress={() => void handleAddPopularBankSubject(item.key)}
              disabled={savingSubject}
            >
              <View style={[styles.bankListDot, { backgroundColor: item.dotColor }]} />
              <Text variant="body" style={{ flex: 1, color: safeTheme.text }}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {savingSubject ? (
          <View style={{ marginTop: 12, alignItems: "center" }}>
            <ActivityIndicator size="small" color={safeTheme.primary} />
          </View>
        ) : null}
      </Modal>

    </TabScreen>
  );
}

// ------------------------------------------------------------------
// STYLES
// ------------------------------------------------------------------
function createStyles(theme: typeof Colors.light) {
  return StyleSheet.create({
    headerBadgesRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 6,
      flexShrink: 1,
    },
    headerBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 999,
    },
    headerBadgeText: {
      fontSize: 11,
      fontWeight: "700",
    },
    container: { 
      flex: 1,
    },
    contentArea: {
      flex: 1,
      justifyContent: "flex-start",
    },
    listScroll: {
      flex: 1,
      minHeight: 0,
    },
    listScrollContent: {
      flexGrow: 1,
      paddingBottom: 8,
    },
    addSubjectColorWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 12,
    },
    addSubjectColorChip: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.surfaceElevated,
      alignItems: "center",
      justifyContent: "center",
    },
    addSubjectColorChipSelected: {
      backgroundColor: theme.primaryTint,
      borderWidth: 1.5,
      borderColor: theme.primaryDark,
    },
    addSubjectColorDot: {
      width: 26,
      height: 26,
      borderRadius: 13,
    },
    bankListScroll: {
      maxHeight: 320,
    },
    bankSuggestDropdown: {
      marginTop: 8,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      overflow: "hidden",
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.1,
          shadowRadius: 6,
        },
        android: { elevation: 3 },
        default: {},
      }),
    },
    bankSuggestScroll: {
      maxHeight: 220,
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
    bankListRowLast: {
      borderBottomWidth: 0,
    },
    bankListDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    listCardStack: {
      gap: 8,
    },
    listRow: {
      flexDirection: "row",
      alignItems: "center",
      minWidth: 0,
      paddingVertical: 9,
      paddingLeft: 12,
      paddingRight: 12,
    },
    listRowCard: {
      backgroundColor: theme.surfaceElevated,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 14,
    },
    listRowTask: {
      alignItems: "flex-start",
      paddingVertical: 8,
    },
    taskRowDot: {
      marginTop: 4,
    },
    contentAreaRunning: {
      justifyContent: "center",
      paddingHorizontal: 4,
    },

    // TIMER — PREMIUM NEUTRAL VERSION
    timerRingWrapper: {
      position: "relative",
      width: 236,
      height: 236,
      alignItems: "center",
      justifyContent: "center",
    },
    timerPulseRing: {
      position: "absolute",
      left: 0,
      top: 0,
      width: 236,
      height: 236,
      alignItems: "center",
      justifyContent: "center",
    },
    timerPulseSvg: {
      position: "absolute",
    },
    timerRingSvg: {
      position: "absolute",
      left: 8,
      top: 8,
    },
    timerTextContainer: {
      position: "absolute",
      left: 8,
      top: 8,
      width: 220,
      height: 220,
      justifyContent: "center",
      alignItems: "center",
    },
    timerCenterColumn: {
      alignItems: "center",
      justifyContent: "center",
      width: "100%",
      paddingHorizontal: 14,
      gap: 4,
    },
    timerInsideSubjectRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      maxWidth: "100%",
    },
    timerSubjectDotInside: {
      width: 6,
      height: 6,
      borderRadius: 3,
      flexShrink: 0,
    },
    timerInsideSubjectLabel: {
      flexShrink: 1,
      textAlign: "center",
    },
    timerTimeCenterWrap: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 12,
    },
    timerSubjectBelowRing: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      marginTop: 8,
      gap: 5,
      paddingHorizontal: 24,
      maxWidth: "100%",
      alignSelf: "stretch",
    },
    timerContainer: { 
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 4,
      paddingHorizontal: 16,
      marginTop: 0,
      marginBottom: 0,
    },
    timerText: {
      width: "100%",
      fontSize: 24,
      fontWeight: "500",
      fontVariant: ["tabular-nums"],
      lineHeight: 30,
      textAlign: "center",
      color: theme.text,
    },
    timerSubjectDot: {
      width: 5,
      height: 5,
      borderRadius: 2.5,
      opacity: 0.55,
    },
    timerSubjectLabel: {
      flexShrink: 1,
    },
    buttonMessagesArea: {
      minHeight: 0,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 4,
    },
    buttonMessagesAreaWithHint: {
      minHeight: 20,
      marginBottom: 6,
    },
    focusBadgeSlot: {
      marginTop: 0,
      alignItems: "center",
      width: "100%",
    },
    // SUBJECT / TASK LIST (pill cards)
    subjectColorDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      marginRight: 12,
      flexShrink: 0,
    },
    taskContent: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    taskHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    timeLabel: {
      marginRight: 0,
    },
    taskMeta: {
      marginTop: 0,
    },
    list: {
      flex: 1,
    },
    loaderContainer: {
      alignItems: "center",
      paddingVertical: 32,
    },

    // ADD BUTTON
    addButton: {
      position: "absolute",
      right: 20,
      bottom: 30,
      width: 60,
      height: 60,
      borderRadius: 30,
      zIndex: 1000, // Ensure it's above other content
      // NOTE: Button component handles styling, this just sets size and position for floating button
    },

  });
}