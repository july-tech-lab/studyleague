# Database Review & Improvement Recommendations

## Executive Summary

This is a comprehensive review of your StudyLeague database structure. Overall, the database is well-structured with good use of PostgreSQL features like RLS, triggers, and views. However, there are several areas for improvement in terms of performance, data integrity, and maintainability.

---

## 1. Schema Design & Normalization

### ✅ Strengths
- Good separation of concerns with clear table boundaries
- Proper use of UUIDs for primary keys
- Well-defined relationships between entities

### ⚠️ Issues & Recommendations

#### 1.1 Missing Foreign Key Constraints
**Issue**: Some relationships lack explicit foreign key constraints:
- `tasks.user_id` references `auth.users(id)` but should also consider `profiles(id)` for consistency
- `study_sessions.user_id` references `profiles(id)` while `tasks.user_id` references `auth.users(id)` - inconsistent pattern

**Recommendation**: Standardize on referencing `profiles(id)` for all user-related foreign keys in the public schema, since `profiles` is the main user table.

#### 1.2 Missing NOT NULL Constraints
**Issue**: Several important columns allow NULL when they shouldn't:
- `groups.created_by` - should be NOT NULL (a group must have a creator)
- `study_sessions.subject_id` - consider if this should be NOT NULL
- `tasks.subject_id` - consider if this should be NOT NULL
- `subjects.owner_id` - should be NOT NULL (subjects must have an owner)

**Recommendation**: Add NOT NULL constraints where business logic requires them.

#### 1.3 Redundant Data in `daily_summaries`
**Issue**: The `streak_count` column in `daily_summaries` appears unused. Streak logic is handled in `handle_session_completed()` trigger which updates `profiles.current_streak` directly.

**Recommendation**: Either remove `streak_count` from `daily_summaries` or use it consistently. If keeping it, update the trigger to maintain it.

---

## 2. Indexing & Performance

### ✅ Strengths
- Good covering index on `daily_summaries` for leaderboard queries
- Appropriate indexes on foreign keys
- Unique index on `groups.invite_code`

### ⚠️ Issues & Recommendations

#### 2.1 Missing Composite Indexes
**Issue**: Several common query patterns may not be optimally indexed:

1. **Study Sessions Queries**:
   ```sql
   -- Missing: Composite index for user + date range queries
   CREATE INDEX idx_study_sessions_user_date 
     ON study_sessions(user_id, started_at DESC);
   ```

2. **Tasks Queries**:
   ```sql
   -- Missing: Composite index for user + status + date queries
   CREATE INDEX idx_tasks_user_status_date 
     ON tasks(user_id, status, scheduled_for);
   ```

3. **Group Members Queries**:
   ```sql
   -- Missing: Index for status filtering
   CREATE INDEX idx_group_members_status 
     ON group_members(group_id, status) 
     WHERE status = 'pending';
   ```

#### 2.2 Leaderboard View Performance
**Issue**: The leaderboard views (`weekly_leaderboard`, `monthly_leaderboard`, `yearly_leaderboard`) are computed on every query, which can be expensive.

**Recommendation**: Consider materialized views with refresh strategies:
```sql
CREATE MATERIALIZED VIEW monthly_leaderboard_mv AS
SELECT ... -- same query as current view
WITH NO DATA;

-- Refresh strategy (via pg_cron or application logic)
REFRESH MATERIALIZED VIEW CONCURRENTLY monthly_leaderboard_mv;
```

#### 2.3 Missing Index on `study_sessions.started_at`
**Issue**: The `weekly_leaderboard` view filters by `ended_at >= CURRENT_DATE - 7`, but there's no index on `started_at` for date range queries.

**Recommendation**: Add index:
```sql
CREATE INDEX idx_study_sessions_started_at 
  ON study_sessions(started_at DESC);
```

#### 2.4 Partial Index for Active Subjects
**Issue**: The `subjects` table has `is_active` but no index for filtering active subjects.

**Recommendation**: Add partial index:
```sql
CREATE INDEX idx_subjects_active 
  ON subjects(owner_id, is_active) 
  WHERE is_active = true;
```

---

## 3. Data Integrity & Constraints

### ⚠️ Issues & Recommendations

#### 3.1 Missing CHECK Constraints
**Issue**: Several columns lack validation constraints:

1. **Study Sessions**:
   ```sql
   -- Ensure ended_at is after started_at
   ALTER TABLE study_sessions 
     ADD CONSTRAINT check_session_duration 
     CHECK (ended_at > started_at);
   
   -- Ensure duration is reasonable (e.g., max 24 hours)
   ALTER TABLE study_sessions 
     ADD CONSTRAINT check_duration_reasonable 
     CHECK (duration_seconds > 0 AND duration_seconds <= 86400);
   ```

2. **Tasks**:
   ```sql
   -- Ensure logged_seconds doesn't exceed planned_minutes * 60
   ALTER TABLE tasks 
     ADD CONSTRAINT check_logged_vs_planned 
     CHECK (planned_minutes IS NULL OR logged_seconds <= (planned_minutes * 60));
   ```

3. **Groups**:
   ```sql
   -- Ensure invite_code format (if you want to enforce it)
   ALTER TABLE groups 
     ADD CONSTRAINT check_invite_code_format 
     CHECK (char_length(invite_code) >= 4);
   ```

#### 3.2 Missing UNIQUE Constraints
**Issue**: 
- `subjects.name` + `subjects.owner_id` should probably be unique (users shouldn't have duplicate subject names)
- `groups.invite_code` already has unique index, but consider making it a constraint

**Recommendation**: Add unique constraints where business logic requires uniqueness.

#### 3.3 Date Validation
**Issue**: No validation that `tasks.scheduled_for` is not in the past (if that's a requirement).

**Recommendation**: Add trigger or check constraint if needed.

---

## 4. Security & RLS Policies

### ✅ Strengths
- Comprehensive RLS policies
- Good use of `auth.uid()` for user context
- Public read access appropriately configured for leaderboards

### ⚠️ Issues & Recommendations

#### 4.1 Missing RLS Policies
**Issue**: Some tables may need additional policies:

1. **Tasks Table**: No RLS policies found - users can read/update all tasks
   ```sql
   -- Users should only see their own tasks
   CREATE POLICY "Users can read own tasks" 
     ON tasks FOR SELECT 
     USING (auth.uid() = user_id);
   
   CREATE POLICY "Users can update own tasks" 
     ON tasks FOR UPDATE 
     USING (auth.uid() = user_id);
   
   CREATE POLICY "Users can delete own tasks" 
     ON tasks FOR DELETE 
     USING (auth.uid() = user_id);
   ```

2. **Study Sessions**: Public read access may be too permissive
   ```sql
   -- Consider restricting to own sessions or group members
   CREATE POLICY "Users can read own sessions" 
     ON study_sessions FOR SELECT 
     USING (auth.uid() = user_id);
   ```

3. **Subjects**: Public read may be fine, but consider if users should see all subjects or only their own + public ones.

#### 4.2 Group Membership Status
**Issue**: The `group_members` table has a `status` field, but policies don't filter by it. Users with `pending` status might see data they shouldn't.

**Recommendation**: Update policies to check status:
```sql
-- Only approved members can see group data
CREATE POLICY "Approved members can read groups" 
  ON groups FOR SELECT 
  USING (
    visibility = 'public' OR 
    EXISTS (
      SELECT 1 FROM group_members gm 
      WHERE gm.group_id = groups.id 
        AND gm.user_id = auth.uid() 
        AND gm.status = 'approved'
    )
  );
```

---

## 5. Triggers & Functions

### ✅ Strengths
- Good use of triggers for automatic updates
- `handle_session_completed()` properly updates XP and streaks

### ⚠️ Issues & Recommendations

#### 5.1 Race Condition in Streak Calculation
**Issue**: In `handle_session_completed()`, the streak calculation has a potential race condition:
```sql
select date into last_day
from public.daily_summaries
where user_id = new.user_id
order by date desc
limit 1 offset 1;
```

If multiple sessions complete simultaneously, this could calculate streaks incorrectly.

**Recommendation**: Use a more robust approach:
```sql
-- Use LOCK or better yet, calculate streak from daily_summaries directly
-- Consider using a function that recalculates streak from scratch
```

#### 5.2 Level Calculation Bug
**Issue**: In `handle_session_completed()`, the level calculation uses `xp_total` before it's updated:
```sql
level = 1 + floor((xp_total + new.duration_seconds) / 3600)
```

This should work, but it's clearer to use the updated value.

**Recommendation**: Consider recalculating level from `xp_total` after update, or use a generated column.

#### 5.3 Missing Trigger for Tasks
**Issue**: When a study session is linked to a task (`task_id`), the `tasks.logged_seconds` should be updated.

**Recommendation**: Add trigger or update `handle_session_completed()`:
```sql
-- In handle_session_completed()
IF new.task_id IS NOT NULL THEN
  UPDATE tasks 
  SET logged_seconds = logged_seconds + new.duration_seconds,
      updated_at = now()
  WHERE id = new.task_id;
END IF;
```

#### 5.4 Missing Validation in `request_join_group`
**Issue**: The function doesn't validate that the user isn't already a member (it checks, but the error handling could be clearer).

**Recommendation**: Already handled, but consider returning more descriptive error messages.

---

## 6. Views & Materialized Views

### ⚠️ Issues & Recommendations

#### 6.1 View Performance
**Issue**: All leaderboard views are regular views that recalculate on every query.

**Recommendation**: 
- For high-traffic leaderboards, use materialized views
- Consider partitioning `daily_summaries` by date for better performance
- Add indexes specifically for leaderboard queries

#### 6.2 Missing View for User Statistics
**Recommendation**: Create a view for common user statistics:
```sql
CREATE VIEW user_statistics AS
SELECT 
  p.id as user_id,
  p.username,
  p.level,
  p.current_streak,
  p.longest_streak,
  p.xp_total,
  COUNT(DISTINCT ss.id) as total_sessions,
  COUNT(DISTINCT ss.subject_id) as subjects_studied,
  SUM(ss.duration_seconds) as total_study_seconds
FROM profiles p
LEFT JOIN study_sessions ss ON ss.user_id = p.id
GROUP BY p.id, p.username, p.level, p.current_streak, p.longest_streak, p.xp_total;
```

---

## 7. Data Types & Constraints

### ⚠️ Issues & Recommendations

#### 7.1 Text Fields Without Length Limits
**Issue**: Many text fields (`username`, `name`, `description`, `notes`) have no maximum length, which could lead to:
- Performance issues
- Storage bloat
- UI/UX issues

**Recommendation**: Add length constraints:
```sql
ALTER TABLE profiles 
  ALTER COLUMN username TYPE varchar(50);
  
ALTER TABLE groups 
  ALTER COLUMN name TYPE varchar(100),
  ALTER COLUMN description TYPE text; -- text is fine for descriptions

ALTER TABLE subjects 
  ALTER COLUMN name TYPE varchar(100);
```

#### 7.2 Integer Types
**Issue**: 
- `duration_seconds` uses `integer` (max ~2.1 billion seconds = ~68 years) - probably fine
- `xp_total` uses `bigint` - good for future growth
- `weekly_goal_minutes` uses `integer` - consider if this should have a max value

**Recommendation**: Add check constraints for reasonable ranges:
```sql
ALTER TABLE profiles 
  ADD CONSTRAINT check_weekly_goal 
  CHECK (weekly_goal_minutes >= 0 AND weekly_goal_minutes <= 10080); -- max: minutes in a week
```

#### 7.3 Timestamp Consistency
**Issue**: Mix of `timestamp with time zone` and `timestamp without time zone` in some Supabase tables.

**Recommendation**: Standardize on `timestamp with time zone` (timestamptz) for all user-facing timestamps.

---

## 8. Foreign Keys & Relationships

### ⚠️ Issues & Recommendations

#### 8.1 Cascade Behavior
**Issue**: Review CASCADE behavior:
- `study_sessions.subject_id` has no CASCADE - if subject is deleted, sessions become orphaned
- `tasks.subject_id` has `ON DELETE SET NULL` - good
- `study_sessions.task_id` has `ON DELETE SET NULL` - good

**Recommendation**: Consider if `study_sessions.subject_id` should also have `ON DELETE SET NULL` instead of no action.

#### 8.2 Missing Foreign Key Indexes
**Issue**: Some foreign keys may not have indexes (PostgreSQL doesn't auto-index FKs).

**Recommendation**: Verify all foreign keys have indexes (most appear to have them already).

---

## 9. General Best Practices

### ⚠️ Recommendations

#### 9.1 Audit Trail
**Issue**: No audit trail for important changes (group updates, subject deletions, etc.).

**Recommendation**: Consider adding audit tables or using triggers to log changes:
```sql
CREATE TABLE audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  action text NOT NULL, -- INSERT, UPDATE, DELETE
  old_data jsonb,
  new_data jsonb,
  user_id uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);
```

#### 9.2 Soft Deletes
**Issue**: No soft delete pattern - deletions are permanent.

**Recommendation**: Consider adding `deleted_at` columns for important entities (groups, subjects) if you want to allow recovery.

#### 9.3 Database Comments
**Issue**: Missing documentation in the database itself.

**Recommendation**: Add comments to tables and columns:
```sql
COMMENT ON TABLE study_sessions IS 'Tracks individual study sessions with start/end times';
COMMENT ON COLUMN study_sessions.duration_seconds IS 'Calculated duration in seconds (generated column)';
```

#### 9.4 Connection Pooling
**Issue**: No mention of connection pooling configuration.

**Recommendation**: Ensure proper connection pooling (Supabase handles this, but verify settings).

#### 9.5 Backup Strategy
**Issue**: No visible backup/restore strategy in schema.

**Recommendation**: Ensure regular backups are configured (Supabase provides this, but verify retention policies).

---

## 10. Specific Table Improvements

### 10.1 `groups` Table
- Add `updated_at` timestamp
- Consider adding `member_count` cached field (or use a view)
- Add index on `created_by` for user's groups queries

### 10.2 `tasks` Table
- Add RLS policies (critical security issue)
- Consider adding `completed_at` timestamp
- Add index on `(user_id, status, scheduled_for)` for common queries

### 10.3 `study_sessions` Table
- Consider adding `is_active` boolean for sessions in progress
- Add validation that `ended_at` is not in the future
- Consider partitioning by date for large datasets

### 10.4 `subjects` Table
- Add `updated_at` timestamp
- Consider adding `usage_count` or similar metric
- Add unique constraint on `(name, owner_id)` if subjects should be unique per user

### 10.5 `daily_summaries` Table
- Remove unused `streak_count` or implement it properly
- Consider adding `session_count` for daily statistics
- Add index on `(date DESC, user_id)` for leaderboard queries

---

## Priority Recommendations

### 🔴 High Priority (Security & Data Integrity)
1. **Add RLS policies for `tasks` table** - Currently all tasks are readable by everyone
2. **Add NOT NULL constraints** on critical fields (`groups.created_by`, `subjects.owner_id`)
3. **Add CHECK constraints** for data validation (session duration, dates, etc.)
4. **Fix group membership status filtering** in RLS policies

### 🟡 Medium Priority (Performance)
1. **Add composite indexes** for common query patterns
2. **Consider materialized views** for leaderboards
3. **Add missing indexes** on date columns used in WHERE clauses
4. **Optimize streak calculation** to avoid race conditions

### 🟢 Low Priority (Maintainability)
1. **Add database comments** for documentation
2. **Standardize text field lengths**
3. **Add audit trail** for important changes
4. **Consider soft deletes** for critical entities

---

## Conclusion

Your database structure is solid with good use of PostgreSQL features. The main areas for improvement are:
1. **Security**: Missing RLS policies on tasks table
2. **Performance**: Additional indexes and materialized views
3. **Data Integrity**: More constraints and validations
4. **Maintainability**: Better documentation and consistency

Most of these improvements can be implemented incrementally without breaking existing functionality.

