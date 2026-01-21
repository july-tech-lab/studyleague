import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Text } from "@/components/Themed";
import Colors from "@/constants/Colors";
import { useTheme } from "@/utils/themeContext";
import {
  CATEGORY_DEFINITIONS,
  type CategoryDefinition,
  type CategoryId,
} from "@/constants/categories";
import { useAuth } from "@/utils/authContext";
import {
  attachSubjectToUser,
  createAndAttachSubject,
  fetchSubjects,
  fetchUserSubjects,
  upsertUserProfile,
  uploadAvatar,
} from "@/utils/queries";
import * as ImagePicker from "expo-image-picker";
import * as Localization from "expo-localization";
import { useRouter } from "expo-router";
import { ArrowLeft, ArrowRight, Pencil, User } from "lucide-react-native";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Image,
  Pressable,
  StyleSheet,
  View,
} from "react-native";

const ensureDefaultSubjectsForCategory = async (userId: string, categoryId: CategoryId) => {
  const category = CATEGORY_DEFINITIONS.find((item) => item.id === categoryId);
  if (!category) return;

  const [availableSubjects, userSubjects] = await Promise.all([
    fetchSubjects(userId),
    fetchUserSubjects(userId),
  ]);

  const subjectsByName = new Map(
    availableSubjects.map((subject) => [subject.name.trim().toLowerCase(), subject])
  );
  const visibleIds = new Set(userSubjects.map((subject) => subject.id));

  for (const subjectName of category.subjects) {
    const normalized = subjectName.trim();
    if (!normalized) continue;

    const key = normalized.toLowerCase();
    const existing = subjectsByName.get(key);

    if (existing) {
      if (!visibleIds.has(existing.id)) {
        await attachSubjectToUser(userId, existing.id);
        visibleIds.add(existing.id);
      }
      continue;
    }

    const created = await createAndAttachSubject(userId, normalized);
    subjectsByName.set(key, created);
    visibleIds.add(created.id);
  }
};

export default function FillProfileScreen() {
  const router = useRouter();
  const { user, updateUserMetadata } = useAuth();
  const theme = useTheme();
  const styles = createStyles(theme);
  const { t } = useTranslation();

  const [displayName, setDisplayName] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<CategoryId | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    (user?.user_metadata as any)?.avatar_url ?? null
  );
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const metadata = (user?.user_metadata as any) ?? {};

    if (metadata.username && !displayName) {
      setDisplayName(metadata.username);
    }

    if (metadata.category && !selectedCategory) {
      setSelectedCategory(metadata.category as CategoryId);
    }

    if (metadata.avatar_url && !avatarUrl) {
      setAvatarUrl(metadata.avatar_url);
    }
  }, [user, displayName, selectedCategory, avatarUrl]);

  const canContinue =
    displayName.trim().length > 0 && !!selectedCategory && !saving && !uploadingAvatar;

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(auth)/signin");
    }
  };

  const uploadAvatarToSupabase = async (uri: string) => {
    if (!user?.id) {
      throw new Error(t("onboarding.userMissing"));
    }

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
      const message = err instanceof Error ? err.message : t("common.errorUnexpected");
      setError(message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleContinue = async () => {
    const trimmedName = displayName.trim();
    if (trimmedName.length < 3) {
      setError(t("onboarding.fillProfile.errorDisplayName"));
      return;
    }
    if (!selectedCategory) {
      setError(t("onboarding.fillProfile.errorCategory"));
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
        avatarUrl ?? ((user?.user_metadata as any)?.avatar_url as string | null) ?? null;

      // Detect device language for default
      const locales = Localization.getLocales?.() ?? [];
      const deviceLanguage = locales[0]?.languageCode || "en";
      const defaultLanguage = deviceLanguage === "fr" ? "fr" : "en";

      await upsertUserProfile(user.id, {
        username: trimmedName,
        avatar_url: finalAvatarUrl,
        language_preference: defaultLanguage, // Default to device locale
        theme_preference: "light", // Default to light theme
      });

      // Update auth metadata (automatically refreshes session state)
      await updateUserMetadata({
        username: trimmedName,
        category: selectedCategory,
        avatar_url: finalAvatarUrl,
      });

      await ensureDefaultSubjectsForCategory(user.id, selectedCategory);

      router.replace("/(tabs)/profile");
    } catch (err) {
      const message = err instanceof Error ? err.message : t("common.errorUnexpected");
      setError(message);
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
        accessibilityLabel={t("common.back", "Back")}
      />

      <Text variant="h1" style={styles.title}>
        {t("onboarding.fillProfile.title")}
      </Text>

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
                <Pencil size={16} color={theme.onPrimary ?? "#FFFFFF"} />
              </View> 
            </View>
          </Pressable>

          <Input
            label={t("onboarding.fillProfile.displayNameLabel", "Choisis ton pseudo")}
            placeholder={t("onboarding.fillProfile.displayNamePlaceholder")}
            leftIcon={User}
            value={displayName}
            onChangeText={setDisplayName}
            autoCapitalize="words"
            returnKeyType="done"
          />

          <View style={styles.categoryBlock}>
            <Text variant="subtitle" colorName="textMuted" style={styles.categoryLabel}>{t("onboarding.fillProfile.categoryLabel")}</Text>
            <View style={styles.categoryChips}>
              {CATEGORY_DEFINITIONS.map((item: CategoryDefinition) => {
                const isActive = item.id === selectedCategory;
                return (
                  <Button
                    key={item.id}
                    title={item.label}
                    variant={isActive ? "primary" : "outline"}
                    shape="pill"
                    size="sm"
                    onPress={() => setSelectedCategory(item.id)}
                  />
                );
              })}
            </View>
          </View>

          {error ? (
            <Text variant="body" align="center" style={styles.error}>
              {error}
            </Text>
          ) : null}

          {/* NOTE: Using shape="pill" to match other auth screens. 
              TODO: Decide on consistent button shape across app (pill vs default) */}
          <Button
            title={saving ? t("onboarding.fillProfile.saving") : t("onboarding.continue")}
            variant="primary"
            size="lg"
            iconRight={ArrowRight}
            onPress={handleContinue}
            disabled={!canContinue || saving}
            loading={saving}
            fullWidth
          />
        </View>
    </>
  );
}

const createStyles = (theme: typeof Colors.light) =>
  StyleSheet.create({
    title: {},
    card: { gap: 12, marginTop: 8 },
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
    categoryBlock: {
      gap: 10,
    },
    categoryLabel: {
      marginBottom: 6,
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

