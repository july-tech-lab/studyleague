# Database Migration Guide

## ⚠️ Important: Fixed Syntax Error
The `create_database.sql` file had a missing comma (line 47) - this has been fixed. Make sure you're using the corrected version.

## Migration Order

Run these migrations **in this exact order** if you're setting up a fresh database:

### Core Setup (Run First)
1. **`create_database.sql`** - Creates all core tables, triggers, and initial seed data
2. **`create_user_subjects.sql`** - Creates user_subjects join table
3. **`groups_functionality.sql`** - Adds groups and group_members tables
4. **`new_tasks.sql`** - Creates tasks table and links to study_sessions

### Cleanup & Fixes (Run After Core)
5. **`20250228_subjects_cleanup.sql`** - Adds is_active column and delete policy for subjects
6. **`20251208_group_invites.sql`** - Adds invite codes and join functionality
7. **`20251209_delete_account.sql`** - Adds account deletion function
8. **`20251209_fix_group_members_policies.sql`** - Fixes group members RLS policies
9. **`20251209_session_views`** - Creates session_overview and session_subject_totals views

### Leaderboard & Analytics
10. **`20251210_leaderboard_views.sql`** - Adds monthly leaderboard and optimized indexes

### Major Improvements (December 11)
11. **`20251211_database_improvements.sql`** - Major improvements to triggers, RLS, indexes
12. **`20251211_chatgpt_improvements.sql`** - Removes unused columns, tightens security, adds enums
13. **`20251211_follow_up_improvements.sql`** - Additional improvements and fixes
14. **`20251211_final_improvements.sql`** - Final round of improvements
15. **`20251211_polish_and_gotchas.sql`** - Polish and edge case fixes

### December 12 Fixes (Run in Order)
16. **`20251212_fix_security_linter_issues.sql`** - Security fixes
17. **`20251212_fix_function_search_path_and_materialized_views.sql`** - Function and view fixes
18. **`20251212_fix_rls_performance_issues.sql`** - RLS performance optimizations
19. **`20251212_secure_materialized_views.sql`** - Secures materialized views
20. **`20251212_improve_rls_policies.sql`** - Additional RLS improvements
21. **`20251212_fix_consistency_and_redundancy.sql`** - Consistency fixes
22. **`20251212_add_soft_delete_to_subjects.sql`** - Adds soft delete to subjects
23. **`20251212_add_privacy_flags_to_profiles.sql`** - Adds privacy flags
24. **`20251212_create_soft_delete_task_function.sql`** - Soft delete function for tasks
25. **`20251212_create_tasks_rls_policies.sql`** - Initial tasks RLS policies
26. **`20251212_diagnose_and_fix_tasks_rls.sql`** - Diagnoses and fixes tasks RLS
27. **`20251212_fix_tasks_update_bypass_select.sql`** - Tasks update policy fix
28. **`20251212_fix_tasks_update_exact_match.sql`** - Tasks update policy refinement
29. **`20251212_fix_tasks_update_match_subjects.sql`** - Tasks update policy with subjects
30. **`20251212_fix_tasks_soft_delete_rls_v2.sql`** - Soft delete RLS v2
31. **`20251212_fix_tasks_update_simple.sql`** - Simplified tasks update policy
32. **`20251212_verify_and_fix_tasks_update_policy.sql`** - Verification and final fix
33. **`20251212_fix_tasks_update_policy_final.sql`** - Final tasks update policy

## How to Determine Which Migrations to Run

### If you have a **FRESH/EMPTY database**:
Run all migrations in the order listed above (1-33).

### If you have an **EXISTING database**:
1. Check which tables/features already exist in your database
2. Start from the first migration that adds something you don't have yet
3. **Be careful**: Some migrations modify existing structures - review them first

### Quick Check Commands

Run these in your Supabase SQL editor to see what you have:

```sql
-- Check if core tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Check if tasks table exists (indicates you've run new_tasks.sql)
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'tasks'
);

-- Check if groups table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'groups'
);
```

## Running Migrations

### Option 1: Supabase Dashboard
1. Go to your Supabase project
2. Navigate to SQL Editor
3. Copy and paste each migration file content
4. Run them one by one in order

### Option 2: Command Line (if using Supabase CLI)
```bash
# Run a single migration
supabase db execute -f migrations/create_database.sql

# Or run all in order (if you have a script)
```

## ⚠️ Warnings

1. **Backup first**: Always backup your database before running migrations
2. **Test environment**: Test migrations in a development environment first
3. **Read the comments**: Many migrations have post-migration notes and verification steps
4. **Some migrations are idempotent**: They use `IF EXISTS` or `IF NOT EXISTS`, but not all
5. **December 12 migrations**: Many are iterative fixes to tasks RLS - you may only need the final one (`20251212_fix_tasks_update_policy_final.sql`)

## Need Help?

If you're unsure:
1. Check what tables/views/functions you currently have
2. Look at the migration file comments - they often explain what they do
3. Start with the core migrations (1-4) and work your way up
4. If you encounter errors, check if the prerequisite migration was run
