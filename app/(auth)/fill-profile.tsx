import { Text } from "@/components/Themed";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
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
import Colors from "@/constants/Colors";
import type { SubjectKey } from "@/constants/subjectCatalog";
import { useAuth } from "@/utils/authContext";
import { ensureDefaultSubjectsFromKeys } from "@/utils/ensureDefaultSubjectsFromKeys";
import { uploadAvatar, upsertUserProfile } from "@/utils/queries";
import { authEyebrow, authFormCard, authTitle } from "./_layout";
import { useTheme } from "@/utils/themeContext";
import * as ImagePicker from "expo-image-picker";
import * as Localization from "expo-localization";
import { useRouter } from "expo-router";
import { ArrowLeft, ArrowRight, Pencil, User } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

const CATEGORY_ORDER: CategoryId[] = [
  "primaire",
  "college",
  "lycee",
  "prepa",
  "universite",
  "autres",
];

type PathWizardScreen = "category" | "level" | "subjects";

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
  };

  const specNeeded = useMemo(
    () =>
      selectedCategory
        ? yearNeedsSpecialties(selectedCategory, yearId)
        : false,
    [selectedCategory, yearId]
  );

  const specRequired = useMemo(
    () => requiredSpecialtyCount(yearId),
    [yearId]
  );

  const toggleSpecialty = (key: SubjectKey) => {
    setSelectedSpecialties((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key);
      const max = specRequired;
      if (max > 0 && prev.length >= max) return prev;
      return [...prev, key];
    });
  };

  const canGoStep2 =
    displayName.trim().length >= 3 && !saving && !uploadingAvatar;

  const yearOk = useMemo(() => {
    if (!selectedCategory) return false;
    const y = YEARS_BY_CATEGORY[selectedCategory];
    return y.length === 1 || yearId !== null;
  }, [selectedCategory, yearId]);

  const specialtiesOk =
    !specNeeded || selectedSpecialties.length === specRequired;

  const confirmFromCategory =
    !!selectedCategory &&
    !categoryNeedsYearStep(selectedCategory) &&
    !yearNeedsSpecialties(selectedCategory, yearId);

  const confirmFromLevel =
    !!selectedCategory &&
    yearOk &&
    !yearNeedsSpecialties(selectedCategory, yearId);

  const pathFooterTitle =
    pathScreen === "subjects" ||
    (pathScreen === "category" && confirmFromCategory) ||
    (pathScreen === "level" && confirmFromLevel)
      ? saving
        ? t("common.status.saving")
        : t("onboarding.continue")
      : t("onboarding.fillProfile.nextStep");

  const pathFooterDisabled =
    pathScreen === "category"
      ? !selectedCategory || saving || uploadingAvatar
      : pathScreen === "level"
        ? !yearOk || saving || uploadingAvatar
        : !specialtiesOk || saving || uploadingAvatar;

  const pathFooterLoading =
    saving &&
    (pathScreen === "subjects" ||
      (pathScreen === "category" && confirmFromCategory) ||
      (pathScreen === "level" && confirmFromLevel));

  const wizardStepTotal = useMemo(() => {
    if (!selectedCategory) return 1;
    let n = 1;
    if (categoryNeedsYearStep(selectedCategory)) n++;
    if (yearNeedsSpecialties(selectedCategory, yearId)) n++;
    return n;
  }, [selectedCategory, yearId]);

  const wizardStepCurrent = useMemo(() => {
    if (pathScreen === "category") return 1;
    if (pathScreen === "level") return 2;
    return wizardStepTotal;
  }, [pathScreen, wizardStepTotal]);

  const goPathBack = useCallback(() => {
    setError(null);
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
      if (pathScreen === "subjects" || pathScreen === "level") {
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
    if (!specialtiesOk) {
      setError(
        t("onboarding.fillProfile.errorSpecialties", { count: specRequired })
      );
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
      });

      await updateUserMetadata({
        username: trimmedName,
        category: selectedCategory,
        academic_year_key: yearId,
        onboarding_completed: true,
        avatar_url: finalAvatarUrl,
      });

      const keys = getSubjectKeysForAcademicPath(
        selectedCategory,
        yearId,
        selectedSpecialties
      );
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
      <Button
        iconLeft={ArrowLeft}
        iconOnly
        variant="secondary"
        shape="pill"
        size="xs"
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
              ? t("onboarding.fillProfile.yearLabel")
              : t("profile.academicPath.modalTitle")}
      </Text>
      {step === 2 && wizardStepTotal > 1 ? (
        <Text variant="caption" colorName="textMuted" align="center" style={styles.stepBadge}>
          {t("profile.academicPath.wizardStepOf", {
            current: wizardStepCurrent,
            total: wizardStepTotal,
          })}
        </Text>
      ) : null}

      {/*
        Auth layout Screen is already a ScrollView. Nested ScrollView + maxHeight %
        often collapses so the form is not visible.
      */}
      <View style={styles.formOuter}>
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
                {wizardStepTotal === 1 ? (
                  <Text variant="caption" colorName="textMuted" style={styles.pathHint}>
                    {t("profile.academicPath.modalHint")}
                  </Text>
                ) : null}
              </>
            ) : null}

            {pathScreen === "level" && selectedCategory && categoryNeedsYearStep(selectedCategory) ? (
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
                {yearOk && !yearNeedsSpecialties(selectedCategory, yearId) ? (
                  <Text variant="caption" colorName="textMuted" style={styles.pathHint}>
                    {t("profile.academicPath.modalHint")}
                  </Text>
                ) : null}
              </>
            ) : null}

            {pathScreen === "subjects" && specNeeded ? (
              <>
                <Text variant="subtitle" colorName="textMuted">
                  {t("onboarding.fillProfile.specialtiesLabel", {
                    count: specRequired,
                  })}
                </Text>
                <ScrollView
                  style={styles.specialtiesScroll}
                  contentContainerStyle={styles.specialtiesScrollContent}
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
                              backgroundColor: active
                                ? theme.primary
                                : theme.surface,
                              borderColor: theme.divider ?? theme.border,
                              opacity: pressed ? 0.85 : 1,
                            },
                          ]}
                        >
                          <Text
                            variant="micro"
                            style={{
                              color: active ? theme.onPrimaryDark : theme.text,
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
                <Text variant="caption" colorName="textMuted" style={styles.pathHint}>
                  {t("profile.academicPath.modalHint")}
                </Text>
              </>
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
                  if (yearNeedsSpecialties(selectedCategory, yearId)) {
                    setPathScreen("subjects");
                    return;
                  }
                  void handleFinish();
                  return;
                }
                if (pathScreen === "level") {
                  if (!yearOk) {
                    setError(t("onboarding.fillProfile.errorYear"));
                    return;
                  }
                  if (yearNeedsSpecialties(selectedCategory!, yearId)) {
                    setPathScreen("subjects");
                    return;
                  }
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
    eyebrow: authEyebrow(theme),
    title: authTitle(),
    formOuter: { paddingBottom: 32 },
    stepBadge: { marginBottom: 10 },
    pathHint: { marginTop: 12, lineHeight: 18 },
    specialtiesScroll: { maxHeight: 280 },
    specialtiesScrollContent: { paddingBottom: 4 },
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
    specChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
    },
    error: {
      color: theme.danger,
      fontWeight: "600",
      marginTop: 2,
    },
  });
