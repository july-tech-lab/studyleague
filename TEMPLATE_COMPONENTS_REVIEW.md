# Template Components Review

## Summary
This document reviews all pages to identify remaining changes needed to use template components (Button and Input) consistently across the application.

## Template Components Available

### Button Component (`components/ui/Button.tsx`)
**Features:**
- Variants: `primary`, `secondary`, `destructive`, `outline`, `ghost`
- Sizes: `xs`, `sm`, `md`, `lg`
- Shapes: `default`, `pill`
- Icons: `iconLeft`, `iconRight`
- Icon-only mode: `iconOnly` prop
- States: `loading`, `disabled`
- Accessibility: `accessibilityLabel` prop
- `fullWidth` option

### Input Component (`components/ui/Input.tsx`)
**Features:**
- Label support
- Helper text and error messages
- Left and right icons (with press handler for right icon)
- Custom styling via `containerStyle` and `fieldStyle`
- Full TextInput props support

---

## Page-by-Page Review

### ✅ Auth Pages - COMPLETE

All auth pages are using template components correctly:

- **signin.tsx**: ✅ Uses `Input` and `Button`
- **signup.tsx**: ✅ Uses `Input` and `Button`
- **fill-profile.tsx**: ✅ Uses `Input` and `Button`
- **forgot-password.tsx**: ✅ Uses `Input` and `Button`
- **reset-password-complete.tsx**: ✅ Uses `Input` and `Button`
- **verify-email.tsx**: ✅ Uses `Button` (no inputs needed)

**Note:** Some `Pressable` components remain for specialized use cases (social login buttons, avatar picker, checkbox, text links) - these are acceptable as they serve specific purposes that don't map directly to Button.

---

### ⚠️ Tab Pages - NEEDS UPDATES

#### 1. **app/(tabs)/index.tsx** (Timer Screen)
**Button Usage:** ✅ Complete
- Uses `Button` for start button, stop button, add button, and modal buttons

**Input Usage:** ✅ Complete
- ✅ Modal now uses `Input` component for subject name input

**Example:**
```tsx
// Current (line 773)
<TextInput
  value={newSubjectName}
  onChangeText={setNewSubjectName}
  placeholder={t("timer.addSubjectPlaceholder", "Nom de la matière")}
  placeholderTextColor={theme.textMuted}
  style={[styles.modalInput, { borderColor: theme.border, color: theme.text }]}
  autoFocus
  editable={!savingSubject}
/>

// Should be:
<Input
  value={newSubjectName}
  onChangeText={setNewSubjectName}
  placeholder={t("timer.addSubjectPlaceholder", "Nom de la matière")}
  autoFocus
  editable={!savingSubject}
  error={savingSubject ? undefined : undefined} // Add error handling if needed
/>
```

---

#### 2. **app/(tabs)/profile.tsx** (Profile Screen)
**Button Usage:** ✅ Complete
- Uses `Button` for all action buttons, pill buttons, icon buttons, and modal buttons

**Input Usage:** ✅ Complete
- ✅ Display name input now uses `Input` component with error handling
- ✅ Modal now uses `Input` component for subject name with error handling

**Example:**
```tsx
// Current (line 394)
<TextInput
  value={displayNameInput}
  onChangeText={setDisplayNameInput}
  placeholder={t("profile.displayName.placeholder", "Your name")}
  placeholderTextColor={theme.textMuted}
  style={[styles.displayNameInput, { borderColor: theme.border, color: theme.text, backgroundColor: theme.surface }]}
  autoCapitalize="words"
/>

// Should be:
<Input
  value={displayNameInput}
  onChangeText={setDisplayNameInput}
  placeholder={t("profile.displayName.placeholder", "Your name")}
  autoCapitalize="words"
  containerStyle={{ flex: 1 }}
  error={displayNameError || undefined}
/>
```

---

#### 3. **app/(tabs)/groups.tsx** (Groups Screen)
**Button Usage:** ✅ Complete
- Uses `Button` for all buttons including join, add, search, and modal buttons

**Input Usage:** ✅ Complete
- ✅ Search input now uses `Input` component
- ✅ Modal group name input now uses `Input` component
- ✅ Modal description input now uses `Input` component
- ✅ Modal password input now uses `Input` component with `secureTextEntry`
- ✅ Join modal password input now uses `Input` component with `secureTextEntry`

**Example:**
```tsx
// Current (line 338)
<TextInput
  placeholder={t("groups.searchPlaceholder", "Code ou nom du groupe")}
  placeholderTextColor={theme.textMuted}
  value={searchCode}
  onChangeText={setSearchCode}
  style={[styles.modalInput, { flex: 1, color: theme.text, borderColor: theme.divider }]}
/>

// Should be:
<Input
  placeholder={t("groups.searchPlaceholder", "Code ou nom du groupe")}
  value={searchCode}
  onChangeText={setSearchCode}
  containerStyle={{ flex: 1 }}
/>
```

---

#### 4. **app/(tabs)/tasks.tsx** (Tasks Screen)
**Button Usage:** ✅ Complete
- Uses `Button` for add button, delete button, and inline action buttons

**Input Usage:** ✅ Complete
- ✅ Task name input now uses `Input` component
- ✅ Task minutes input now uses `Input` component with `keyboardType="numeric"`

**Note:** The subject selector uses `TouchableOpacity` which is appropriate for a dropdown trigger, not an input field.

**Example:**
```tsx
// Current (line 299)
<TextInput
  placeholder={t("tasks.form.name")}
  placeholderTextColor={theme.textMuted}
  value={newTaskTitle}
  onChangeText={setNewTaskTitle}
  returnKeyType="done"
  onSubmitEditing={handleAddTask}
  blurOnSubmit
  style={[styles.input, { borderColor: theme.divider, backgroundColor: theme.surfaceElevated, color: theme.text }]}
/>

// Should be:
<Input
  placeholder={t("tasks.form.name")}
  value={newTaskTitle}
  onChangeText={setNewTaskTitle}
  returnKeyType="done"
  onSubmitEditing={handleAddTask}
  blurOnSubmit
/>
```

---

## Summary of Required Changes

### ✅ COMPLETED - All TextInput components replaced
1. **index.tsx**: ✅ 1 TextInput → Input (COMPLETED)
2. **profile.tsx**: ✅ 2 TextInput → Input (COMPLETED)
3. **groups.tsx**: ✅ 5 TextInput → Input (COMPLETED)
4. **tasks.tsx**: ✅ 2 TextInput → Input (COMPLETED)

**Total: 10 TextInput components replaced with Input component ✅**

### Acceptable Exceptions
The following `Pressable`/`TouchableOpacity` components are acceptable and should NOT be replaced:
- Social login buttons (FontAwesome icons, not compatible with Button's LucideIcon)
- Avatar picker button (specialized interaction)
- Checkbox toggle (specialized component)
- Text links (can use Button variant="ghost" but current Pressable is fine)
- Dropdown triggers (TouchableOpacity for subject selector in tasks)
- Custom interactive elements that don't map to standard button patterns

---

## Implementation Notes

1. **Removing Custom Styles**: After replacing TextInput with Input, remove corresponding styles from StyleSheet (e.g., `modalInput`, `displayNameInput`, `input`, `inputSmall`)

2. **Error Handling**: The Input component supports `error` prop - consider adding error states where appropriate

3. **Icons**: Input component supports `leftIcon` and `rightIcon` - consider adding icons where it improves UX

4. **Consistency**: All inputs should now have consistent styling, spacing, and behavior

---

## Testing Checklist

After making changes, verify:
- [ ] All inputs have consistent styling
- [ ] Error states display correctly
- [ ] Icons (if added) display correctly
- [ ] Placeholder text is visible
- [ ] Keyboard types are correct (email, numeric, etc.)
- [ ] Secure text entry works for password fields
- [ ] Form validation still works
- [ ] No visual regressions
