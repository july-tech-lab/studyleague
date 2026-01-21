import { supabase } from "./supabase";

// Shared query types
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
  language_preference?: string | null; // 'en' | 'fr' | null
  theme_preference?: string | null; // 'light' | 'dark' | null
}

export interface Subject {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  parent_subject_id?: string | null;
  owner_id: string | null; // null = Global, string = Custom
  // User-specific customization (from user_subjects)
  display_order?: number | null;
  custom_color?: string | null;
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

// Aggregated views (Supabase)
export interface SessionOverviewView {
  user_id: string;
  session_count: number;
  total_seconds: number;
  month_seconds: number;
  avg_seconds: number;
}

export interface SubjectTotalView {
  user_id: string;
  parent_id: string;
  parent_name: string;
  total_seconds: number;
  direct_seconds: number;
  subtag_seconds: number;
}

export interface SubjectAggregate {
  parentId: string;
  parentName: string;
  totalSeconds: number;
  directSeconds: number;
  subtagSeconds: number;
}

export interface ProfileOverview {
  profile: Profile | null;
  subjects: Subject[];
  allSubjects: Subject[];
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

// SUBJECT QUERIES
// Fetches/maintains the subject catalog (global + custom) and the user's
// visibility list. Also includes helpers for CRUD and tree-building.
export const fetchSubjects = async (userId?: string | null) => {
  let query = supabase
    .from("subjects")
    .select("*")
    .eq("is_active", true)
    .is("deleted_at", null) // Filter out soft-deleted subjects
    .order("name", { ascending: true });

  query = userId
    ? query.or(`owner_id.is.null,owner_id.eq.${userId}`)
    : query.is("owner_id", null);

  const { data, error } = await query;

  if (error) throw error;
  return data as Subject[];
};

export const fetchUserSubjects = async (userId: string) => {
  const { data, error } = await supabase
    .from("user_subjects")
    .select(
      `
      subject_id,
      display_order,
      custom_color,
      subjects (*)
    `
    )
    .eq("user_id", userId)
    .eq("is_hidden", false)
    .is("subjects.deleted_at", null) // Filter out soft-deleted subjects
    .order("display_order", { ascending: true, nullsFirst: false })
    .order("subjects(name)", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    ...(row.subjects as Subject),
    display_order: row.display_order,
    custom_color: row.custom_color,
  })) as Subject[];
};

export const upsertUserSubject = async (userId: string, subjectId: string) => {
  const { error } = await supabase
    .from("user_subjects")
    .upsert(
      { user_id: userId, subject_id: subjectId, is_hidden: false },
      { onConflict: "user_id,subject_id" }
    );

  if (error) throw error;
};

export const attachSubjectToUser = async (userId: string, subjectId: string) => {
  await upsertUserSubject(userId, subjectId);
};

export const hideUserSubject = async (userId: string, subjectId: string) => {
  const { error } = await supabase
    .from("user_subjects")
    .update({ is_hidden: true })
    .eq("user_id", userId)
    .eq("subject_id", subjectId);

  if (error) throw error;
};

export const updateUserSubjectColor = async (
  userId: string,
  subjectId: string,
  customColor: string | null
) => {
  const { error } = await supabase
    .from("user_subjects")
    .update({ custom_color: customColor })
    .eq("user_id", userId)
    .eq("subject_id", subjectId);

  if (error) throw error;
};

export const updateUserSubjectOrder = async (
  userId: string,
  subjectId: string,
  displayOrder: number | null
) => {
  const { error } = await supabase
    .from("user_subjects")
    .update({ display_order: displayOrder })
    .eq("user_id", userId)
    .eq("subject_id", subjectId);

  if (error) throw error;
};

export const updateUserSubjectCustomization = async (
  userId: string,
  subjectId: string,
  updates: { custom_color?: string | null; display_order?: number | null }
) => {
  const { error } = await supabase
    .from("user_subjects")
    .update(updates)
    .eq("user_id", userId)
    .eq("subject_id", subjectId);

  if (error) throw error;
};

export const buildSubjectTree = (subjects: Subject[]): SubjectNode[] => {
  const byId = new Map<string, SubjectNode>();
  subjects.forEach((s) => {
    byId.set(s.id, { ...s, children: [] });
  });

  const roots: SubjectNode[] = [];

  byId.forEach((node) => {
    const parentId = node.parent_subject_id;
    if (parentId && byId.has(parentId)) {
      byId.get(parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
};

export const createSubject = async (
  userId: string,
  name: string,
  parentSubjectId?: string | null
) => {
  const { data, error } = await supabase
    .from("subjects")
    .insert({
      name,
      owner_id: userId,
      icon: "bookmark",
      color: "#9C27B0",
      parent_subject_id: parentSubjectId ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Subject;
};

export const createAndAttachSubject = async (
  userId: string,
  name: string,
  parentSubjectId?: string | null
) => {
  const created = await createSubject(userId, name, parentSubjectId);
  await upsertUserSubject(userId, created.id);
  return created;
};

export const deleteSubject = async (subjectId: string) => {
  // Soft delete: set deleted_at instead of actually deleting
  const { error } = await supabase
    .from("subjects")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", subjectId);

  if (error) throw error;
};

export const permanentlyDeleteSubject = async (subjectId: string, userId: string) => {
  // Permanently delete a user-owned subject (hard delete)
  // Only works if the subject is owned by the user and has no study sessions
  // First, check if there are any study sessions for this subject
  const { data: sessions, error: checkError } = await supabase
    .from("study_sessions")
    .select("id")
    .eq("subject_id", subjectId)
    .limit(1);

  if (checkError) throw checkError;

  // If there are study sessions, throw an error
  if (sessions && sessions.length > 0) {
    throw new Error("Cannot permanently delete subject with recorded study time. Use soft delete instead.");
  }

  // If no sessions, proceed with hard delete
  const { error } = await supabase
    .from("subjects")
    .delete()
    .eq("id", subjectId)
    .eq("owner_id", userId);

  if (error) throw error;
};

export const restoreSubject = async (subjectId: string) => {
  // Restore a soft-deleted subject
  const { error } = await supabase
    .from("subjects")
    .update({ deleted_at: null })
    .eq("id", subjectId);

  if (error) throw error;
};

// TASK QUERIES
// CRUD helpers for user tasks (planning, tracking progress).
const mapTaskRow = (row: any): Task => ({
  id: row.id,
  user_id: row.user_id,
  title: row.title,
  subjectId: row.subject_id ?? null,
  subjectName: undefined,
  scheduledFor: row.scheduled_for ?? null,
  plannedMinutes: row.planned_minutes ?? null,
  status: (row.status as TaskStatus) ?? "planned",
  loggedSeconds: row.logged_seconds ?? 0,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const fetchTasks = async (userId: string) => {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapTaskRow);
};

export const createTask = async (
  userId: string,
  payload: {
    title: string;
    subjectId: string;
    plannedMinutes: number | null;
    status?: TaskStatus;
    loggedSeconds?: number;
    scheduledFor?: string | null;
  }
) => {
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      user_id: userId,
      title: payload.title,
      subject_id: payload.subjectId,
      planned_minutes: payload.plannedMinutes,
      status: payload.status ?? "planned",
      logged_seconds: payload.loggedSeconds ?? 0,
      scheduled_for: payload.scheduledFor ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return mapTaskRow(data);
};

export const updateTask = async (
  taskId: string,
  userId: string,
  payload: Partial<{
    title: string;
    subjectId: string | null;
    plannedMinutes: number | null;
    status: TaskStatus;
    loggedSeconds: number;
    scheduledFor: string | null;
  }>
) => {
  const updates: Record<string, any> = {};

  if (payload.title !== undefined) updates.title = payload.title;
  if (payload.subjectId !== undefined) updates.subject_id = payload.subjectId;
  if (payload.plannedMinutes !== undefined)
    updates.planned_minutes = payload.plannedMinutes;
  if (payload.status !== undefined) updates.status = payload.status;
  if (payload.loggedSeconds !== undefined)
    updates.logged_seconds = payload.loggedSeconds;
  if (payload.scheduledFor !== undefined)
    updates.scheduled_for = payload.scheduledFor;

  if (Object.keys(updates).length === 0) return null;

  const { data, error } = await supabase
    .from("tasks")
    .update(updates)
    .eq("id", taskId)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw error;
  return mapTaskRow(data);
};

export const deleteTask = async (taskId: string) => {
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) throw error;
};

// SESSION QUERIES
// Logging, reading, and aggregating study sessions for totals/graphs/history.
export const logSession = async (
  userId: string,
  subjectId: string,
  startTime: Date,
  endTime: Date,
  options?: { notes?: string; taskId?: string | null }
) => {
  const { data, error } = await supabase
    .from("study_sessions")
    .insert({
      user_id: userId,
      subject_id: subjectId,
      task_id: options?.taskId ?? null,
      started_at: startTime.toISOString(),
      ended_at: endTime.toISOString(),
      notes: options?.notes ?? "",
    })
    .select()
    .single();

  if (error) throw error;

  // If a task is linked, accumulate time into logged_seconds and mark in-progress
  if (options?.taskId) {
    const durationSeconds = Math.max(0, Math.floor((endTime.getTime() - startTime.getTime()) / 1000));

    // Preferred path: Postgres RPC that increments safely
    const { error: taskError } = await supabase
      .rpc("increment_task_seconds", { task_id_input: options.taskId, seconds_to_add: durationSeconds })
      .select();

    // Fallback if RPC is missing: fetch current value then update
    if (taskError) {
      try {
        const { data: current } = await supabase
          .from("tasks")
          .select("logged_seconds")
          .eq("id", options.taskId)
          .eq("user_id", userId)
          .maybeSingle();

        const currentSeconds = current?.logged_seconds ?? 0;
        await supabase
          .from("tasks")
          .update({
            logged_seconds: currentSeconds + durationSeconds,
            status: "in-progress",
          })
          .eq("id", options.taskId)
          .eq("user_id", userId);
      } catch (err) {
        console.warn("Unable to update task progress", err);
      }
    }
  }

  return data;
};

//---------------------------------------------------------------
// PROFILE / LEADERBOARD QUERIES
// Profile record, daily summaries, leaderboard, and an orchestrated overview
// that gathers profile + subjects + sessions + leaderboard in one call.
//---------------------------------------------------------------
export const fetchLeaderboardByPeriod = async (
  period: LeaderboardPeriod
): Promise<LeaderboardEntry[]> => {
  const tableByPeriod: Record<LeaderboardPeriod, string> = {
    week: "weekly_leaderboard",
    month: "monthly_leaderboard",
    year: "yearly_leaderboard",
  };

  const columnByPeriod: Record<LeaderboardPeriod, string> = {
    week: "weekly_seconds",
    month: "total_seconds",
    year: "total_seconds",
  };

  const table = tableByPeriod[period];
  const totalColumn = columnByPeriod[period];

  const { data, error } = await supabase.from(table).select("*").limit(50);

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    userId: row.user_id,
    username: row.username ?? "Utilisateur",
    avatarUrl: row.avatar_url ?? "",
    level: row.level ?? 1,
    totalSeconds: row[totalColumn] ?? 0,
  }));
};

export const fetchLeaderboard = async () => {
  return fetchLeaderboardByPeriod("week");
};

export const fetchUserProfile = async (userId: string) => {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) throw error;
  return data as Profile;
};

export const updateUserProfile = async (
  userId: string,
  updates: { 
    username?: string; 
    avatar_url?: string | null;
    language_preference?: string | null;
    theme_preference?: string | null;
  }
) => {
  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId)
    .select()
    .single();

  if (error) throw error;
  return data as Profile;
};

export const upsertUserProfile = async (
  userId: string,
  profile: { 
    username: string; 
    avatar_url?: string | null;
    language_preference?: string | null;
    theme_preference?: string | null;
  }
) => {
  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      { 
        id: userId, 
        username: profile.username, 
        avatar_url: profile.avatar_url ?? null,
        language_preference: profile.language_preference ?? null,
        theme_preference: profile.theme_preference ?? null,
      },
      { onConflict: "id" }
    )
    .select()
    .single();

  if (error) throw error;
  return data as Profile;
};

export const fetchDailyStats = async (userId: string) => {
  const { data, error } = await supabase
    .from("daily_summaries")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .limit(30);

  if (error) throw error;
  return data as DailySummary[];
};

export const fetchProfileOverview = async (
  userId: string
): Promise<ProfileOverview> => {
  const [
    userProfile,
    allAvailable,
    userVisible,
    leaderboard,
    overviewResponse,
    subjectTotalsResponse,
  ] = await Promise.all([
    fetchUserProfile(userId),
    fetchSubjects(userId),
    fetchUserSubjects(userId),
    fetchLeaderboard(),
    supabase
      .from("session_overview")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("session_subject_totals")
      .select("*")
      .eq("user_id", userId),
  ]);

  if (overviewResponse.error) throw overviewResponse.error;
  if (subjectTotalsResponse.error) throw subjectTotalsResponse.error;

  const allList = allAvailable ?? [];
  const visibleList = userVisible ?? [];

  const sessionStats =
    overviewResponse.data ?? ({
      total_seconds: 0,
      month_seconds: 0,
      avg_seconds: 0,
      session_count: 0,
    } as SessionOverviewView);

  const sessionTotals: SessionTotals = {
    totalSeconds: sessionStats.total_seconds ?? 0,
    monthSeconds: sessionStats.month_seconds ?? 0,
    avgSeconds: sessionStats.avg_seconds ?? 0,
    count: sessionStats.session_count ?? 0,
  };

  const subjectTotals: SubjectAggregate[] = (subjectTotalsResponse.data ?? []).map(
    (row) => ({
      parentId: row.parent_id,
      parentName: row.parent_name,
      totalSeconds: row.total_seconds,
      directSeconds: row.direct_seconds,
      subtagSeconds: row.subtag_seconds,
    })
  );

  subjectTotals.sort((a, b) => b.totalSeconds - a.totalSeconds);

  const idx = leaderboard.findIndex((entry) => entry.userId === userId);
  const leaderboardRank = idx >= 0 ? `#${idx + 1}` : "-";

  return {
    profile: userProfile ?? null,
    subjects: visibleList,
    allSubjects: allList,
    subjectTotals,
    sessionTotals,
    leaderboardRank,
  };
};

// GROUP QUERIES
// Group management, membership, and discovery
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
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: GroupRole;
  status?: MembershipStatus;
  created_at: string;
}

export const fetchUserGroups = async (userId: string): Promise<Group[]> => {
  const { data, error } = await supabase
    .from("group_members")
    .select(
      "group_id, status, groups:group_id(id, name, description, visibility, created_by, created_at, requires_admin_approval, invite_code, has_password)"
    )
    .eq("user_id", userId)
    .eq("status", "approved");

  if (error) throw error;

  const mapped = (data ?? [])
    .map((row) => {
      const groupsField = (row as { groups?: Group | Group[] | null }).groups;
      if (Array.isArray(groupsField)) {
        return groupsField[0] ?? null;
      }
      return groupsField ?? null;
    })
    .filter((group): group is Group => Boolean(group));

  return mapped;
};

export const fetchPublicGroups = async (excludeGroupIds: string[] = []): Promise<Group[]> => {
  const { data, error } = await supabase
    .from("groups")
    .select(
      "id, name, description, visibility, created_by, created_at, requires_admin_approval, invite_code, has_password"
    )
    .eq("visibility", "public");

  if (error) throw error;
  
  const allGroups = (data ?? []) as Group[];
  
  // Filter out excluded groups client-side
  if (excludeGroupIds.length > 0) {
    const excludeSet = new Set(excludeGroupIds);
    return allGroups.filter((g) => !excludeSet.has(g.id));
  }
  
  return allGroups;
};

export const createGroup = async (
  userId: string,
  payload: {
    name: string;
    description?: string | null;
    visibility?: GroupVisibility;
    requires_admin_approval?: boolean;
    join_password?: string | null;
  }
): Promise<Group> => {
  const { data, error } = await supabase
    .from("groups")
    .insert({
      name: payload.name.trim(),
      description: payload.description?.trim() || null,
      created_by: userId,
      visibility: payload.visibility ?? "private",
      requires_admin_approval: payload.requires_admin_approval ?? false,
      join_password: payload.join_password?.trim() || null,
    })
    .select()
    .single();

  if (error) throw error;

  // Add creator as admin member
  const { error: memberError } = await supabase.from("group_members").insert({
    user_id: userId,
    group_id: data.id,
    role: "group_admin",
    status: "approved",
  });

  if (memberError) {
    console.error("Error adding creator to group", memberError);
    // Still return the group even if member creation fails
  }

  return data as Group;
};

export const findGroupByInviteCode = async (code: string): Promise<Group | null> => {
  const { data, error } = await supabase.rpc("find_group_by_invite_code", {
    p_code: code,
  });

  if (error) throw error;

  if (!data || (Array.isArray(data) && data.length === 0)) {
    return null;
  }

  return (Array.isArray(data) ? data[0] : data) as Group;
};

export const requestJoinGroup = async (
  groupId: string,
  password?: string | null
): Promise<GroupMember> => {
  const { data, error } = await supabase.rpc("request_join_group", {
    p_group_id: groupId,
    p_password: password ?? null,
  });

  if (error) throw error;
  return (Array.isArray(data) ? data[0] : data) as GroupMember;
};

export const regenerateInviteCode = async (groupId: string): Promise<string> => {
  const { data, error } = await supabase.rpc("regenerate_invite_code", {
    p_group_id: groupId,
  });

  if (error) throw error;
  const result = Array.isArray(data) ? data[0] : data;
  return result?.invite_code ?? "";
};

//---------------------------------------------------------------
// AUTH QUERIES
//---------------------------------------------------------------
// Centralized auth operations (password reset, email verification, etc.)
export const resetPasswordForEmail = async (email: string, redirectTo?: string) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: redirectTo ?? "studyleague://reset-password-complete",
  });
  if (error) throw error;
};

export const updateUserPassword = async (newPassword: string) => {
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });
  if (error) throw error;
};

export const resendVerificationEmail = async (email: string, redirectTo?: string) => {
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: email.trim(),
    options: { emailRedirectTo: redirectTo },
  });
  if (error) throw error;
};

export const getCurrentUser = async () => {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user;
};

export const getSession = async () => {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
};

export const exchangeCodeForSession = async (code: string) => {
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) throw error;
  return data.session;
};

//---------------------------------------------------------------
// STORAGE QUERIES
//---------------------------------------------------------------
// Centralized storage operations (avatar uploads, etc.)
export const uploadAvatar = async (userId: string, uri: string): Promise<string> => {
  const response = await fetch(uri);
  const blob = await response.blob();
  const extension = uri.split(".").pop()?.split("?")[0] || "jpg";
  const filePath = `${userId}-${Date.now()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(filePath, blob, {
      cacheControl: "3600",
      upsert: true,
      contentType: blob.type || "image/jpeg",
    });

  if (uploadError) throw uploadError;

  const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(filePath);

  if (!publicUrlData?.publicUrl) {
    throw new Error("Failed to get public URL for uploaded avatar");
  }

  return publicUrlData.publicUrl;
};
