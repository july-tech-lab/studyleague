import { useProfile } from "@/hooks/useProfile";
import { useSubjectGoals } from "@/hooks/useSubjectGoals";
import {
  aggregateGoalsByDay,
  aggregateGoalsByDayAndSubject,
  aggregateGoalsBySubject,
  fetchLongestSessionSeconds,
  fetchSessionsInRange,
  sumWeeklyGoalMinutes,
} from "@/utils/queries";
import {
  getDaysInMonth,
  getMonthRangeForDate,
  getWeekRangeForDate,
  getYearRangeForDate,
} from "@/utils/time";
import { useCallback, useEffect, useMemo, useState } from "react";

export type DashboardPeriod = "week" | "month" | "year";

export interface SubjectGoalVsActual {
  subjectId: string;
  subjectName: string;
  actualMinutes: number;
  goalMinutes: number;
  behindMinutes: number;
}

export interface DayGoalVsActual {
  day: number;
  actualMinutes: number;
  goalMinutes: number;
}

export interface HistogramBucket {
  label: string;
  key: number;
  actualMinutes: number;
  plannedMinutes: number;
}

export function useDashboard(
  userId: string | null,
  period: DashboardPeriod = "week",
  focusDate: Date = new Date()
) {
  const { profile, subjectTotals, sessionTotals, subjects, allSubjects, loading: profileLoading } =
    useProfile({ userId, autoLoad: true });
  const { goals, goalsBySubject, loading: goalsLoading } =
    useSubjectGoals(userId);

  const [weeklySessions, setWeeklySessions] = useState<
    { subject_id: string; duration_seconds: number; ended_at: string }[]
  >([]);
  const [longestSessionSeconds, setLongestSessionSeconds] = useState(0);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  const dateRange = useMemo(() => {
    if (period === "week") return getWeekRangeForDate(focusDate);
    if (period === "month") return getMonthRangeForDate(focusDate);
    return getYearRangeForDate(focusDate);
  }, [period, focusDate]);

  const loadSessions = useCallback(async () => {
    if (!userId) return;
    setSessionsLoading(true);
    try {
      const [sessions, longest] = await Promise.all([
        fetchSessionsInRange(userId, dateRange.fromIso, dateRange.toIso),
        fetchLongestSessionSeconds(userId),
      ]);
      setWeeklySessions(sessions);
      setLongestSessionSeconds(longest);
    } catch (err) {
      console.error("Error loading dashboard data", err);
      setWeeklySessions([]);
      setLongestSessionSeconds(0);
    } finally {
      setSessionsLoading(false);
    }
  }, [userId, dateRange.fromIso, dateRange.toIso]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const parentSubjects = useMemo(
    () =>
      subjects.filter(
        (s) => s.parent_subject_id === null || s.parent_subject_id === undefined
      ),
    [subjects]
  );

  const subjectIds = useMemo(
    () => parentSubjects.map((s) => s.id),
    [parentSubjects]
  );
  const subjectNameById = useMemo(
    () => Object.fromEntries(parentSubjects.map((s) => [s.id, s.name])),
    [parentSubjects]
  );

  const weeklyTotalSeconds = useMemo(
    () =>
      weeklySessions.reduce((sum, s) => sum + (s.duration_seconds ?? 0), 0),
    [weeklySessions]
  );

  const weeklyGoalMinutes = useMemo(() => {
    const fromGoals = sumWeeklyGoalMinutes(goals);
    if (fromGoals > 0) return fromGoals;
    return profile?.weekly_goal_minutes ?? 0;
  }, [goals, profile?.weekly_goal_minutes]);

  const goalsBySubjectMap = useMemo(
    () => aggregateGoalsBySubject(goals),
    [goals]
  );

  const subjectGoalVsActual: SubjectGoalVsActual[] = useMemo(() => {
    const actualBySubject: Record<string, number> = {};
    weeklySessions.forEach((s) => {
      const subjId = s.subject_id;
      const mins = Math.round((s.duration_seconds ?? 0) / 60);
      actualBySubject[subjId] = (actualBySubject[subjId] ?? 0) + mins;
    });

    return parentSubjects
      .filter((s) => (goalsBySubjectMap[s.id] ?? 0) > 0)
      .map((s) => {
        const actual = actualBySubject[s.id] ?? 0;
        const goal = goalsBySubjectMap[s.id] ?? 0;
        const behind = Math.max(0, goal - actual);
        return {
          subjectId: s.id,
          subjectName: s.name,
          actualMinutes: actual,
          goalMinutes: goal,
          behindMinutes: behind,
        };
      });
  }, [parentSubjects, goalsBySubjectMap, weeklySessions]);

  const goalsByDayMap = useMemo(() => aggregateGoalsByDay(goals), [goals]);
  const goalsByDayAndSubject = useMemo(
    () => aggregateGoalsByDayAndSubject(goals),
    [goals]
  );

  const subjectIdToParentId = useMemo(() => {
    const map: Record<string, string> = {};
    (allSubjects ?? []).forEach((s) => {
      map[s.id] = s.parent_subject_id ?? s.id;
    });
    return map;
  }, [allSubjects]);

  const actualByDayBySubject = useMemo(() => {
    const byDay: Record<number, Record<string, number>> = {
      1: {}, 2: {}, 3: {}, 4: {}, 5: {}, 6: {}, 7: {},
    };
    weeklySessions.forEach((s) => {
      if (!s.ended_at) return;
      const d = new Date(s.ended_at);
      const dow = d.getDay();
      const dayNum = dow === 0 ? 7 : dow;
      const parentId = subjectIdToParentId[s.subject_id] ?? s.subject_id;
      const mins = Math.round((s.duration_seconds ?? 0) / 60);
      byDay[dayNum][parentId] = (byDay[dayNum][parentId] ?? 0) + mins;
    });
    return byDay;
  }, [weeklySessions, subjectIdToParentId]);

  const actualByDayOfMonthBySubject = useMemo(() => {
    const byDay: Record<number, Record<string, number>> = {};
    weeklySessions.forEach((s) => {
      if (!s.ended_at) return;
      const d = new Date(s.ended_at);
      const dayOfMonth = d.getDate();
      if (!byDay[dayOfMonth]) byDay[dayOfMonth] = {};
      const parentId = subjectIdToParentId[s.subject_id] ?? s.subject_id;
      const mins = Math.round((s.duration_seconds ?? 0) / 60);
      byDay[dayOfMonth][parentId] = (byDay[dayOfMonth][parentId] ?? 0) + mins;
    });
    return byDay;
  }, [weeklySessions, subjectIdToParentId]);

  const actualByMonthBySubject = useMemo(() => {
    const byMonth: Record<number, Record<string, number>> = {
      1: {}, 2: {}, 3: {}, 4: {}, 5: {}, 6: {},
      7: {}, 8: {}, 9: {}, 10: {}, 11: {}, 12: {},
    };
    weeklySessions.forEach((s) => {
      if (!s.ended_at) return;
      const d = new Date(s.ended_at);
      const month = d.getMonth() + 1;
      const parentId = subjectIdToParentId[s.subject_id] ?? s.subject_id;
      const mins = Math.round((s.duration_seconds ?? 0) / 60);
      byMonth[month][parentId] = (byMonth[month][parentId] ?? 0) + mins;
    });
    return byMonth;
  }, [weeklySessions, subjectIdToParentId]);

  const dayKeys = useMemo(() => {
    if (period === "week") return [1, 2, 3, 4, 5, 6, 7];
    if (period === "month") {
      const days = getDaysInMonth(focusDate);
      return Array.from({ length: days }, (_, i) => i + 1);
    }
    return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  }, [period, focusDate]);

  const histogramData = useCallback(
    (selectedSubjectId: string | null): HistogramBucket[] => {
      const monthAbbr = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const dayKeyToLabel = (key: number) => {
        if (period === "week") {
          const labels: Record<number, string> = { 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat", 7: "Sun" };
          return labels[key] ?? "";
        }
        if (period === "month") return String(key);
        return monthAbbr[key - 1] ?? "";
      };

      let byKey: Record<number, Record<string, number>>;
      if (period === "week") byKey = actualByDayBySubject;
      else if (period === "month") byKey = actualByDayOfMonthBySubject;
      else byKey = actualByMonthBySubject;

      return dayKeys.map((key) => {
        const bucket = byKey[key] ?? {};
        if (selectedSubjectId === null) {
          const actual = Object.values(bucket).reduce((a, b) => a + b, 0);
          const planned = period === "week" ? (goalsByDayMap[key] ?? 0) : 0;
          return {
            label: dayKeyToLabel(key),
            key,
            actualMinutes: actual,
            plannedMinutes: planned,
          };
        }
        const actual = bucket[selectedSubjectId] ?? 0;
        const planned = period === "week"
          ? (goalsByDayAndSubject[key] ?? {})[selectedSubjectId] ?? 0
          : 0;
        return {
          label: dayKeyToLabel(key),
          key,
          actualMinutes: actual,
          plannedMinutes: planned,
        };
      });
    },
    [
      period,
      focusDate,
      dayKeys,
      actualByDayBySubject,
      actualByDayOfMonthBySubject,
      actualByMonthBySubject,
      goalsByDayMap,
      goalsByDayAndSubject,
    ]
  );

  const histogramSubjects = useMemo(() => {
    const hasSessions = new Set<string>();
    const hasGoals = new Set<string>();
    Object.values(actualByDayBySubject).forEach((bySubj) => {
      Object.keys(bySubj).forEach((id) => hasSessions.add(id));
    });
    Object.values(goalsByDayAndSubject).forEach((bySubj) => {
      Object.keys(bySubj).forEach((id) => hasGoals.add(id));
    });
    const ids = new Set([...hasSessions, ...hasGoals]);
    return parentSubjects.filter((s) => ids.has(s.id));
  }, [parentSubjects, actualByDayBySubject, goalsByDayAndSubject]);

  const dailyGoalVsActual: DayGoalVsActual[] = useMemo(() => {
    const actualByDay: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 };
    weeklySessions.forEach((s) => {
      if (!s.ended_at) return;
      const d = new Date(s.ended_at);
      const dow = d.getDay();
      const dayNum = dow === 0 ? 7 : dow;
      const mins = Math.round((s.duration_seconds ?? 0) / 60);
      actualByDay[dayNum] = (actualByDay[dayNum] ?? 0) + mins;
    });

    return [1, 2, 3, 4, 5, 6, 7].map((day) => ({
      day,
      actualMinutes: actualByDay[day] ?? 0,
      goalMinutes: goalsByDayMap[day] ?? 0,
    }));
  }, [weeklySessions, goalsByDayMap]);

  const bestSubjectName = useMemo(() => {
    if (!subjectTotals.length) return null;
    const best = subjectTotals.reduce((a, b) =>
      a.totalSeconds >= b.totalSeconds ? a : b
    );
    return best.parentName;
  }, [subjectTotals]);

  return {
    profile,
    weeklyTotalSeconds,
    weeklyGoalMinutes,
    subjectGoalVsActual,
    dailyGoalVsActual,
    sessionTotals,
    longestSessionSeconds,
    bestSubjectName,
    subjectNameById,
    histogramData,
    histogramSubjects,
    parentSubjects,
    loading: profileLoading || goalsLoading || sessionsLoading,
    refetch: loadSessions,
  };
}
