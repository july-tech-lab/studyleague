import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/Themed";
import { getSubjectDisplayName } from "@/constants/subjectCatalog";
import { Subject, Task } from "@/utils/queries";
import { useTheme } from "@/utils/themeContext";
import { formatDateLabel, getTodayIso } from "@/utils/time";
import { Check, Pencil, RotateCcw, Trash2 } from "lucide-react-native";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";

export interface TaskCardProps {
  task: Task;
  subjects: Pick<Subject, "id" | "name" | "bank_key">[];
  onEdit?: (task: Task) => void;
  onDelete?: (taskId: string) => void;
  onResume?: (task: Task) => void;
  onComplete?: (task: Task) => void;
  showActions?: boolean;
  formatScheduledLabel?: (value?: string | null) => string;
}

export function TaskCard({
  task,
  subjects,
  onEdit,
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

  // Prefer resolved subject (bank_key → i18n); else string from API/query (no catalog key).
  const subjectLabel = useMemo(() => {
    if (task.subjectId) {
      const found = subjects.find((s) => s.id === task.subjectId);
      if (found) return getSubjectDisplayName(found, t);
    }
    if (task.subjectName?.trim()) {
      return getSubjectDisplayName({ name: task.subjectName }, t);
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
    actionRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    iconButton: {
      borderRadius: 12,
    },
    progressRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    progressBar: {
      flex: 1,
      height: 8,
      borderRadius: 8,
      backgroundColor: "rgba(0,0,0,0.05)",
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      borderRadius: 8,
    },
    titleBlock: {
      flexDirection: "row",
      alignItems: "flex-start",
      marginBottom: 12,
    },
    titleColumn: {
      flex: 1,
      gap: 2,
    },
    actionRowWrapper: {
      alignSelf: "flex-start",
    },
  });

  return (
    <Card variant="border">
      <View style={styles.titleBlock}>
        <View style={styles.titleColumn}>
          <Text variant="subtitle" style={{ fontWeight: "600" }}>
            {task.title}
          </Text>
          <Text variant="micro" colorName="textMuted">
            {subjectLabel}
            {task.scheduledFor ? ` • ${formatLabel(task.scheduledFor)}` : ""}
          </Text>
        </View>
        {(onEdit || onDelete || onResume || onComplete) && (
          <View style={[styles.actionRow, styles.actionRowWrapper]}>
            {onEdit ? (
              <Button
                iconLeft={Pencil}
                iconOnly
                variant="ghost"
                size="xs"
                onPress={() => onEdit(task)}
                accessibilityLabel={t("tasks.edit")}
                style={[styles.iconButton, { backgroundColor: theme.primaryTint }]}
              />
            ) : null}
            {task.status === "done" && onResume ? (
              <Button
                iconLeft={RotateCcw}
                iconOnly
                variant="ghost"
                size="xs"
                onPress={() => onResume(task)}
                accessibilityLabel={t("tasks.resume")}
                style={[styles.iconButton, { backgroundColor: theme.primaryTint }]}
              />
            ) : onComplete ? (
              <Button
                iconLeft={Check}
                iconOnly
                variant="ghost"
                size="xs"
                onPress={() => onComplete(task)}
                accessibilityLabel={t("tasks.completeNow")}
                style={[styles.iconButton, { backgroundColor: theme.primaryTint }]}
              />
            ) : null}
            {onDelete && (
              <Button
                iconLeft={Trash2}
                iconOnly
                variant="ghost"
                size="xs"
                onPress={() => onDelete(task.id)}
                accessibilityLabel={t("tasks.delete")}
                style={[styles.iconButton, { backgroundColor: theme.primaryTint }]}
              />
            )}
          </View>
        )}
      </View>
      <View style={styles.progressRow}>
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
          <Text variant="micro" colorName="textMuted">
            {t("tasks.progress", {
              current: Math.round(task.loggedSeconds / 60),
              target: planned || "—",
            })}
          </Text>
        )}
      </View>
    </Card>
  );
}
