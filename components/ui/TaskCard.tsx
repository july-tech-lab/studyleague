import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/Themed";
import { Task } from "@/utils/queries";
import { useTheme } from "@/utils/themeContext";
import { formatDateLabel, getTodayIso } from "@/utils/time";
import { Trash2 } from "lucide-react-native";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";

export interface TaskCardProps {
  task: Task;
  subjects: { id: string; name: string }[];
  onDelete?: (taskId: string) => void;
  onResume?: (task: Task) => void;
  onComplete?: (task: Task) => void;
  showActions?: boolean;
  formatScheduledLabel?: (value?: string | null) => string;
}

export function TaskCard({
  task,
  subjects,
  onDelete,
  onResume,
  onComplete,
  showActions = true,
  formatScheduledLabel,
}: TaskCardProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const todayIso = useMemo(() => getTodayIso(), []);

  const planned = task.plannedMinutes ?? 0;
  const progress = useMemo(
    () => (planned > 0 ? Math.min(1, task.loggedSeconds / (planned * 60)) : 0),
    [planned, task.loggedSeconds]
  );

  // Priority: task.subjectName (from query) > subjects array lookup > fallback
  // Note: Tasks can be assigned to child subjects, so we need the full subjects array
  const subjectLabel = useMemo(() => {
    // First, prefer subjectName if it's already on the task (from Supabase query)
    if (task.subjectName) return task.subjectName;
    
    // Fallback to lookup by ID (supports both parent and child subjects)
    if (task.subjectId) {
      const found = subjects.find((s) => s.id === task.subjectId);
      if (found) return found.name;
    }
    
    return t("tasks.form.subject");
  }, [task.subjectName, task.subjectId, subjects, t]);

  const defaultFormatScheduled = (value?: string | null) => {
    if (!value) return "";
    const formatted = formatDateLabel(value, todayIso);
    if (formatted === "Today") return t("tasks.today");
    return formatted;
  };

  const formatLabel = formatScheduledLabel ?? defaultFormatScheduled;

  const styles = StyleSheet.create({
    taskHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    // Note: Typography handled by Themed Text component with variant prop
    progressBar: {
      height: 8,
      borderRadius: 8,
      backgroundColor: "rgba(0,0,0,0.05)",
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      borderRadius: 8,
    },
    progressLabels: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    inlineActionButton: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
    },
  });

  return (
    <Card variant="border">
      <View style={styles.taskHeader}>
        <Text variant="subtitle" style={{ fontWeight: "600" }}>
          {task.title}
        </Text>
        {onDelete && (
          <Button
            iconLeft={Trash2}
            iconOnly
            variant="ghost"
            size="sm"
            onPress={() => onDelete(task.id)}
            accessibilityLabel={t("tasks.delete", "Delete task")}
          />
        )}
      </View>
      <Text variant="micro" colorName="textMuted">
        {subjectLabel}
        {task.scheduledFor ? ` • ${formatLabel(task.scheduledFor)}` : ""}
      </Text>
      <View style={styles.progressBar}>
        <View
          style={[
            styles.progressFill,
            {
              backgroundColor: theme.primary,
              width: `${progress * 100}%`,
            },
          ]}
        />
      </View>
      {showActions && (
        <View style={styles.progressLabels}>
          <Text variant="micro" colorName="textMuted">
            {t("tasks.progress", {
              current: Math.round(task.loggedSeconds / 60),
              target: planned || "—",
            })}
          </Text>
          {task.status === "done" && onResume ? (
            <Button
              title={t("tasks.resume")}
              variant="primary"
              size="sm"
              onPress={() => onResume(task)}
              style={styles.inlineActionButton}
            />
          ) : onComplete ? (
            <Button
              title={t("tasks.completeNow")}
              variant="primary"
              size="sm"
              onPress={() => onComplete(task)}
              style={styles.inlineActionButton}
            />
          ) : null}
        </View>
      )}
    </Card>
  );
}
