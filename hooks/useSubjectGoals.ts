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
      const result: GoalsBySubject = {};
      subjectIds.forEach((id) => {
        result[id] = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
      });
      goals.forEach((g) => {
        if (!result[g.subject_id]) result[g.subject_id] = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
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
        await loadGoals();
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [userId, loadGoals]
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
