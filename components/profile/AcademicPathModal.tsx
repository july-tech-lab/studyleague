import { PathSubjectOptionsStep } from "@/components/profile/PathSubjectOptionsStep";
import { Text } from "@/components/Themed";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import {
  categoryNeedsYearStep,
  getSubjectKeysForAcademicPath,
  normalizeAcademicYearId,
  pathNeedsSubjectOptionsStep,
  yearNeedsSpecialties,
  YEARS_BY_CATEGORY,
  type AcademicYearId,
} from "@/constants/academicPath";
import type { CategoryId } from "@/constants/categories";
import {
  LANGUAGE_OPTION_SUBJECT_KEYS,
  LYCEE_SPECIALTY_SUBJECT_KEYS,
} from "@/constants/pathSubjectOptions";
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
  specs: string[] | null | undefined,
  langs: string[] | null | undefined
): {
  category: CategoryId | null;
  yearId: AcademicYearId | null;
  specialties: SubjectKey[];
  languages: SubjectKey[];
} {
  const category =
    (CATEGORY_ORDER.find((c) => c === categoryRaw) as CategoryId | undefined) ??
    null;
  if (!category) {
    return { category: null, yearId: null, specialties: [], languages: [] };
  }
  const years = YEARS_BY_CATEGORY[category];
  if (years.length === 1) {
    return {
      category,
      yearId: years[0].id,
      specialties: [],
      languages: [],
    };
  }
  const normalizedYear = normalizeAcademicYearId(yearRaw);
  const yearOk = normalizedYear !== null && years.some((y) => y.id === normalizedYear);
  const yearId = yearOk ? normalizedYear : null;
  const specSet = new Set(LYCEE_SPECIALTY_SUBJECT_KEYS);
  const specialties = (specs ?? []).filter((k): k is SubjectKey =>
    specSet.has(k as SubjectKey)
  );
  const langSet = new Set(LANGUAGE_OPTION_SUBJECT_KEYS);
  const languages = (langs ?? []).filter((k): k is SubjectKey =>
    langSet.has(k as SubjectKey)
  );
  return { category, yearId, specialties, languages };
}

export type AcademicPathModalProps = {
  visible: boolean;
  onClose: () => void;
  userId: string;
  /** Current values from profile (reset when modal opens). */
  academicCategory: string | null | undefined;
  academicYearKey: string | null | undefined;
  specialtyKeys: string[] | null | undefined;
  languageKeys: string[] | null | undefined;
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
  languageKeys,
  onSaved,
}: AcademicPathModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [screen, setScreen] = useState<PathWizardScreen>("category");
  const [selectedCategory, setSelectedCategory] = useState<CategoryId | null>(null);
  const [yearId, setYearId] = useState<AcademicYearId | null>(null);
  const [selectedSpecialties, setSelectedSpecialties] = useState<SubjectKey[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<SubjectKey[]>([]);
  const [saving, setSaving] = useState(false);
  const [listingPreview, setListingPreview] = useState(false);
  /** New subjects for this path (not yet visible); confirm step toggles a subset. */
  const [previewKeys, setPreviewKeys] = useState<SubjectKey[]>([]);
  const [confirmSelectedKeys, setConfirmSelectedKeys] = useState<SubjectKey[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    const parsed = parseStoredPath(
      academicCategory,
      academicYearKey,
      specialtyKeys,
      languageKeys
    );
    setSelectedCategory(parsed.category);
    setYearId(parsed.yearId);
    setSelectedSpecialties(parsed.specialties);
    setSelectedLanguages(parsed.languages);
    setScreen("category");
    setError(null);
    setSaving(false);
    setListingPreview(false);
    setPreviewKeys([]);
    setConfirmSelectedKeys([]);
  }, [visible, academicCategory, academicYearKey, specialtyKeys, languageKeys]);

  const yearsForCategory = useMemo(() => {
    if (!selectedCategory) return [];
    return YEARS_BY_CATEGORY[selectedCategory];
  }, [selectedCategory]);

  const onSelectCategory = (id: CategoryId) => {
    setSelectedCategory(id);
    const years = YEARS_BY_CATEGORY[id];
    setYearId(years.length === 1 ? years[0].id : null);
    setSelectedSpecialties([]);
    setSelectedLanguages([]);
  };

  const yearOk = useMemo(() => {
    if (!selectedCategory) return false;
    const y = YEARS_BY_CATEGORY[selectedCategory];
    return y.length === 1 || yearId !== null;
  }, [selectedCategory, yearId]);

  const subjectOptionsNeeded = useMemo(
    () =>
      !!selectedCategory &&
      pathNeedsSubjectOptionsStep(selectedCategory) &&
      yearOk,
    [selectedCategory, yearOk]
  );

  const showSpecialtyBlock = useMemo(
    () =>
      selectedCategory
        ? yearNeedsSpecialties(selectedCategory, yearId)
        : false,
    [selectedCategory, yearId]
  );

  const toggleSpecialty = (key: SubjectKey) => {
    setSelectedSpecialties((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const toggleLanguage = (key: SubjectKey) => {
    setSelectedLanguages((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const canSave =
    !!selectedCategory &&
    yearOk &&
    !saving &&
    !listingPreview;

  const goWizardBack = useCallback(() => {
    setError(null);
    if (screen === "confirm") {
      setScreen(
        subjectOptionsNeeded
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
  }, [screen, selectedCategory, subjectOptionsNeeded]);

  const toggleConfirmSubjectKey = (key: SubjectKey) => {
    setConfirmSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const requestPreviewSave = async () => {
    if (!canSave || !selectedCategory) return;
    setListingPreview(true);
    setError(null);
    try {
      const specs = showSpecialtyBlock ? selectedSpecialties : [];
      const langs = pathNeedsSubjectOptionsStep(selectedCategory)
        ? selectedLanguages
        : [];
      const keys = getSubjectKeysForAcademicPath(
        selectedCategory,
        yearId,
        specs,
        langs
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
    if (!selectedCategory || !yearOk) return;
    try {
      setSaving(true);
      setError(null);
      const specs = showSpecialtyBlock ? selectedSpecialties : [];
      const langs = pathNeedsSubjectOptionsStep(selectedCategory)
        ? selectedLanguages
        : [];
      await updateUserProfile(userId, {
        academic_category: selectedCategory,
        academic_year_key: yearId,
        specialty_keys: specs,
        language_keys: langs,
      });
      const allKeys = getSubjectKeysForAcademicPath(
        selectedCategory,
        yearId,
        specs,
        langs
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
    if (pathNeedsSubjectOptionsStep(selectedCategory) && yearOk) {
      setScreen("subjects");
      return;
    }
    void requestPreviewSave();
  };

  const advanceFromLevel = () => {
    if (!selectedCategory || !yearOk) return;
    if (pathNeedsSubjectOptionsStep(selectedCategory) && yearOk) {
      setScreen("subjects");
      return;
    }
    void requestPreviewSave();
  };

  const confirmFromCategory =
    !!selectedCategory &&
    !categoryNeedsYearStep(selectedCategory) &&
    !pathNeedsSubjectOptionsStep(selectedCategory);

  const confirmFromLevel =
    !!selectedCategory &&
    yearOk &&
    !pathNeedsSubjectOptionsStep(selectedCategory);

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
          ? saving || listingPreview
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
        {screen === "category" ? (
          <View style={[styles.categoryChips, styles.pathBlockBelowTitle]}>
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
        ) : null}

        {screen === "level" && selectedCategory && categoryNeedsYearStep(selectedCategory) ? (
          <>
            <View style={[styles.categoryChips, styles.pathBlockBelowTitle]}>
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
                    setSelectedLanguages([]);
                  }}
                />
              ))}
            </View>
          </>
        ) : null}

        {screen === "subjects" && subjectOptionsNeeded ? (
          <View style={styles.pathBlockBelowTitle}>
            <PathSubjectOptionsStep
              baseSubjectKeys={getSubjectKeysForAcademicPath(
                selectedCategory!,
                yearId,
                [],
                []
              )}
              showSpecialtyOptions={showSpecialtyBlock}
              specialtyOptionKeys={LYCEE_SPECIALTY_SUBJECT_KEYS}
              selectedSpecialties={selectedSpecialties}
              onToggleSpecialty={toggleSpecialty}
              showLanguageOptions
              languageOptionKeys={LANGUAGE_OPTION_SUBJECT_KEYS}
              selectedLanguages={selectedLanguages}
              onToggleLanguage={toggleLanguage}
            />
          </View>
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
                              ? theme.onPrimaryDark ?? "#FFFFFF"
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
    body: { gap: 12, paddingTop: 4 },
    pathBlockBelowTitle: { marginTop: 14 },
    subjectsScroll: { maxHeight: 280 },
    subjectsScrollContent: { paddingBottom: 4 },
    categoryChips: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    specChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
    },
    confirmIntro: { marginTop: 6, lineHeight: 18 },
    error: {
      color: theme.danger ?? "#c00",
      fontWeight: "600",
      marginTop: 8,
    },
  });
