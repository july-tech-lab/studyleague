import { TabScreen } from "@/components/layout/TabScreen";
import { Text } from "@/components/Themed";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ListCard, ListItem } from "@/components/ui/ListCard";
import { Modal } from "@/components/ui/Modal";
import { SubjectPicker } from "@/components/ui/SubjectPicker";
import { Tabs } from "@/components/ui/Tabs";
import { TaskCard } from "@/components/ui/TaskCard";
import Colors from "@/constants/Colors";
import { useSubjects } from "@/hooks/useSubjects";
import { useTasks } from "@/hooks/useTasks";
import { useTimer } from "@/hooks/useTimer";
import { useAuth } from '@/utils/authContext';
import { createSubjectColorMap, getReadableTextColor, hexToRgba } from '@/utils/color';
import { SubjectNode } from '@/utils/queries';
import { useTheme, useThemePreference } from '@/utils/themeContext';
import { useFocusEffect } from "expo-router";
import { Bell, Check, Circle, Lock, Plus, Square } from 'lucide-react-native';
import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Alert, FlatList, StyleSheet, TouchableOpacity, View } from "react-native";

export default function TimerScreen() {
  const { user } = useAuth();
  const { colorScheme } = useThemePreference();
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
  const { t } = useTranslation();

  // Refs for FlatLists
  const tasksListRef = useRef<FlatList>(null);

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

  // ============================================================================
  // UI STATE (Component-only state)
  // ============================================================================
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [listTab, setListTab] = useState<"subjects" | "tasks">("subjects");
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [selectedParentSubjectId, setSelectedParentSubjectId] = useState<string | null>(null);
  const [savingSubject, setSavingSubject] = useState(false);

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

  // Use timer hook
  const {
    isRunning,
    start: timerStart,
    stop: timerStop,
    formattedTime,
  } = useTimer({
    userId: user?.id ?? null,
    onSessionComplete: async (sessionId, sessionSeconds) => {
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
    onError: (error) => {
      Alert.alert(t("timer.errorTitle"), error.message || t("timer.errorSave"));
    },
  });

  // Use utility function for color mapping (moved before subjectListData)
  const subjectColorById = React.useMemo(
    () => createSubjectColorMap(subjectTree, subjectPalette, safeTheme.primary),
    [subjectTree, subjectPalette, safeTheme.primary]
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


  // Group tasks by subject for timer display
  const tasksBySubject = React.useMemo(() => {
    const grouped: Record<string, { id: string; title: string; plannedMinutes: number | null; loggedSeconds: number }[]> = {};
    
    tasks
      .filter((t) => t.status !== "done" && t.subjectId) // Safety filter
      .forEach((task) => {
        const subjectId = task.subjectId!;
        const list = grouped[subjectId] ?? [];
        list.push({
          id: task.id,
          title: task.title,
          plannedMinutes: task.plannedMinutes ?? null,
          loggedSeconds: task.loggedSeconds ?? 0,
        });
        grouped[subjectId] = list;
      });
    
    return grouped;
  }, [tasks]);

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

  // Refresh tasks and subjects when tab comes into focus
  // This ensures data stays in sync when switching between tabs
  useFocusEffect(
    useCallback(() => {
      refetchTasks();
      // Note: subjects are typically stable, but we could add refetchSubjects here if needed
    }, [refetchTasks])
  );

  // Debug effect to log state changes
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
  const handleStart = () => {
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
        t("timer.chooseSubjectHint", "Veuillez sélectionner une matière avant de démarrer")
      );
      return;
    }
    
    console.log("Starting timer", {
      subjectId: selectedSubjectId,
      subjectName: selectedSubject.name,
      taskId: selectedTaskId,
    });
    timerStart();
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
      await timerStop(subjectForLog.id, selectedTaskId ?? null);
    } catch (error: any) {
      // Error handling is done in the hook's onError callback
      console.error("Error stopping timer", error);
    }
  };

  const handleCreateSubject = async () => {
    const name = newSubjectName.trim();
    if (!name) {
      Alert.alert(t("timer.errorTitle"), t("common.errorUnexpected"));
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
    if (!selectedSubject) return t("timer.subjectMissing", "Sélectionne une matière");
    
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
      rightIcon={{
        icon: Bell,
        badge: <View style={styles.notificationDot} />,
      }}
    >
        {/* BIG TIMER */}
        <View 
          style={[styles.timerContainer, isRunning && styles.timerContainerExpanded]}
        >
          {/* Dark mode teal tint overlay */}
          {colorScheme === "dark" && (
            <View style={[StyleSheet.absoluteFill, {
              backgroundColor: hexToRgba(safeTheme.primary, 0.12),
              borderRadius: 22,
            }]} />
          )}
          <Text style={styles.timerText}>
            {formattedTime.hours}:{formattedTime.mins}:{formattedTime.secs}
          </Text>
          <View style={styles.selectedSubjectRow}>
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
            {isRunning ? (
              <View style={styles.focusBadge}>
                <Lock size={14} color={safeTheme.textMuted} />
                <Text variant="micro" colorName="textMuted">
                  {t("timer.focusOn")}
                </Text>
              </View>
            ) : (
              <>
                {!hasValidSubject && (
                  <Text variant="micro" colorName="textMuted" align="center">
                    {t("timer.chooseSubjectHint")}
                  </Text>
                )}
                <Button
                  title={t("timer.startButton")}
                  variant="primary"
                  onPress={(e) => {
                    console.log("Start button pressed", { hasValidSubject, selectedSubjectId, event: e });
                    handleStart();
                  }}
                  disabled={!hasValidSubject}
                  fullWidth
                />
              </>
            )}
          </View>
        </View>

        {/* SUBJECT / TASK CONTENT */}
        {!isRunning ? (
          <>
            {/* TAB SWITCHER (after timer) */}
            <Tabs
              options={[
                { value: "subjects", label: t("timer.tabSubjects", "Matières") },
                { value: "tasks", label: t("timer.tabTasks", "Tâches") },
              ]}
              value={listTab}
              onChange={(newTab) => {
                console.log("Tab changed", { from: listTab, to: newTab });
                setListTab(newTab);
              }}
            />

            <View style={styles.listContainer}>
              {listTab === "subjects" ? (
                subjectsLoading ? (
                  <View style={styles.loaderContainer}>
                    <ActivityIndicator size="large" color={safeTheme.primary} />
                  </View>
                ) : (
                  <ListCard style={{ marginBottom: 0 }}>
                    {subjectListData.map((item) => {
                      const sub = item.node;
                      const subjectColor = item.subjectColor;
                      const textOnColor = item.textOnColor;
                      const isActiveParent = selectedSubjectId === sub.id;
                      const isActiveChild = sub.children.some((c) => c.id === selectedSubjectId);
                      const isRowActive = isActiveParent || isActiveChild;
                      const disableRowInteraction = isRunning && !isRowActive;

                      return (
                        <React.Fragment key={sub.id}>
                          <ListItem
                            pointerEvents="box-none"
                            style={[
                              {
                                backgroundColor: isRowActive
                                  ? hexToRgba(subjectColor, 0.16)
                                  : "transparent",
                              },
                              isRowActive && { shadowOpacity: 0.08, shadowRadius: 6 },
                              disableRowInteraction && { opacity: 0.45 },
                            ]}
                          >
                            <TouchableOpacity
                              activeOpacity={0.9}
                              style={{ flex: 1, flexDirection: "row", alignItems: "center" }}
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
                              {/* PLAY BUTTON (Select only) */}
                              <TouchableOpacity
                                style={[
                                  styles.subjectPlayButton,
                                  { backgroundColor: subjectColor },
                                  disableRowInteraction && { opacity: 0.6 },
                                ]}
                                onPress={() => {
                                  if (isRunning && !isRowActive) {
                                    console.warn("Cannot select subject: timer is running");
                                    return;
                                  }
                                  console.log("Subject selected (play button)", {
                                    subjectId: sub.id,
                                    subjectName: sub.name,
                                    wasSelected: selectedSubjectId === sub.id,
                                  });
                                  setSelectedSubjectId(sub.id);
                                }}
                                disabled={disableRowInteraction}
                              >
                                {isRowActive && isRunning ? (
                                  <View
                                    style={{
                                      width: 8,
                                      height: 8,
                                      backgroundColor: textOnColor,
                                      borderRadius: 2,
                                    }}
                                  />
                                ) : isRowActive ? (
                                  <Check size={20} color={textOnColor} strokeWidth={2.5} />
                                ) : (
                                  <Circle size={20} color={textOnColor} strokeWidth={2} fill="none" />
                                )}
                              </TouchableOpacity>

                              <View style={styles.subjectInfo}>
                                <Text
                                  variant="subtitle"
                                  style={isRowActive ? { fontWeight: "600" } : undefined}
                                >
                                  {sub.name}
                                </Text>
                                {sub.children.length > 0 && (
                                  <Text variant="micro" colorName="textMuted">
                                    {t("timer.subtagHint", "Choisis un sous-tag pour être précis")}
                                  </Text>
                                )}
                              </View>
                            </TouchableOpacity>
                          </ListItem>

                          {sub.children.length > 0 && (
                            <View style={[styles.subtagRow, { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 8 }]}>
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
                              {tasksBySubject[sub.id]?.length ? (
                                <View style={styles.taskChips}>
                                  {tasksBySubject[sub.id].map((task) => {
                                    const taskSelected = selectedTaskId === task.id;
                                    return (
                                      <TouchableOpacity
                                        key={task.id}
                                        style={[
                                          styles.taskChip,
                                          {
                                            borderColor: subjectColor,
                                            backgroundColor: taskSelected
                                              ? hexToRgba(subjectColor, 0.24)
                                              : safeTheme.surface,
                                          },
                                          disableRowInteraction && !taskSelected && { opacity: 0.6 },
                                        ]}
                                        onPress={() => {
                                          console.log("Task chip selected", {
                                            taskId: task.id,
                                            taskTitle: task.title,
                                            subjectId: sub.id,
                                          });
                                          setSelectedSubjectId(sub.id);
                                          setSelectedTaskId(task.id);
                                        }}
                                      >
                                        <Text
                                          variant="micro"
                                          style={
                                            taskSelected
                                              ? { color: textOnColor, fontWeight: "700" }
                                              : undefined
                                          }
                                        >
                                          {task.title}
                                        </Text>
                                      </TouchableOpacity>
                                    );
                                  })}
                                </View>
                              ) : null}
                            </View>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </ListCard>
                )
            ) : (
              // Show loading indicator for tasks if needed
              tasks.length === 0 && !subjectsLoading ? (
                <View style={styles.loaderContainer}>
                  <Text colorName="textMuted">
                    {t("timer.tasksEmpty", "Aucune tâche active")}
                  </Text>
                </View>
              ) : (
                <FlatList
                  ref={tasksListRef}
                  data={tasks.filter((t) => t.status !== "done" && t.subjectId)}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.taskList}
                  style={styles.list}
                  ListEmptyComponent={
                    <View style={styles.loaderContainer}>
                      <Text colorName="textMuted">
                        {t("timer.tasksEmpty", "Aucune tâche active")}
                      </Text>
                    </View>
                  }
                  renderItem={({ item: task }) => {
                    const isSelected = selectedTaskId === task.id;
                    return (
                      <TouchableOpacity
                        activeOpacity={0.7}
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
                        style={[
                          isSelected && {
                            backgroundColor: hexToRgba(safeTheme.primary, 0.08),
                            borderRadius: 12,
                            marginBottom: 8,
                            padding: 4,
                          },
                        ]}
                      >
                        <TaskCard
                          task={task}
                          subjects={subjects}
                          showActions={false}
                        />
                      </TouchableOpacity>
                    );
                  }}
                />
              )
            )}
            </View>
          </>
        ) : null}

      {/* STOP BUTTON (Visible only when running) */}
      {isRunning && (
        <View style={styles.stopButtonContainer}>
          <Button
            iconLeft={Square}
            iconOnly
            variant="destructive"
            size="lg"
            onPress={(e) => {
              console.log("Stop button pressed", { event: e });
              handleStop();
            }}
            accessibilityLabel={t("timer.stop", "Arrêter")}
            style={styles.stopButtonFloating}
          />
          <Text variant="caption" colorName="textMuted">
            {t("timer.stop", "Arrêter")}
          </Text>
        </View>
      )}

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
        title={t("timer.addSubjectTitle", "Ajouter une matière")}
        actions={{
          cancel: {
            label: t("timer.cancel", "Annuler"),
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
              ? t("timer.saving", "Enregistrement...")
              : t("timer.create", "Créer"),
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
          placeholder={t("timer.addSubjectPlaceholder", "Nom de la matière")}
          autoFocus
          editable={!savingSubject}
          containerStyle={{ marginBottom: 12 }}
        />
        
        <SubjectPicker
          subjects={subjects}
          selectedSubjectId={selectedParentSubjectId}
          onSelect={setSelectedParentSubjectId}
          placeholder={t("timer.parentSubjectPlaceholder", "Parent subject (optional)")}
          containerStyle={{ marginBottom: 0 }}
          parentsOnly={true}
        />
      </Modal>
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
    contentAreaRunning: {
      justifyContent: "center",
      paddingHorizontal: 4,
    },

    // HEADER (styles moved to Header component, keeping notificationDot here)
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
    timerContainer: { 
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 80,
      paddingHorizontal: 20,
      marginTop: 18,
      marginBottom: 10,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: theme.divider,
      backgroundColor: theme.surfaceElevated,
      shadowColor: "#000",
      shadowOpacity: 0.04,
      shadowRadius: 10,
      elevation: 3,
      minHeight: 240,
      overflow: "hidden", // For dark mode overlay
    },
    timerContainerExpanded: {
      flex: 1,
      marginTop: 24,
      marginBottom: 12,
    },
    timerText: {
      fontSize: 56,
      fontWeight: "500",
      fontVariant: ['tabular-nums'],
      color: theme.text,
    },
    selectedSubjectRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      marginTop: 20,
      gap: 8,
    },
    subjectColorBadge: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    focusBadge: {
      marginTop: 10,
      backgroundColor: theme.secondaryTint, // secondary tint
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 20,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    focusBadgeSlot: {
      minHeight: 30,
      justifyContent: "center",
      marginTop: 16,
      alignItems: "center",
      gap: 12,
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

    // SUBJECT LIST
    subjectPlayButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
      backgroundColor: theme.secondaryTint,
    },
    subjectInfo: { flex: 1 },
    subtagRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      paddingHorizontal: 6,
      paddingBottom: 2,
    },
    subtagPill: {
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 12,
    },
    taskChips: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      paddingHorizontal: 6,
      paddingVertical: 4,
    },
    taskChip: {
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    // Note: Typography handled by Themed Text component with variant prop
    list: {
      flex: 1,
    },
    loaderContainer: {
      alignItems: "center",
      paddingVertical: 40,
    },
    taskList: { paddingBottom: 180, gap: 6 },
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

    // STOP BUTTON
    stopButtonContainer: {
      position: "absolute",
      alignSelf: 'center',
      bottom: 40,
      alignItems: "center",
      gap: 8,
      zIndex: 1000, // Ensure it's above other content
    },
    stopButtonFloating: {
      width: 80,
      height: 80,
      borderRadius: 40,
      // NOTE: Button component handles styling, this just sets size for floating button
    },
  });
}