// Shared Supabase-facing types (keep here; implementation lives in sibling modules).

export interface Profile {
  id: string;
  username: string;
  avatar_url: string;
  xp_total: number;
  level: number;
  current_streak: number;
  longest_streak: number;
  weekly_goal_minutes: number;
  is_public: boolean;
  show_in_leaderboard: boolean;
  language_preference?: string | null;
  theme_preference?: string | null;
  onboarding_completed?: boolean | null;
  academic_category?: string | null;
  academic_year_key?: string | null;
  specialty_keys?: string[] | null;
  language_keys?: string[] | null;
}

export interface Subject {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  bank_key?: string | null;
  owner_id: string | null;
  display_order?: number | null;
  custom_color?: string | null;
  is_hidden?: boolean;
}

export interface UserSubject {
  user_id: string;
  subject_id: string;
  is_hidden: boolean;
  created_at: string;
  display_order?: number | null;
  custom_color?: string | null;
}

export interface SubjectNode extends Subject {
  children: SubjectNode[];
}

export type LeaderboardPeriod = "week" | "month" | "year";

export interface LeaderboardEntry {
  userId: string;
  username: string;
  avatarUrl: string;
  level: number;
  totalSeconds: number;
}

export interface DailySummary {
  date: string;
  total_seconds: number;
  streak_count: number;
}

export interface SessionTotals {
  totalSeconds: number;
  monthSeconds: number;
  avgSeconds: number;
  count: number;
}

export interface SessionOverviewView {
  user_id: string;
  session_count: number;
  total_seconds: number;
  month_seconds: number;
  avg_seconds: number;
}

export interface SessionSubjectTotalsDbRow {
  user_id: string;
  subject_id: string;
  subject_name: string;
  total_seconds: number;
  direct_seconds: number;
  subtag_seconds: number;
}

export interface SubjectAggregate {
  subjectId: string;
  subjectName: string;
  totalSeconds: number;
  directSeconds: number;
  subtagSeconds: number;
}

export interface ProfileOverview {
  profile: Profile | null;
  subjects: Subject[];
  allSubjects: Subject[];
  hiddenSubjects: Subject[];
  subjectTotals: SubjectAggregate[];
  sessionTotals: SessionTotals;
  leaderboardRank: string | null;
}

export type TaskStatus = "planned" | "in-progress" | "done";

export interface Task {
  id: string;
  user_id?: string;
  title: string;
  subjectId?: string | null;
  subjectName?: string;
  scheduledFor?: string | null;
  plannedMinutes?: number | null;
  status: TaskStatus;
  loggedSeconds: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface SubjectWeeklyGoal {
  id: string;
  user_id: string;
  subject_id: string;
  day_of_week: number;
  minutes: number;
}

export interface WeeklySessionRow {
  subject_id: string;
  duration_seconds: number;
  ended_at: string;
}

export type GroupVisibility = "public" | "private";
export type GroupRole = "group_admin" | "group_member";
export type MembershipStatus = "pending" | "approved";

export interface Group {
  id: string;
  name: string;
  description: string | null;
  visibility: GroupVisibility;
  invite_code: string;
  requires_admin_approval: boolean;
  has_password: boolean;
  created_by: string;
  created_at: string;
  member_count?: number;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: GroupRole;
  status?: MembershipStatus;
  created_at: string;
}

export interface GroupMemberWithPresence {
  userId: string;
  username: string | null;
  avatarUrl: string | null;
  role: GroupRole;
  isStudying: boolean;
  studyingSince: string | null;
  /** Server heartbeat; used to treat presence as stale without clearing the row */
  presenceUpdatedAt: string | null;
}
