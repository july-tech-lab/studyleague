# Typography Implementation Guide

## Best Practices

### 🎯 Rule of Thumb

**If it's a typography decision, it belongs in `typography.ts` + Themed Text variant.**  
**If it's a layout decision, it belongs in the screen's `StyleSheet.create()`.**

### ✅ DO: Use Themed Text Component with Variants

**Always use the Themed Text component** (`@/components/Themed`) with `variant` prop for consistent typography:

```tsx
import { Text } from "@/components/Themed";

// Screen titles
<Text variant="h1">Profile</Text>

// Standard body text (default)
<Text>This is regular body text</Text>

// Secondary/muted text
<Text variant="micro" colorName="textMuted">Last updated 2 hours ago</Text>

// Strong body text
<Text variant="bodyStrong">Important information</Text>
```

### ✅ DO: Keep StyleSheet.create() for Layout & Visuals

**Keep `StyleSheet.create()` for:**
- **Layout** (flex, padding, gap, alignItems, justifyContent, positioning)
- **Component-specific visuals** (backgroundColor, borderRadius, borderWidth, shadows)
- **Small local adjustments** on top of design tokens
- **Spacing and sizing** (margins, widths, heights)

**Avoid embedding or redefining typography in pages.**

```tsx
const createStyles = (theme: typeof Colors.light) =>
  StyleSheet.create({
    container: {
      flex: 1,
      padding: 16,
      gap: 12,
    },
    card: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.divider,
      padding: 16,
    },
    // ✅ Good: Layout and spacing
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
  });
```

### ❌ DON'T: Put Typography in createStyles

**Avoid in `StyleSheet.create()`:**
- `fontSize`, `lineHeight`, `fontWeight` (except rare one-offs like timer displays)
- Ad-hoc text variants ("this screen uses 18/24 because it felt right")
- Redefining typography tokens at the component level

**All typography decisions should use Themed Text with variants from `typography.ts`.**

```tsx
// ❌ BAD: Typography in styles
const createStyles = (theme: typeof Colors.light) =>
  StyleSheet.create({
    title: { fontSize: 28, fontWeight: "700" }, // ❌ Remove this
    body: { fontSize: 17, color: theme.text },   // ❌ Remove this
  });

// ✅ GOOD: Use Themed Text with variants
<Text variant="h1">Title</Text>
<Text>Body text</Text>
```

### ⚠️ EXCEPTION: Rare One-Offs

**Only use fontSize in styles for truly special cases** that don't fit the typography scale:
- Large timer displays (56px+)
- Custom decorative text
- One-off special sizes not in typography scale

**When in doubt, add a new variant to `typography.ts` instead of hardcoding.**

```tsx
// ✅ Acceptable: Special display text
timerText: {
  fontSize: 56, // Special case for timer
  fontWeight: "500",
  fontVariant: ['tabular-nums'],
  color: theme.text,
},
```

## Typography Variants Reference

Available variants from `constants/typography.ts`:

| Variant | iOS Size | Android Size | Use Case |
|---------|----------|--------------|----------|
| `display` | 34px | 32px | Hero titles, landing pages |
| `h1` | 28px | 24px | Screen/page titles |
| `h2` | 22px | 20px | Section headers |
| `subtitle` | 15px | 14px | Subtitles, card titles |
| `body` | 17px | 16px | Default body text |
| `bodyStrong` | 17px (600) | 16px (600) | Emphasized body text |
| `micro` | 13px | 12px | Labels, metadata, hints |
| `caption` | 12px | 11px | Small captions, timestamps |

## Migration Checklist

When refactoring a component:

1. ✅ Replace all `<Text>` from `react-native` with `<Text>` from `@/components/Themed`
2. ✅ Remove `fontSize`, `fontWeight`, `lineHeight` from `createStyles`
3. ✅ Add `variant` prop to Text components
4. ✅ Use `colorName` prop instead of inline `color` styles
5. ✅ Keep layout/spacing/colors in `createStyles`
6. ✅ Test on both iOS and Android to verify platform-specific sizing

## Examples

### Before (Inconsistent)
```tsx
import { Text, StyleSheet } from "react-native";

const createStyles = (theme) => StyleSheet.create({
  title: { fontSize: 28, fontWeight: "700", color: theme.text },
  body: { fontSize: 17, color: theme.text },
  label: { fontSize: 13, color: theme.textMuted },
});

<Text style={styles.title}>Title</Text>
<Text style={styles.body}>Body</Text>
<Text style={styles.label}>Label</Text>
```

### After (Consistent)
```tsx
import { Text } from "@/components/Themed";
import { StyleSheet } from "react-native";

const createStyles = (theme) => StyleSheet.create({
  // Only layout/spacing, no typography
  container: { padding: 16, gap: 12 },
});

<Text variant="h1">Title</Text>
<Text>Body</Text>
<Text variant="micro" colorName="textMuted">Label</Text>
```

## Benefits

1. **Consistency**: All text uses the same typography scale
2. **Platform-aware**: Automatically uses iOS/Android appropriate sizes
3. **Accessibility**: Supports user font scaling preferences
4. **Maintainability**: Change typography in one place (`constants/typography.ts`)
5. **Cleaner code**: Less duplication, clearer intent
