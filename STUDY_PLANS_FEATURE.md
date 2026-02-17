# Study Plans Feature — Implementation Guide

## Overview

Study plans let users define **recurring study schedules** for subjects over long periods, e.g.:

- *"Study maths 2 hrs per week every Monday"*
- *"Except June–July"* (holiday exclusion)
- *"Until Sept 2027"* (end date)

This is distinct from **tasks** (one-off items like *"Study for test #3 in maths"*). Tasks have a single `scheduled_for` date; study plans are recurring rules.

---

## 1. Database Changes

### Migration

Run the migration:

```bash
# In Supabase SQL Editor, run:
migrations/20260217_study_plans.sql
```

### New Table: `study_plans`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `user_id` | uuid | FK → auth.users |
| `subject_id` | uuid | FK → subjects |
| `minutes_per_week` | integer | Total minutes per week (e.g. 120 = 2 hrs) |
| `days_of_week` | smallint[] | 0=Sun,1=Mon,…,6=Sat (e.g. `[1]` = Mondays) |
| `start_date` | date | When the plan starts |
| `end_date` | date | When it ends (nullable = no end) |
| `excluded_ranges` | jsonb | `[{"start":"2025-06-01","end":"2025-07-31"}]` |
| `is_active` | boolean | Can be paused |
| `created_at`, `updated_at` | timestamptz | |

### RPC: `study_plan_occurrences(user_id, from_date, to_date)`

Returns planned sessions in a date range:

| Column | Type | Description |
|--------|------|-------------|
| `planned_date` | date | Date of planned session |
| `subject_id` | uuid | Subject |
| `minutes` | integer | Minutes for that day |
| `plan_id` | uuid | Source plan |

---

## 2. App Changes

### A. Data layer (`utils/queries.ts`)

Add:

- Type `StudyPlan` (id, userId, subjectId, minutesPerWeek, daysOfWeek, startDate, endDate, excludedRanges, isActive)
- `fetchStudyPlans(userId)`
- `createStudyPlan(userId, payload)`
- `updateStudyPlan(planId, userId, payload)`
- `deleteStudyPlan(planId)`
- `fetchStudyPlanOccurrences(userId, fromDate, toDate)` (calls RPC)

### B. Hook (`hooks/useStudyPlans.ts`)

```ts
// useStudyPlans({ userId, autoLoad })
// Returns: plans, loading, createPlan, updatePlan, deletePlan, refetch
// Optionally: getOccurrences(from, to) for calendar/week view
```

### C. UI — Where to add

1. **Option A — New tab:** Add a "Plans" or "Schedule" tab for managing plans and viewing a calendar.
2. **Option B — Under Tasks:** Add a "Study Plans" section above or below the task list, with a list + add form.
3. **Option C — Separate screen:** e.g. `(tabs)/plans` or `modal/study-plans` reachable from Tasks or Profile.

### D. Plan form (create/edit)

- **Subject** — existing `SubjectPicker`
- **Minutes per week** — number input (e.g. 120)
- **Days of week** — multi-select (Mon, Tue, Wed, …)
- **Start date** — date picker (default: today)
- **End date** — optional date picker
- **Exclusions** — list of date ranges with add/remove (e.g. "June 1 – July 31")

### E. Plan list

- Show each plan: subject, `X hrs/week on Mon, Wed`, valid range, exclusions summary.
- Actions: Edit, Delete, Pause/Resume (`is_active`).

### F. Integration with Tasks / Calendar

Choose one or combine:

1. **Week view:** Use `study_plan_occurrences` for the current week and show suggested sessions (read‑only blocks or "Add as task").
2. **Generate tasks:** Button "Create tasks from plans for this week" that:
   - Calls `study_plan_occurrences`
   - Creates tasks for each occurrence with `title` like "Maths (planned)" and `scheduled_for`.
3. **Dashboard:** Compare plan goals vs actual study time per subject.

### G. i18n

Add keys for:

- `studyPlans.title`, `studyPlans.add`, `studyPlans.edit`, `studyPlans.delete`
- `studyPlans.form.minutesPerWeek`, `studyPlans.form.daysOfWeek`, `studyPlans.form.startDate`, `studyPlans.form.endDate`, `studyPlans.form.exclusions`
- Day names (or reuse existing)
- `studyPlans.perWeekOn`, `studyPlans.until`, `studyPlans.except`

---

## 3. Example: Your use case

**"Study maths 2 hrs per week every Monday, except June–July, until Sept 2027"**

- `subject_id` = Maths
- `minutes_per_week` = 120
- `days_of_week` = `[1]` (Monday)
- `start_date` = e.g. today
- `end_date` = `2027-09-30`
- `excluded_ranges` = `[{"start":"2025-06-01","end":"2025-07-31"},{"start":"2026-06-01","end":"2026-07-31"}]`

For multi‑year exclusions (every June–July), either:

- Add one range per year in `excluded_ranges`, or
- Extend the schema later with something like "exclude months 6–7 every year".

---

## 4. Suggested implementation order

1. Run `20260217_study_plans.sql`
2. Add queries + `useStudyPlans` hook
3. Add a simple Plans list screen (create, list, delete)
4. Add plan form (subject, minutes, days, dates, exclusions)
5. Integrate with Tasks (e.g. week view or "Create tasks from plans")
6. Add i18n and polish

---

## 5. Files to create/change

| File | Action |
|------|--------|
| `migrations/20260217_study_plans.sql` | ✅ Created |
| `utils/queries.ts` | Add StudyPlan types + CRUD + occurrences |
| `hooks/useStudyPlans.ts` | New |
| `app/(tabs)/plans.tsx` or similar | New screen |
| `components/StudyPlanForm.tsx` | New form component |
| `components/StudyPlanList.tsx` | New list component |
| `i18n/locales/en.json` | Add studyPlans keys |
| `i18n/locales/fr.json` | Add studyPlans keys |
| `app/(tabs)/_layout.tsx` | Add Plans tab (if new tab) |
