import { Text } from "@/components/Themed";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import type { CategoryId } from "@/constants/categories";
import {
  categoryNeedsYearStep,
  getSubjectKeysForAcademicPath,
  requiredSpecialtyCount,
  type AcademicYearId,
  yearNeedsSpecialties,
  YEARS_BY_CATEGORY,
} from "@/constants/academicPath";
import { LYCEE_SPECIALTY_SUBJECT_KEYS } from "@/constants/lyceeSpecialties";
import type { SubjectKey } from "@/constants/subjectCatalog";
import { useTheme } from "@/utils/themeContext";
import { ensureDefaultSubjectsFromKeys } from "@/utils/ensureDefaultSubjectsFromKeys";
import { updateUserProfile } from "@/utils/queries";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

const CATEGORY_ORDER: CategoryId[] = [
  "primaire",
  "college",
  "lycee",
  "prepa",
  "universite",
  "autres",
];

function parseStoredPath(
  categoryRaw: string | null | undefined,
  yearRaw: string | null | undefined,
  specs: string[] | null | undefined
): {
  category: CategoryId | null;
  yearId: AcademicYearId | null;
  specialties: SubjectKey[];
} {
  const category =
    (CATEGORY_ORDER.find((c) => c === categoryRaw) as CategoryId | undefined) ??
    null;
  if (!category) {
    return { category: null, yearId: null, specialties: [] };
  }
  const years = YEARS_BY_CATEGORY[category];
  if (years.length === 1) {
    return {
      category,
      yearId: years[0].id,
      specialties: [],
    };
  }
  const yearOk = years.some((y) => y.id === yearRaw);
  const yearId = yearOk ? (yearRaw as AcademicYearId) : null;
  const specSet = new Set(LYCEE_SPECIALTY_SUBJECT_KEYS);
  const specialties = (specs ?? []).filter((k): k is SubjectKey =>
    specSet.has(k as SubjectKey)
  );
  return { category, yearId, specialties };
}

export type AcademicPathModalProps = {
  visible: boolean;
  onClose: () => void;
  userId: string;
  /** Current values from profile (reset when modal opens). */
  academicCategory: string | null | undefined;
  academicYearKey: string | null | undefined;
  specialtyKeys: string[] | null | undefined;
  /** Sync auth metadata, refetch profile, etc. */
  onSaved: (info: {
    category: CategoryId;
    yearId: AcademicYearId | null;
  }) => Promise<void>;
};

export function AcademicPathModal({
  visible,
  onClose,
  userId,
  academicCategory,
  academicYearKey,
  specialtyKeys,
  onSaved,
}: AcademicPathModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [selectedCategory, setSelectedCategory] = useState<CategoryId | null>(null);
  const [yearId, setYearId] = useState<AcademicYearId | null>(null);
  const [selectedSpecialties, setSelectedSpecialties] = useState<SubjectKey[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    const parsed = parseStoredPath(academicCategory, academicYearKey, specialtyKeys);
    setSelectedCategory(parsed.category);
    setYearId(parsed.yearId);
    setSelectedSpecialties(parsed.specialties);
    setError(null);
    setSaving(false);
  }, [visible, academicCategory, academicYearKey, specialtyKeys]);

  const yearsForCategory = useMemo(() => {
    if (!selectedCategory) return [];
    return YEARS_BY_CATEGORY[selectedCategory];
  }, [selectedCategory]);

  const onSelectCategory = (id: CategoryId) => {
    setSelectedCategory(id);
    const years = YEARS_BY_CATEGORY[id];
    setYearId(years.length === 1 ? years[0].id : null);
    setSelectedSpecialties([]);
  };

  const specNeeded = useMemo(
    () =>
      selectedCategory ? yearNeedsSpecialties(selectedCategory, yearId) : false,
    [selectedCategory, yearId]
  );

  const specRequired = useMemo(() => requiredSpecialtyCount(yearId), [yearId]);

  const toggleSpecialty = (key: SubjectKey) => {
    setSelectedSpecialties((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key);
      const max = specRequired;
      if (max > 0 && prev.length >= max) return prev;
      return [...prev, key];
    });
  };

  const yearOk = useMemo(() => {
    if (!selectedCategory) return false;
    const y = YEARS_BY_CATEGORY[selectedCategory];
    return y.length === 1 || yearId !== null;
  }, [selectedCategory, yearId]);

  const specialtiesOk =
    !specNeeded || selectedSpecialties.length === specRequired;

  const canSave =
    !!selectedCategory &&
    yearOk &&
    specialtiesOk &&
    !saving;

  const handleSave = async () => {
    if (!canSave || !selectedCategory) return;
    if (!specialtiesOk) {
      setError(t("onboarding.fillProfile.errorSpecialties", { count: specRequired }));
      return;
    }
    try {
      setSaving(true);
      setError(null);
      const specs = specNeeded ? selectedSpecialties : [];
      await updateUserProfile(userId, {
        academic_category: selectedCategory,
        academic_year_key: yearId,
        specialty_keys: specs,
      });
      const keys = getSubjectKeysForAcademicPath(
        selectedCategory,
        yearId,
        specs
      );
      await ensureDefaultSubjectsFromKeys(userId, keys, t);
      await onSaved({ category: selectedCategory, yearId });
      onClose();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : t("profile.academicPath.errorSave")
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title={t("profile.academicPath.modalTitle")}
      dismissible={!saving}
      padding={14}
      actions={{
        cancel: {
          label: t("common.actions.cancel"),
          onPress: onClose,
          variant: "outline",
          disabled: saving,
        },
        confirm: {
          label: saving ? t("common.status.saving") : t("common.actions.save"),
          onPress: handleSave,
          loading: saving,
          disabled: !canSave,
        },
      }}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text variant="subtitle" colorName="textMuted">
          {t("onboarding.fillProfile.categoryLabel")}
        </Text>
        <View style={styles.categoryChips}>
          {CATEGORY_ORDER.map((id) => (
            <Button
              key={id}
              title={t(`categories.${id}`)}
              variant={selectedCategory === id ? "primary" : "outline"}
              shape="pill"
              size="sm"
              onPress={() => onSelectCategory(id)}
            />
          ))}
        </View>

        {selectedCategory && categoryNeedsYearStep(selectedCategory) ? (
          <>
            <Text variant="subtitle" colorName="textMuted" style={styles.blockLabel}>
              {t("onboarding.fillProfile.yearLabel")}
            </Text>
            <View style={styles.categoryChips}>
              {yearsForCategory.map((y) => (
                <Button
                  key={y.id}
                  title={t(`onboarding.years.${y.labelKey}`)}
                  variant={yearId === y.id ? "primary" : "outline"}
                  shape="pill"
                  size="sm"
                  onPress={() => {
                    setYearId(y.id);
                    setSelectedSpecialties([]);
                  }}
                />
              ))}
            </View>
          </>
        ) : null}

        {specNeeded ? (
          <>
            <Text variant="subtitle" colorName="textMuted" style={styles.blockLabel}>
              {t("onboarding.fillProfile.specialtiesLabel", {
                count: specRequired,
              })}
            </Text>
            <View style={styles.categoryChips}>
              {LYCEE_SPECIALTY_SUBJECT_KEYS.map((key) => {
                const active = selectedSpecialties.includes(key);
                return (
                  <Pressable
                    key={key}
                    onPress={() => toggleSpecialty(key)}
                    style={({ pressed }) => [
                      styles.specChip,
                      {
                        backgroundColor: active ? theme.primary : theme.surface,
                        borderColor: theme.divider ?? theme.border,
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                  >
                    <Text
                      variant="micro"
                      style={{
                        color: active
                          ? theme.onPrimary ?? "#fff"
                          : theme.text,
                        fontWeight: "600",
                      }}
                    >
                      {t(`subjectCatalog.${key}`)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}

        <Text variant="caption" colorName="textMuted" style={styles.hint}>
          {t("profile.academicPath.modalHint")}
        </Text>

        {error ? (
          <Text variant="body" style={styles.error}>
            {error}
          </Text>
        ) : null}
      </ScrollView>
    </Modal>
  );
}

const createStyles = (theme: { divider?: string; border: string; danger?: string }) =>
  StyleSheet.create({
    scroll: { maxHeight: 420 },
    scrollContent: { paddingBottom: 8, gap: 4 },
    categoryChips: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
      marginTop: 8,
    },
    blockLabel: { marginTop: 12 },
    specChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
    },
    hint: { marginTop: 14, lineHeight: 18 },
    error: {
      color: theme.danger ?? "#c00",
      fontWeight: "600",
      marginTop: 10,
    },
  });
