import { Text } from "@/components/Themed";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import {
    categoryNeedsYearStep,
    getSubjectKeysForAcademicPath,
    requiredSpecialtyCount,
    yearNeedsSpecialties,
    YEARS_BY_CATEGORY,
    type AcademicYearId,
} from "@/constants/academicPath";
import type { CategoryId } from "@/constants/categories";
import { LYCEE_SPECIALTY_SUBJECT_KEYS } from "@/constants/lyceeSpecialties";
import type { SubjectKey } from "@/constants/subjectCatalog";
import {
  ensureDefaultSubjectsFromKeys,
  listSubjectKeysToEnsure,
} from "@/utils/ensureDefaultSubjectsFromKeys";
import { updateUserProfile } from "@/utils/queries";
import { useTheme } from "@/utils/themeContext";
import { useCallback, useEffect, useMemo, useState } from "react";
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

type PathWizardScreen = "category" | "level" | "subjects" | "confirm";

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

  const [screen, setScreen] = useState<PathWizardScreen>("category");
  const [selectedCategory, setSelectedCategory] = useState<CategoryId | null>(null);
  const [yearId, setYearId] = useState<AcademicYearId | null>(null);
  const [selectedSpecialties, setSelectedSpecialties] = useState<SubjectKey[]>([]);
  const [saving, setSaving] = useState(false);
  const [listingPreview, setListingPreview] = useState(false);
  /** New subjects for this path (not yet visible); confirm step toggles a subset. */
  const [previewKeys, setPreviewKeys] = useState<SubjectKey[]>([]);
  const [confirmSelectedKeys, setConfirmSelectedKeys] = useState<SubjectKey[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    const parsed = parseStoredPath(academicCategory, academicYearKey, specialtyKeys);
    setSelectedCategory(parsed.category);
    setYearId(parsed.yearId);
    setSelectedSpecialties(parsed.specialties);
    setScreen("category");
    setError(null);
    setSaving(false);
    setListingPreview(false);
    setPreviewKeys([]);
    setConfirmSelectedKeys([]);
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

  const wizardStepTotal = useMemo(() => {
    if (!selectedCategory) return 1;
    let n = 1;
    if (categoryNeedsYearStep(selectedCategory)) n++;
    if (yearNeedsSpecialties(selectedCategory, yearId)) n++;
    return n;
  }, [selectedCategory, yearId]);

  const wizardStepCurrent = useMemo(() => {
    if (screen === "category") return 1;
    if (screen === "level") return 2;
    return wizardStepTotal;
  }, [screen, wizardStepTotal]);

  const canSave =
    !!selectedCategory &&
    yearOk &&
    specialtiesOk &&
    !saving &&
    !listingPreview;

  const goWizardBack = useCallback(() => {
    setError(null);
    if (screen === "confirm") {
      setScreen(
        specNeeded
          ? "subjects"
          : selectedCategory && categoryNeedsYearStep(selectedCategory)
            ? "level"
            : "category"
      );
      return;
    }
    if (screen === "subjects") {
      setScreen(
        selectedCategory && categoryNeedsYearStep(selectedCategory)
          ? "level"
          : "category"
      );
      return;
    }
    if (screen === "level") {
      setScreen("category");
    }
  }, [screen, selectedCategory, specNeeded]);

  const toggleConfirmSubjectKey = (key: SubjectKey) => {
    setConfirmSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const requestPreviewSave = async () => {
    if (!canSave || !selectedCategory) return;
    if (!specialtiesOk) {
      setError(t("onboarding.fillProfile.errorSpecialties", { count: specRequired }));
      return;
    }
    setListingPreview(true);
    setError(null);
    try {
      const specs = specNeeded ? selectedSpecialties : [];
      const keys = getSubjectKeysForAcademicPath(
        selectedCategory,
        yearId,
        specs
      );
      const newKeys = await listSubjectKeysToEnsure(userId, keys);
      setPreviewKeys(newKeys);
      setConfirmSelectedKeys([...newKeys]);
      setScreen("confirm");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : t("profile.academicPath.errorSave")
      );
    } finally {
      setListingPreview(false);
    }
  };

  const applySave = async () => {
    if (!selectedCategory || !yearOk || !specialtiesOk) return;
    try {
      setSaving(true);
      setError(null);
      const specs = specNeeded ? selectedSpecialties : [];
      await updateUserProfile(userId, {
        academic_category: selectedCategory,
        academic_year_key: yearId,
        specialty_keys: specs,
      });
      const allKeys = getSubjectKeysForAcademicPath(
        selectedCategory,
        yearId,
        specs
      );
      const newKeySet = new Set(previewKeys);
      const keysToEnsure = allKeys.filter(
        (k) => !newKeySet.has(k) || confirmSelectedKeys.includes(k)
      );
      await ensureDefaultSubjectsFromKeys(userId, keysToEnsure, t);
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

  const advanceFromCategory = () => {
    if (!selectedCategory) return;
    if (categoryNeedsYearStep(selectedCategory)) {
      setScreen("level");
      return;
    }
    if (yearNeedsSpecialties(selectedCategory, yearId)) {
      setScreen("subjects");
      return;
    }
    void requestPreviewSave();
  };

  const advanceFromLevel = () => {
    if (!selectedCategory || !yearOk) return;
    if (yearNeedsSpecialties(selectedCategory, yearId)) {
      setScreen("subjects");
      return;
    }
    void requestPreviewSave();
  };

  const confirmFromCategory =
    !!selectedCategory &&
    !categoryNeedsYearStep(selectedCategory) &&
    !yearNeedsSpecialties(selectedCategory, yearId);

  const confirmFromLevel =
    !!selectedCategory &&
    yearOk &&
    !yearNeedsSpecialties(selectedCategory, yearId);

  const showPathHint =
    (screen === "category" && wizardStepTotal === 1) ||
    (screen === "level" && confirmFromLevel) ||
    (screen === "subjects" && specNeeded);

  const confirmLabel =
    screen === "confirm"
      ? saving
        ? t("common.status.saving")
        : t("profile.academicPath.confirmApply")
      : screen === "subjects" || (screen === "category" && confirmFromCategory)
        ? listingPreview
          ? t("common.status.loading")
          : t("common.actions.save")
        : screen === "level" && confirmFromLevel
          ? listingPreview
            ? t("common.status.loading")
            : t("common.actions.save")
          : t("common.actions.continue");

  const confirmDisabled =
    screen === "category"
      ? !selectedCategory || saving || listingPreview
      : screen === "level"
        ? !yearOk || saving || listingPreview
        : screen === "subjects"
          ? !specialtiesOk || saving || listingPreview
          : screen === "confirm"
            ? saving
            : true;

  const confirmOnPress = () => {
    if (screen === "confirm") {
      void applySave();
      return;
    }
    if (screen === "category") {
      advanceFromCategory();
      return;
    }
    if (screen === "level") {
      advanceFromLevel();
      return;
    }
    void requestPreviewSave();
  };

  const cancelIsClose = screen === "category";

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title={t("profile.academicPath.modalTitle")}
      dismissible={!saving && !listingPreview}
      padding={14}
      actions={{
        cancel: {
          label: cancelIsClose
            ? t("common.actions.cancel")
            : t("common.actions.back"),
          onPress: cancelIsClose ? onClose : goWizardBack,
          variant: "outline",
          disabled: saving || listingPreview,
        },
        confirm: {
          label: confirmLabel,
          onPress: confirmOnPress,
          loading:
            (screen === "confirm" && saving) ||
            (screen === "subjects" && listingPreview) ||
            (screen === "category" && confirmFromCategory && listingPreview) ||
            (screen === "level" && confirmFromLevel && listingPreview),
          disabled: confirmDisabled,
        },
      }}
    >
      <View style={styles.body}>
        {wizardStepTotal > 1 && screen !== "confirm" ? (
          <Text variant="caption" colorName="textMuted" style={styles.stepBadge}>
            {t("profile.academicPath.wizardStepOf", {
              current: wizardStepCurrent,
              total: wizardStepTotal,
            })}
          </Text>
        ) : null}

        {screen === "category" ? (
          <>
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
            {showPathHint && screen === "category" ? (
              <Text variant="caption" colorName="textMuted" style={styles.hint}>
                {t("profile.academicPath.modalHint")}
              </Text>
            ) : null}
          </>
        ) : null}

        {screen === "level" && selectedCategory && categoryNeedsYearStep(selectedCategory) ? (
          <>
            <Text variant="subtitle" colorName="textMuted">
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
            {showPathHint && screen === "level" ? (
              <Text variant="caption" colorName="textMuted" style={styles.hint}>
                {t("profile.academicPath.modalHint")}
              </Text>
            ) : null}
          </>
        ) : null}

        {screen === "subjects" && specNeeded ? (
          <>
            <Text variant="subtitle" colorName="textMuted">
              {t("onboarding.fillProfile.specialtiesLabel", {
                count: specRequired,
              })}
            </Text>
            <ScrollView
              style={styles.subjectsScroll}
              contentContainerStyle={styles.subjectsScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
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
            </ScrollView>
            <Text variant="caption" colorName="textMuted" style={styles.hint}>
              {t("profile.academicPath.modalHint")}
            </Text>
          </>
        ) : null}

        {screen === "confirm" ? (
          <>
            <Text variant="subtitle" colorName="textMuted">
              {t("profile.academicPath.confirmTitle")}
            </Text>
            <Text variant="caption" colorName="textMuted" style={styles.confirmIntro}>
              {t("profile.academicPath.confirmIntro")}
            </Text>
            {previewKeys.length === 0 ? (
              <Text variant="body" colorName="textMuted" style={styles.confirmIntro}>
                {t("profile.academicPath.confirmEmpty")}
              </Text>
            ) : (
              <ScrollView
                style={styles.subjectsScroll}
                contentContainerStyle={styles.subjectsScrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.categoryChips}>
                  {previewKeys.map((key) => {
                    const active = confirmSelectedKeys.includes(key);
                    return (
                      <Pressable
                        key={key}
                        onPress={() => toggleConfirmSubjectKey(key)}
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
              </ScrollView>
            )}
          </>
        ) : null}

        {error ? (
          <Text variant="body" style={styles.error}>
            {error}
          </Text>
        ) : null}
      </View>
    </Modal>
  );
}

const createStyles = (theme: { divider?: string; border: string; danger?: string }) =>
  StyleSheet.create({
    body: { gap: 4 },
    stepBadge: { marginBottom: 6 },
    subjectsScroll: { maxHeight: 280 },
    subjectsScrollContent: { paddingBottom: 4 },
    categoryChips: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
      marginTop: 8,
    },
    specChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
    },
    hint: { marginTop: 10, lineHeight: 18 },
    confirmIntro: { marginTop: 6, lineHeight: 18 },
    error: {
      color: theme.danger ?? "#c00",
      fontWeight: "600",
      marginTop: 8,
    },
  });
