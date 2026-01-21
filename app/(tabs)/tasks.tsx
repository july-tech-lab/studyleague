import { TabScreen } from "@/components/layout/TabScreen";
import { Text } from "@/components/Themed";
import { SubjectPicker, TaskCard } from "@/components/ui";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Tabs } from "@/components/ui/Tabs";
import Colors from "@/constants/Colors";
import { useSubjects } from "@/hooks/useSubjects";
import { useTasks } from "@/hooks/useTasks";
import { useAuth } from "@/utils/authContext";
import { Task } from "@/utils/queries";
import { useTheme } from "@/utils/themeContext";
import { formatDateLabel, getTodayIso } from "@/utils/time";
import { useFocusEffect } from "expo-router";
import { CalendarClock, Plus } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
    subjects, // All subjects (parents + children) - needed for TaskCard lookup
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
            <View style={{ flex: 1 }}>
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
          ) : (
            <FlatList
              data={orderedTasks}
              keyExtractor={(item) => item.id}
              renderItem={({ item: task }) => (
                <TaskCard
                  task={task}
                  subjects={subjects}
                  onDelete={handleDeleteTask}
                  onResume={viewMode === "done" ? handleResumeTask : undefined}
                  onComplete={viewMode !== "done" ? handleCompleteTask : undefined}
                  formatScheduledLabel={formatScheduledLabel}
                />
              )}
              ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
              ListEmptyComponent={
                <Text variant="micro" colorName="textMuted" style={styles.emptyText}>
                  {t("tasks.emptyState")}
                </Text>
              }
              scrollEnabled={false}
            />
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
  emptyText: {},
  formRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
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
});
