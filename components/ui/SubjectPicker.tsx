import { Text } from "@/components/Themed";
import { getSubjectDisplayName } from "@/constants/subjectCatalog";
import { createSubjectColorMap } from "@/utils/color";
import { Subject } from "@/utils/queries";
import { useTheme } from "@/utils/themeContext";
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
}

export function SubjectPicker({
  subjects,
  selectedSubjectId,
  onSelect,
  loading = false,
  placeholder,
  containerStyle,
}: SubjectPickerProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const displaySubjects = subjects;

  const selectedSubject = displaySubjects.find((s) => s.id === selectedSubjectId) ?? null;

  // Create color map for subjects (using custom_color and color from database)
  const subjectColorMap = useMemo(() => {
    const subjectTree = displaySubjects.map((s) => ({
      id: s.id,
      custom_color: s.custom_color,
      color: s.color,
      children: [] as { id: string; custom_color?: string | null; color?: string | null }[],
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
      backgroundColor: theme.surface,
    },
    dropdown: {
      marginTop: 8,
      borderWidth: 1,
      borderColor: theme.divider,
      borderRadius: 12,
      backgroundColor: theme.surface,
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
            ? t("common.status.loading")
            : selectedSubject
            ? getSubjectDisplayName(selectedSubject, t)
            : placeholder ?? t("subjects.select.placeholder")}
        </Text>
        <ChevronDown size={18} color={theme.textMuted} />
      </TouchableOpacity>
      {isOpen && (
        <View style={styles.dropdown}>
          {loading ? (
            <View style={[styles.dropdownItem, { flexDirection: "row", alignItems: "center", gap: 8 }]}>
              <ActivityIndicator size="small" color={theme.textMuted} />
              <Text variant="subtitle" colorName="textMuted">
                {t("common.status.loading")}
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
                    {getSubjectDisplayName(subj, t)}
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
