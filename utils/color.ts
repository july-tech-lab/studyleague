/**
 * Color utility functions for consistent color manipulation across the app.
 */

/**
 * Converts a hex color to rgba format with optional alpha transparency.
 * 
 * @param hex - Hex color string (e.g., "#4AC9CC" or "#4AC9CCFF")
 * @param alpha - Alpha value between 0 and 1 (default: 1)
 * @returns RGBA color string (e.g., "rgba(74,201,204,0.5)")
 * 
 * @example
 * hexToRgba("#4AC9CC", 0.5) // "rgba(74,201,204,0.5)"
 * hexToRgba("#4AC", 1) // "rgba(68,68,68,1)" (expands 3-char hex)
 */
export const hexToRgba = (hex: string | null | undefined, alpha = 1): string => {
  if (!hex) return `rgba(47,75,78,${alpha})`;
  
  let normalized = hex.replace("#", "");

  // Expand 3-character hex to 6 characters
  if (normalized.length === 3) {
    normalized = normalized.split("").map((c) => c + c).join("");
  }
  
  // Remove alpha channel if present (8 characters)
  if (normalized.length === 8) {
    normalized = normalized.slice(0, 6);
  }
  
  // Validate length
  if (normalized.length !== 6) return `rgba(47,75,78,${alpha})`;

  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);

  // Fallback to default teal if parsing fails
  const safeR = Number.isFinite(r) ? r : 47;
  const safeG = Number.isFinite(g) ? g : 75;
  const safeB = Number.isFinite(b) ? b : 78;

  return `rgba(${safeR},${safeG},${safeB},${alpha})`;
};

/**
 * Determines the most readable text color (black or white) for a given background color.
 * Uses the relative luminance formula from WCAG guidelines.
 * 
 * @param hex - Hex color string (e.g., "#4AC9CC")
 * @returns "#1A1A1A" for light backgrounds, "#FFFFFF" for dark backgrounds
 * 
 * @example
 * getReadableTextColor("#4AC9CC") // "#1A1A1A" (dark text on light teal)
 * getReadableTextColor("#1F8E92") // "#FFFFFF" (white text on dark teal)
 */
export const getReadableTextColor = (hex: string | null | undefined): string => {
  if (!hex) return "#fff";
  
  let normalized = hex.replace("#", "");
  
  // Expand 3-character hex to 6 characters
  if (normalized.length === 3) {
    normalized = normalized.split("").map((c) => c + c).join("");
  }
  
  // Remove alpha channel if present
  if (normalized.length === 8) {
    normalized = normalized.slice(0, 6);
  }
  
  // Validate length
  if (normalized.length !== 6) return "#fff";

  // Convert to 0-1 range for luminance calculation
  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;

  // Fallback to default dark gray if parsing fails
  const safeR = Number.isFinite(r) ? r : 0.18;
  const safeG = Number.isFinite(g) ? g : 0.29;
  const safeB = Number.isFinite(b) ? b : 0.31;

  // Calculate relative luminance using WCAG formula
  const luminance =
    0.2126 * (safeR <= 0.03928 ? safeR / 12.92 : Math.pow((safeR + 0.055) / 1.055, 2.4)) +
    0.7152 * (safeG <= 0.03928 ? safeG / 12.92 : Math.pow((safeG + 0.055) / 1.055, 2.4)) +
    0.0722 * (safeB <= 0.03928 ? safeB / 12.92 : Math.pow((safeB + 0.055) / 1.055, 2.4));

  // Return dark text for light backgrounds, white text for dark backgrounds
  return luminance > 0.55 ? "#1A1A1A" : "#FFFFFF";
};

/**
 * Creates a mapping of subject IDs to colors based on their position in the subject tree.
 * Uses custom_color if available, otherwise uses a color palette, cycling through colors 
 * for parent subjects and assigning the same color to all children of a parent.
 * 
 * @param subjectTree - Tree structure of subjects with custom_color property
 * @param palette - Array of color hex strings to cycle through
 * @param defaultColor - Fallback color if palette is empty (default: theme primary)
 * @returns Record mapping subject ID to color hex string
 * 
 * @example
 * const colorMap = createSubjectColorMap(tree, ["#60B3E3", "#26BD93"], "#4AC9CC");
 * // Returns: { "subj1": "#60B3E3", "subj1-child": "#60B3E3", "subj2": "#26BD93", ... }
 */
export function createSubjectColorMap(
  subjectTree: { id: string; custom_color?: string | null; children: { id: string; custom_color?: string | null }[] }[],
  palette: string[],
  defaultColor: string
): Record<string, string> {
  const map: Record<string, string> = {};
  
  subjectTree.forEach((parent, index) => {
    // Use custom_color if available, otherwise use palette
    const color = parent.custom_color ?? (palette.length > 0 
      ? palette[index % palette.length] 
      : defaultColor);
    
    // Assign color to parent
    map[parent.id] = color;
    
    // Assign same color to all children (or use child's custom_color if available)
    parent.children.forEach((child) => {
      map[child.id] = child.custom_color ?? color;
    });
  });
  
  return map;
}

/**
 * Creates a mapping of subject IDs to colors from a flat array of subjects.
 * Uses custom_color if available, otherwise cycles through a color palette based on index.
 * This is a simpler version for flat arrays (unlike createSubjectColorMap which handles tree structures).
 * 
 * @param subjects - Flat array of subjects with custom_color property
 * @param palette - Array of color hex strings to cycle through
 * @param defaultColor - Fallback color if palette is empty (default: theme primary)
 * @returns Record mapping subject ID to color hex string
 * 
 * @example
 * const colorMap = createSubjectColorMapFromFlat(
 *   [{ id: "1", custom_color: null }, { id: "2", custom_color: "#FF0000" }],
 *   ["#60B3E3", "#26BD93"],
 *   "#4AC9CC"
 * );
 * // Returns: { "1": "#60B3E3", "2": "#FF0000" }
 */
export function createSubjectColorMapFromFlat(
  subjects: { id: string; custom_color?: string | null }[],
  palette: string[],
  defaultColor: string
): Record<string, string> {
  const map: Record<string, string> = {};
  
  subjects.forEach((subject, index) => {
    // Use custom_color if available, otherwise use palette based on index
    map[subject.id] = subject.custom_color ?? (
      palette.length > 0 
        ? palette[index % palette.length] 
        : defaultColor
    );
  });
  
  return map;
}

/**
 * Creates a simple mapping of subject IDs to their names.
 * 
 * @param subjects - Flat array of subjects
 * @returns Record mapping subject ID to subject name
 */
export function createSubjectNameMap(
  subjects: { id: string; name: string }[]
): Record<string, string> {
  const map: Record<string, string> = {};
  subjects.forEach((subj) => {
    map[subj.id] = subj.name;
  });
  return map;
}