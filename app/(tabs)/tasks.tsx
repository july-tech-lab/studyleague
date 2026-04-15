import { TabScreen } from "@/components/layout/TabScreen";
import { Text } from "@/components/Themed";
import { WeeklyGoalsPanel } from "@/components/planning/WeeklyGoalsPanel";
import { SubjectPicker } from "@/components/ui";
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
import { formatDateLabel, getTodayIso } from "@/utils/time";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { CheckCircle2, ListTodo, Plus, Save } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
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

  const { planningSection } = useLocalSearchParams<{ planningSection?: string }>();

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskMinutes, setNewTaskMinutes] = useState("");
  const [planningTab, setPlanningTab] = useState<"weeklyGoals" | "tasks">("tasks");
  const [viewMode, setViewMode] = useState<"active" | "done">("active");
  const [createModalVisible, setCreateModalVisible] = useState(false);
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
    [subjects]
  );

  // Refresh tasks when returning to this tab to reflect timer updates
  useFocusEffect(
    useCallback(() => {
      refetchTasks();
    }, [refetchTasks])
  );

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return;
    if (!selectedSubject) {
      Alert.alert(t("timer.errorTitle"), t("subjects.select.missing"));
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
      setCreateModalVisible(false);
    } catch (err) {
      console.error("Error creating task", err);
      Alert.alert(t("timer.errorTitle"), t("timer.errorSave"));
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

  return (
    <TabScreen
      title={t("tasks.title")}
      scroll={planningTab === "weeklyGoals" ? false : undefined}
      rightIcon={
        planningTab === "tasks"
          ? {
              icon: Plus,
              onPress: () => setCreateModalVisible(true),
              accessibilityLabel: t("tasks.form.add"),
            }
          : undefined
      }
    >
        <View style={{ gap: planningTab === "weeklyGoals" ? 8 : 12, flex: planningTab === "weeklyGoals" ? 1 : undefined }}>
          <Tabs
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
          visible={createModalVisible}
          onClose={() => setCreateModalVisible(false)}
          title={t("tasks.planBlock")}
          padding={20}
          actions={{
            cancel: {
              label: t("common.actions.cancel"),
              onPress: () => setCreateModalVisible(false),
              variant: "outline",
            },
            confirm: {
              label: t("tasks.form.add"),
              variant: "primary",
              iconLeft: Plus,
              onPress: handleAddTask,
              disabled: !selectedSubject,
            },
          }}
        >
          <Input
            placeholder={t("tasks.form.name")}
            value={newTaskTitle}
            onChangeText={setNewTaskTitle}
            returnKeyType="done"
            onSubmitEditing={handleAddTask}
            blurOnSubmit
            containerStyle={{ marginBottom: 12 }}
          />
          <View style={styles.formRow}>
            <View style={styles.subjectPickerContainer}>
              <SubjectPicker
                subjects={subjects}
                selectedSubjectId={selectedSubjectId}
                onSelect={handleSubjectSelect}
                loading={subjectsLoading}
                placeholder={t("subjects.select.placeholder")}
                containerStyle={{ flex: 1 }}
              />
              {!selectedSubject && (
                <Text variant="micro" colorName="textMuted" style={styles.helperText}>
                  {t("subjects.select.required")}
                </Text>
              )}
            </View>
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
        </Modal>

        <Modal
          visible={editModalVisible}
          onClose={closeEditModal}
          title={t("tasks.editBlock")}
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
  taskCardsContainer: {
    gap: 8,
  },
});
