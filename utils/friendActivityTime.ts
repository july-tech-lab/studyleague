import type { TFunction } from "i18next";
import { format } from "date-fns";
import { enUS, fr } from "date-fns/locale";

/** Relative label for when a study session ended (friend feed). */
export function formatFriendActivityEndedAgo(
  endedAtIso: string,
  t: TFunction,
  language: string | undefined
): string {
  const end = new Date(endedAtIso);
  const now = new Date();
  if (Number.isNaN(end.getTime())) {
    return t("friends.ago.justNow");
  }

  const diffMs = now.getTime() - end.getTime();
  if (diffMs < 0) {
    return t("friends.ago.justNow");
  }

  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) {
    return t("friends.ago.justNow");
  }
  if (diffMin < 60) {
    return t("friends.ago.minutes", { count: diffMin });
  }

  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) {
    return t("friends.ago.hours", { count: diffH });
  }

  const startOf = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = Math.round((startOf(now) - startOf(end)) / 86400000);
  if (dayDiff === 1) {
    return t("friends.ago.yesterday");
  }
  if (dayDiff > 1 && dayDiff < 7) {
    return t("friends.ago.daysAgo", { count: dayDiff });
  }

  const loc = language?.startsWith("fr") ? fr : enUS;
  const sameYear = end.getFullYear() === now.getFullYear();
  const pat = sameYear ? "d MMM" : "d MMM yyyy";
  return format(end, pat, { locale: loc });
}
