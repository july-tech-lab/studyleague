import { Text } from "@/components/Themed";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import Colors from "@/constants/Colors";
import { exchangeCodeForSession, getSession, updateUserPassword } from "@/utils/queries";
import { useTheme } from "@/utils/themeContext";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Lock } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  StyleSheet,
  View,
} from "react-native";

export default function ResetPasswordComplete() {
  const router = useRouter();
  const urlFromHook = Linking.useURL();
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = createStyles(theme);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"checking" | "ready" | "error">(
    "checking"
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [initialUrlChecked, setInitialUrlChecked] = useState(false);

  const currentUrl = useMemo(() => urlFromHook, [urlFromHook]);

  useEffect(() => {
    const ensureSessionFromLink = async () => {
      try {
        setError(null);

        const existing = await getSession();
        if (existing) {
          setStatus("ready");
          return;
        }

        const url = currentUrl ?? (await Linking.getInitialURL());
        setInitialUrlChecked(true);

        if (!url) {
          setStatus("error");
          setError(t("auth.resetComplete.errorMissingLink"));
          return;
        }

        const code = new URL(url).searchParams.get("code");
        if (!code) {
          setStatus("error");
          setError(t("auth.resetComplete.errorMissingCode"));
          return;
        }

        await exchangeCodeForSession(code);

        setStatus("ready");
      } catch (err) {
        setStatus("error");
        setError(err instanceof Error ? err.message : t("common.errorUnexpected"));
      }
    };

    // Run once when we get a URL or after initial URL is checked
    if (!initialUrlChecked || currentUrl) {
      ensureSessionFromLink();
    }
  }, [currentUrl, initialUrlChecked, t]);

  const handleUpdate = async () => {
    const passwordValue = password.trim();
    const confirmValue = confirm.trim();

    if (!passwordValue || !confirmValue) {
      setError(t("auth.resetComplete.errorMissing"));
      return;
    }

    if (passwordValue !== confirmValue) {
      setError(t("auth.resetComplete.errorMismatch"));
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      await updateUserPassword(passwordValue);

      setSuccess(t("auth.resetComplete.success"));
      setTimeout(() => {
        // Root path resolves to the first tab; group segment stays internal
        router.replace("/");
      }, 800);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("auth.resetComplete.errorGeneric")
      );
    } finally {
      setSaving(false);
    }
  };

  const passwordValue = password.trim();
  const confirmValue = confirm.trim();
  const passwordsMismatch =
    Boolean(passwordValue && confirmValue) && passwordValue !== confirmValue;

  // Only show loader during background status checking, not during saving (button shows loading)
  const showLoader = status === "checking";
  const isPrimaryDisabled =
    saving || !passwordValue || !confirmValue || passwordsMismatch;

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(auth)/signin");
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
        {t("auth.resetComplete.title")}
      </Text>
      <Text variant="body" colorName="textMuted" style={styles.subtitle}>
        {t("auth.resetComplete.subtitle")}
      </Text>

      {showLoader && <ActivityIndicator style={styles.loader} color={theme.primary} />}

      {status === "error" && error ? (
        <Text variant="micro" align="center" style={styles.error}>
          {error}
        </Text>
      ) : null}

      {status === "ready" ? (
        <View style={styles.card}>
          <Input
            placeholder={t("auth.resetComplete.placeholderNew")}
            leftIcon={Lock}
            rightIcon={showPassword ? EyeOff : Eye}
            secureTextEntry={!showPassword}
            textContentType="newPassword"
            onChangeText={setPassword}
            value={password}
            onRightIconPress={() => setShowPassword((v) => !v)}
          />

          <Input
            placeholder={t("auth.resetComplete.placeholderConfirm")}
            leftIcon={Lock}
            rightIcon={showConfirm ? EyeOff : Eye}
            secureTextEntry={!showConfirm}
            textContentType="newPassword"
            onChangeText={setConfirm}
            value={confirm}
            onRightIconPress={() => setShowConfirm((v) => !v)}
            error={
              passwordsMismatch
                ? t("auth.resetComplete.errorMismatch")
                : undefined
            }
          />

          {error && !passwordsMismatch && (
            <Text variant="micro" align="center" style={styles.error}>
              {error}
            </Text>
          )}

          {success && (
            <Text variant="micro" align="center" style={styles.success}>
              {success}
            </Text>
          )}

          <Button
            title={saving ? t("auth.resetComplete.buttonLoading") : t("auth.resetComplete.button")}
            variant="primary"
            size="lg"
            iconRight={ArrowRight}
            onPress={handleUpdate}
            disabled={isPrimaryDisabled}
            loading={saving}
            fullWidth
          />
        </View>
      ) : null}
    </>
  );
}

const createStyles = (theme: typeof Colors.light) => {
  return StyleSheet.create({
    title: {},
    subtitle: { marginTop: 4 },
    card: { gap: 12, marginTop: 8 },
    success: { color: theme.success, marginTop: 2 },
    // NOTE: primaryButton styles removed - now using Button component
    loader: { marginTop: 10 },
    error: { color: theme.danger, marginTop: 2, marginBottom: 2 },
  });
};
