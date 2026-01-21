# Database Schema (from migrations)

High-level map of the schema created by the migrations in this folder. Order below follows migration chronology.

## Core entities
- `profiles` (PK `id` = `auth.users.id`): username, avatar, XP/level, streaks, weekly_goal_minutes, timestamps. RLS: public select; users update self. Trigger `handle_new_user` on `auth.users` insert; trigger `update_profiles_timestamp` before update.
- `subjects`: hierarchical catalog with optional owner, icon/color, `is_active`. RLS: public select; owners insert/delete. Seeded global subjects. Indexes on owner and parent.
- `user_subjects`: join for a user’s visible subjects (`is_hidden`). RLS: self-only select/insert/update/delete. Indexes on user and subject.
- `study_sessions`: user + subject (+ optional `task_id`), start/end, generated `duration_seconds`, notes, created_at. RLS: public select; users insert their own. Trigger `handle_session_completed` updates XP/level, daily summaries, and streaks.
- `daily_summaries`: per-user per-day totals/streak_count, public select. PK `(user_id, date)`; index on `(user_id, date)`.
- `subscriptions`: Stripe-ready status/plan/price/current period fields keyed to profile. RLS: user can read own row.
- `tasks`: per-user tasks with optional subject, planned_minutes, scheduled_for, logged_seconds, status (planned|in-progress|done), timestamps. Trigger `set_updated_at`. Indexes on user, subject, status. `study_sessions.task_id` FK added.

## Groups & collaboration
- Enums: `group_role` (`group_admin`, `group_member`); `group_visibility` (`public`, `private`); `membership_status` (`pending`, `approved`).
- `groups`: name, description, visibility, created_by (auth user), timestamps. RLS: read public or groups you belong to; insert requires created_by match; admins can update.
- `group_members`: membership with role, status, unique `(group_id, user_id)`, indexes on group/user. RLS currently simplified: auth-only select; insert self; delete self (later RPCs enforce business rules). Older recursive policies dropped/reset.
- Group invites/passwords: columns `requires_admin_approval`, `invite_code` (unique, default, regenerated), `join_password`, generated `has_password`. RPCs: `find_group_by_invite_code(text)`, `regenerate_invite_code(uuid)`, `request_join_group(uuid, text)` (handles approval/password and duplicate membership checks). Execution granted to `authenticated`.

## Analytics & views
- `weekly_leaderboard`: per-user 7-day duration, joins profiles to sessions.
- `session_overview`: per-user session_count, total_seconds, month_seconds, avg_seconds.
- `session_subject_totals`: per-user rollups to parent subject with direct vs subtag breakdowns.

## Automation & cleanup
- `handle_session_completed` trigger: on session insert → add XP, recompute level, upsert daily summary, update streaks.
- Account deletion: `delete_current_user()` definer, deletes sessions, tasks, user_subjects, profile, then `auth.delete_user`.

## RLS summary (enabled)
- Profiles, subjects, study_sessions, daily_summaries, subscriptions, user_subjects, groups, group_members all have RLS on. Tasks currently rely on app-side auth (no RLS defined).

## Seed data
- Global subjects inserted in `create_database.sql` (Programmation, Mathématiques, Physique, Anglais, Histoire).
- Invite codes backfilled/unique in `20251208_group_invites.sql`.

## Migration order (current folder)
1) `create_database.sql`
2) `create_user_subjects.sql`
3) `groups_functionality.sql`
4) `new_tasks.sql`
5) `20250228_subjects_cleanup.sql`
6) `20251208_group_invites.sql`
7) `20251209_delete_account.sql`
8) `20251209_fix_group_members_policies.sql`
9) `20251209_session_views`

## Noted issue to fix
- In `create_database.sql` the `subjects` table definition is missing a comma before `is_active` (after `created_at`). Add the comma or the migration will fail to run.

