import {
    attachSubjectToUser,
    buildSubjectTree,
    createSubject,
    fetchUserSubjects,
    hideUserSubject,
    Subject,
    SubjectNode,
    upsertUserSubject,
} from "@/utils/queries";
import { useCallback, useEffect, useMemo, useState } from "react";

export interface UseSubjectsOptions {
  userId: string | null;
  autoLoad?: boolean; // Whether to automatically load subjects on mount
  autoSelectFirst?: boolean; // Whether to automatically select the first subject
}

export interface UseSubjectsReturn {
  subjects: Subject[];
  subjectTree: SubjectNode[];
  parentSubjects: Subject[]; // Only parent subjects (where parent_subject_id is null)
  loading: boolean;
  error: Error | null;
  selectedSubjectId: string | null;
  selectedSubject: Subject | null;
  subjectNameById: Record<string, string>; // Quick lookup map (includes all subjects)
  setSelectedSubjectId: (id: string | null) => void;
  createSubject: (name: string, parentSubjectId?: string | null) => Promise<Subject>;
  hideSubject: (subjectId: string) => Promise<void>;
  attachSubject: (subjectId: string) => Promise<void>;
  refetch: () => Promise<void>;
}

function pickDefaultSubjectId(tree: SubjectNode[]): string | null {
  if (!tree.length) return null;
  const first = tree[0];
  return first.children[0]?.id ?? first.id;
}

export function useSubjects({
  userId,
  autoLoad = true,
  autoSelectFirst = false,
}: UseSubjectsOptions): UseSubjectsReturn {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectTree, setSubjectTree] = useState<SubjectNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);

  const loadSubjects = useCallback(async () => {
    if (!userId) {
      setSubjects([]);
      setSubjectTree([]);
      setSelectedSubjectId(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await fetchUserSubjects(userId);
      const flat = data ?? [];
      const tree = buildSubjectTree(flat);
      setSubjects(flat);
      setSubjectTree(tree);

      // Auto-select first subject if enabled and no selection exists
      if (autoSelectFirst) {
        setSelectedSubjectId((current) => {
          // Keep current selection if it's still valid
          if (current && flat.some((s) => s.id === current)) {
            return current;
          }
          // Otherwise pick default
          return pickDefaultSubjectId(tree);
        });
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      console.error("Error loading subjects", err);
      setSubjects([]);
      setSubjectTree([]);
    } finally {
      setLoading(false);
    }
  }, [userId, autoSelectFirst]);

  useEffect(() => {
    if (autoLoad) {
      loadSubjects();
    }
  }, [loadSubjects, autoLoad]);

  const handleCreateSubject = useCallback(
    async (name: string, parentSubjectId?: string | null): Promise<Subject> => {
      if (!userId) {
        throw new Error("User not authenticated");
      }

      try {
        const created = await createSubject(userId, name, parentSubjectId);
        // Make it visible for this user
        await upsertUserSubject(userId, created.id);
        
        // Update local state using functional update
        setSubjects((prev) => {
          const next = [created, ...prev];
          const nextTree = buildSubjectTree(next);
          setSubjectTree(nextTree);
          return next;
        });
        
        return created;
      } catch (err) {
        console.error("Error creating subject", err);
        throw err;
      }
    },
    [userId]
  );

  const handleHideSubject = useCallback(
    async (subjectId: string): Promise<void> => {
      if (!userId) {
        throw new Error("User not authenticated");
      }

      try {
        await hideUserSubject(userId, subjectId);
        // Update local state using functional update
        setSubjects((prev) => {
          const next = prev.filter((s) => s.id !== subjectId);
          const nextTree = buildSubjectTree(next);
          setSubjectTree(nextTree);
          return next;
        });
        
        // Clear selection if the hidden subject was selected
        setSelectedSubjectId((current) => (current === subjectId ? null : current));
      } catch (err) {
        console.error("Error hiding subject", err);
        throw err;
      }
    },
    [userId]
  );

  const handleAttachSubject = useCallback(
    async (subjectId: string): Promise<void> => {
      if (!userId) {
        throw new Error("User not authenticated");
      }

      try {
        await attachSubjectToUser(userId, subjectId);
        // Refetch to get the updated list (subject might be new or restored)
        await loadSubjects();
      } catch (err) {
        console.error("Error attaching subject", err);
        throw err;
      }
    },
    [userId, loadSubjects]
  );

  const selectedSubject = useMemo(() => {
    return subjects.find((s) => s.id === selectedSubjectId) ?? null;
  }, [subjects, selectedSubjectId]);

  // Create name mapping for quick lookups (includes all subjects - parents and children)
  const subjectNameById = useMemo(() => {
    const map: Record<string, string> = {};
    subjects.forEach((subj) => {
      map[subj.id] = subj.name;
    });
    return map;
  }, [subjects]);

  // Filter to only parent subjects (where parent_subject_id is null)
  // Database: parent_subject_id is NULL for parents, UUID for children
  // Tasks can be assigned to child subjects, but SubjectPicker should only show parents
  const parentSubjects = useMemo(() => {
    return subjects.filter((s) => s.parent_subject_id === null || s.parent_subject_id === undefined);
  }, [subjects]);

  return {
    subjects,
    subjectTree,
    parentSubjects,
    loading,
    error,
    selectedSubjectId,
    selectedSubject,
    subjectNameById,
    setSelectedSubjectId,
    createSubject: handleCreateSubject,
    hideSubject: handleHideSubject,
    attachSubject: handleAttachSubject,
    refetch: loadSubjects,
  };
}
