/**
 * Time formatting utilities for consistent time display across the app.
 */

/**
 * Formats total seconds into an object with hours, minutes, and seconds as zero-padded strings.
 * Used for timer displays (HH:MM:SS format).
 * 
 * @param totalSeconds - Total number of seconds
 * @returns Object with hours, mins, and secs as zero-padded strings
 * 
 * @example
 * formatTime(3661) // { hours: "01", mins: "01", secs: "01" }
 * formatTime(125) // { hours: "00", mins: "02", secs: "05" }
 */
export const formatTime = (totalSeconds: number): { hours: string; mins: string; secs: string } => {
  return {
    hours: Math.floor(totalSeconds / 3600).toString().padStart(2, "0"),
    mins: Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, "0"),
    secs: (totalSeconds % 60).toString().padStart(2, "0"),
  };
};

/**
 * Formats seconds into a human-readable duration string.
 * Returns format like "2h 30m" or "45m" (omits hours if zero).
 * 
 * @param seconds - Total number of seconds
 * @returns Formatted string like "2h 30m" or "45m" or "--" if invalid
 * 
 * @example
 * formatDuration(9000) // "2h 30m"
 * formatDuration(2700) // "45m"
 * formatDuration(0) // "--"
 */
export const formatDuration = (seconds: number | null | undefined): string => {
  if (!seconds || seconds <= 0) return "--";
  const mins = Math.round(seconds / 60);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

/**
 * Formats minutes into a human-readable duration string.
 * Returns format like "2h 30m" or "45m" (omits hours if zero).
 * 
 * @param minutes - Total number of minutes
 * @returns Formatted string like "2h 30m" or "45m"
 * 
 * @example
 * formatDurationFromMinutes(150) // "2h 30m"
 * formatDurationFromMinutes(45) // "45m"
 */
export const formatDurationFromMinutes = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

/**
 * Gets today's date in ISO format (YYYY-MM-DD) in local timezone.
 * 
 * @returns ISO date string (e.g., "2024-01-15")
 */
export const getTodayIso = (): string => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

/**
 * Formats a date string for display, showing "Today" if it's today's date.
 * 
 * @param date - Date string or Date object
 * @param todayIso - Optional today's date in ISO format (YYYY-MM-DD). If not provided, will be calculated.
 * @param locale - Optional locale for date formatting (default: user's locale)
 * @returns Formatted date string or "Today" if it's today
 * 
 * @example
 * formatDateLabel("2024-01-15", "2024-01-15") // "Today"
 * formatDateLabel("2024-01-14", "2024-01-15") // "1/14/2024" (locale-dependent)
 */
export const formatDateLabel = (
  date: string | Date | null | undefined,
  todayIso?: string,
  locale?: string
): string => {
  if (!date) return "";
  
  try {
    const parsed = typeof date === "string" ? new Date(date) : date;
    const parsedIso = parsed.toISOString().slice(0, 10);
    
    if (Number.isNaN(parsed.getTime())) {
      return typeof date === "string" ? date : "";
    }
    
    const today = todayIso ?? getTodayIso();
    if (parsedIso === today) {
      return "Today";
    }
    
    return parsed.toLocaleDateString(locale);
  } catch {
    return typeof date === "string" ? date : "";
  }
};
