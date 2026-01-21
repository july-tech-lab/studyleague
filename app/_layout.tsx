import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/inter';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Text, TextInput } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import i18n from '@/i18n';
import { AuthProvider, useAuth } from '@/utils/authContext';
import { AppThemeProvider } from '@/utils/themeContext';
import { I18nextProvider } from 'react-i18next';

let hasConfiguredGlobalFont = false;

// These casts avoid TS errors: defaultProps is added dynamically
const TextWithDefaults = Text as unknown as { defaultProps?: { style?: any } };
const TextInputWithDefaults = TextInput as unknown as { defaultProps?: { style?: any } };

const configureGlobalFont = () => {
  if (hasConfiguredGlobalFont) return;

  const defaultFontStyle = { fontFamily: 'Inter_400Regular' };

  if (!TextWithDefaults.defaultProps) TextWithDefaults.defaultProps = {};
  if (!TextInputWithDefaults.defaultProps) TextInputWithDefaults.defaultProps = {};

  TextWithDefaults.defaultProps.style = [
    TextWithDefaults.defaultProps.style,
    defaultFontStyle,
  ].filter(Boolean);

  TextInputWithDefaults.defaultProps.style = [
    TextInputWithDefaults.defaultProps.style,
    defaultFontStyle,
  ].filter(Boolean);

  hasConfiguredGlobalFont = true;
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  configureGlobalFont();

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  return (
    <SafeAreaProvider>
      <I18nextProvider i18n={i18n}>
        <AuthProvider>
          <AppThemeProvider>
            <NavigationWithTheme />
          </AppThemeProvider>
        </AuthProvider>
      </I18nextProvider>
    </SafeAreaProvider>
  );
}

function NavigationWithTheme() {
  const colorScheme = useColorScheme();
  const { user, loadingUser } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loadingUser) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!user && !inAuthGroup) {
      router.replace("/(auth)/signin");
    }
  }, [loadingUser, user, segments, router]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: "modal" }} />
      </Stack>
    </ThemeProvider>
  );
}
