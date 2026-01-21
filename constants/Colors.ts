// colors.ts (Brand Palette: teal + coral)
// Simplified: removed separate accent hue (use secondary as accent)
// Added: primaryTint + onPrimaryDark (for contrast on primaryDark backgrounds)

const brand = {
  // Primary (teal)
  primary: "#4AC9CC",
  primaryDark: "#1F8E92",
  primaryLight: "#8BE3E5",
  primaryTint: "#CCF3F4",

  // Secondary (coral) — doubles as "accent"
  secondary: "#F28C8C",
  secondaryLight: "#F7B3B3",
  secondaryDark: "#E57878",
  secondaryTint: "rgba(242,140,140,0.16)",

  // Semantics
  success: "#26BD93",
  warning: "#FFCE53",
  danger: "#F97046",

  successTint: "rgba(38,189,147,0.16)",
  warningTint: "rgba(255,206,83,0.16)",
  dangerTint: "rgba(249,112,70,0.16)",

  successDark: "#1E826D",
  warningDark: "#B89137",
  dangerDark: "#B84623",

  // Subject colors
  subjectPalette: [
    "#60B3E3", // blue
    "#26BD93", // green
    "#FFCE53", // yellow
    "#F97046", // orange
    "#FF8FD3", // pink
    "#C992E3", // purple
  ],
};

// Base neutrals
const lightBase = {
  background: "#F6FAF8",
  surface: "#FFFFFF",
  surfaceElevated: "#EEF5F2",

  text: "#1F2A2C",
  textMuted: "#5F7772",

  border: "#E5E5E5",
  divider: "#E5E5E5",

  shadow: "rgba(15, 20, 20, 0.12)",
};

const darkBase = {
  background: "#0F1414",
  surface: "#172020",
  surfaceElevated: "#1D2727",

  text: "#E8EAEB",
  textMuted: "#A7B2B6",

  border: "#3A3A3A",
  divider: "#3A3A3A",

  shadow: "rgba(0, 0, 0, 0.55)",
};

export default {
  light: {
    ...lightBase,
    ...brand,

    // "On" colors
    onPrimary: lightBase.text, // for primary + primaryLight
    onSecondary: lightBase.text,
    onSurface: lightBase.text,

    // Important: for primaryDark (hover/pressed backgrounds), use white for readability
    onPrimaryDark: "#FFFFFF",

    // UI for navigation bar icons
    tabIconDefault: lightBase.textMuted,
    tabIconSelected: brand.primary,
  },

  dark: {
    ...darkBase,
    ...brand,

    // Slightly stronger tints in dark mode is fine
    secondaryTint: "rgba(242,140,140,0.22)",
    primaryTint: "#CCF3F4",

    // "On" colors
    // Text on the teal primary still works best as dark ink, even in dark mode.
    // (You can swap this to darkBase.text if you prefer bright text everywhere.)
    onPrimary: "#1F2A2C",
    onSecondary: "#1F2A2C",
    onSurface: darkBase.text,

    // For primaryDark (hover/pressed) use white
    onPrimaryDark: "#FFFFFF",

    // UI for navigation bar icons
    tabIconDefault: darkBase.textMuted,
    tabIconSelected: brand.primaryLight,
  },
};
