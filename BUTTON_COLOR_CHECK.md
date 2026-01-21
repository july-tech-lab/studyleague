# Button Color Verification

## Expected Colors

### Primary Button Variant
- **Background Color**: `#1F8E92` (primaryDark)
- **Text Color**: `#FFFFFF` (onPrimaryDark)
- **Pressed Background**: `#4AC9CC` (primary)

## Color Source
Both profile and auth screens use:
- Same theme: `Colors[colorScheme ?? "light"]`
- Same Button component: `components/ui/Button`
- Same variant: `variant="primary"`
- Same color path: `colorSet.primaryDark` → `#1F8E92`

## Code Paths

### Profile Screen (`app/(tabs)/profile.tsx`)
```tsx
const theme = Colors[colorScheme ?? "light"];
<Button variant="primary" ... />
```

### Auth Screens (`app/(auth)/signin.tsx`, etc.)
```tsx
const theme = Colors[colorScheme ?? "light"];
<Button variant="primary" ... />
```

## Button Component Implementation
```tsx
case "primary":
  return { 
    bg: colorSet.primaryDark,  // #1F8E92
    pressedBg: colorSet.primary, // #4AC9CC
    text: colorSet.onPrimaryDark, // #FFFFFF
    border: "transparent",
    borderWidth: 0 
  };
```

## Potential Visual Differences

1. **Background Contrast**
   - Profile: Buttons on white cards (`theme.surface` = `#FFFFFF`)
   - Auth: Buttons on light background (`theme.background` = `#F6FAF8`)
   - **Impact**: Same button color may appear darker against white background

2. **Elevation/Shadows**
   - Profile buttons are inside cards with `elevation: 1`
   - Auth buttons are directly on background
   - **Impact**: Shadows might affect perceived darkness

3. **Opacity**
   - Button component applies `opacity: 0.65` when disabled
   - No opacity applied when enabled
   - **Impact**: Should be identical when both enabled

## Conclusion
**The colors are identical in code** (`#1F8E92`). Any visual difference is likely due to:
- Background contrast (white card vs light background)
- Shadow/elevation effects
- Visual perception due to context

## Recommendation
If buttons need to appear identical visually, consider:
1. Using same background color for both contexts
2. Removing elevation from profile card
3. Or accepting that context affects perceived color (which is normal in UI design)
