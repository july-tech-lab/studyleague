import { Text } from "@/components/Themed";
import { Button } from "@/components/ui/Button";
import Colors from "@/constants/Colors";
import { buildRedirectUrl, useAuth } from "@/utils/authContext";
import { getCurrentUser, resendVerificationEmail } from "@/utils/queries";
import { useTheme } from "@/utils/themeContext";
import * as Linking from "expo-linking";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, ExternalLink } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  AppState,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";

export default function VerifyEmail() {
  const { user, refreshSession, isLoading: authLoading } = useAuth();
  const { email: emailParam } = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState((emailParam as string) ?? "");

  // Resend State
  const [resendStatus, setResendStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = createStyles(theme);

  // Helper to map raw API errors to friendly UI text
  const getFriendlyErrorMessage = useCallback(
    (rawError: string) => {
      const lower = rawError.toLowerCase();
      if (lower.includes("rate limit") || lower.includes("too many requests")) {
        return t("auth.verifyEmail.errorRateLimit", "Please wait a moment before trying again.");
      }
      if (lower.includes("security purposes")) {
        return t("auth.verifyEmail.errorSecurity", "Please wait a few seconds.");
      }
      return rawError; // Fallback
    },
    [t],
  );

  // 1. Auto-fill email
  useEffect(() => {
    if (email) return;
    getCurrentUser().then((user) => {
      if (user?.email) setEmail(user.email);
    });
  }, [email]);

  // 2. GATE REDIRECT: Only redirect if explicitly verified
  useEffect(() => {
    if (user?.email_confirmed_at) {
      router.replace("/(auth)/fill-profile");
    }
  }, [user, router]);

  // 3. POLLING: Stop polling only on VERIFICATION, not just session existence
  useEffect(() => {
    const interval = setInterval(async () => {
      const session = await refreshSession();
      if (session?.user?.email_confirmed_at) {
        clearInterval(interval);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [refreshSession]);

  // 4. COOLDOWN TIMER: Decrement cooldown every second
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setInterval(() => {
        setResendCooldown((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [resendCooldown]);

  // 5. APP STATE: Check immediately when app comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        refreshSession();
      }
    });
    return () => subscription.remove();
  }, [refreshSession]);

  const handleOpenMailApp = async () => {
    const mailUrl = Platform.select({
      ios: "message://",
      android: "mailto:",
      default: "mailto:",
    });

    try {
      const supported = await Linking.canOpenURL(mailUrl);
      await Linking.openURL(supported ? mailUrl : "mailto:");
    } catch (err) {
      console.log("Could not open mail app", err);
    }
  };

  const handleResend = async () => {
    if (!email) {
      setError(t("auth.verifyEmail.errorMissingEmail", "No email address found."));
      return;
    }
    if (resendCooldown > 0) return;

    setResendStatus("sending");
    setError(null);

    let success = false;

    try {
      await resendVerificationEmail(email.trim(), buildRedirectUrl());

      success = true;
      setResendStatus("sent");
      setResendCooldown(60);
    } catch (err) {
      const rawMsg = err instanceof Error ? err.message : t("auth.verifyEmail.errorSend");
      setError(getFriendlyErrorMessage(rawMsg));
    } finally {
      if (!success) {
        setResendStatus("idle");
      } else {
        setTimeout(() => setResendStatus("idle"), 3000);
      }
    }
  };

  const isResending = resendStatus === "sending";
  const isCoolingDown = resendCooldown > 0;

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
        {t("auth.verifyEmail.title")}
      </Text>
      <Text variant="body" colorName="textMuted" style={styles.subtitle}>
        {t("auth.verifyEmail.subtitle")}
      </Text>

      <View style={styles.card}>
        <View style={styles.illustration}>
          <Text style={styles.illustrationText}>📧</Text>
        </View>

        <Text variant="body" align="center" style={styles.bodyTextCentered}>
          {email
            ? t("auth.verifyEmail.instructionsWithEmail", { email })
            : t("auth.verifyEmail.instructions")}
        </Text>

        {error && (
          <Text variant="micro" align="center" style={styles.error}>
            {error}
          </Text>
        )}

        {/* Primary Action: Open Email App */}
        <Button
          title={t("auth.verifyEmail.openMailApp", "Open Mail App")}
          variant="primary"
          size="lg"
          iconRight={ExternalLink}
          onPress={handleOpenMailApp}
          disabled={isResending}
          fullWidth
        />

        {/* Secondary Action: Manual Check */}
        <Button
          title={authLoading ? t("common.loading") : t("auth.verifyEmail.continue", "I've verified it")}
          variant="secondary"
          onPress={() => refreshSession()}
          disabled={authLoading || isResending}
          fullWidth
        />

        {/* Resend Link with Cooldown & Spinner */}
        <Pressable
          style={styles.textLinkButton}
          onPress={handleResend}
          disabled={isResending || isCoolingDown}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            {isResending && <ActivityIndicator size="small" color={theme.primaryDark} />}

            <Text
              variant="micro"
              style={[
                styles.textLink,
                (isResending || isCoolingDown) && { color: theme.textMuted },
                resendStatus === "sent" && { color: theme.success },
              ]}
            >
              {resendStatus === "sending"
                ? t("auth.verifyEmail.buttonLoading", "Sending...")
                : resendStatus === "sent"
                ? t("auth.verifyEmail.sent", "Email sent!")
                : isCoolingDown
                ? t("auth.verifyEmail.resendCooldown", "Resend in {{count}}s", { count: resendCooldown })
                : t("auth.verifyEmail.resend", "Resend email")}
            </Text>
          </View>
        </Pressable>
      </View>

      <View style={{ flex: 1 }} />
      <Link href="/(auth)/signin" asChild>
        <Pressable style={styles.footerPressable}>
          <Text variant="micro" align="center" style={styles.footerLinkText}>
            {t("auth.verifyEmail.back")}
          </Text>
        </Pressable>
      </Link>
    </>
  );
}

const createStyles = (theme: typeof Colors.light) =>
  StyleSheet.create({
    title: { marginTop: 26 },
    subtitle: { marginTop: 4 },
    card: { gap: 12, marginTop: 8 },
    illustration: {
      width: 80,
      height: 80,
      borderRadius: 40,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.primaryLight ?? "#EAF2FF",
      alignSelf: "center",
      marginBottom: 8,
    },
    illustrationText: {
      fontSize: 40,
    },
    bodyTextCentered: {
      marginBottom: 8,
    },
    error: { color: theme.danger, marginTop: 2, marginBottom: 8 },

    // NOTE: primaryButton and secondaryButton styles removed - now using Button component
    // textLinkButton kept as Pressable for custom styling with ActivityIndicator

    textLinkButton: { marginTop: 8, padding: 8 },
    textLink: { color: theme.primaryDark, fontWeight: "600" },

    footerPressable: {
      alignSelf: "center",
    },
    footerLinkText: {
      color: theme.primaryDark,
      fontWeight: "700",
    },
  });
