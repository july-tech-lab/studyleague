import { Text } from "@/components/Themed";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import Colors from "@/constants/Colors";
import { resetPasswordForEmail } from "@/utils/queries";
import { useTheme } from "@/utils/themeContext";
import { Link, useRouter } from "expo-router";
import { ArrowLeft, ArrowRight, Mail } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Pressable,
  StyleSheet,
  View,
} from "react-native";

export default function ForgotPassword() {
  const router = useRouter();
  const theme = useTheme();
  const styles = createStyles(theme);
  const { t } = useTranslation();

  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(auth)/signin");
    }
  };

  const handleReset = async () => {
    setError(null);
    setMessage(null);

    if (!email.trim()) {
      setError(t("auth.resetRequest.errorMissing"));
      return;
    }

    try {
      setLoading(true);

      await resetPasswordForEmail(email.trim(), "studyleague://reset-password-complete");

      setMessage(t("auth.resetRequest.sent"));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t("auth.resetRequest.errorSend");
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const isPrimaryDisabled = loading || !email.trim();

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

      <Text variant="h1" style={styles.title}>{t("auth.resetRequest.title")}</Text>

      <View style={styles.card}>
        <Input
          placeholder={t("auth.placeholders.email")}
          leftIcon={Mail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          onChangeText={setEmail}
          value={email}
          error={error || undefined}
        />

        {message ? (
          <Text variant="micro" align="center" style={styles.success}>
            {message}
          </Text>
        ) : null}

        <Button
          title={loading ? t("auth.resetRequest.buttonLoading") : t("auth.resetRequest.button")}
          variant="primary"
          size="lg"
          iconRight={ArrowRight}
          onPress={handleReset}
          disabled={isPrimaryDisabled}
          loading={loading}
          fullWidth
        />
      </View>

      <Link href="/(auth)/signin" asChild>
        <Pressable style={styles.footerPressable}>
          <Text variant="micro" align="center" style={styles.footerLinkText}>
            {t("auth.resetRequest.back")}
          </Text>
        </Pressable>
      </Link>
    </>
  );
}

const createStyles = (theme: typeof Colors.light) => {
  return StyleSheet.create({
    title: {},
    card: { gap: 12, marginTop: 8 },
    success: { color: theme.success, marginTop: 2 },
    footerPressable: {
      marginTop: 18,
      alignSelf: "center",
    },
    footerLinkText: {
      color: theme.primaryDark,
      fontWeight: "700",
    },
  });
};
