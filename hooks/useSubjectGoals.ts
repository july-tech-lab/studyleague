import {
  fetchSubjectWeeklyGoals,
  SubjectWeeklyGoal,
  upsertSubjectWeeklyGoals,
} from "@/utils/queries";
import { useCallback, useEffect, useState } from "react";

export type GoalsBySubject = Record<
  string,
  { [dayOfWeek: number]: number }
>;

export type GoalsByDay = Record<number, Record<string, number>>;

function mergeGoalsAfterUpsert(
  prev: SubjectWeeklyGoal[],
  userId: string,
  rows: { subject_id: string; day_of_week: number; minutes: number }[]
): SubjectWeeklyGoal[] {
  const map = new Map<string, SubjectWeeklyGoal>();
  for (const g of prev) {
    map.set(`${g.subject_id}:${g.day_of_week}`, g);
  }
  for (const r of rows) {
    const key = `${r.subject_id}:${r.day_of_week}`;
    if (r.minutes <= 0) {
      map.delete(key);
    } else {
      const existing = map.get(key);
      map.set(key, {
        id: existing?.id ?? `local:${r.subject_id}:${r.day_of_week}`,
        user_id: userId,
        subject_id: r.subject_id,
        day_of_week: r.day_of_week,
        minutes: r.minutes,
      });
    }
  }
  return Array.from(map.values());
}

export function useSubjectGoals(userId: string | null) {
  const [goals, setGoals] = useState<SubjectWeeklyGoal[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const loadGoals = useCallback(async () => {
    if (!userId) {
      setGoals([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSubjectWeeklyGoals(userId);
      setGoals(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setGoals([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadGoals();
  }, [loadGoals]);

  const goalsBySubject = useCallback(
    (subjectIds: string[]): GoalsBySubject => {
      const allowed = new Set(subjectIds);
      const result: GoalsBySubject = {};
      subjectIds.forEach((id) => {
        result[id] = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
      });
      goals.forEach((g) => {
        if (!allowed.has(g.subject_id)) return;
        result[g.subject_id][g.day_of_week] = g.minutes;
      });
      return result;
    },
    [goals]
  );

  const saveGoals = useCallback(
    async (subjectGoals: GoalsBySubject) => {
      if (!userId) return;
      setSaving(true);
      setError(null);
      try {
        const rows: { subject_id: string; day_of_week: number; minutes: number }[] = [];
        Object.entries(subjectGoals).forEach(([subjectId, byDay]) => {
          Object.entries(byDay).forEach(([dowStr, minutes]) => {
            rows.push({
              subject_id: subjectId,
              day_of_week: parseInt(dowStr, 10),
              minutes,
            });
          });
        });
        await upsertSubjectWeeklyGoals(userId, rows);
        setGoals((g) => mergeGoalsAfterUpsert(g, userId, rows));
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [userId]
  );

  return {
    goals,
    goalsBySubject,
    loading,
    saving,
    error,
    refetch: loadGoals,
    saveGoals,
  };
}
