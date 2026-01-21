import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import fr from "./locales/fr.json";

const STORAGE_KEY = "studyleague.lang";
const canUseAsyncStorage = typeof window !== "undefined";

export const supportedLanguages = ["en", "fr"] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];

const languageDetector = {
  type: "languageDetector",
  async: true,

  detect: async (callback: (lng: SupportedLanguage) => void) => {
    try {
      // 1. Check stored language (only when window is available – avoids SSR errors)
      if (canUseAsyncStorage) {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          callback(stored as SupportedLanguage);
          return;
        }
      }

      // 2. Detect system language
      const locales = Localization.getLocales?.() ?? [];
      const first = locales[0];

      const bestGuess =
        first?.languageCode ||
        first?.languageTag?.split("-")[0] ||
        "en";

      callback(bestGuess as SupportedLanguage);
    } catch (error) {
      console.warn("Language detect error", error);
      callback("en");
    }
  },

  init: () => {},
  cacheUserLanguage: (lng: SupportedLanguage) => {
    if (canUseAsyncStorage) {
      AsyncStorage.setItem(STORAGE_KEY, lng).catch(() => {});
    }
  },
};

if (!i18n.isInitialized) {
  i18n
    .use(languageDetector as any)
    .use(initReactI18next)
    .init({
      compatibilityJSON: "v4",
      fallbackLng: "fr",
      resources: { en: { translation: en }, fr: { translation: fr } },
      interpolation: { escapeValue: false },
      defaultNS: "translation",
      returnNull: false,
    })
    .catch((err) => console.warn("i18n init error", err));
}

export const changeLanguage = async (lng: SupportedLanguage) => {
  await i18n.changeLanguage(lng);
};

export const getCurrentLanguage = () => i18n.language as SupportedLanguage;

export default i18n;
