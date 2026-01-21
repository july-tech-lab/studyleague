import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createTask,
  deleteTask,
  fetchTasks,
  Task,
  TaskStatus,
  updateTask,
} from "@/utils/queries";
import { getTodayIso } from "@/utils/time";

export interface UseTasksOptions {
  userId: string | null;
  autoLoad?: boolean; // Whether to automatically load tasks on mount
  filterStatus?: TaskStatus[]; // Filter tasks by status
}

export interface UseTasksReturn {
  tasks: Task[];
  loading: boolean;
  error: Error | null;
  createTask: (payload: {
    title: string;
    subjectId: string;
    plannedMinutes: number | null;
    status?: TaskStatus;
    loggedSeconds?: number;
    scheduledFor?: string | null;
  }) => Promise<Task | null>;
  updateTask: (
    taskId: string,
    payload: Partial<{
      title: string;
      subjectId: string | null;
      plannedMinutes: number | null;
      status: TaskStatus;
      loggedSeconds: number;
      scheduledFor: string | null;
    }>
  ) => Promise<Task | null>;
  deleteTask: (taskId: string) => Promise<void>;
  resumeTask: (task: Task) => Promise<void>;
  completeTask: (task: Task, minutesOverride?: number) => Promise<void>;
  refetch: () => Promise<void>;
  // Filtered and ordered tasks
  orderedTasks: Task[];
}

export function useTasks({
  userId,
  autoLoad = true,
  filterStatus,
}: UseTasksOptions): UseTasksReturn {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const lastTasksRef = useRef<Task[]>([]);

  const loadTasks = useCallback(async () => {
    if (!userId) {
      setTasks([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await fetchTasks(userId);
      setTasks(data ?? []);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      console.error("Error loading tasks", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (autoLoad) {
      loadTasks();
    }
  }, [loadTasks, autoLoad]);

  const handleCreateTask = useCallback(
    async (payload: {
      title: string;
      subjectId: string;
      plannedMinutes: number | null;
      status?: TaskStatus;
      loggedSeconds?: number;
      scheduledFor?: string | null;
    }): Promise<Task | null> => {
      if (!userId) {
        throw new Error("User not authenticated");
      }

      try {
        const saved = await createTask(userId, {
          ...payload,
          scheduledFor: payload.scheduledFor ?? getTodayIso(),
        });
        setTasks((prev) => [saved, ...prev]);
        return saved;
      } catch (err) {
        console.error("Error creating task", err);
        throw err;
      }
    },
    [userId]
  );

  const handleUpdateTask = useCallback(
    async (
      taskId: string,
      payload: Partial<{
        title: string;
        subjectId: string | null;
        plannedMinutes: number | null;
        status: TaskStatus;
        loggedSeconds: number;
        scheduledFor: string | null;
      }>
    ): Promise<Task | null> => {
      if (!userId) {
        throw new Error("User not authenticated");
      }

      try {
        const saved = await updateTask(taskId, userId, payload);
        if (saved) {
          setTasks((current) =>
            current.map((t) =>
              t.id === taskId
                ? { ...saved, subjectName: saved.subjectName ?? t.subjectName }
                : t
            )
          );
        }
        return saved;
      } catch (err) {
        console.error("Error updating task", err);
        throw err;
      }
    },
    [userId]
  );

  const handleDeleteTask = useCallback(
    async (taskId: string): Promise<void> => {
      if (!userId) {
        throw new Error("User not authenticated");
      }

      // Optimistic update with functional update pattern
      setTasks((prev) => {
        lastTasksRef.current = prev; // Capture current state for rollback
        return prev.filter((t) => t.id !== taskId);
      });

      try {
        await deleteTask(taskId);
      } catch (err) {
        console.error("Error deleting task", err);
        // Rollback on error
        setTasks(lastTasksRef.current);
        throw err;
      }
    },
    [userId]
  );

  const handleResumeTask = useCallback(
    async (task: Task): Promise<void> => {
      if (!userId) {
        throw new Error("User not authenticated");
      }

      const optimistic: Task = { ...task, status: "in-progress" };
      let previous: Task[] = [];
      
      setTasks((current) => {
        previous = current; // Capture for rollback
        return current.map((t) => (t.id === task.id ? optimistic : t));
      });

      try {
        const saved = await updateTask(task.id, userId, { status: "in-progress" });
        if (saved) {
          setTasks((current) =>
            current.map((t) =>
              t.id === task.id
                ? { ...saved, subjectName: optimistic.subjectName ?? t.subjectName }
                : t
            )
          );
        }
      } catch (err) {
        console.error("Error resuming task", err);
        setTasks(previous);
        throw err;
      }
    },
    [userId]
  );

  const handleCompleteTask = useCallback(
    async (task: Task, minutesOverride?: number): Promise<void> => {
      if (!userId) {
        throw new Error("User not authenticated");
      }

      const targetSeconds =
        minutesOverride !== undefined
          ? Math.max(task.loggedSeconds, minutesOverride * 60)
          : task.loggedSeconds;

      const optimistic: Task = {
        ...task,
        status: "done",
        loggedSeconds: targetSeconds,
      };

      let previous: Task[] = [];
      setTasks((current) => {
        previous = current; // Capture for rollback
        return current.map((t) => (t.id === task.id ? optimistic : t));
      });

      try {
        const saved = await updateTask(task.id, userId, {
          status: "done",
          loggedSeconds: targetSeconds,
        });

        if (saved) {
          setTasks((current) =>
            current.map((t) =>
              t.id === task.id
                ? { ...saved, subjectName: optimistic.subjectName ?? t.subjectName }
                : t
            )
          );
        }
      } catch (err) {
        console.error("Error completing task", err);
        setTasks(previous);
        throw err;
      }
    },
    [userId]
  );

  // Filtered and ordered tasks
  const orderedTasks = useMemo(() => {
    let filtered = tasks;

    // Apply status filter if provided
    if (filterStatus && filterStatus.length > 0) {
      filtered = filtered.filter((t) => filterStatus.includes(t.status));
    }

    // Order by status priority: in-progress > planned > done
    const priority: Record<TaskStatus, number> = {
      "in-progress": 0,
      planned: 1,
      done: 2,
    };

    return filtered.sort((a, b) => priority[a.status] - priority[b.status]);
  }, [tasks, filterStatus]);

  return {
    tasks,
    loading,
    error,
    createTask: handleCreateTask,
    updateTask: handleUpdateTask,
    deleteTask: handleDeleteTask,
    resumeTask: handleResumeTask,
    completeTask: handleCompleteTask,
    refetch: loadTasks,
    orderedTasks,
  };
}
