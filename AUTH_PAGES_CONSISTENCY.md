# Auth Pages Consistency Guide

This document outlines the standardized styles and patterns used across all 6 authentication pages to ensure consistency and easy maintenance.

## Standardized Styles

### Screen Container
All auth pages use the same `screen` style:
```typescript
screen: {
  flex: 1,
  backgroundColor: theme.background,
  paddingHorizontal: 26,
  paddingTop: 60,
  gap: 12,
}
```

### Title Spacing
- **Pages without back button** (signin, signup): `marginTop: 18`
- **Pages with back button** (forgot-password, reset-password-complete, verify-email, fill-profile): `marginTop: 26`

### Subtitle Spacing
When present: `marginTop: 4`

### Card Container
Standard card: `gap: 12, marginTop: 8`
- Exception: `verify-email` has a special styled card (intentional design)

### Error/Success Messages
- Error: `color: theme.danger, marginTop: 2`
- Success: `color: theme.success, marginTop: 2`

### Loader
`marginTop: 10`

### Footer Links
- `footerLinkText`: `color: theme.primaryDark, fontWeight: "700"`
- `footerRow` or `footerPressable`: `marginTop: 18`
  - Exception: `verify-email` uses `marginTop: "auto"` (intentional for bottom positioning)

## Typography Variants

### Titles
All use: `<Text variant="h1">`

### Subtitles/Descriptions
Use: `<Text variant="body" colorName="textMuted">`

### Form Labels
Use: `<Text variant="subtitle" colorName="textMuted">` (matches Input component label)

### Links
Use: `<Text variant="micro">` with appropriate color styling

### Error/Success Messages
Use: `<Text variant="micro">`

## Button Sizes

### Primary Action Buttons
All use: `size="lg"` (16px text)

### Secondary Buttons
Use: `size="md"` (15px text, default)

## Pages

1. **signin.tsx** - No back button, has logo, footer row
2. **signup.tsx** - No back button, has logo, footer row, terms checkbox
3. **forgot-password.tsx** - Has back button, simple footer link
4. **reset-password-complete.tsx** - Has back button, subtitle, error/success messages
5. **verify-email.tsx** - Has back button, subtitle, special styled card, footer link
6. **fill-profile.tsx** - Has back button, ScrollView for content, category selection

## Maintenance Notes

- When adding a new auth page, follow these standardized values
- If a page needs different spacing, document why (like verify-email's special card)
- All spacing values are in pixels for consistency
- Typography is handled via `variant` prop, not fontSize in stylesheets
