# Code Improvements Roadmap

## Executive Summary

This document consolidates all code improvement recommendations into a single actionable roadmap. It tracks completed work, pending improvements, and provides clear priorities for maintaining and enhancing code quality.

**Last Updated:** January 2025

**Overall Status:**
- ✅ **Completed:** Theme utilities, color utilities, time utilities, style memoization, groups hook migration, Header prop standardization, color-palette cleanup, FlatList implementation, timer screen verification, ScreenContainer component
- 📋 **Pending:** Component extraction, typography standardization

---

## ✅ Phase 1: Completed Improvements

### 1. Theme System Standardization ✅

**Status:** ✅ **COMPLETE**

- ✅ `useTheme()` hook created in `utils/themeContext.tsx`
- ✅ All screens now use `const theme = useTheme()` pattern
- ✅ Consistent theme access across the app

**Impact:**
- Reduced boilerplate from 2 lines to 1 line per screen
- Single source of truth for theme access
- Consistent fallback handling

---

### 2. Color Utilities Centralization ✅

**Status:** ✅ **COMPLETE**

- ✅ `utils/color.ts` created with:
  - `hexToRgba()` - Converts hex to rgba with alpha
  - `getReadableTextColor()` - WCAG-compliant luminance calculation
  - `createSubjectColorMap()` - Subject color mapping
  - `createSubjectNameMap()` - Subject name mapping
- ✅ Timer screen (`index.tsx`) uses centralized utilities
- ✅ `color-palette.tsx` now uses `getReadableTextColor()` from centralized utility

---

### 3. Time Formatting Utilities ✅

**Status:** ✅ **COMPLETE**

- ✅ `utils/time.ts` created with:
  - `formatTime()` - HH:MM:SS format for timers
  - `formatDuration()` - Human-readable duration from seconds
  - `formatDurationFromMinutes()` - Human-readable duration from minutes
  - `formatDateLabel()` - Date formatting with "Today" support
  - `getTodayIso()` - Today's date in ISO format
- ✅ All screens should be using centralized time utilities

**Verification Needed:**
- Confirm all screens have migrated from local time formatting functions

---

### 4. Style Memoization Standardization ✅

**Status:** ✅ **COMPLETE**

- ✅ All tab screens use `useMemo(() => createStyles(theme), [theme])` pattern:
  - `index.tsx` ✅
  - `dashboard.tsx` ✅
  - `tasks.tsx` ✅
  - `groups.tsx` ✅
  - `profile.tsx` ✅
  - `leaderboard.tsx` ✅

**Impact:**
- Consistent performance optimization across all screens
- Prevents unnecessary style recalculations

---

### 5. Groups Screen Hook Migration ✅

**Status:** ✅ **COMPLETE**

- ✅ `groups.tsx` migrated to use `useGroups` hook
- ✅ No direct Supabase imports in groups screen
- ✅ Uses hook functions: `createGroup`, `joinGroup`, `searchGroupByCode`
- ✅ Real-time subscriptions handled by hook

**Impact:**
- Reduced code complexity
- Consistent data access pattern
- Eliminated direct Supabase calls

---

## ✅ Phase 2: Recently Completed

### 6. Remove Redundant Header Theme Prop ✅

**Status:** ✅ **COMPLETE**

- ✅ Removed `theme={theme}` prop from all 5 screens:
  - `profile.tsx` ✅
  - `leaderboard.tsx` ✅
  - `dashboard.tsx` ✅
  - `tasks.tsx` ✅
  - `groups.tsx` ✅
- ✅ Header component uses `useTheme()` internally, making explicit prop unnecessary

**Impact:**
- Removed redundant prop passing
- Cleaner, more consistent code
- Prevents "forgot to pass theme" mistakes

---

### 7. Replace Duplicate Color Logic in color-palette.tsx ✅

**Status:** ✅ **COMPLETE**

- ✅ Replaced local `getContrastColor()` function with `getReadableTextColor()` from `utils/color.ts`
- ✅ Removed 22 lines of duplicate code
- ✅ Now uses WCAG-compliant luminance calculation consistently

**Impact:**
- Single source of truth for color contrast logic
- Consistent behavior across app
- WCAG-compliant contrast calculation

---

### 8. Verify Hook Callbacks ✅

**Status:** ✅ **VERIFIED - ALREADY CORRECT**

- ✅ `useTasks.ts` - All callbacks use functional updates: `setTasks((prev) => ...)`
- ✅ `useSubjects.ts` - All callbacks use functional updates: `setSubjects((prev) => ...)`
- ✅ Dependency arrays only include `userId`, not state arrays
- ✅ No changes needed - hooks already follow best practices

**Impact:**
- Confirmed optimal performance patterns
- No unnecessary re-renders
- Stable callback references

---

### 9. Create ScreenContainer Component ✅

**Status:** ✅ **COMPLETE**

**Completed:**
- ✅ Created `components/ScreenContainer.tsx` with:
  - Standardized padding (default: 20px)
  - Consistent gap spacing (default: 12px)
  - Safe area inset handling for notches/home bars
  - Theme background color integration via `useTheme()`
- ✅ Replaced `<ScrollView>` with `<ScreenContainer>` in all 5 tab screens:
  - `app/(tabs)/dashboard.tsx` ✅
  - `app/(tabs)/tasks.tsx` ✅
  - `app/(tabs)/groups.tsx` ✅
  - `app/(tabs)/profile.tsx` ✅
  - `app/(tabs)/color-palette.tsx` ✅
- ✅ Removed ~50+ lines of repetitive padding code from StyleSheets
- ✅ All screens now use consistent spacing without explicit props

**Impact:**
- ✅ Eliminated repetitive padding code
- ✅ Consistent spacing across all screens (padding: 20, gap: 12)
- ✅ Proper safe area handling on all devices
- ✅ Automatic theme background color
- ✅ Easier to adjust global spacing (change defaults in one place)

---

## 📋 Phase 3: Medium Priority

### 10. Eliminate Direct Supabase Calls in Screens ✅

**Status:** ✅ **COMPLETE** (Auth screens only - Profile screen was already done)

**Completed:**
- ✅ Added `getSession()` and `exchangeCodeForSession()` to `utils/queries.ts`
- ✅ Added `uploadAvatar()` to `utils/queries.ts` for storage operations
- ✅ Replaced direct Supabase calls in `app/(auth)/reset-password-complete.tsx`
- ✅ Replaced direct Supabase storage calls in `app/(auth)/fill-profile.tsx`
- ✅ Verified `app/(auth)/verify-email.tsx` and `app/(auth)/forgot-password.tsx` already use queries.ts
- ✅ Verified `app/(tabs)/profile.tsx` already uses queries.ts

**Rule Enforced:**
> **Screens should not import `supabase` at all. All database access should go through `utils/queries.ts`.**

**Impact:**
- ✅ Centralized data access logic
- ✅ Easier to add error handling, logging, or caching
- ✅ Consistent patterns across app
- ✅ Easier testing and mocking

---

### 11. Standardize Typography Usage

**Current State:**
- Mixed usage of Text components:
  - `index.tsx` (Timer): Uses `Text, View` from `@/components/Themed`
  - Other screens: Use `Text, View` from `react-native` directly
- `Themed` Text supports variants: `variant="h1"`, `variant="body"`, etc.
- Most screens use raw React Native Text with manual styling

**Action Items:**
1. Audit all screens for Text usage
2. Decide on approach:
   - **Option A:** Replace `react-native` Text imports with `@/components/Themed` Text and use variants
   - **Option B:** Drop Themed Text and use RN Text + centralized typography styles consistently
3. Create typography style utilities if needed
4. Migrate screens to chosen approach

**Expected Impact:**
- Consistent typography system
- Easier to maintain font sizes/spacing
- Better accessibility support

---

### 12. Extract Large Components

**Current State:**
Large component files:
- `app/(tabs)/index.tsx`: ~836 lines (Timer screen)
- `app/(tabs)/profile.tsx`: ~964 lines
- `app/(tabs)/dashboard.tsx`: ~477 lines

**Action Items:**

**Timer Screen (`index.tsx`):**
1. Extract timer UI into `components/timer/TimerDisplay.tsx`
2. Extract timer controls into `components/timer/TimerControls.tsx`
3. Extract subject/task selection UI into separate components

**Profile Screen (`profile.tsx`):**
1. Extract profile stats into `components/profile/ProfileStats.tsx`
2. Extract profile settings into `components/profile/ProfileSettings.tsx`
3. Extract profile sections into separate components

**Dashboard Screen (`dashboard.tsx`):**
1. Extract charts into `components/dashboard/StudyChart.tsx`
2. Extract heatmap into `components/dashboard/Heatmap.tsx`
3. Extract stats cards into `components/dashboard/StatsCard.tsx`

**Expected Impact:**
- Improved maintainability
- Better code organization
- Easier testing
- Reusable components

---


## 🔧 Phase 4: Performance Optimizations

### 13. Fix Callback Dependencies in Hooks

**Issue:** Some hooks use state arrays in dependencies, causing unnecessary recreations

**Files to Check:**
- `hooks/useTasks.ts` - `handleDeleteTask` may depend on `tasks`
- `hooks/useSubjects.ts` - `handleCreateSubject` may depend on `subjects`

**Action Items:**
1. Audit hook callbacks for state dependencies
2. Use functional update pattern where appropriate:
   ```typescript
   // ❌ Before
   const handleDeleteTask = useCallback(async (taskId: string) => {
     setTasks(tasks.filter((t) => t.id !== taskId));
   }, [tasks]);
   
   // ✅ After
   const handleDeleteTask = useCallback(async (taskId: string) => {
     setTasks((prev) => prev.filter((t) => t.id !== taskId));
   }, []);
   ```

**Expected Impact:**
- Reduced unnecessary re-renders
- Better performance
- More stable callback references

---

### 14. Implement FlatList for Task Lists ✅

**Status:** ✅ **COMPLETE**

**File:** `app/(tabs)/tasks.tsx`

**Completed:**
- ✅ Replaced `.map()` with `FlatList` for task rendering
- ✅ Added `ItemSeparatorComponent` for consistent spacing (12px gap)
- ✅ Used `ListEmptyComponent` for empty state handling
- ✅ Set `scrollEnabled={false}` since it's nested in ScrollView
- ✅ Maintained all TaskCard props and functionality

**Impact:**
- ✅ Better performance with long lists through virtualization
- ✅ Consistent rendering engine with Timer screen (index.tsx)
- ✅ Standardized task rendering using TaskCard component

---

### 16. Add Query Caching Layer

**Current State:**
- Every navigation refetches data
- No request deduplication
- Multiple components might fetch same data simultaneously

**Action Items:**
1. Consider React Query or SWR for caching and deduplication
2. Or implement simple cache layer in hooks
3. Use Supabase real-time subscriptions more consistently (currently only `useGroups` uses it)

**Expected Impact:**
- Reduced API calls
- Faster navigation
- Better user experience
- Lower server load

---

## 🧹 Phase 5: Cleanup & Polish

### 17. Clean Up Temporary Screens

**File:** `app/(tabs)/color-palette.tsx`

**Current State:**
- Marked as "TEMPORARY" in `_layout.tsx` but still accessible in production

**Action Items:**
1. **Option A:** Remove `color-palette` screen entirely if no longer needed
2. **Option B:** Gate behind dev flag:
   ```typescript
   {__DEV__ && (
     <Tabs.Screen name="color-palette" ... />
   )}
   ```

**Expected Impact:**
- Production-ready codebase
- Removes development-only features

---

### 18. Extract Mock Data

**File:** `app/(tabs)/dashboard.tsx`

**Issue:** Mock data mixed with UI code

**Action Items:**
1. Move mock data to `constants/Mocks.ts` or fetch from `queries.ts`
2. Or remove mock data if real data is available

**Expected Impact:**
- Cleaner separation of concerns
- Easier to maintain

---

### 19. Organize Type Definitions

**Current State:**
- Types are mixed between files
- Some in `utils/queries.ts` (good for query-related types)
- Some inline in components
- Some in hook files

**Action Items:**
1. Create `types/` directory for shared types:
   ```
   types/
     index.ts
     profile.ts
     tasks.ts
     subjects.ts
     groups.ts
   ```
2. Move shared types to appropriate files
3. Keep component-specific types in components

**Expected Impact:**
- Better type organization
- Easier to find and maintain types
- Clearer dependencies

---

## 📊 Implementation Priority

### Immediate (This Week)
1. ✅ Remove redundant Header theme prop (5 files) - **COMPLETED**
2. ✅ Replace duplicate color logic in color-palette.tsx - **COMPLETED**
3. ✅ Verify hook callbacks - **VERIFIED (already correct)**
4. ✅ Implement FlatList in tasks.tsx - **COMPLETED**
5. ⏳ Verify timer screen migration completeness (~30 minutes)

### Short-term (This Month)
6. ✅ Eliminate direct Supabase calls (5 files, ~2-3 hours) - **COMPLETED**
7. ✅ Create ScreenContainer component (~2 hours) - **COMPLETED**
8. 📋 Extract large components (3 screens, ~1-2 days)

### Medium-term (Next Quarter)
9. 📋 Standardize typography usage (~1-2 days)
10. 🔧 Add query caching layer (~3-5 days)
11. 🧹 Clean up temporary screens (~15 minutes)
12. 🧹 Extract mock data (~30 minutes)
13. 🧹 Organize type definitions (~2-3 hours)

---

## 📈 Success Metrics

### Code Quality Improvements
- **Line Reduction:** Timer screen target ~400-500 lines after component extraction
- **Duplication Elimination:** Single source of truth for all utilities
- **Testability:** Business logic separated from UI, easier to unit test

### Maintainability Improvements
- **Consistency:** Shared utilities ensure consistent behavior
- **Flexibility:** Easy to add features (e.g., task caching, optimistic updates)
- **Onboarding:** New developers can understand codebase faster

### Performance Improvements
- **Reduced Re-renders:** Fixed callback dependencies
- **Better List Performance:** FlatList virtualization
- **Faster Navigation:** Query caching

---

## 🎯 Quick Reference Checklist

### ✅ Completed
- [x] Create `useTheme()` hook
- [x] Create `utils/color.ts` with color utilities
- [x] Create `utils/time.ts` with time utilities
- [x] Standardize style memoization pattern
- [x] Migrate groups screen to useGroups hook
- [x] Verify timer screen migration completeness
- [x] Remove redundant Header theme prop (5 files) - (all tab screens use Header without theme prop)
- [x] Replace duplicate color logic in color-palette.tsx - (uses getReadableTextColor from utils/color.ts)
- [x] Verify timer screen migration completeness - (uses formatTime from utils/time.ts via useTimer hook)
- [x] Eliminate direct Supabase calls in profile.tsx - (uses updateUserProfile and updateUserMetadata from queries.ts)
- [x] Eliminate direct Supabase calls in auth screens - (added getSession, exchangeCodeForSession, uploadAvatar to queries.ts)
- [x] Create ScreenContainer component - (standardized padding/gap, safe area handling, theme background)

### 📋 Medium Priority
- [ ] Extract timer UI components
- [ ] Extract profile components
- [ ] Standardize typography usage

### 🔧 Performance
- [ ] Fix callback dependencies in hooks
- [x] Implement FlatList in tasks.tsx
- [ ] Add query caching layer

### 🧹 Cleanup
- [ ] Clean up temporary screens
- [ ] Extract mock data
- [ ] Organize type definitions

---

## 📝 Notes

- The codebase is already fairly well-organized
- Most improvements are incremental refactoring
- No breaking changes expected
- These changes will make the codebase easier to maintain and extend
- Prioritize based on impact vs. effort

---

## 🔄 Document Maintenance

This document should be updated:
- After completing any item
- When new patterns or issues are discovered
- When priorities change
- Monthly review to track progress

**Last Review Date:** [Current Date]
**Next Review Date:** [Current Date + 1 month]
