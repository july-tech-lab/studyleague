# StudyLeague – App Specification for Recreation

This document describes StudyLeague for onboarding, recreation (e.g. Lovable), or general reference.

## Overview

StudyLeague is a study tracking and productivity app for students. It helps users:

- Focus and log study time with a timer
- Organize tasks and subjects
- See stats and compete on a leaderboard
- Join study groups and track streaks

## Tech Stack (Target)

- Framework: React Native with Expo (Expo Router for navigation)
- Backend: Supabase (PostgreSQL + auth + storage)
- i18n: English + French (i18next)
- Fonts: Inter
- Platform: iOS, Android, Web (with native modules on mobile)

## Core Features

### 1. Authentication

- Sign In: Email/password, optional Google/Apple OAuth
- Sign Up: Email/password, terms checkbox
- Post-signup: Email verification page if needed
- Fill profile: Display name, avatar (image picker), category selection
- Forgot password: Request reset email, reset password completion
- Auth flow: Sign in → app; Sign up → verify or fill-profile → app
- Account: Sign out, delete account

### 2. Focus / Timer (Main Tab)

- Large timer (HH:MM:SS)
- Subject picker:
  - Hierarchical subjects (parent + child, e.g. "Maths" → "Algèbre")
  - Color badges
  - Create new subject with optional parent
- Optional task selector for tasks with subjects
- Focus mode (mobile):
  - Permission to enable focus/blocking
  - iOS: pick apps to block (WhatsApp, Instagram, etc.)
  - Study time is recorded only when focus mode is on
  - Warning if focus mode is lost during session
- Start/Stop buttons
- On stop: session saved to backend, optional task update
- Bell icon (notification dot) in header
- Floating "+" for subjects; floating stop when running

### 3. Tasks / Planner (Tab)

- Add tasks with:
  - Title, subject (picker), planned minutes (optional)
- Tabs: Active / Done
- Task states: planned, in-progress, done
- Actions: Mark done, resume, delete
- Time shown as logged/planned min or logged min
- Optional scheduledFor (date)
- Subject color badges

### 4. Groups (Tab)

- "My groups" list
- "Public groups" list (search by code or name)
- Create group: name, description, visibility (public/private), optional password, optional admin approval
- Join group: by invite code, optional password, optional approval
- Badges: Public/Private, password required, admin approval

### 5. Leaderboard

- Accessed from Groups tab (Trophy icon)
- Periods: Week / Month / Year
- Rows: rank, username, total time
- Top 3 colors (gold/silver/bronze)
- Current user highlighted
- Pull-to-refresh

### 6. Stats / Dashboard (Tab)

- Weekly study time vs goal
- Subject distribution (% bars)
- Personal records (e.g. longest session, streak, top subject)
- Activity heatmap (e.g. 28 cells)
- Histogram by day with subject filter
- Period filter: Day / Week / Month

### 7. Profile (Tab)

- Display name edit
- Stats tab:
  - Total time (this month), streak, session count, leaderboard rank, average per session
  - Subject breakdown (parent/children and total time per subject)
- Subjects tab:
  - Hierarchical list with colors
  - Add subject (search/create), attach existing
  - Custom color per subject (palette)
  - Delete subject
- Settings tab:
  - Language: EN / FR
  - Theme: Light / Dark
  - Focus mode: status, grant permission, (iOS) select apps
  - Account: sign out, delete account

## Database Schema (Supabase)

### Core Tables

- profiles: id (PK, FK auth.users), username, avatar_url, xp_total, level, current_streak, longest_streak, weekly_goal_minutes, language_preference, theme_preference, is_public, show_in_leaderboard, created_at, updated_at
- subjects: id, name, owner_id, parent_subject_id, icon, color, is_active, deleted_at (soft delete)
- user_subjects: user_id, subject_id, is_hidden, display_order, custom_color (user hex override)
- study_sessions: id, user_id, subject_id, task_id, started_at, ended_at, notes, duration_seconds (generated)
- tasks: id, user_id, title, subject_id, planned_minutes, logged_seconds, status (planned|in-progress|done), scheduled_for, created_at, updated_at
- groups: id, name, description, visibility (public|private), invite_code, requires_admin_approval, join_password, has_password (generated), created_by, created_at
- group_members: id, group_id, user_id, role (group_admin|group_member), status (pending|approved), created_at
- daily_summaries: user_id, date (PK), total_seconds, streak_count, updated_at

### Views / Materialized Views

- **weekly_leaderboard**: from study_sessions (last 7 days); filter show_in_leaderboard
- **monthly_leaderboard**, **yearly_leaderboard**: from daily_summaries (30/365 days); filter show_in_leaderboard
- **session_overview**: per-user session_count, total_seconds, month_seconds, avg_seconds
- **session_subject_totals**: per-user rollups to parent subject (direct_seconds vs subtag_seconds); excludes deleted subjects

### RPC / Functions

- delete_current_user
- find_group_by_invite_code
- request_join_group
- increment_task_seconds (for task progress)
- create_group_with_creator (creates group + adds creator as admin in one tx; avoids RLS recursion)
- regenerate_invite_code (admin regenerates group invite code)

### Triggers & Automations

- **on_auth_user_created**: creates profile row when user signs up (handle_new_user)
- **update_profiles_timestamp**: auto-updates profiles.updated_at on change
- **handle_session_completed** (after insert on study_sessions):
  - Updates profiles: xp_total, level
  - Upserts daily_summaries (total_seconds by date)
  - Updates current_streak, longest_streak
- **study_sessions.duration_seconds**: generated column (ended_at - started_at)

### Storage (Supabase Storage)

- **avatars** bucket: profile photos, path `{userId}-{timestamp}.{ext}`

### Additional Details

- **profiles**: username constraint (char_length >= 3); is_public, show_in_leaderboard (privacy; leaderboards filter by show_in_leaderboard = true)
- **groups**: has_password is generated (true if join_password IS NOT NULL); invite_code unique, auto-generated
- **group_members**: status = 'pending' when requires_admin_approval; 'approved' when joined
- **leaderboards**: materialized views; need periodic REFRESH for weekly/monthly/yearly
- **session_overview**: regular view (session_count, total_seconds, month_seconds, avg_seconds per user)
- **session_subject_totals**: regular view; rolls up to parent subject (direct_seconds vs subtag_seconds)
- **RLS**: All tables use Row Level Security; policies vary (own data, public read, etc.)
- **Enums**: group_role (group_admin, group_member), group_visibility (public, private), membership_status (pending, approved)

### Optional Tables

- **subscriptions**: Stripe-ready (status, plan_id, price_id, period dates) — not used in core flow

## UI/UX

### Theme (Teal + Coral)

- Primary: #4AC9CC (teal)
- Primary dark: #1F8E92
- Secondary: #F28C8C (coral)
- Subject palette: blue, green, yellow, orange, pink, purple
- Light/dark mode

### Layout

- Tab bar: Focus, Tasks, Groups, Stats, Profile (Leaderboard via Groups)
- Tab bar icons in bubbles; haptic feedback on tap
- Shared header: title, optional right icon (e.g. Bell, Logout, Trophy)

### Components

- Button: variants (primary, secondary, outline, ghost, destructive), sizes (xs, sm, md, lg), shapes (pill), iconLeft/iconRight, loading
- Input: left/right icons, label, error state
- Modal: title, cancel/confirm actions, padding
- Card, ListCard, ListItem
- SubjectPicker: hierarchical, parentsOnly
- Tabs: pill-style tab switcher

### Typography

- Inter (400, 500, 600, 700, 800)
- Variants: h1, h2, subtitle, body, bodyStrong, caption, micro
- Tabular numbers for timer

## Onboarding

- Fill profile: Display name (≥3 chars), avatar (optional), category
- Categories: Primaire, Collège, Lycée, Classes Préparatoires, Université, Autres
- Each category has predefined subjects; they are attached on selection

## Focus Mode (Mobile Only)

- Custom native module FocusModule (Family Controls / Screen Time API)
- Methods: checkPermission, requestPermission, presentFamilyActivityPicker, setFocusMode, getSelectedApps
- iOS: requires selecting apps to block before starting timer
- Android: permission check
- Web: focus mode not available

## Localization (i18n)

- Languages: English (en), French (fr)
- Keys for auth, onboarding, timer, tasks, groups, leaderboard, dashboard, profile, common

## Routing 

- (auth)/signin, (auth)/signup, (auth)/fill-profile, (auth)/verify-email, (auth)/forgot-password, (auth)/reset-password-complete
- (tabs)/index (Focus), (tabs)/tasks, (tabs)/groups, (tabs)/leaderboard, (tabs)/dashboard, (tabs)/profile
- modal for modals
