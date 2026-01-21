import { Text } from "@/components/Themed";
import { Subject } from "@/utils/queries";
import { useTheme } from "@/utils/themeContext";
import Colors from "@/constants/Colors";
import { createSubjectColorMap } from "@/utils/color";
import { ChevronDown } from "lucide-react-native";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    ActivityIndicator,
    StyleSheet,
    TouchableOpacity,
    View,
} from "react-native";

export interface SubjectPickerProps {
  subjects: Subject[];
  selectedSubjectId: string | null;
  onSelect: (subjectId: string) => void;
  loading?: boolean;
  placeholder?: string;
  containerStyle?: object;
  /** If true, only shows parent subjects (where parent_subject_id is null). Default: true */
  parentsOnly?: boolean;
}

export function SubjectPicker({
  subjects,
  selectedSubjectId,
  onSelect,
  loading = false,
  placeholder,
  containerStyle,
  parentsOnly = true,
}: SubjectPickerProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  // Filter to only parent subjects (where parent_subject_id is null)
  // Database: parent_subject_id is NULL for parents, UUID for children
  // Tasks can be assigned to child subjects, but the picker should only show parents
  const displaySubjects = parentsOnly
    ? subjects.filter((s) => s.parent_subject_id === null || s.parent_subject_id === undefined)
    : subjects;

  const selectedSubject = displaySubjects.find((s) => s.id === selectedSubjectId) ?? null;

  // Create color map for subjects (using custom_color if available)
  const subjectColorMap = useMemo(() => {
    const subjectTree = displaySubjects.map((s) => ({
      id: s.id,
      custom_color: s.custom_color,
      children: [] as { id: string; custom_color?: string | null }[],
    }));
    return createSubjectColorMap(subjectTree, theme.subjectPalette ?? [], theme.primary);
  }, [displaySubjects, theme.subjectPalette, theme.primary]);

  const styles = StyleSheet.create({
    input: {
      flex: 1,
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      borderColor: theme.divider,
      backgroundColor: theme.surfaceElevated,
    },
    dropdown: {
      marginTop: 8,
      borderWidth: 1,
      borderColor: theme.divider,
      borderRadius: 12,
      backgroundColor: theme.surfaceElevated,
      overflow: "hidden",
    },
    dropdownItem: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.divider,
    },
    colorBadge: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    // Typography handled by Themed Text variants
  });

  return (
    <View style={containerStyle}>
      <TouchableOpacity
        style={styles.input}
        onPress={() => setIsOpen((prev) => !prev)}
      >
        {selectedSubject && subjectColorMap[selectedSubject.id] && (
          <View
            style={[
              styles.colorBadge,
              { backgroundColor: subjectColorMap[selectedSubject.id] },
            ]}
          />
        )}
        <Text
          variant="subtitle"
          style={{ color: selectedSubject ? theme.text : theme.textMuted, flex: 1 }}
        >
          {loading
            ? t("common.loading", "Chargement...")
            : selectedSubject
            ? selectedSubject.name
            : placeholder ?? t("tasks.form.selectSubject", {
                defaultValue: "Select a subject",
              })}
        </Text>
        <ChevronDown size={18} color={theme.textMuted} />
      </TouchableOpacity>
      {isOpen && (
        <View style={styles.dropdown}>
          {loading ? (
            <View style={[styles.dropdownItem, { flexDirection: "row", alignItems: "center", gap: 8 }]}>
              <ActivityIndicator size="small" color={theme.textMuted} />
              <Text variant="subtitle" colorName="textMuted">
                {t("common.loading", "Chargement...")}
              </Text>
            </View>
          ) : displaySubjects.length === 0 ? (
            <Text variant="subtitle" colorName="textMuted" style={styles.dropdownItem}>
              {t("tasks.emptyState")}
            </Text>
          ) : (
            displaySubjects.map((subj) => {
              const subjectColor = subjectColorMap[subj.id];
              return (
                <TouchableOpacity
                  key={subj.id}
                  style={[
                    styles.dropdownItem,
                    { flexDirection: "row", alignItems: "center", gap: 8 },
                    selectedSubjectId === subj.id && {
                      backgroundColor: theme.secondaryTint,
                    },
                  ]}
                  onPress={() => {
                    onSelect(subj.id);
                    setIsOpen(false);
                  }}
                >
                  {subjectColor && (
                    <View
                      style={[
                        styles.colorBadge,
                        { backgroundColor: subjectColor },
                      ]}
                    />
                  )}
                  <Text
                    variant="subtitle"
                    style={[
                      {
                        flex: 1,
                        color:
                          selectedSubjectId === subj.id
                            ? theme.text
                            : theme.textMuted,
                      },
                    ]}
                  >
                    {subj.name}
                  </Text>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      )}
    </View>
  );
}
