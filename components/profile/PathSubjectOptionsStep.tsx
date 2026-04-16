import { Text } from "@/components/Themed";
import type { SubjectKey } from "@/constants/subjectCatalog";
import { useTheme } from "@/utils/themeContext";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";

export type PathSubjectOptionsStepProps = {
  baseSubjectKeys: readonly SubjectKey[];
  showSpecialtyOptions: boolean;
  specialtyOptionKeys: readonly SubjectKey[];
  selectedSpecialties: SubjectKey[];
  onToggleSpecialty: (key: SubjectKey) => void;
  showLanguageOptions: boolean;
  languageOptionKeys: readonly SubjectKey[];
  selectedLanguages: SubjectKey[];
  onToggleLanguage: (key: SubjectKey) => void;
};

export function PathSubjectOptionsStep({
  baseSubjectKeys,
  showSpecialtyOptions,
  specialtyOptionKeys,
  selectedSpecialties,
  onToggleSpecialty,
  showLanguageOptions,
  languageOptionKeys,
  selectedLanguages,
  onToggleLanguage,
}: PathSubjectOptionsStepProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(), []);

  const renderLanguageChip = (key: SubjectKey) => {
    const active = selectedLanguages.includes(key);
    return (
      <Pressable
        key={key}
        onPress={() => onToggleLanguage(key)}
        style={({ pressed }) => [
          styles.optionChip,
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
  };

  return (
    <View style={styles.wrapper}>
      <Text variant="subtitle" colorName="textMuted">
        {t("onboarding.fillProfile.mainSubjectsLabel")}
      </Text>
      <View style={styles.chips}>
        {baseSubjectKeys.map((key) => (
          <View
            key={key}
            style={[
              styles.mainChip,
              {
                backgroundColor: theme.primary,
                borderColor: theme.primary,
              },
            ]}
          >
            <Text
              variant="micro"
              style={{
                color: theme.onPrimaryDark ?? theme.onPrimary ?? "#FFFFFF",
                fontWeight: "600",
              }}
            >
              {t(`subjectCatalog.${key}`)}
            </Text>
          </View>
        ))}
      </View>

      {showSpecialtyOptions ? (
        <>
          <Text
            variant="subtitle"
            colorName="textMuted"
            style={styles.sectionHeading}
          >
            {t("onboarding.fillProfile.specialtiesLabel")}
          </Text>
          <View style={styles.chips}>
            {specialtyOptionKeys.map((key) => {
              const active = selectedSpecialties.includes(key);
              return (
                <Pressable
                  key={key}
                  onPress={() => onToggleSpecialty(key)}
                  style={({ pressed }) => [
                    styles.optionChip,
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
        </>
      ) : null}

      {showLanguageOptions ? (
        <>
          <Text
            variant="subtitle"
            colorName="textMuted"
            style={styles.sectionHeading}
          >
            {t("onboarding.fillProfile.languagesLabel")}
          </Text>
          <View style={styles.chips}>
            {languageOptionKeys.map((key) => renderLanguageChip(key))}
          </View>
        </>
      ) : null}
    </View>
  );
}

const createStyles = () =>
  StyleSheet.create({
    wrapper: { gap: 8 },
    sectionHeading: { marginTop: 12 },
    chips: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    mainChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
    },
    optionChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
    },
  });
