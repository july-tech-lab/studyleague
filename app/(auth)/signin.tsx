import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Text } from "@/components/Themed";
import Colors from "@/constants/Colors";
import { useTheme } from "@/utils/themeContext";
import { useAuth } from "@/utils/authContext";
import { ArrowRight, Eye, EyeOff, Lock, Mail } from "lucide-react-native";
import { FontAwesome } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { ViewStyle } from "react-native";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";

const logo = require("@/assets/images/logo.png");

export default function SignIn() {
  const { signIn, signInWithGoogle, signInWithApple, isLoading } = useAuth();
  const router = useRouter();
  const isAppleSupported = Platform.OS === "ios";
  const theme = useTheme();
  const styles = createStyles(theme);
  const { t } = useTranslation();
  const showSocialLogin = false;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "apple" | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      setError(t("auth.signin.errorMissing"));
      return;
    }

    try {
      setLoading(true);
      setError(null);

      await signIn(email.trim(), password.trim());

      // Use the root route; tab group segments are not part of the URL
      router.replace("/");

    } catch (err) {
      const message = err instanceof Error ? err.message : t("auth.signin.connectError");
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setOauthLoading("google");
      setError(null);
      await signInWithGoogle();
      router.replace("/");
    } catch (err) {
      const message = err instanceof Error ? err.message : t("auth.signin.googleFailed");
      setError(message);
    } finally {
      setOauthLoading(null);
    }
  };

  const handleAppleSignIn = async () => {
    if (!isAppleSupported) {
      setError(t("auth.signin.appleOnlyIOS"));
      return;
    }

    try {
      setOauthLoading("apple");
      setError(null);
      await signInWithApple();
      router.replace("/");
    } catch (err) {
      const message = err instanceof Error ? err.message : t("auth.signin.appleFailed");
      setError(message);
    } finally {
      setOauthLoading(null);
    }
  };

  return (
    <>
      <View style={styles.logoRow}>
        <Image source={logo} style={styles.logoImage} resizeMode="contain" />
      </View>

      <Text variant="h1" style={styles.title}>
        {t("auth.signin.title")}
      </Text>

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
          />

        <Input
            placeholder={t("auth.placeholders.password")}
          leftIcon={Lock}
          rightIcon={showPassword ? EyeOff : Eye}
            secureTextEntry={!showPassword}
            textContentType="password"
            onChangeText={setPassword}
            value={password}
          onRightIconPress={() => setShowPassword((v) => !v)}
            />

        <View style={styles.inlineActions}>
          <Link href="/(auth)/forgot-password" asChild>
            <Pressable>
              <Text variant="micro" style={styles.inlineLinkText}>
                {t("common.forgotPassword")}
              </Text>
            </Pressable>
          </Link>
        </View>

        {error && (
          <Text variant="micro" align="center" style={styles.error}>
            {error}
          </Text>
        )}

        <Button
          title={loading ? t("auth.signin.buttonLoading") : t("auth.signin.button")}
          variant="primary"
          size="lg"
          iconRight={ArrowRight}
          onPress={handleSignIn}
          disabled={loading || !email.trim() || !password.trim()}
          loading={loading}
          fullWidth
        />
      </View>

      {showSocialLogin && (
        <>
          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text variant="micro" colorName="textMuted" style={styles.dividerText}>
              {t("common.or")}
            </Text>
            <View style={styles.divider} />
          </View>

          <View style={styles.socialRow}>
            <Pressable
              style={[styles.socialButtonCircle, styles.shadow]}
              onPress={handleGoogleSignIn}
              disabled={Boolean(oauthLoading)}
            >
              <FontAwesome name="google" size={20} color="#DB4437" />
            </Pressable>

            <Pressable
              style={[
                styles.socialButtonCircle,
                styles.shadow,
                !isAppleSupported && { opacity: 0.5 },
              ]}
              onPress={handleAppleSignIn}
              disabled={Boolean(oauthLoading) || !isAppleSupported}
            >
              <FontAwesome name="apple" size={20} color="#000" />
            </Pressable>
          </View>
        </>
      )}

      <View style={styles.footerRow}>
        <Text variant="micro" colorName="textMuted" align="center">
          {t("auth.signin.footerText")}{" "}
        </Text>
        <Link href="/(auth)/signup" asChild>
          <Pressable>
            <Text variant="micro" style={styles.footerLinkText}>
              {t("auth.signin.footerLink")}
            </Text>
          </Pressable>
        </Link>
      </View>

      {!loading && isLoading && (
        <ActivityIndicator style={styles.loader} color={theme.primary} />
      )}
    </>
  );
}

const createStyles = (theme: typeof Colors.light) => {
  const socialShadow =
    Platform.select<ViewStyle>({
      web: { boxShadow: "0px 4px 12px rgba(47,75,78,0.08)" } as ViewStyle,
      default: {
        shadowColor: theme.primary,
        shadowOpacity: 0.08,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 8,
        elevation: 3,
      },
    }) || {};

  return StyleSheet.create({
    logoRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      alignSelf: "center",
      gap: 8,
      marginBottom: 8, // Compensate for title marginTop change to maintain visual alignment
    },
    logoImage: { width: 250, height: 250 },
    title: {},
    card: { gap: 12, marginTop: 8 },

    // Keeping socialButtonCircle for FontAwesome icons (not compatible with Button's LucideIcon type)
    inlineActions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      alignItems: "center",
      marginTop: -4,
    },
    inlineLinkText: { color: theme.primaryDark, fontWeight: "600" },
    error: { color: theme.danger, marginTop: 2 },
    loader: { marginTop: 10 },
    dividerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 22 },
    divider: { flex: 1, height: 1, backgroundColor: theme.divider ?? theme.border },
    dividerText: { fontWeight: "600" },
    socialRow: {
      flexDirection: "row",
      justifyContent: "center",
      gap: 12,
      marginTop: 8,
    },
    socialButtonCircle: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.divider ?? theme.border,
    },
    shadow: {
      ...socialShadow,
    },
    footerRow: {
      marginTop: 18,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      flexWrap: "wrap",
    },
    footerLinkText: {
      color: theme.primaryDark,
      fontWeight: "700",
    },
  });
};
