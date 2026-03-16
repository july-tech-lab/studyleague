import { TabScreen } from "@/components/layout/TabScreen";
import { Text } from "@/components/Themed";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { SubjectPicker } from "@/components/ui/SubjectPicker";
import { Tabs } from "@/components/ui/Tabs";
import Colors from "@/constants/Colors";
import { useProfile } from '@/hooks/useProfile';
import { useStudyMode } from "@/hooks/useStudyMode";
import { useSubjects } from "@/hooks/useSubjects";
import { useTasks } from "@/hooks/useTasks";
import { useTimer } from "@/hooks/useTimer";
import { useAuth } from '@/utils/authContext';
import { createSubjectColorMap, getReadableTextColor, hexToRgba } from '@/utils/color';
import { buildSubjectTree, SubjectNode } from '@/utils/queries';
import { useTheme } from '@/utils/themeContext';
import { formatDateLabel, getTodayIso } from '@/utils/time';
import { useFocusEffect, useRouter } from "expo-router";
import { Bell, Plus, Square, Target } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Alert, Platform, StyleSheet, TouchableOpacity, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle as SvgCircle } from "react-native-svg";

export default function TimerScreen() {
  const { user } = useAuth();
  const theme = useTheme();
  const router = useRouter();
  
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
  const { t } = useTranslation();

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
    loading: subjectsLoading,
  } = useSubjects({
    userId: user?.id ?? null,
    autoLoad: true,
    autoSelectFirst: true,
  });

  // Use profile hook to get allSubjects with custom_color (same source as profile page)
  const {
    allSubjects: allSubjectsFlat,
  } = useProfile({
    userId: user?.id ?? null,
    autoLoad: true,
  });

  // Build tree from allSubjects for consistent color mapping
  const allSubjects = React.useMemo(
    () => buildSubjectTree(allSubjectsFlat),
    [allSubjectsFlat]
  );

  // ============================================================================
  // STUDY MODE HOOK
  // ============================================================================
  const {
    hasPermission: hasFocusPermission,
    isLoading: focusModeLoading,
    enable: enableFocusMode,
    requestPermission: requestFocusPermission,
    presentAppPicker,
    checkSelectedApps,
  } = useStudyMode();

  // ============================================================================
  // UI STATE (Component-only state)
  // ============================================================================
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [listTab, setListTab] = useState<"subjects" | "tasks">("subjects");
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [selectedParentSubjectId, setSelectedParentSubjectId] = useState<string | null>(null);
  const [savingSubject, setSavingSubject] = useState(false);
  const [permissionModalVisible, setPermissionModalVisible] = useState(false);
  const [appPickerModalVisible, setAppPickerModalVisible] = useState(false);

  // Helper function to find subject with parent (needed for timer callbacks)
  const findSubjectWithParent = React.useCallback(
    (
      tree: SubjectNode[],
      id: string | null,
      parent?: SubjectNode
    ): { node: SubjectNode; parent?: SubjectNode } | null => {
      if (!id) return null;
      for (const node of tree) {
        if (node.id === id) return { node, parent };
        const childResult = findSubjectWithParent(node.children, id, node);
        if (childResult) return childResult;
      }
      return null;
    },
    []
  );

  // Memoize timer callbacks to prevent unnecessary re-renders
  const handleSessionComplete = useCallback(
    async (sessionId: string, sessionSeconds: number) => {
      const selection = findSubjectWithParent(subjectTree, selectedSubjectId);
      const subjectForLog = selection?.node;
      
      if (subjectForLog) {
        Alert.alert(
          t("timer.sessionFinishedTitle"),
          t("timer.sessionFinishedMessage", {
            minutes: Math.floor(sessionSeconds / 60),
            subject: subjectForLog.name,
          })
        );
      }
      await refetchTasks();
    },
    [findSubjectWithParent, subjectTree, selectedSubjectId, t, refetchTasks]
  );

  const handleTimerError = useCallback(
    (error: Error) => {
      Alert.alert(t("timer.errorTitle"), error.message || t("timer.errorSave"));
    },
    [t]
  );

  // Use timer hook - focus mode not required on web (not available)
  const requireFocusMode = Platform.OS !== 'web';
  const {
    isRunning,
    start: timerStart,
    stop: timerStop,
    formattedTime,
    focusModeActive,
    canStart: timerCanStart,
    seconds: timerSeconds,
  } = useTimer({
    userId: user?.id ?? null,
    onSessionComplete: handleSessionComplete,
    onError: handleTimerError,
    requireFocusMode,
    onFocusModeLost: () => {
      Alert.alert(
        t("timer.focusModeLost"),
        t("timer.resumeRequiresFocus")
      );
    },
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

  // Create subjectListData for FlatList (moved before useEffect that uses it)
  const subjectListData = React.useMemo(() => {
    const primaryColor = safeTheme.primary;
    return subjectTree.map((node) => {
      const subjectColor = subjectColorById[node.id] ?? primaryColor;
      return {
        node,
        subjectColor,
        textOnColor: getReadableTextColor(subjectColor),
      };
    });
  }, [subjectTree, subjectColorById, safeTheme.primary]);


  // Check if we have a valid subject selected (must exist in tree AND in subjects list)
  // IMPORTANT: This must be defined BEFORE useFocusEffect, useEffect, and handleStart
  const hasValidSubject = React.useMemo(() => {
    // Check both that we can find it in the tree AND that selectedSubject exists
    const found = findSubjectWithParent(subjectTree, selectedSubjectId);
    const isValid = !!found && !!selectedSubject;
    
    if (__DEV__ && selectedSubjectId && !isValid) {
      console.warn("hasValidSubject check failed", {
        selectedSubjectId,
        foundInTree: !!found,
        selectedSubjectExists: !!selectedSubject,
        subjectTreeLength: subjectTree.length,
      });
    }
    
    return isValid;
  }, [findSubjectWithParent, subjectTree, selectedSubjectId, selectedSubject]);

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
      // Note: subjects are typically stable, but we could add refetchSubjects here if needed
    }, [refetchTasks])
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

    // Check focus mode requirements (skip on web - focus mode not available)
    if (requireFocusMode) {
      if (!hasFocusPermission) {
        // Show permission request modal
        setPermissionModalVisible(true);
        return;
      }

      // On iOS, check if apps are selected
      if (Platform.OS === 'ios') {
        const hasSelectedApps = await checkSelectedApps();
        if (!hasSelectedApps) {
          // Show app picker modal
          setAppPickerModalVisible(true);
          return;
        }
      }

      // Try to enable focus mode and start timer
      const focusEnabled = await enableFocusMode();
      if (!focusEnabled) {
        Alert.alert(
          t("timer.errorTitle"),
          t("timer.permissionDenied")
        );
        return;
      }
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
    const selection = findSubjectWithParent(subjectTree, selectedSubjectId);
    const subjectForLog = selection?.node;

    if (!subjectForLog) {
      Alert.alert(t("timer.errorTitle"), t("timer.errorSave"));
      console.warn("Stop session aborted: missing subject", {
        subjectPresent: !!subjectForLog,
      });
      return;
    }

    try {
      const result = await timerStop(subjectForLog.id, selectedTaskId ?? null);
      
      if (result.saved) {
        const totalMinutes = Math.floor(timerSeconds / 60);
        Alert.alert(
          t("timer.sessionFinishedTitle"),
          t("timer.sessionRecorded", { minutes: totalMinutes })
        );
      } else {
        Alert.alert(
          t("timer.sessionNotRecorded"),
          result.reason === 'focus_mode_required' 
            ? t("timer.sessionNotRecorded")
            : t("timer.errorSave")
        );
      }
    } catch (error: any) {
      // Error handling is done in the hook's onError callback
      console.error("Error stopping timer", error);
    }
  };

  const handleCreateSubject = async () => {
    const name = newSubjectName.trim();
    if (!name) {
      Alert.alert(t("timer.errorTitle"), t("common.errors.unexpected"));
      return;
    }

    setSavingSubject(true);
    try {
      const created = await createSubjectHook(name, selectedParentSubjectId);
      setSelectedSubjectId(created.id);
      setNewSubjectName("");
      setSelectedParentSubjectId(null);
      setAddModalVisible(false);
    } catch (error: any) {
      console.error("Unable to create subject", error);
      Alert.alert(t("timer.errorTitle"), error.message ?? t("timer.errorSave"));
    } finally {
      setSavingSubject(false);
    }
  };

  // Simplified selectedSubjectLabel - use selectedSubject from hook, with breadcrumb support
  const selectedSubjectLabel = React.useMemo(() => {
    if (!selectedSubject) return t("subjects.select.missing");
    
    // Check if it's a child subject and build breadcrumb
    const match = findSubjectWithParent(subjectTree, selectedSubjectId);
    if (match?.parent) {
      return `${match.parent.name} • ${match.node.name}`;
    }
    return selectedSubject.name;
  }, [selectedSubject, selectedSubjectId, subjectTree, findSubjectWithParent, t]);

  const selectedSubjectColor = React.useMemo(() => {
    if (!selectedSubjectId) return null;
    return subjectColorById[selectedSubjectId] ?? safeTheme.primary;
  }, [selectedSubjectId, subjectColorById, safeTheme.primary]);

  return (
    <TabScreen
      title={t("tabs.focus")}
      rightAction={
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/goals")}
            style={styles.headerIconBtn}
          >
            <Target size={22} color={safeTheme.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn}>
            <Bell size={22} color={safeTheme.text} />
            <View style={styles.notificationDot} />
          </TouchableOpacity>
        </View>
      }
      gap={8}
    >
        {/* BIG TIMER */}
        <View style={styles.timerContainer}>
          {/* Circular progress ring (thin track + thicker progress arc) */}
          <View style={styles.timerRingWrapper}>
            {/* Pulse ring (visible when running) */}
            {isRunning && (
              <Animated.View style={[styles.timerPulseRing, pulseAnimatedStyle]} pointerEvents="none">
                <Svg width={180} height={180} style={styles.timerPulseSvg}>
                  <SvgCircle
                    cx={90}
                    cy={90}
                    r={84}
                    stroke={hexToRgba(safeTheme.primary, 0.25)}
                    strokeWidth={2.5}
                    fill="none"
                  />
                </Svg>
              </Animated.View>
            )}
            <Svg width={168} height={168} style={styles.timerRingSvg}>
              {/* Thin background track */}
              <SvgCircle
                cx={84}
                cy={84}
                r={74}
                stroke={hexToRgba(safeTheme.textMuted, 0.12)}
                strokeWidth={4}
                fill="none"
              />
              {/* Thicker progress arc (clockwise from top, 25-min reference) */}
              <SvgCircle
                cx={84}
                cy={84}
                r={74}
                stroke={safeTheme.primary}
                strokeWidth={9}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={
                  (() => {
                    const circumference = 2 * Math.PI * 74;
                    const progress = isRunning ? Math.min(1, timerSeconds / 1500) : 0;
                    return `${progress * circumference} ${circumference}`;
                  })()
                }
                transform="rotate(-90 84 84)"
              />
            </Svg>
            <View style={styles.timerTextContainer}>
              <Text
                style={styles.timerText}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {formattedTime.hours}:{formattedTime.mins}:{formattedTime.secs}
              </Text>
            </View>
          </View>
          <View style={[styles.selectedSubjectRow, styles.selectedSubjectPill]}>
            {selectedSubjectColor && (
              <View
                style={[
                  styles.subjectColorBadge,
                  { backgroundColor: selectedSubjectColor },
                ]}
              />
            )}
            <Text variant="bodyStrong">
              {selectedSubjectLabel}
            </Text>
          </View>

          <View style={styles.focusBadgeSlot}>
            {/* Messages above button (variable height) */}
            <View style={styles.buttonMessagesArea}>
              {isRunning && !focusModeActive && (
                <Text variant="micro" style={{ color: safeTheme.danger }} align="center">
                  {t("timer.focusModeLost")}
                </Text>
              )}
              {!isRunning && !hasValidSubject && (
                <Text variant="micro" colorName="textMuted" align="center">
                  {t("subjects.select.hint")}
                </Text>
              )}
              {!isRunning && hasValidSubject && !timerCanStart && !focusModeLoading && (
                <Text variant="micro" colorName="textMuted" align="center">
                  {!hasFocusPermission 
                    ? t("timer.focusModeRequired")
                    : Platform.OS === 'ios' 
                      ? t("timer.noAppsSelected")
                      : t("timer.focusModeRequired")
                  }
                </Text>
              )}
            </View>
            {/* Button always in same place (Start or Stop) */}
            {isRunning ? (
              <Button
                iconLeft={Square}
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
                disabled={!hasValidSubject || (!timerCanStart && !focusModeLoading)}
                loading={focusModeLoading}
                fullWidth
              />
            )}
            {Platform.OS === "web" && (
              <Text variant="micro" colorName="textMuted" style={styles.focusSimulatedText}>
                {t("timer.focusSimulated")}
              </Text>
            )}
          </View>
        </View>

        {/* SUBJECT / TASK CONTENT (always visible, below timer) */}
        <>
            {/* TAB SWITCHER (after timer) */}
            <Tabs
              options={[
                { value: "subjects", label: t("timer.tabSubjects") },
                { value: "tasks", label: t("timer.tabTasks") },
              ]}
              value={listTab}
              onChange={(newTab) => {
                console.log("Tab changed", { from: listTab, to: newTab });
                setListTab(newTab);
              }}
              style={{ marginBottom: 6 }}
            />

            <View style={styles.listContainer}>
              {listTab === "subjects" ? (
                subjectsLoading ? (
                  <View style={styles.loaderContainer}>
                    <ActivityIndicator size="large" color={safeTheme.primary} />
                  </View>
                ) : (
                  <View style={styles.subjectCardsContainer}>
                    {subjectListData.map((item) => {
                      const sub = item.node;
                      const subjectColor = item.subjectColor;
                      const textOnColor = item.textOnColor;
                      const isActiveParent = selectedSubjectId === sub.id;
                      const isActiveChild = sub.children.some((c) => c.id === selectedSubjectId);
                      const isRowActive = isActiveParent || isActiveChild;
                      const disableRowInteraction = isRunning && !isRowActive;

                      return (
                        <Card
                          key={sub.id}
                          variant="border"
                          radius={14}
                          padding={8}
                          style={[
                            {
                              backgroundColor: isRowActive
                                ? hexToRgba(subjectColor, 0.16)
                                : undefined,
                            },
                            isRowActive && {
                              borderColor: subjectColor,
                              borderWidth: 1.5,
                            },
                            disableRowInteraction && { opacity: 0.45 },
                          ]}
                        >
                          <View style={styles.subjectRowWithChildren}>
                              <TouchableOpacity
                                activeOpacity={0.9}
                                style={styles.subjectMainTapArea}
                                onPress={(e) => {
                                  console.log("Subject row pressed", { subjectId: sub.id, event: e });
                                  if (isRunning && !isRowActive) {
                                    console.warn("Cannot select subject: timer is running");
                                    return;
                                  }
                                  console.log("Subject selected (parent)", {
                                    subjectId: sub.id,
                                    subjectName: sub.name,
                                    wasSelected: selectedSubjectId === sub.id,
                                  });
                                  setSelectedSubjectId(sub.id);
                                }}
                                disabled={disableRowInteraction}
                              >
                                {/* Small color dot (compact, reference style) */}
                                <View
                                  style={[
                                    styles.subjectColorDot,
                                    { backgroundColor: subjectColor },
                                    disableRowInteraction && { opacity: 0.6 },
                                  ]}
                                />
                                <View style={styles.subjectInfo}>
                                  <Text
                                    variant="subtitle"
                                    style={isRowActive ? { fontWeight: "600" } : undefined}
                                  >
                                    {sub.name}
                                  </Text>
                                </View>
                              </TouchableOpacity>
                              {sub.children.length > 0 && (
                                <View style={styles.subtagRowInline}>
                                  {sub.children.map((child) => {
                                    const childSelected = selectedSubjectId === child.id;
                                    return (
                                      <TouchableOpacity
                                        key={child.id}
                                        style={[
                                          styles.subtagPill,
                                          {
                                            backgroundColor: childSelected
                                              ? hexToRgba(subjectColor, 0.24)
                                              : safeTheme.surface,
                                            borderColor: subjectColor,
                                          },
                                          disableRowInteraction && !childSelected && { opacity: 0.6 },
                                        ]}
                                        onPress={() => {
                                          if (isRunning && !childSelected) {
                                            console.warn("Cannot select child subject: timer is running");
                                            return;
                                          }
                                          console.log("Child subject selected", {
                                            childId: child.id,
                                            childName: child.name,
                                            parentId: sub.id,
                                            wasSelected: selectedSubjectId === child.id,
                                          });
                                          setSelectedSubjectId(child.id);
                                        }}
                                        disabled={isRunning && !childSelected}
                                      >
                                        <Text
                                          variant="micro"
                                          style={
                                            childSelected
                                              ? { color: textOnColor, fontWeight: "700" }
                                              : undefined
                                          }
                                        >
                                          {child.name}
                                        </Text>
                                      </TouchableOpacity>
                                    );
                                  })}
                                </View>
                              )}
                            </View>
                        </Card>
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
                <View style={styles.subjectCardsContainer}>
                  {tasks
                    .filter((t) => t.status !== "done" && t.subjectId)
                    .map((task) => {
                      const isSelected = selectedTaskId === task.id;
                      
                      // Get subject info
                      const subjectName = task.subjectName || 
                        subjects.find((s) => s.id === task.subjectId)?.name || 
                        t("tasks.form.subject");
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
                        <Card
                          key={task.id}
                          variant="border"
                          radius={14}
                          padding={10}
                          style={[
                            {
                              backgroundColor: isSelected
                                ? hexToRgba(taskSubjectColor, 0.16)
                                : undefined,
                            },
                            isSelected && {
                              borderColor: taskSubjectColor,
                              borderWidth: 1.5,
                            },
                          ]}
                        >
                          <TouchableOpacity
                            activeOpacity={0.9}
                            style={{ flexDirection: "row", alignItems: "center" }}
                            onPress={() => {
                              console.log("Task selected", {
                                taskId: task.id,
                                taskTitle: task.title,
                                subjectId: task.subjectId,
                              });
                              if (task.subjectId) {
                                setSelectedSubjectId(task.subjectId);
                              }
                              setSelectedTaskId(task.id);
                            }}
                          >
                            {/* Small color dot (compact, consistent with subjects) */}
                            <View
                              style={[
                                styles.subjectColorDot,
                                { backgroundColor: taskSubjectColor },
                              ]}
                            />
                            {/* TASK CONTENT */}
                            <View style={styles.taskContent}>
                              <View style={styles.taskHeader}>
                                <Text
                                  variant="subtitle"
                                  style={[isSelected ? { fontWeight: "600" } : undefined, { flex: 1 }]}
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
                        </Card>
                      );
                    })}
                </View>
              )
            )}
            </View>
          </>

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
          setSelectedParentSubjectId(null);
          setAddModalVisible(false);
        }}
        title={t("common.addSubject")}
        actions={{
          cancel: {
            label: t("common.actions.cancel"),
            onPress: () => {
              setNewSubjectName("");
              setSelectedParentSubjectId(null);
              setAddModalVisible(false);
            },
            variant: "ghost",
            disabled: savingSubject,
          },
          confirm: {
            label: savingSubject
              ? t("common.status.saving")
              : t("common.actions.create"),
            onPress: handleCreateSubject,
            variant: "primary",
            disabled: savingSubject,
            loading: savingSubject,
          },
        }}
      >
        <Input
          value={newSubjectName}
          onChangeText={setNewSubjectName}
          placeholder={t("timer.addSubjectPlaceholder")}
          autoFocus
          editable={!savingSubject}
          containerStyle={{ marginBottom: 12 }}
        />
        
        <SubjectPicker
          subjects={subjects}
          selectedSubjectId={selectedParentSubjectId}
          onSelect={setSelectedParentSubjectId}
          placeholder={t("common.parentSubjectPlaceholder")}
          containerStyle={{ marginBottom: 0 }}
          parentsOnly={true}
        />
      </Modal>

      {/* Permission Request Modal */}
      <Modal
        visible={permissionModalVisible}
        onClose={() => setPermissionModalVisible(false)}
        title={t("timer.permissionRequestTitle")}
        actions={{
          cancel: {
            label: t("common.actions.cancel"),
            onPress: () => setPermissionModalVisible(false),
            variant: "ghost",
          },
          confirm: {
            label: t("common.grantPermission"),
            onPress: async () => {
              const granted = await requestFocusPermission();
              setPermissionModalVisible(false);
              if (granted) {
                // On iOS, check if apps need to be selected
                if (Platform.OS === 'ios') {
                  const hasSelected = await checkSelectedApps();
                  if (!hasSelected) {
                    setAppPickerModalVisible(true);
                  }
                }
              } else {
                Alert.alert(
                  t("timer.permissionDenied"),
                  Platform.OS === 'ios' 
                    ? t("timer.permissionRequestIOS")
                    : t("timer.openSettings")
                );
              }
            },
            variant: "primary",
          },
        }}
      >
        <Text variant="body" colorName="text" style={{ marginBottom: 12 }}>
          {t("timer.permissionRequestMessage")}
        </Text>
        {Platform.OS === 'ios' && (
          <Text variant="body" colorName="textMuted">
            {t("timer.permissionRequestIOS")}
          </Text>
        )}
      </Modal>

      {/* App Picker Modal (iOS only) */}
      {Platform.OS === 'ios' && (
        <Modal
          visible={appPickerModalVisible}
          onClose={() => setAppPickerModalVisible(false)}
          title={t("common.selectApps")}
          actions={{
            cancel: {
              label: t("common.actions.cancel"),
              onPress: () => setAppPickerModalVisible(false),
              variant: "ghost",
            },
            confirm: {
              label: t("common.selectApps"),
              onPress: async () => {
                const selected = await presentAppPicker();
                setAppPickerModalVisible(false);
                if (!selected) {
                  Alert.alert(
                    t("timer.noAppsSelected"),
                    t("timer.noAppsSelectedDescription")
                  );
                }
              },
              variant: "primary",
            },
          }}
        >
          <Text variant="body" colorName="text" style={{ marginBottom: 12 }}>
            {t("timer.noAppsSelectedDescription")}
          </Text>
        </Modal>
      )}
    </TabScreen>
  );
}

// ------------------------------------------------------------------
// STYLES
// ------------------------------------------------------------------
function createStyles(theme: typeof Colors.light) {
  return StyleSheet.create({
    container: { 
      flex: 1,
    },
    contentArea: {
      flex: 1,
      justifyContent: "flex-start",
    },
    listContainer: {
      minHeight: 200,
    },
    subjectCardsContainer: {
      gap: 5,
    },
    contentAreaRunning: {
      justifyContent: "center",
      paddingHorizontal: 4,
    },

    // HEADER (styles moved to Header component, keeping notificationDot here)
    headerActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    headerIconBtn: {
      padding: 8,
      justifyContent: "center",
      alignItems: "center",
      position: "relative",
    },
    notificationDot: {
      position: "absolute",
      top: 4,
      right: 4,
      width: 8,
      height: 8,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: theme.onPrimary,
      backgroundColor: theme.secondary, // secondary color
    },

    // TIMER — PREMIUM NEUTRAL VERSION
    timerRingWrapper: {
      position: "relative",
      alignItems: "center",
      justifyContent: "center",
    },
    timerPulseRing: {
      position: "absolute",
      width: 180,
      height: 180,
      alignItems: "center",
      justifyContent: "center",
    },
    timerPulseSvg: {
      position: "absolute",
    },
    timerRingSvg: {
      position: "absolute",
    },
    timerTextContainer: {
      width: 168,
      height: 168,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 16,
      paddingVertical: 16,
    },
    focusSimulatedText: {
      marginTop: 6,
      textAlign: "center",
    },
    timerContainer: { 
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 8,
      paddingHorizontal: 16,
      marginTop: 0,
      marginBottom: 0,
    },
    timerText: {
      fontSize: 28,
      fontWeight: "600",
      fontVariant: ['tabular-nums'],
      lineHeight: 34,
      color: theme.text,
    },
    selectedSubjectRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      marginTop: 6,
      gap: 6,
    },
    selectedSubjectPill: {
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    subjectColorBadge: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    buttonMessagesArea: {
      height: 36,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 8,
    },
    focusBadgeSlot: {
      marginTop: 6,
      alignItems: "center",
      width: "100%",
    },
    // NOTE: startButton styles removed - now using Button component
    // Cards in list
    card: {
      padding: 16,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.divider,
      marginHorizontal: 16,
      marginTop: 10,
      gap: 8,
      backgroundColor: theme.surface,
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    cardTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    // Note: Typography handled by Themed Text component with variant prop

    // SUBJECT LIST (compact: small color dot like reference)
    subjectColorDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      marginRight: 10,
    },
    subjectInfo: { flex: 1 },
    subjectRowWithChildren: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      width: "100%",
    },
    subjectMainTapArea: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      minWidth: 0,
    },
    subtagRowInline: {
      flexDirection: "row",
      flexWrap: "nowrap",
      gap: 4,
      marginLeft: 8,
      flexShrink: 0,
    },
    taskContent: {
      flex: 1,
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
    subtagRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 4,
      paddingHorizontal: 6,
      paddingBottom: 2,
    },
    subtagPill: {
      borderWidth: 1,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 10,
    },
    // Note: Typography handled by Themed Text component with variant prop
    list: {
      flex: 1,
    },
    loaderContainer: {
      alignItems: "center",
      paddingVertical: 40,
    },
    toggleSubjectsButton: {
      marginTop: 10,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
      alignItems: "center",
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