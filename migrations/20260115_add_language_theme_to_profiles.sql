/* -----------------------------------------------------------------------------
  ADD LANGUAGE AND THEME PREFERENCES TO PROFILES
  Date: 2026-01-15
  
  Adds user preferences for language and theme to the profiles table
  so they persist across devices instead of being stored only in AsyncStorage.
  
  Changes:
  1. Add language_preference text column (nullable, default NULL)
  2. Add theme_preference text column (nullable, default NULL)
  3. Add check constraints to ensure valid values
  4. Add comments for documentation
  
  Valid values:
  - language_preference: 'en' or 'fr' (matches SupportedLanguage type)
  - theme_preference: 'light' or 'dark' (matches ThemePreference type)
  -----------------------------------------------------------------------------
*/

BEGIN;

  -----------------------------------------------------------------------------
  -- 1. ADD LANGUAGE PREFERENCE COLUMN
  -----------------------------------------------------------------------------

  ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS language_preference text;

  -- Add check constraint for valid language values
  ALTER TABLE public.profiles
    ADD CONSTRAINT language_preference_check 
    CHECK (language_preference IS NULL OR language_preference IN ('en', 'fr'));

  COMMENT ON COLUMN public.profiles.language_preference IS 
    'User preferred language: "en" for English, "fr" for French. NULL means use system default.';

  -----------------------------------------------------------------------------
  -- 2. ADD THEME PREFERENCE COLUMN
  -----------------------------------------------------------------------------

  ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS theme_preference text;

  -- Add check constraint for valid theme values
  ALTER TABLE public.profiles
    ADD CONSTRAINT theme_preference_check 
    CHECK (theme_preference IS NULL OR theme_preference IN ('light', 'dark'));

  COMMENT ON COLUMN public.profiles.theme_preference IS 
    'User preferred theme: "light" or "dark". NULL means use system default.';

COMMIT;
