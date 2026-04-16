import type { TFunction } from "i18next";

/** Same rule as DB check on `profiles.username` (~* '^[a-zA-Z0-9_]+$'). */
export const PROFILE_USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;

export function isValidProfileUsername(trimmed: string): boolean {
  return trimmed.length >= 3 && PROFILE_USERNAME_PATTERN.test(trimmed);
}

/**
 * Maps raw API / Postgres messages to user-facing copy when we recognise them.
 */
export function mapProfileUsernameSaveError(raw: string, t: TFunction): string {
  const lower = raw.toLowerCase();
  if (
    lower.includes("idx_profiles_username_unique") ||
    lower.includes("duplicate key") ||
    lower.includes("23505")
  ) {
    return t("onboarding.fillProfile.errorUsernameTaken");
  }
  if (lower.includes("username_format") || lower.includes("username_len")) {
    return t("onboarding.fillProfile.errorUsernameFormat");
  }
  return raw;
}
