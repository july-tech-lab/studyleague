import { PathSubjectOptionsStep } from "@/components/profile/PathSubjectOptionsStep";
import { Text } from "@/components/Themed";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  categoryNeedsYearStep,
  getDefaultPickedSubjectKeysForPath,
  getSubjectKeysForAcademicPath,
  pathNeedsSubjectOptionsStep,
  yearNeedsSpecialties,
  YEARS_BY_CATEGORY,
  type AcademicYearId,
} from "@/constants/academicPath";
import type { CategoryId } from "@/constants/categories";
import Colors from "@/constants/Colors";
import {
  LANGUAGE_OPTION_SUBJECT_KEYS,
  LYCEE_SPECIALTY_SUBJECT_KEYS,
} from "@/constants/pathSubjectOptions";
import type { SubjectKey } from "@/constants/subjectCatalog";
import { useAuth } from "@/utils/authContext";
import { ensureDefaultSubjectsFromKeys } from "@/utils/ensureDefaultSubjectsFromKeys";
import { uploadAvatar, upsertUserProfile } from "@/utils/queries";
import { useTheme } from "@/utils/themeContext";
import * as ImagePicker from "expo-image-picker";
import * as Localization from "expo-localization";
import { useRouter } from "expo-router";
import { ArrowLeft, ArrowRight, Pencil, User } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { authEyebrow, authFormCard, authTitle } from "./_layout";

const CATEGORY_ORDER: CategoryId[] = [
  "primaire",
  "college",
  "lycee",
  "prepa",
  "universite",
  "autres",
];

type PathWizardScreen = "category" | "level" | "subjects" | "catalog";

export default function FillProfileScreen() {
  const router = useRouter();
  const { user, updateUserMetadata, refreshProfileSetup } = useAuth();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { t } = useTranslation();

  const [step, setStep] = useState<1 | 2>(1);
  const [pathScreen, setPathScreen] = useState<PathWizardScreen>("category");
  const [displayName, setDisplayName] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<CategoryId | null>(null);
  const [yearId, setYearId] = useState<AcademicYearId | null>(null);
  const [selectedSpecialties, setSelectedSpecialties] = useState<SubjectKey[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<SubjectKey[]>([]);
  /** Matières catalogue à créer (parcours sans spécialités lycée) — défaut = catalogue sans LV optionnelles. */
  const [pickedSubjectKeys, setPickedSubjectKeys] = useState<SubjectKey[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    (user?.user_metadata as { avatar_url?: string })?.avatar_url ?? null
  );
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const metadata = (user?.user_metadata as Record<string, unknown>) ?? {};

    if (metadata.username && !displayName) {
      setDisplayName(String(metadata.username));
    }

    if (metadata.avatar_url && !avatarUrl) {
      setAvatarUrl(String(metadata.avatar_url));
    }
  }, [user, displayName, avatarUrl]);

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

  const canGoStep2 =
    displayName.trim().length >= 3 && !saving && !uploadingAvatar;

  const yearOk = useMemo(() => {
    if (!selectedCategory) return false;
    const y = YEARS_BY_CATEGORY[selectedCategory];
    return y.length === 1 || yearId !== null;
  }, [selectedCategory, yearId]);

  const subjectOptionsStep = useMemo(
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

  const pathFooterTitle =
    saving
      ? t("common.status.saving")
      : pathScreen === "catalog" || pathScreen === "subjects"
        ? t("onboarding.continue")
        : t("onboarding.fillProfile.nextStep");

  const pathFooterDisabled =
    pathScreen === "category"
      ? !selectedCategory || saving || uploadingAvatar
      : pathScreen === "level"
        ? !yearOk || saving || uploadingAvatar
        : pathScreen === "subjects"
          ? saving || uploadingAvatar
          : pathScreen === "catalog"
            ? saving || uploadingAvatar
            : true;

  const pathFooterLoading =
    saving && (pathScreen === "catalog" || pathScreen === "subjects");

  const openCatalogScreen = useCallback(() => {
    if (!selectedCategory) return;
    const years = YEARS_BY_CATEGORY[selectedCategory];
    const resolvedYearId = yearId ?? (years.length === 1 ? years[0].id : null);
    setPickedSubjectKeys(
      getDefaultPickedSubjectKeysForPath(
        selectedCategory,
        resolvedYearId,
        [],
        []
      )
    );
    setPathScreen("catalog");
  }, [selectedCategory, yearId]);

  const goPathBack = useCallback(() => {
    setError(null);
    if (pathScreen === "catalog") {
      setPathScreen(
        selectedCategory && categoryNeedsYearStep(selectedCategory)
          ? "level"
          : "category"
      );
      return;
    }
    if (pathScreen === "subjects") {
      setPathScreen(
        selectedCategory && categoryNeedsYearStep(selectedCategory)
          ? "level"
          : "category"
      );
      return;
    }
    if (pathScreen === "level") {
      setPathScreen("category");
    }
  }, [pathScreen, selectedCategory]);

  const handleBack = () => {
    if (step === 2) {
      if (pathScreen === "catalog" || pathScreen === "subjects" || pathScreen === "level") {
        goPathBack();
        return;
      }
      setStep(1);
      setPathScreen("category");
      setError(null);
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace("/(auth)/signin");
  };

  const uploadAvatarToSupabase = async (uri: string) => {
    if (!user?.id) throw new Error(t("onboarding.userMissing"));
    const publicUrl = await uploadAvatar(user.id, uri);
    setAvatarUrl(publicUrl);
    return publicUrl;
  };

  const handlePickAvatar = async () => {
    if (saving || uploadingAvatar) return;
    try {
      setError(null);
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError(t("onboarding.fillProfile.avatarPermission"));
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) {
        setError(t("onboarding.fillProfile.avatarError"));
        return;
      }
      setUploadingAvatar(true);
      await uploadAvatarToSupabase(asset.uri);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.errors.unexpected"));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleFinish = async () => {
    const trimmedName = displayName.trim();
    if (trimmedName.length < 3) {
      setError(t("onboarding.fillProfile.errorDisplayName"));
      return;
    }
    if (!selectedCategory) {
      setError(t("onboarding.fillProfile.errorCategory"));
      return;
    }
    if (!yearOk) {
      setError(t("onboarding.fillProfile.errorYear"));
      return;
    }
    if (!user?.id) {
      setError(t("onboarding.userMissing"));
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const finalAvatarUrl =
        avatarUrl ??
        ((user?.user_metadata as { avatar_url?: string })?.avatar_url ?? null);

      const locales = Localization.getLocales?.() ?? [];
      const deviceLanguage = locales[0]?.languageCode || "en";
      const defaultLanguage = deviceLanguage === "fr" ? "fr" : "en";

      await upsertUserProfile(user.id, {
        username: trimmedName,
        avatar_url: finalAvatarUrl,
        language_preference: defaultLanguage,
        theme_preference: "light",
        onboarding_completed: true,
        academic_category: selectedCategory,
        academic_year_key: yearId,
        specialty_keys: selectedSpecialties,
        language_keys:
          selectedCategory && pathNeedsSubjectOptionsStep(selectedCategory)
            ? selectedLanguages
            : [],
      });

      await updateUserMetadata({
        username: trimmedName,
        category: selectedCategory,
        academic_year_key: yearId,
        onboarding_completed: true,
        avatar_url: finalAvatarUrl,
      });

      const keys =
        selectedCategory && pathNeedsSubjectOptionsStep(selectedCategory)
          ? getSubjectKeysForAcademicPath(
              selectedCategory,
              yearId,
              selectedSpecialties,
              selectedLanguages
            )
          : pickedSubjectKeys;
      await ensureDefaultSubjectsFromKeys(user.id, keys, t);
      await refreshProfileSetup();
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.errors.unexpected"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <View style={styles.topBlock}>
        <Button
          iconLeft={ArrowLeft}
          iconOnly
          variant="secondary"
          shape="pill"
          size="xs"
          style={{ alignSelf: "flex-start" }}
          onPress={handleBack}
          accessibilityLabel={t("common.actions.back")}
        />

        <Text variant="micro" style={styles.eyebrow}>
          {t("auth.branding.eyebrow")}
        </Text>
        <Text variant="h2" align="center" style={styles.title}>
          {step === 1
            ? t("onboarding.fillProfile.title")
            : pathScreen === "category"
              ? t("onboarding.fillProfile.pathTitle")
              : pathScreen === "level"
                ? t("onboarding.fillProfile.levelTitle")
                : pathScreen === "catalog" || pathScreen === "subjects"
                  ? t("onboarding.fillProfile.subjectPickTitle")
                  : t("profile.academicPath.modalTitle")}
        </Text>
      </View>

      {/*
        Auth layout Screen is already a ScrollView. Nested ScrollView + maxHeight %
        often collapses so the form is not visible.
      */}
      <View style={[styles.formOuter, step === 2 && styles.formOuterPath]}>
        {step === 1 ? (
          <View style={styles.card}>
            <Pressable
              accessibilityRole="button"
              onPress={handlePickAvatar}
              disabled={uploadingAvatar}
              style={({ pressed }) => [
                styles.avatarWrapper,
                pressed && !uploadingAvatar && styles.avatarPressed,
              ]}
            >
              <View style={styles.avatar}>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
                ) : (
                  <User size={44} color={theme.textMuted} strokeWidth={1.8} />
                )}
                <View style={styles.avatarBadge}>
                  <Pencil size={14} color={theme.onPrimary ?? "#FFFFFF"} />
                </View>
              </View>
            </Pressable>

            <Input
              label={t("onboarding.fillProfile.displayNameLabel")}
              placeholder={t("onboarding.fillProfile.displayNamePlaceholder")}
              leftIcon={User}
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
              returnKeyType="done"
            />

            <Button
              title={t("onboarding.fillProfile.nextStep")}
              variant="primary"
              size="md"
              iconRight={ArrowRight}
              onPress={() => {
                setError(null);
                if (!canGoStep2) {
                  setError(t("onboarding.fillProfile.errorDisplayName"));
                  return;
                }
                setPathScreen("category");
                setStep(2);
              }}
              disabled={!canGoStep2}
              fullWidth
            />
          </View>
        ) : (
          <View style={styles.card}>
            {pathScreen === "category" ? (
              <View style={[styles.categoryChips, styles.pathChipsBelowTitle]}>
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

            {pathScreen === "level" && selectedCategory && categoryNeedsYearStep(selectedCategory) ? (
              <>
                <View style={[styles.categoryChips, styles.pathChipsBelowTitle]}>
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

            {pathScreen === "subjects" && subjectOptionsStep ? (
              <View style={styles.pathChipsBelowTitle}>
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

            {pathScreen === "catalog" && selectedCategory ? (
              <View style={styles.pathChipsBelowTitle}>
                <View style={styles.categoryChips}>
                  {getSubjectKeysForAcademicPath(
                    selectedCategory!,
                    yearId,
                    [],
                    []
                  ).map((key) => {
                    const active = pickedSubjectKeys.includes(key);
                    return (
                      <Pressable
                        key={key}
                        onPress={() => {
                          setPickedSubjectKeys((prev) =>
                            prev.includes(key)
                              ? prev.filter((k) => k !== key)
                              : [...prev, key]
                          );
                        }}
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
                              ? theme.onPrimaryDark ?? theme.onPrimary ?? "#FFFFFF"
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
              </View>
            ) : null}

            {error ? (
              <Text variant="body" align="center" style={styles.error}>
                {error}
              </Text>
            ) : null}

            <Button
              title={pathFooterTitle}
              variant="primary"
              size="md"
              iconRight={ArrowRight}
              onPress={() => {
                setError(null);
                if (pathScreen === "category") {
                  if (!selectedCategory) {
                    setError(t("onboarding.fillProfile.errorCategory"));
                    return;
                  }
                  if (categoryNeedsYearStep(selectedCategory)) {
                    setPathScreen("level");
                    return;
                  }
                  if (
                    pathNeedsSubjectOptionsStep(selectedCategory) &&
                    yearOk
                  ) {
                    setPathScreen("subjects");
                    return;
                  }
                  openCatalogScreen();
                  return;
                }
                if (pathScreen === "level") {
                  if (!yearOk) {
                    setError(t("onboarding.fillProfile.errorYear"));
                    return;
                  }
                  if (
                    pathNeedsSubjectOptionsStep(selectedCategory!) &&
                    yearOk
                  ) {
                    setPathScreen("subjects");
                    return;
                  }
                  openCatalogScreen();
                  return;
                }
                if (pathScreen === "catalog") {
                  void handleFinish();
                  return;
                }
                void handleFinish();
              }}
              disabled={pathFooterDisabled}
              loading={pathFooterLoading}
              fullWidth
            />
          </View>
        )}
      </View>
    </>
  );
}

const createStyles = (theme: typeof Colors.light) =>
  StyleSheet.create({
    topBlock: {
      width: "100%",
      paddingTop: 20,
      gap: 12,
      marginBottom: 24,
    },
    eyebrow: authEyebrow(theme),
    title: authTitle(),
    formOuter: { paddingBottom: 32 },
    formOuterPath: { marginTop: 4 },
    pathChipsBelowTitle: { marginTop: 16 },
    specChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
    },
    card: authFormCard(),
    avatarWrapper: {
      alignItems: "center",
      justifyContent: "center",
      alignSelf: "center",
    },
    avatarPressed: { opacity: 0.9 },
    avatar: {
      width: 132,
      height: 132,
      borderRadius: 66,
      backgroundColor: theme.surface,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: theme.divider ?? theme.border,
      overflow: "hidden",
      position: "relative",
    },
    avatarImage: { width: "100%", height: "100%" },
    avatarBadge: {
      position: "absolute",
      bottom: 10,
      right: 10,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.primaryDark,
      borderWidth: 0,
      alignItems: "center",
      justifyContent: "center",
    },
    categoryChips: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    error: {
      color: theme.danger,
      fontWeight: "600",
      marginTop: 2,
    },
  });
