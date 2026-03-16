import { TabScreen } from "@/components/layout/TabScreen";
import { Text } from "@/components/Themed";
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
import { useFocusEffect } from "expo-router";
import { Plus } from "lucide-react-native";
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
  const [createModalVisible, setCreateModalVisible] = useState(false);

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
      rightIcon={{
        icon: Plus,
        onPress: () => setCreateModalVisible(true),
        accessibilityLabel: t("tasks.form.add"),
      }}
    >
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
            <View style={styles.taskCardsContainer}>
              {orderedTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  subjects={subjects}
                  onDelete={handleDeleteTask}
                  onResume={viewMode === "done" ? handleResumeTask : undefined}
                  onComplete={viewMode === "active" ? handleCompleteTask : undefined}
                  formatScheduledLabel={formatScheduledLabel}
                />
              ))}
            </View>
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
                subjects={parentSubjects}
                selectedSubjectId={selectedSubjectId}
                onSelect={handleSubjectSelect}
                loading={subjectsLoading}
                placeholder={t("subjects.select.placeholder")}
                containerStyle={{ flex: 1 }}
                parentsOnly={true}
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
