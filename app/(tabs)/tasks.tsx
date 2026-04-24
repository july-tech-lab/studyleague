import { TabScreen } from "@/components/layout/TabScreen";
import { WeeklyGoalsPanel } from "@/components/planning/WeeklyGoalsPanel";
import { Text } from "@/components/Themed";
import { SubjectPicker } from "@/components/ui";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Tabs } from "@/components/ui/Tabs";
import { TaskCard } from "@/components/ui/TaskCard";
import Colors from "@/constants/Colors";
import { useSubjects } from "@/hooks/useSubjects";
import { useTasks } from "@/hooks/useTasks";
import { useAuth } from "@/utils/authContext";
import { Task } from "@/utils/queries";
import { useTheme } from "@/utils/themeContext";
import { formatDateLabel, formatMinutesCompact, getTodayIso } from "@/utils/time";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { CheckCircle2, ListTodo, Plus, Save, X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

/** Same presets as weekly goals time picker (`WeeklyGoalsPanel`). */
const TASK_PLANNED_MINUTE_PRESETS = [30, 60, 90, 120, 180] as const;

export default function TasksScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { user } = useAuth();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const todayIso = useMemo(() => getTodayIso(), []);

  const { planningSection } = useLocalSearchParams<{ planningSection?: string }>();

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskMinutes, setNewTaskMinutes] = useState("");
  const [planningTab, setPlanningTab] = useState<"weeklyGoals" | "tasks">("tasks");
  const [viewMode, setViewMode] = useState<"active" | "done">("active");
  const [showAddTaskPanel, setShowAddTaskPanel] = useState(false);
  const [addTaskError, setAddTaskError] = useState<string | null>(null);
  const [creatingTask, setCreatingTask] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editMinutes, setEditMinutes] = useState("");
  const [editSubjectId, setEditSubjectId] = useState<string | null>(null);

  useEffect(() => {
    if (planningSection === "goals") {
      setPlanningTab("weeklyGoals");
    }
  }, [planningSection]);

  /** Add-task UI only on "Active"; closing when switching to "Done" avoids a stuck open panel. */
  useEffect(() => {
    if (viewMode === "done") {
      setShowAddTaskPanel(false);
      setNewTaskTitle("");
      setNewTaskMinutes("");
      setAddTaskError(null);
    }
  }, [viewMode]);

  // Use hooks for tasks and subjects
  const {
    tasks,
    loading: tasksLoading,
    createTask: createTaskHook,
    updateTask,
    deleteTask: deleteTaskHook,
    resumeTask: resumeTaskHook,
    completeTask: completeTaskHook,
    refetch: refetchTasks,
  } = useTasks({
    userId: user?.id ?? null,
    autoLoad: true,
  });

  const {
    subjects,
    loading: subjectsLoading,
    selectedSubjectId,
    selectedSubject,
    setSelectedSubjectId,
  } = useSubjects({
    userId: user?.id ?? null,
    autoLoad: true,
  });

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

  const closeEditModal = useCallback(() => {
    setEditModalVisible(false);
    setEditingTask(null);
  }, []);

  const handleOpenEdit = useCallback(
    (task: Task) => {
      setEditingTask(task);
      setEditTitle(task.title);
      setEditMinutes(
        task.plannedMinutes != null && task.plannedMinutes > 0 ? String(task.plannedMinutes) : ""
      );
      setEditSubjectId(task.subjectId ?? null);
      setEditModalVisible(true);
    },
    []
  );

  // Refresh tasks when returning to this tab to reflect timer updates
  useFocusEffect(
    useCallback(() => {
      refetchTasks();
    }, [refetchTasks])
  );

  const handleAddTask = async () => {
    setAddTaskError(null);
    if (!newTaskTitle.trim()) {
      setAddTaskError(t("tasks.addTaskErrorName", "Enter a task name."));
      return;
    }
    if (!selectedSubject) {
      setAddTaskError(t("subjects.select.missing"));
      return;
    }
    const parsedMinutesRaw = newTaskMinutes.trim();
    const parsedMinutes =
      parsedMinutesRaw === ""
        ? null
        : Math.max(0, parseInt(parsedMinutesRaw || "0", 10) || 0);

    setCreatingTask(true);
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
      setShowAddTaskPanel(false);
      Keyboard.dismiss();
    } catch (err) {
      console.error("Error creating task", err);
      Alert.alert(t("timer.errorTitle"), t("timer.errorSave"));
    } finally {
      setCreatingTask(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingTask || !editTitle.trim()) return;
    if (!editSubjectId) {
      Alert.alert(t("timer.errorTitle"), t("subjects.select.missing"));
      return;
    }
    const parsedMinutesRaw = editMinutes.trim();
    const parsedMinutes =
      parsedMinutesRaw === ""
        ? null
        : Math.max(0, parseInt(parsedMinutesRaw || "0", 10) || 0);

    try {
      await updateTask(editingTask.id, {
        title: editTitle.trim(),
        subjectId: editSubjectId,
        plannedMinutes: parsedMinutes,
      });
      closeEditModal();
    } catch (err) {
      console.error("Error updating task", err);
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

  /** Minutes value in add-task panel for matching preset chips (null = empty or invalid). */
  const addTaskParsedMinutes = useMemo(() => {
    const raw = newTaskMinutes.trim();
    if (!raw) return null;
    const n = parseInt(raw, 10);
    return Number.isNaN(n) || n < 0 ? null : n;
  }, [newTaskMinutes]);

  return (
    <TabScreen
      title={t("tasks.title")}
      scroll={planningTab === "weeklyGoals" ? false : undefined}
    >
        <View style={{ gap: planningTab === "weeklyGoals" ? 8 : 12, flex: planningTab === "weeklyGoals" ? 1 : undefined }}>
          <Tabs
            variant="underline"
            options={[
              { value: "weeklyGoals", label: t("tasks.planningTabs.weeklyGoals") },
              { value: "tasks", label: t("tasks.planningTabs.tasks") },
            ]}
            value={planningTab}
            onChange={(v) => setPlanningTab(v as "weeklyGoals" | "tasks")}
          />

          {planningTab === "weeklyGoals" ? (
            <WeeklyGoalsPanel />
          ) : (
            <>
              <Tabs
                variant="iconPills"
                options={[
                  {
                    value: "active",
                    label: t("tasks.view.active"),
                    icon: ListTodo,
                  },
                  {
                    value: "done",
                    label: t("tasks.view.done"),
                    icon: CheckCircle2,
                  },
                ]}
                value={viewMode}
                onChange={setViewMode}
              />

              {user?.id && viewMode === "active" ? (
                <>
                  <Pressable
                    onPress={() => {
                      setAddTaskError(null);
                      setShowAddTaskPanel((open) => {
                        const next = !open;
                        if (!next) {
                          setNewTaskTitle("");
                          setNewTaskMinutes("");
                        }
                        return next;
                      });
                    }}
                    style={({ pressed }) => [
                      styles.addTaskToggle,
                      {
                        backgroundColor: theme.primaryTint,
                        borderColor: pressed ? theme.primaryDark : theme.primary,
                        opacity: pressed ? 0.96 : 1,
                      },
                    ]}
                  >
                    {showAddTaskPanel ? (
                      <X size={18} color={theme.primaryDark} strokeWidth={2} />
                    ) : (
                      <Plus size={18} color={theme.primaryDark} strokeWidth={2} />
                    )}
                    <Text variant="body" style={[styles.addTaskToggleText, { color: theme.primaryDark }]}>
                      {showAddTaskPanel
                        ? t("common.actions.cancel")
                        : t("tasks.addTaskAction")}
                    </Text>
                  </Pressable>

                  {showAddTaskPanel ? (
                    <View
                      style={[
                        styles.addTaskPanel,
                        {
                          backgroundColor: theme.surface,
                          borderColor: theme.divider,
                        },
                      ]}
                    >
                      <Input
                        placeholder={t("tasks.form.name")}
                        value={newTaskTitle}
                        onChangeText={(text) => {
                          setNewTaskTitle(text);
                          if (addTaskError) setAddTaskError(null);
                        }}
                        returnKeyType="done"
                        onSubmitEditing={() => void handleAddTask()}
                        blurOnSubmit
                        containerStyle={{ marginBottom: 0 }}
                      />
                      <SubjectPicker
                        subjects={subjects}
                        selectedSubjectId={selectedSubjectId}
                        onSelect={(id) => {
                          Keyboard.dismiss();
                          handleSubjectSelect(id);
                          if (addTaskError) setAddTaskError(null);
                        }}
                        loading={subjectsLoading}
                        placeholder={t("subjects.select.placeholder")}
                        containerStyle={{ width: "100%" }}
                      />
                      <View style={styles.timeOptionsWrap}>
                        {TASK_PLANNED_MINUTE_PRESETS.map((m) => {
                          const isSelected = addTaskParsedMinutes === m;
                          return (
                            <TouchableOpacity
                              key={m}
                              style={[styles.timeOption, isSelected && styles.timeOptionSelected]}
                              onPress={() => {
                                setNewTaskMinutes(String(m));
                                if (addTaskError) setAddTaskError(null);
                              }}
                              accessibilityState={{ selected: isSelected }}
                            >
                              <Text
                                variant="body"
                                numberOfLines={1}
                                style={[
                                  styles.timeOptionText,
                                  isSelected && styles.timeOptionTextSelected,
                                ]}
                              >
                                {formatMinutesCompact(m)}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                        <Input
                          placeholder={t("tasks.form.minutes")}
                          value={newTaskMinutes}
                          onChangeText={(text) => {
                            setNewTaskMinutes(text);
                            if (addTaskError) setAddTaskError(null);
                          }}
                          keyboardType="number-pad"
                          onSubmitEditing={() => {
                            const parsed = parseInt(newTaskMinutes.trim(), 10);
                            if (Number.isNaN(parsed) || parsed < 0) setNewTaskMinutes("");
                            else setNewTaskMinutes(String(parsed));
                          }}
                          containerStyle={styles.taskMinutesInputBox}
                          fieldStyle={styles.taskMinutesField}
                          style={styles.taskMinutesInputText}
                        />
                      </View>
                      {addTaskError ? (
                        <Text variant="caption" style={{ color: theme.danger, marginTop: 4 }}>
                          {addTaskError}
                        </Text>
                      ) : null}
                      <Button
                        title={t("tasks.addTaskSubmit")}
                        variant="primary"
                        onPress={() => void handleAddTask()}
                        disabled={!newTaskTitle.trim() || !selectedSubject || creatingTask}
                        loading={creatingTask}
                        fullWidth
                      />
                    </View>
                  ) : null}
                </>
              ) : null}

              {tasksLoading ? (
                <View style={{ alignItems: "center", paddingVertical: 40 }}>
                  <ActivityIndicator size="large" color={theme.primary} />
                </View>
              ) : orderedTasks.length === 0 ? (
                <View style={{ alignItems: "center", paddingVertical: 40 }}>
                  <Text variant="micro" colorName="textMuted" style={styles.emptyText}>
                    {viewMode === "done"
                      ? t("tasks.emptyStateDone")
                      : t("tasks.emptyState")}
                  </Text>
                </View>
              ) : (
                <View style={styles.taskCardsContainer}>
                  {orderedTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      subjects={subjects}
                      onEdit={handleOpenEdit}
                      onDelete={handleDeleteTask}
                      onResume={viewMode === "done" ? handleResumeTask : undefined}
                      onComplete={viewMode === "active" ? handleCompleteTask : undefined}
                      formatScheduledLabel={formatScheduledLabel}
                    />
                  ))}
                </View>
              )}
            </>
          )}
        </View>

        <Modal
          visible={editModalVisible}
          onClose={closeEditModal}
          title={t("tasks.edit")}
          padding={20}
          actions={{
            cancel: {
              label: t("common.actions.cancel"),
              onPress: closeEditModal,
              variant: "outline",
            },
            confirm: {
              label: t("common.actions.save"),
              variant: "primary",
              iconLeft: Save,
              onPress: handleSaveEdit,
              disabled: !editTitle.trim() || !editSubjectId,
            },
          }}
        >
          <Input
            placeholder={t("tasks.form.name")}
            value={editTitle}
            onChangeText={setEditTitle}
            returnKeyType="done"
            onSubmitEditing={handleSaveEdit}
            blurOnSubmit
            containerStyle={{ marginBottom: 12 }}
          />
          <View style={styles.formRow}>
            <View style={styles.subjectPickerContainer}>
              <SubjectPicker
                subjects={subjects}
                selectedSubjectId={editSubjectId}
                onSelect={setEditSubjectId}
                loading={subjectsLoading}
                placeholder={t("subjects.select.placeholder")}
                containerStyle={{ flex: 1 }}
              />
              {!editSubjectId && (
                <Text variant="micro" colorName="textMuted" style={styles.helperText}>
                  {t("subjects.select.required")}
                </Text>
              )}
            </View>
            <Input
              placeholder={t("tasks.form.minutes")}
              value={editMinutes}
              onChangeText={setEditMinutes}
              returnKeyType="done"
              onSubmitEditing={handleSaveEdit}
              blurOnSubmit
              keyboardType="numeric"
              containerStyle={{ width: 110 }}
            />
          </View>
        </Modal>
    </TabScreen>
  );
}

const createStyles = (theme: typeof Colors.light) =>
  StyleSheet.create({
  emptyText: {
    textAlign: "center",
  },
  addTaskToggle: {
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
  addTaskToggleText: {
    fontWeight: "600",
    fontSize: 14,
  },
  addTaskPanel: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginBottom: 16,
    gap: 14,
  },
  formRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  subjectPickerContainer: {
    flex: 1,
  },
  helperText: {
    marginTop: 4,
    marginLeft: 4,
  },
  timeOptionsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  timeOption: {
    width: 52,
    minWidth: 52,
    height: 44,
    borderRadius: 8,
    backgroundColor: theme.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  timeOptionText: {
    fontSize: 13,
    color: theme.text,
  },
  timeOptionSelected: {
    backgroundColor: theme.primaryTint,
    borderWidth: 1.5,
    borderColor: theme.primaryDark,
  },
  timeOptionTextSelected: {
    color: theme.primaryDark,
    fontWeight: "600",
  },
  taskMinutesInputBox: {
    width: 112,
    minWidth: 112,
    margin: 0,
  },
  taskMinutesField: {
    minHeight: 44,
    height: 44,
    paddingHorizontal: 6,
  },
  taskMinutesInputText: {
    fontSize: 12,
    lineHeight: 16,
    paddingVertical: 0,
    textAlign: "center",
  },
  taskCardsContainer: {
    gap: 8,
  },
});
