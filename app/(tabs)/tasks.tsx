import { TabScreen } from "@/components/layout/TabScreen";
import { Text } from "@/components/Themed";
import { SubjectPicker } from "@/components/ui";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ListCard, ListItem } from "@/components/ui/ListCard";
import { Tabs } from "@/components/ui/Tabs";
import Colors from "@/constants/Colors";
import { useSubjects } from "@/hooks/useSubjects";
import { useTasks } from "@/hooks/useTasks";
import { useAuth } from "@/utils/authContext";
import { createSubjectColorMap } from "@/utils/color";
import { Task } from "@/utils/queries";
import { useTheme } from "@/utils/themeContext";
import { formatDateLabel, getTodayIso } from "@/utils/time";
import { useFocusEffect } from "expo-router";
import { CalendarClock, Check, Plus, RotateCcw, Trash2 } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  View,
} from "react-native";

export default function TasksScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { user } = useAuth();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const todayIso = useMemo(() => getTodayIso(), []);

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskMinutes, setNewTaskMinutes] = useState("");
  const [viewMode, setViewMode] = useState<"active" | "done">("active");

  // Use hooks for tasks and subjects
  const {
    tasks,
    loading: tasksLoading,
    createTask: createTaskHook,
    deleteTask: deleteTaskHook,
    resumeTask: resumeTaskHook,
    completeTask: completeTaskHook,
    refetch: refetchTasks,
  } = useTasks({
    userId: user?.id ?? null,
    autoLoad: true,
  });

  const {
    subjects, // All subjects (parents + children) - needed for task subject lookup
    parentSubjects, // Only parent subjects - for SubjectPicker
    subjectTree, // Tree structure for color mapping
    loading: subjectsLoading,
    selectedSubjectId,
    selectedSubject,
    setSelectedSubjectId,
  } = useSubjects({
    userId: user?.id ?? null,
    autoLoad: true,
  });

  // Create color map for subjects
  const subjectColorById = useMemo(() => {
    return createSubjectColorMap(
      subjectTree,
      theme.subjectPalette ?? [],
      theme.primary
    );
  }, [subjectTree, theme.subjectPalette, theme.primary]);

  const formatScheduledLabel = useCallback(
    (value?: string | null) => {
      if (!value) return "";
      const formatted = formatDateLabel(value, todayIso);
      // Handle translation for "Today"
      if (formatted === "Today") return t("tasks.today");
      return formatted;
    },
    [todayIso, t]
  );

  const handleSubjectSelect = useCallback((subjectId: string) => {
    setSelectedSubjectId(subjectId);
  }, [setSelectedSubjectId]);

  // Refresh tasks when returning to this tab to reflect timer updates
  useFocusEffect(
    useCallback(() => {
      refetchTasks();
    }, [refetchTasks])
  );

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return;
    if (!selectedSubject) {
      Alert.alert(t("timer.errorTitle"), t("timer.subjectMissing"));
      return;
    }
    const parsedMinutesRaw = newTaskMinutes.trim();
    const parsedMinutes =
      parsedMinutesRaw === ""
        ? null
        : Math.max(0, parseInt(parsedMinutesRaw || "0", 10) || 0);

    try {
      await createTaskHook({
        title: newTaskTitle.trim(),
        subjectId: selectedSubject.id,
        plannedMinutes: parsedMinutes,
        status: "planned",
        loggedSeconds: 0,
        // scheduledFor defaults to todayIso in the hook
      });
      setNewTaskTitle("");
      setNewTaskMinutes("");
    } catch (err) {
      console.error("Error creating task", err);
      Alert.alert(t("timer.errorTitle"), t("timer.errorSave"));
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteTaskHook(taskId);
    } catch (err) {
      console.error("Error deleting task", err);
      Alert.alert(t("timer.errorTitle"), t("timer.errorSave"));
    }
  };

  const handleResumeTask = async (task: Task) => {
    try {
      await resumeTaskHook(task);
    } catch (err) {
      console.error("Error resuming task", err);
      Alert.alert(t("timer.errorTitle"), t("timer.errorSave"));
    }
  };

  const handleCompleteTask = async (task: Task, minutesOverride?: number) => {
    try {
      await completeTaskHook(task, minutesOverride);
    } catch (err) {
      console.error("Error completing task", err);
      Alert.alert(t("timer.errorTitle"), t("timer.errorSave"));
    }
  };

  // Filter tasks by view mode
  const orderedTasks = useMemo(() => {
    const filtered =
      viewMode === "done"
        ? tasks.filter((t) => t.status === "done")
        : tasks.filter((t) => t.status !== "done");
    const priority = { "in-progress": 0, planned: 1, done: 2 } as const;
    return filtered.sort((a, b) => priority[a.status] - priority[b.status]);
  }, [tasks, viewMode]);

  return (
    <TabScreen title={t("tasks.title")}>
        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <CalendarClock size={18} color={theme.textMuted} />
              <Text variant="subtitle" style={styles.cardTitle}>
                {t("tasks.planBlock")}
              </Text>
            </View>
          </View>
          <View style={styles.formRow}>
            <Input
              placeholder={t("tasks.form.name")}
              value={newTaskTitle}
              onChangeText={setNewTaskTitle}
              returnKeyType="done"
              onSubmitEditing={handleAddTask}
              blurOnSubmit
              containerStyle={{ flex: 1 }}
            />
          </View>
          <View style={styles.formRow}>
            <View style={styles.subjectPickerContainer}>
              <SubjectPicker
                subjects={parentSubjects}
                selectedSubjectId={selectedSubjectId}
                onSelect={handleSubjectSelect}
                loading={subjectsLoading}
                placeholder={t("tasks.form.selectSubject", {
                  defaultValue: "Select a subject",
                })}
                containerStyle={{ flex: 1 }}
                parentsOnly={true}
              />
              {!selectedSubject && (
                <Text variant="micro" colorName="textMuted" style={styles.helperText}>
                  {t("tasks.form.subjectRequired")}
                </Text>
              )}
            </View>
            <View style={styles.minutesInputContainer}>
              <Input
                placeholder={t("tasks.form.minutes")}
                value={newTaskMinutes}
                onChangeText={setNewTaskMinutes}
                returnKeyType="done"
                onSubmitEditing={handleAddTask}
                blurOnSubmit
                keyboardType="numeric"
                containerStyle={{ width: 110 }}
              />
            </View>
          </View>
          <Button
            title={t("tasks.form.add")}
            variant="primary"
            iconLeft={Plus}
            onPress={handleAddTask}
            style={styles.addButton}
            disabled={!selectedSubject}
          />
        </View>

        <View style={{ gap: 12 }}>
          <Tabs
            options={[
              { value: "active", label: t("tasks.view.active") },
              { value: "done", label: t("tasks.view.done") },
            ]}
            value={viewMode}
            onChange={setViewMode}
          />

          {tasksLoading ? (
            <View style={{ alignItems: "center", paddingVertical: 40 }}>
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          ) : orderedTasks.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 40 }}>
              <Text variant="micro" colorName="textMuted" style={styles.emptyText}>
                {t("tasks.emptyState")}
              </Text>
            </View>
          ) : (
            <ListCard>
              {orderedTasks.map((task, index) => {
                const subject = subjects.find((s) => s.id === task.subjectId);
                const subjectLabel = task.subjectName || subject?.name || t("tasks.form.subject");
                const planned = task.plannedMinutes ?? 0;
                const loggedMinutes = Math.round(task.loggedSeconds / 60);
                const isLast = index === orderedTasks.length - 1;

                const subjectColor = task.subjectId
                  ? subjectColorById[task.subjectId] ?? theme.primary
                  : theme.primary;

                return (
                  <ListItem key={task.id} isLast={isLast}>
                    <View style={styles.taskContent}>
                      <View style={styles.taskHeader}>
                        {task.subjectId && (
                          <View
                            style={[
                              styles.subjectColorBadge,
                              { backgroundColor: subjectColor },
                            ]}
                          />
                        )}
                        <Text variant="subtitle" style={{ fontWeight: "600", flex: 1 }}>
                          {task.title}
                        </Text>
                        <Text variant="micro" colorName="textMuted" style={styles.timeLabel}>
                          {planned > 0
                            ? `${loggedMinutes}/${planned} min`
                            : `${loggedMinutes} min`}
                        </Text>
                        <View style={styles.actionButtons}>
                          {viewMode === "done" ? (
                            <>
                              <Button
                                iconLeft={RotateCcw}
                                iconOnly
                                variant="ghost"
                                size="sm"
                                onPress={() => handleResumeTask(task)}
                                accessibilityLabel={t("tasks.resume")}
                              />
                              <Button
                                iconLeft={Trash2}
                                iconOnly
                                variant="ghost"
                                size="sm"
                                onPress={() => handleDeleteTask(task.id)}
                                accessibilityLabel={t("tasks.delete", "Delete task")}
                              />
                            </>
                          ) : (
                            <>
                              <Button
                                iconLeft={Check}
                                iconOnly
                                variant="ghost"
                                size="sm"
                                onPress={() => handleCompleteTask(task)}
                                accessibilityLabel={t("tasks.completeNow")}
                              />
                              <Button
                                iconLeft={Trash2}
                                iconOnly
                                variant="ghost"
                                size="sm"
                                onPress={() => handleDeleteTask(task.id)}
                                accessibilityLabel={t("tasks.delete", "Delete task")}
                              />
                            </>
                          )}
                        </View>
                      </View>
                      <Text variant="micro" colorName="textMuted" style={styles.taskMeta}>
                        {subjectLabel}
                        {task.scheduledFor ? ` • ${formatScheduledLabel(task.scheduledFor)}` : ""}
                      </Text>
                    </View>
                  </ListItem>
                );
              })}
            </ListCard>
          )}
        </View>
    </TabScreen>
  );
}

const createStyles = (theme: typeof Colors.light) =>
  StyleSheet.create({
  container: { flex: 1 },
  card: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.divider,
    gap: 12,
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
  cardTitle: { fontWeight: "700" },
  emptyText: {
    textAlign: "center",
  },
  formRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  subjectPickerContainer: {
    flex: 1,
  },
  minutesInputContainer: {
    alignSelf: "flex-start",
  },
  addButton: {
    marginTop: 8,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    flexDirection: "row",
  },
  helperText: {
    marginTop: 4,
    marginLeft: 4,
  },
  taskContent: {
    flex: 1,
    gap: 6,
  },
  taskHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  subjectColorBadge: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  timeLabel: {
    marginRight: 8,
  },
  actionButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginRight: -4,
  },
  taskMeta: {
    marginTop: 2,
  },
});
