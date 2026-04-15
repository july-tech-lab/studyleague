# Database Migration Guide

## ⚠️ Important: Fixed Syntax Error

The `create_database.sql` file had a missing comma (line 47) — that fix should already be in your copy. If you forked an older version, verify before running.

## Where migrations live

| Location | Role |
|----------|------|
| **`migrations/`** (this folder) | Human-maintained SQL you run in order (source of truth for how the app schema was built). |
| **`supabase/migrations/`** | Supabase CLI migration history. If empty or stub-only, **`db push` / remote history won’t match** this folder until you add real files or pull from the linked project. |

## Refreshing `full_structure.sql`

`full_structure.sql` in the **repo root** is a **snapshot**, not a migration. Refresh it whenever you want the repo to reflect **what is currently on the linked Supabase project** (after you apply SQL in the dashboard or run migrations).

### Option A — Supabase CLI (recommended)

1. Install and log in: [Supabase CLI](https://supabase.com/docs/guides/cli).
2. From the **repository root** (`tymii/`), link the project if needed:
   ```bash
   supabase link --project-ref <your-project-ref>
   ```
3. Dump **schema only** (no table data). The CLI uses `pg_dump --schema-only` and filters internal Supabase schemas.

   **Full dump** (default: all dumpable app-related schemas except platform-internal ones — good for a “whole picture” file):

   ```bash
   supabase db dump --linked -f full_structure.sql
   ```

   **Public schema only** (smaller file, enough for most app/RLS reviews):

   ```bash
   supabase db dump --linked -f full_structure.sql -s public
   ```

4. Commit the updated `full_structure.sql` when you intend the repo to match that snapshot.

**Windows (PowerShell):** same commands; run them from the folder that contains `supabase/config.toml`.

### Option B — `pg_dump` + connection string

1. In Supabase Dashboard → **Project Settings → Database**, copy the **URI** (use the session pooler or direct connection as documented there).
2. Run from a machine with PostgreSQL client tools:

   ```bash
   pg_dump "postgresql://postgres.[ref]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres" --schema=public --schema-only --no-owner --no-privileges -f full_structure.sql
   ```

   Adjust host, port, user, and SSL options per the dashboard instructions. **Do not commit passwords**; use env vars or `.env` excluded from git.

### After refreshing

- Diff against the previous file in git to see what changed.
- If production and staging differ, dump **each** environment you care about (or document which project ref the file represents).

---

## Migration order (files that exist in `migrations/`)

Run these **in this order** on a **fresh** database. If the database already exists, only run from the first file that has **not** yet been applied (review each script first).

| Step | File | Notes |
|------|------|--------|
| 1 | `create_database.sql` | Core tables, triggers, seed data |
| 2 | `create_user_subjects.sql` | `user_subjects` join table |
| 3 | `20250116_set_default_display_order.sql` | Backfill `display_order` for existing rows (safe to skip on empty DB) |
| 4 | `groups_functionality.sql` | `groups`, `group_members` |
| 5 | `add_subject_Color` | **Misleading filename:** defines `create_group_with_creator` and related group RPCs — run after groups exist |
| 6 | `new_tasks.sql` | `tasks` + `study_sessions.task_id` |
| 7 | `20250228_subjects_cleanup.sql` | Subjects cleanup / `is_active`, policies |
| 8 | `20251208_group_invites.sql` | Invite codes, join flow columns |
| 9 | `20251209_delete_account.sql` | Account deletion RPC |
| 10 | `20251209_fix_group_members_policies.sql` | Group member RLS fixes |
| 11 | `20251209_session_views` | **No `.sql` extension** — `session_overview`, `session_subject_totals` |
| 12 | `20251210_leaderboard_views.sql` | Leaderboard matviews / indexes |
| 13 | `20251211_database_improvements.sql` | Triggers, RLS, indexes |
| 14 | `20251211_chatgpt_improvements.sql` | Column/security/enum tightening |
| 15 | `20251211_follow_up_improvements.sql` | Follow-up fixes |
| 16 | `20251211_final_improvements.sql` | Final Dec 11 batch |
| 17 | `20251211_polish_and_gotchas.sql` | Polish / edge cases |
| 18 | `20251212_fix_security_linter_issues.sql` | Security linter fixes |
| 19 | `20251212_fix_function_search_path_and_materialized_views.sql` | `search_path`, matviews |
| 20 | `20251212_fix_rls_performance_issues.sql` | RLS performance |
| 21 | `20251212_secure_materialized_views.sql` | Lock down matview access |
| 22 | `20251212_improve_rls_policies.sql` | More RLS |
| 23 | `20251212_fix_consistency_and_redundancy.sql` | Consistency |
| 24 | `20251212_add_soft_delete_to_subjects.sql` | Soft delete on subjects |
| 25 | `20251212_add_privacy_flags_to_profiles.sql` | Profile privacy flags |
| 26 | `20251212_create_tasks_rls_policies.sql` | Tasks RLS (initial) |
| 27 | `20251212_fix_tasks_update_exact_match.sql` | Tasks UPDATE policy refinement |
| 28 | `20251213_fix_group_creator_member_insert.sql` | Group creator membership insert |
| 29 | `20260115_add_language_theme_to_profiles.sql` | Language / theme on profiles |
| 30 | `20260217_subject_weekly_goals.sql` | **`subject_weekly_goals`** table + RLS |
| 31 | `20260414_sync_triggers_and_rpc.sql` | Sync **`handle_session_completed`**, **`handle_new_user`**, **`handle_task_completed_xp`** + **`on_task_completed_xp`**, and **`increment_task_seconds`** RPC with app + production |

### Older guide vs this folder

An earlier version of this document listed many **`20251212_*tasks*`** iterations (`create_soft_delete_task`, `diagnose_and_fix_tasks_rls`, `fix_tasks_update_policy_final`, etc.) and **`20260217_study_plans.sql`**. Those files are **not** in the repo today; the **Dec 12 tasks story** in production may correspond to **`20251212_create_tasks_rls_policies.sql`** + **`20251212_fix_tasks_update_exact_match.sql`** only, or to manual SQL in Supabase. **Trust the live database + a fresh `full_structure.sql` dump** when in doubt.

---

## How to determine which migrations to run

### Fresh / empty database

Run **all** steps **1 → 31** in order.

### Existing database

1. Compare live objects (tables, views, policies) to what each file does.
2. Start at the **first** migration that adds or changes something you do not have yet.
3. Read the file before running — not every script is fully idempotent.

### Quick checks (SQL editor)

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Example: weekly goals (step 30)
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'subject_weekly_goals'
);
```

---

## Running migrations

### Supabase Dashboard

1. Open **SQL Editor**.
2. Paste one file at a time, run, fix errors before continuing.

### Supabase CLI

From repo root (paths relative to root):

```bash
supabase db execute -f migrations/create_database.sql
```

Repeat for each file in order, or script a loop in your shell (stop on first error).

---

## ⚠️ Warnings

1. **Backup first** before bulk or production changes.
2. **Test on a branch project or staging** when possible.
3. **Read comments** inside each migration.
4. **Idempotency** varies — `IF NOT EXISTS` / `OR REPLACE` in some files, not all.
5. Keep **`MIGRATION_GUIDE.md`** in sync when you add or rename files under `migrations/`.

---

## Need help?

1. List tables/policies on the live project (queries above).
2. Re-dump **`full_structure.sql`** and diff in git.
3. See **`README.md`** in this folder for a narrative schema overview (may lag behind migrations — prefer this guide for order).
