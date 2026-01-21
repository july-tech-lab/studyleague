# Database Review: Redundancy & Consistency Recommendations

## Executive Summary

After reviewing your database structure and recent migrations, I've identified several areas for improvement to eliminate redundancy and ensure consistency. The database is well-structured overall, but there are some inconsistencies in foreign key references and a few redundant elements.

---

## 1. Foreign Key Consistency Issues ⚠️ **HIGH PRIORITY**

### Problem
You have inconsistent foreign key references for user IDs:
- Some tables reference `auth.users(id)` directly
- Others reference `public.profiles(id)` (which references `auth.users(id)`)

### Inconsistent Tables
1. **`tasks.user_id`** → Currently references `auth.users(id)`
2. **`group_members.user_id`** → Currently references `auth.users(id)`
3. **`groups.created_by`** → Currently references `auth.users(id)`

### Recommendation
**Standardize on `public.profiles(id)`** for all user references in the public schema because:
- `profiles` is your main user table with business logic
- It provides a consistent abstraction layer
- It's already used by most tables (`study_sessions`, `daily_summaries`, `subscriptions`, `user_subjects`, `subjects.owner_id`)
- Easier to maintain and query

### Migration Needed
```sql
-- Fix tasks.user_id
ALTER TABLE public.tasks
  DROP CONSTRAINT tasks_user_id_fkey,
  ADD CONSTRAINT tasks_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Fix group_members.user_id
ALTER TABLE public.group_members
  DROP CONSTRAINT group_members_user_id_fkey,
  ADD CONSTRAINT group_members_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Fix groups.created_by
ALTER TABLE public.groups
  DROP CONSTRAINT groups_created_by_fkey,
  ADD CONSTRAINT groups_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE CASCADE;
```

---

## 2. Missing NOT NULL Constraints

### Issue: `groups.created_by` allows NULL
A group must have a creator, but the column allows NULL.

### Recommendation
```sql
ALTER TABLE public.groups
  ALTER COLUMN created_by SET NOT NULL;
```

**Note:** `subjects.owner_id` is correctly nullable (NULL = global subject).

---

## 3. Redundant/Unused Columns

### Issue: `daily_summaries.session_count`
- Has a default value of `1`
- Never updated by `handle_session_completed()` trigger
- Appears unused in the codebase

### Recommendation
**Option A:** Remove if truly unused
```sql
ALTER TABLE public.daily_summaries
  DROP COLUMN session_count;
```

**Option B:** Keep and maintain it properly
```sql
-- Update handle_session_completed() to increment session_count
-- This would require modifying the trigger function
```

**Recommendation:** Remove it unless you have a specific use case. The count can be derived from `study_sessions` if needed.

---

## 4. Function Naming Consistency

### Issue
You have two similar functions with different names:
- `set_updated_at()` - used by `tasks`, `groups`, `subjects`
- `update_profile_timestamp()` - used by `profiles`

### Recommendation
**Option A:** Rename `update_profile_timestamp()` to `set_updated_at()` for consistency
```sql
-- Rename the function
ALTER FUNCTION public.update_profile_timestamp() 
  RENAME TO set_updated_at;

-- Update the trigger
DROP TRIGGER IF EXISTS update_profiles_timestamp ON public.profiles;
CREATE TRIGGER update_profiles_timestamp
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
```

**Option B:** Keep both if they have different logic (but they appear identical)

**Recommendation:** Option A - use a single function name for consistency.

---

## 5. Index Optimization

### Potential Redundancy
You have multiple indexes on similar columns. Review these:

1. **`tasks` table:**
   - `idx_tasks_user` on `(user_id)`
   - `idx_tasks_status_filter` on `(user_id, status)`
   - `idx_tasks_user_status_date` on `(user_id, status, scheduled_for)` WHERE `scheduled_for IS NOT NULL`
   - `idx_tasks_deleted_at` on `(user_id, deleted_at)` WHERE `deleted_at IS NULL`
   
   **Analysis:** These are mostly fine as they serve different query patterns, but `idx_tasks_user` might be redundant if you always filter by status.

2. **`study_sessions` table:**
   - `idx_study_sessions_user_date` on `(user_id, started_at DESC)`
   - `idx_study_sessions_date_range` on `(ended_at DESC, user_id)` WHERE `ended_at IS NOT NULL`
   - `idx_study_sessions_started_at` on `(started_at DESC)`
   
   **Analysis:** `idx_study_sessions_started_at` might be redundant if you always filter by `user_id`.

### Recommendation
Monitor query patterns and remove indexes that aren't being used. PostgreSQL's `pg_stat_user_indexes` can help identify unused indexes.

---

## 6. Constraint Naming Consistency

### Current State
Your constraints use mixed naming:
- Some: `check_*` (e.g., `check_duration_reasonable`)
- Some: `*_check` (e.g., `tasks_logged_seconds_check`)
- Some: descriptive names (e.g., `check_invite_code_format`)

### Recommendation
Standardize on `check_*` pattern for all CHECK constraints:
```sql
-- Example: Rename if desired (optional, low priority)
ALTER TABLE public.tasks
  RENAME CONSTRAINT tasks_logged_seconds_check TO check_tasks_logged_seconds;
```

**Note:** This is low priority - consistency is nice but not critical.

---

## 7. Materialized View Refresh Strategy

### Current State
You have materialized views for leaderboards but no automatic refresh mechanism visible.

### Recommendation
Consider adding a scheduled job (using `pg_cron` if available) to refresh these:
```sql
-- Example (if pg_cron is enabled)
SELECT cron.schedule(
  'refresh-leaderboards',
  '0 * * * *', -- Every hour
  $$SELECT public.refresh_leaderboards()$$
);
```

---

## 8. Soft Delete Pattern Consistency

### Current State
- `tasks` has `deleted_at` for soft deletes
- Other tables use hard deletes

### Recommendation
**If you want soft deletes everywhere:**
- Add `deleted_at` to other tables that might need it (e.g., `subjects`, `groups`)
- Update RLS policies to filter `deleted_at IS NULL`

**If you want hard deletes everywhere:**
- Remove `deleted_at` from `tasks` and use the DELETE policy you already have

**Recommendation:** Keep soft deletes only where you need audit trails or recovery. For most tables, hard deletes are fine.

---

## 9. RLS Policy Consistency

### Good News ✅
Your recent migrations have standardized RLS policies to use `(select auth.uid())` for performance, which is excellent!

### Minor Observation
All policies are consistent now, but ensure all tables that need RLS have it enabled:
- ✅ `profiles` - RLS enabled
- ✅ `subjects` - RLS enabled
- ✅ `study_sessions` - RLS enabled
- ✅ `tasks` - RLS enabled (with FORCE)
- ✅ `groups` - RLS enabled
- ✅ `group_members` - RLS enabled
- ✅ `daily_summaries` - RLS enabled
- ✅ `subscriptions` - RLS enabled
- ✅ `user_subjects` - RLS enabled

**Status:** All good! ✅

---

## 10. Summary of Recommended Actions

### High Priority (Do First)
1. ✅ **Fix foreign key consistency** - Change `tasks.user_id`, `group_members.user_id`, and `groups.created_by` to reference `profiles(id)`
2. ✅ **Add NOT NULL to `groups.created_by`**

### Medium Priority
3. ⚠️ **Remove or maintain `daily_summaries.session_count`** - Decide if you need it
4. ⚠️ **Standardize function naming** - Rename `update_profile_timestamp()` to `set_updated_at()`

### Low Priority (Nice to Have)
5. 📝 **Review and optimize indexes** - Remove unused ones
6. 📝 **Standardize constraint naming** - Optional consistency improvement
7. 📝 **Add materialized view refresh schedule** - If you want automatic updates

---

## Migration Script

I can create a migration file with all the high and medium priority fixes. Would you like me to create it?

