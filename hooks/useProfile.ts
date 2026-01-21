import { useCallback, useEffect, useState } from "react";
import {
  fetchProfileOverview,
  Profile,
  SessionTotals,
  Subject,
  SubjectAggregate,
} from "@/utils/queries";

export interface UseProfileOptions {
  userId: string | null;
  autoLoad?: boolean; // Whether to automatically load profile on mount
}

export interface UseProfileReturn {
  profile: Profile | null;
  subjects: Subject[]; // Visible subjects
  allSubjects: Subject[]; // All available subjects (visible + hidden)
  subjectTotals: SubjectAggregate[];
  sessionTotals: SessionTotals;
  leaderboardRank: string | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useProfile({
  userId,
  autoLoad = true,
}: UseProfileOptions): UseProfileReturn {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
  const [subjectTotals, setSubjectTotals] = useState<SubjectAggregate[]>([]);
  const [sessionTotals, setSessionTotals] = useState<SessionTotals>({
    totalSeconds: 0,
    monthSeconds: 0,
    avgSeconds: 0,
    count: 0,
  });
  const [leaderboardRank, setLeaderboardRank] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const loadProfile = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      setSubjects([]);
      setAllSubjects([]);
      setSubjectTotals([]);
      setSessionTotals({
        totalSeconds: 0,
        monthSeconds: 0,
        avgSeconds: 0,
        count: 0,
      });
      setLeaderboardRank(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const overview = await fetchProfileOverview(userId);
      setProfile(overview.profile);
      setSubjects(overview.subjects);
      setAllSubjects(overview.allSubjects);
      setSubjectTotals(overview.subjectTotals);
      setSessionTotals(overview.sessionTotals);
      setLeaderboardRank(overview.leaderboardRank);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      console.error("Error loading profile", err);
      // Reset state on error
      setProfile(null);
      setSubjects([]);
      setAllSubjects([]);
      setSubjectTotals([]);
      setSessionTotals({
        totalSeconds: 0,
        monthSeconds: 0,
        avgSeconds: 0,
        count: 0,
      });
      setLeaderboardRank(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (autoLoad) {
      loadProfile();
    }
  }, [loadProfile, autoLoad]);

  return {
    profile,
    subjects,
    allSubjects,
    subjectTotals,
    sessionTotals,
    leaderboardRank,
    loading,
    error,
    refetch: loadProfile,
  };
}
