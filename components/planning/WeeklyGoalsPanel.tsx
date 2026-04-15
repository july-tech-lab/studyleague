import { Text } from "@/components/Themed";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Tabs } from "@/components/ui/Tabs";
import Colors from "@/constants/Colors";
import { getSubjectDisplayName } from "@/constants/subjectCatalog";
import { useProfile } from "@/hooks/useProfile";
import { useSubjectGoals, GoalsBySubject } from "@/hooks/useSubjectGoals";
import { attachSubjectToUser, fetchSubjects, Subject } from "@/utils/queries";
import { createSubjectColorMap } from "@/utils/color";
import { useAuth } from "@/utils/authContext";
import { useTheme } from "@/utils/themeContext";
import { formatMinutesCompact } from "@/utils/time";
import { BookOpen, Calendar, Plus, Save, X } from "lucide-react-native";
import React, { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import Slider from "@react-native-community/slider";

const DAYS_ORDER = [1, 2, 3, 4, 5, 6, 0] as const; // Mon-Sun
const DAY_KEYS = [
  "common.days.mon",
  "common.days.tue",
  "common.days.wed",
  "common.days.thu",
  "common.days.fri",
  "common.days.sat",
  "common.days.sun",
] as const;
const DAY_DEFAULTS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const SLIDER_MAX = 240; // 4h
const SLIDER_STEP = 15;
const TIME_OPTIONS = [0, 15, 30, 45, 60, 90, 120, 150, 180, 240];
const AUTO_SAVE_DEBOUNCE_MS = 600;

function serializeGoalsMap(g: GoalsBySubject): string {
  return Object.keys(g)
    .sort()
    .map((id) => {
      const d = g[id];
      return `${id}:${[0, 1, 2, 3, 4, 5, 6].map((i) => d[i] ?? 0).join(",")}`;
    })
    .join("|");
}

export function WeeklyGoalsPanel() {
  const theme = useTheme();
  const { user } = useAuth();
  const { t } = useTranslation();
  const safeTheme = theme ?? Colors.light;

  const {
    subjects: profileSubjects,
    loading: profileLoading,
    refetch: refetchProfile,
  } = useProfile({
    userId: user?.id ?? null,
    autoLoad: true,
  });

  const parentSubjects = useMemo(() => profileSubjects, [profileSubjects]);

  const {
    goalsBySubject,
    loading: goalsLoading,
    error: goalsError,
    refetch: refetchGoals,
    saveGoals,
  } = useSubjectGoals(user?.id ?? null);

  const subjectIds = useMemo(
    () => parentSubjects.map((s) => s.id),
    [parentSubjects]
  );

  const initialGoals = useMemo(
    () => goalsBySubject(subjectIds),
    [goalsBySubject, subjectIds]
  );

  const [viewMode, setViewMode] = useState<"bySubject" | "byDay">("bySubject");
  const [localGoals, setLocalGoals] = useState<GoalsBySubject>(initialGoals);
  const [addSubjectVisible, setAddSubjectVisible] = useState(false);
  const [availableSubjects, setAvailableSubjects] = useState<Subject[]>([]);
  const [selectedSubjectToAdd, setSelectedSubjectToAdd] = useState<string | null>(null);
  const [addingSubject, setAddingSubject] = useState(false);
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [timePickerTarget, setTimePickerTarget] = useState<{
    subjectId: string;
    dayOfWeek: number;
  } | null>(null);
  const [customMinutesInput, setCustomMinutesInput] = useState("");

  const subjectIdsKey = useMemo(
    () =>
      [...subjectIds]
        .sort()
        .join(","),
    [subjectIds]
  );

  const wasLoadingRef = React.useRef(true);
  const prevSubjectIdsKeyRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (goalsLoading) {
      wasLoadingRef.current = true;
      return;
    }

    const syncFromServer =
      wasLoadingRef.current || prevSubjectIdsKeyRef.current !== subjectIdsKey;
    prevSubjectIdsKeyRef.current = subjectIdsKey;
    wasLoadingRef.current = false;

    if (syncFromServer) {
      setLocalGoals(initialGoals);
    }
  }, [goalsLoading, subjectIdsKey, initialGoals]);

  React.useEffect(() => {
    if (!user?.id || goalsLoading || profileLoading) return;
    if (serializeGoalsMap(localGoals) === serializeGoalsMap(initialGoals)) return;

    const timeoutId = setTimeout(() => {
      void saveGoals(localGoals).catch((err: unknown) => {
        console.error(err);
        Alert.alert(
          t("goals.errorSave", "Unable to save goals."),
          err instanceof Error ? err.message : t("common.errors.unexpected")
        );
      });
    }, AUTO_SAVE_DEBOUNCE_MS);

    return () => clearTimeout(timeoutId);
  }, [user?.id, goalsLoading, profileLoading, localGoals, initialGoals, saveGoals, t]);

  const subjectPalette = useMemo(
    () => safeTheme?.subjectPalette ?? [],
    [safeTheme?.subjectPalette]
  );

  const subjectColorById = useMemo(
    () =>
      createSubjectColorMap(
        parentSubjects.map((s) => ({
          ...s,
          children: [] as { id: string; custom_color?: string | null; color?: string | null }[],
        })),
        subjectPalette,
        safeTheme.primary
      ),
    [parentSubjects, subjectPalette, safeTheme.primary]
  );

  const styles = useMemo(() => createStyles(safeTheme), [safeTheme]);

  const updateGoal = useCallback(
    (subjectId: string, dayOfWeek: number, minutes: number) => {
      setLocalGoals((prev) => {
        const next = { ...prev };
        if (!next[subjectId]) {
          next[subjectId] = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
        }
        next[subjectId] = { ...next[subjectId], [dayOfWeek]: minutes };
        return next;
      });
    },
    []
  );

  const openTimePicker = useCallback(
    (subjectId: string, dayOfWeek: number) => {
      setTimePickerTarget({ subjectId, dayOfWeek });
      setTimePickerVisible(true);
    },
    []
  );

  const handleTimePick = useCallback(
    (minutes: number) => {
      if (timePickerTarget) {
        updateGoal(timePickerTarget.subjectId, timePickerTarget.dayOfWeek, minutes);
        setTimePickerVisible(false);
        setTimePickerTarget(null);
        setCustomMinutesInput("");
      }
    },
    [timePickerTarget, updateGoal]
  );

  const handleCustomMinutesApply = useCallback(() => {
    const parsed = parseInt(customMinutesInput, 10);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      const clamped = Math.min(parsed, 480);
      handleTimePick(clamped);
    }
  }, [customMinutesInput, handleTimePick]);

  const openAddSubject = useCallback(async () => {
    if (!user?.id) return;
    setAddSubjectVisible(true);
    try {
      const all = await fetchSubjects(user.id);
      const existingIds = new Set(parentSubjects.map((s) => s.id));
      setAvailableSubjects(all.filter((s) => !existingIds.has(s.id)));
    } catch (err) {
      console.error(err);
      Alert.alert(t("goals.errorLoad", "Unable to load subjects."), t("common.errors.unexpected"));
    }
  }, [user?.id, parentSubjects, t]);

  const handleAddSubject = useCallback(async () => {
    if (!user?.id || !selectedSubjectToAdd) return;
    setAddingSubject(true);
    try {
      await attachSubjectToUser(user.id, selectedSubjectToAdd);
      await refetchProfile();
      await refetchGoals();
      setLocalGoals((prev) => {
        const next = { ...prev };
        next[selectedSubjectToAdd] = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
        return next;
      });
      setAddSubjectVisible(false);
      setSelectedSubjectToAdd(null);
    } catch (err: any) {
      Alert.alert(t("goals.errorAdd", "Unable to add subject."), err.message ?? t("common.errors.unexpected"));
    } finally {
      setAddingSubject(false);
    }
  }, [user?.id, selectedSubjectToAdd, refetchProfile, refetchGoals, t]);

  const weeklyTotal = useCallback(
    (subjectId: string) => {
      const byDay = localGoals[subjectId];
      if (!byDay) return 0;
      return DAYS_ORDER.reduce<number>((sum, d) => sum + (byDay[d] ?? 0), 0);
    },
    [localGoals]
  );

  const dayTotal = useCallback(
    (dayOfWeek: number) => {
      return Object.values(localGoals).reduce(
        (sum, byDay) => sum + (byDay[dayOfWeek] ?? 0),
        0
      );
    },
    [localGoals]
  );

  if (goalsLoading) {
    return (
      <View style={styles.root}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={safeTheme.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {goalsError ? (
        <Text variant="caption" style={styles.syncErrorBanner}>
          {t("goals.loadErrorHint")}
        </Text>
      ) : null}
      <Tabs
        variant="iconPills"
        options={[
          {
            value: "bySubject",
            label: t("goals.bySubject", "By Subject"),
            icon: BookOpen,
          },
          {
            value: "byDay",
            label: t("goals.byDay", "By Day"),
            icon: Calendar,
          },
        ]}
        value={viewMode}
        onChange={(v) => setViewMode(v as "bySubject" | "byDay")}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {viewMode === "bySubject" && (
          <>
            {parentSubjects.map((subject) => {
              const color = subjectColorById[subject.id] ?? safeTheme.primary;
              const total = weeklyTotal(subject.id);
              return (
                <View key={subject.id} style={styles.subjectCard}>
                  <View style={styles.subjectHeader}>
                    <View style={styles.subjectNameRow}>
                      <View style={[styles.colorDot, { backgroundColor: color }]} />
                      <Text variant="h2" style={styles.subjectName}>
                        {getSubjectDisplayName(subject, t)}
                      </Text>
                    </View>
                    <Text variant="subtitle" style={styles.weeklyTotal}>
                      {total > 0
                        ? `${formatMinutesCompact(total)}/week`
                        : t("goals.noTime", "0min/week")}
                    </Text>
                  </View>
                  <View style={styles.weekGrid}>
                    <View style={styles.dayLabelsRow}>
                      {DAYS_ORDER.map((_, idx) => (
                        <Text key={idx} variant="caption" style={styles.dayLabel}>
                          {t(DAY_KEYS[idx], DAY_DEFAULTS[idx])}
                        </Text>
                      ))}
                    </View>
                    <View style={styles.daySlotsRow}>
                      {DAYS_ORDER.map((dow) => {
                        const mins = localGoals[subject.id]?.[dow] ?? 0;
                        const hasTime = mins > 0;
                        return (
                          <TouchableOpacity
                            key={dow}
                            style={[
                              styles.daySlot,
                              hasTime ? styles.daySlotActive : styles.daySlotInactive,
                            ]}
                            onPress={() => openTimePicker(subject.id, dow)}
                          >
                            <Text
                              variant="caption"
                              style={[
                                styles.slotValue,
                                hasTime ? styles.slotValueActive : styles.slotValueInactive,
                              ]}
                            >
                              {formatMinutesCompact(mins)}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                </View>
              );
            })}

            <Button
              variant="outline"
              title={t("common.addSubject")}
              iconLeft={Plus}
              onPress={openAddSubject}
              style={styles.addButton}
            />
          </>
        )}

        {viewMode === "byDay" && (
          <>
            {DAYS_ORDER.map((dow, idx) => {
              const total = dayTotal(dow);
              return (
                <View key={dow} style={styles.dayCard}>
                  <View style={styles.dayHeader}>
                    <Text variant="h2" style={styles.dayName}>
                      {t(DAY_KEYS[idx], DAY_DEFAULTS[idx])}
                    </Text>
                    <Text variant="subtitle" style={styles.dayTotal}>
                      {total > 0 ? formatMinutesCompact(total) : "--"}
                    </Text>
                  </View>
                  {parentSubjects
                    .filter((subject) => (localGoals[subject.id]?.[dow] ?? 0) > 0)
                    .map((subject) => {
                      const mins = localGoals[subject.id]?.[dow] ?? 0;
                      const color = subjectColorById[subject.id] ?? safeTheme.primary;
                      return (
                        <View key={subject.id} style={styles.daySubjectRow}>
                          <View style={[styles.colorDot, { backgroundColor: color }]} />
                          <Text variant="body" style={styles.daySubjectName}>
                            {getSubjectDisplayName(subject, t)}
                          </Text>
                          <Slider
                            style={styles.slider}
                            minimumValue={0}
                            maximumValue={SLIDER_MAX}
                            step={SLIDER_STEP}
                            value={mins}
                            onValueChange={(v) => updateGoal(subject.id, dow, Math.round(v))}
                            minimumTrackTintColor={safeTheme.primary}
                            maximumTrackTintColor={safeTheme.border}
                            thumbTintColor={safeTheme.primary}
                          />
                          <Text variant="caption" style={styles.sliderValue}>
                            {formatMinutesCompact(mins)}
                          </Text>
                        </View>
                      );
                    })}
                </View>
              );
            })}
          </>
        )}
      </ScrollView>

      <Modal
        visible={timePickerVisible}
        onClose={() => {
          setTimePickerVisible(false);
          setTimePickerTarget(null);
          setCustomMinutesInput("");
        }}
      >
        <View style={styles.timePickerContainer}>
          <View style={styles.timeOptionsWrap}>
            {TIME_OPTIONS.map((m) => {
              const isClear = m === 0;
              return (
                <TouchableOpacity
                  key={m}
                  style={[styles.timeOption, isClear && styles.timeOptionClear]}
                  onPress={() => handleTimePick(m)}
                  accessibilityLabel={isClear ? t("goals.clear", "Clear") : undefined}
                >
                  {isClear ? (
                    <X size={18} color={safeTheme.secondaryDark} strokeWidth={2.5} />
                  ) : (
                    <Text variant="body" numberOfLines={1} style={styles.timeOptionText}>
                      {formatMinutesCompact(m)}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
            <Input
              placeholder={t("goals.minutesPlaceholder", "minutes")}
              value={customMinutesInput}
              onChangeText={setCustomMinutesInput}
              keyboardType="number-pad"
              onSubmitEditing={handleCustomMinutesApply}
              containerStyle={styles.customMinutesBox}
              fieldStyle={styles.customMinutesField}
              style={styles.customMinutesInputText}
            />
            <Button
              variant="primary"
              iconLeft={Save}
              iconOnly
              size="sm"
              onPress={handleCustomMinutesApply}
              disabled={!customMinutesInput.trim()}
              accessibilityLabel={t("goals.apply", "Apply")}
              style={styles.applyButton}
            />
          </View>
        </View>
      </Modal>

      <Modal
        visible={addSubjectVisible}
        onClose={() => {
          setAddSubjectVisible(false);
          setSelectedSubjectToAdd(null);
        }}
        title={t("common.addSubject")}
        actions={{
          confirm: {
            label: t("common.actions.add"),
            onPress: handleAddSubject,
            loading: addingSubject,
            disabled: !selectedSubjectToAdd,
          },
        }}
      >
        {availableSubjects.length === 0 ? (
          <Text variant="body" style={styles.emptyText}>
            {t("goals.allSubjectsAdded", "All available subjects have been added.")}
          </Text>
        ) : (
          <ScrollView style={styles.addSubjectList}>
            {availableSubjects.map((subject) => {
                const color =
                  subjectColorById[subject.id] ??
                  subject.custom_color ??
                  subject.color ??
                  safeTheme.primary;
                const isSelected = selectedSubjectToAdd === subject.id;
                return (
                  <TouchableOpacity
                    key={subject.id}
                    style={[styles.addSubjectItem, isSelected && styles.addSubjectItemSelected]}
                    onPress={() => setSelectedSubjectToAdd(subject.id)}
                  >
                    <View style={[styles.colorDot, { backgroundColor: color }]} />
                    <Text variant="body">{getSubjectDisplayName(subject, t)}</Text>
                  </TouchableOpacity>
                );
              })}
          </ScrollView>
        )}
      </Modal>
    </View>
  );
}

const createStyles = (theme: typeof Colors.light) =>
  StyleSheet.create({
    syncErrorBanner: {
      color: theme.textMuted,
      marginBottom: 8,
      paddingHorizontal: 4,
    },
    root: {
      flex: 1,
    },
    center: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 24,
    },
    subjectCard: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 1,
      shadowRadius: 3,
      elevation: 2,
    },
    subjectHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    subjectNameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    colorDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    subjectName: {
      color: theme.text,
      fontWeight: "600",
      fontSize: 15,
    },
    weeklyTotal: {
      color: theme.textMuted,
      fontSize: 13,
    },
    weekGrid: {
      gap: 8,
    },
    dayLabelsRow: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 4,
    },
    dayLabel: {
      flex: 1,
      textAlign: "center",
      color: theme.textMuted,
      fontSize: 10,
      minWidth: 36,
    },
    daySlotsRow: {
      flexDirection: "row",
      gap: 8,
      flexWrap: "nowrap",
    },
    daySlot: {
      flex: 1,
      minWidth: 36,
      paddingVertical: 10,
      paddingHorizontal: 4,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
    },
    daySlotActive: {
      backgroundColor: theme.primaryTint,
      borderWidth: 1,
      borderColor: theme.primary,
    },
    daySlotInactive: {
      backgroundColor: theme.surfaceElevated,
    },
    slotValue: {
      fontSize: 11,
    },
    slotValueActive: {
      color: theme.primary,
      fontWeight: "600",
    },
    slotValueInactive: {
      color: theme.textMuted,
    },
    addButton: {
      alignSelf: "center",
      marginTop: 8,
    },
    dayCard: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 1,
      shadowRadius: 3,
      elevation: 2,
    },
    dayHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    dayName: {
      color: theme.text,
      fontWeight: "600",
      fontSize: 15,
    },
    dayTotal: {
      color: theme.textMuted,
      fontSize: 13,
    },
    daySubjectRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 8,
    },
    daySubjectName: {
      flex: 1,
      color: theme.text,
      fontSize: 14,
    },
    slider: {
      flex: 2,
      height: 32,
    },
    sliderValue: {
      minWidth: 40,
      textAlign: "right",
      color: theme.textMuted,
      fontSize: 11,
    },
    timePickerContainer: {
      marginTop: 4,
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
    },
    timeOptionClear: {
      backgroundColor: theme.secondaryTint,
      borderWidth: 1,
      borderColor: theme.secondaryLight,
    },
    applyButton: {
      width: 52,
      height: 44,
      minWidth: 52,
      minHeight: 44,
    },
    customMinutesBox: {
      width: 112,
      minWidth: 112,
      margin: 0,
    },
    customMinutesField: {
      minHeight: 44,
      height: 44,
      paddingHorizontal: 6,
    },
    customMinutesInputText: {
      fontSize: 12,
    },
    emptyText: {
      color: theme.textMuted,
    },
    addSubjectList: {
      maxHeight: 240,
    },
    addSubjectItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 12,
      paddingHorizontal: 8,
      borderRadius: 8,
    },
    addSubjectItemSelected: {
      backgroundColor: theme.primaryTint,
    },
  });
