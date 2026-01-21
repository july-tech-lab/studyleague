import { useCallback, useEffect, useRef, useState } from "react";
import { logSession } from "@/utils/queries";
import { formatTime as formatTimeUtil } from "@/utils/time";

export interface UseTimerOptions {
  userId: string | null;
  onSessionComplete?: (sessionId: string, seconds: number) => void;
  onError?: (error: Error) => void;
}

export interface UseTimerReturn {
  seconds: number;
  isRunning: boolean;
  start: () => void;
  stop: (subjectId: string, taskId?: string | null) => Promise<void>;
  reset: () => void;
  formattedTime: { hours: string; mins: string; secs: string };
}

export function useTimer({
  userId,
  onSessionComplete,
  onError,
}: UseTimerOptions): UseTimerReturn {
  const [isRunning, setIsRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const startTimeRef = useRef<number | null>(null);

  // Timer engine: sync elapsed time every second when running
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    const syncElapsed = () => {
      if (!startTimeRef.current) return;
      const elapsed = Math.max(0, Math.floor((Date.now() - startTimeRef.current) / 1000));
      setSeconds(elapsed);
    };

    if (isRunning && startTimeRef.current) {
      syncElapsed(); // Ensure immediate catch-up when resuming from background
      interval = setInterval(syncElapsed, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning]);

  const start = useCallback(() => {
    if (isRunning) return;
    startTimeRef.current = Date.now();
    setSeconds(0);
    setIsRunning(true);
  }, [isRunning]);

  const stop = useCallback(
    async (subjectId: string, taskId?: string | null): Promise<void> => {
      const finalSeconds = seconds;
      const safeSeconds = Math.max(finalSeconds, 1); // Avoid zero-length sessions
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - safeSeconds * 1000);

      // Always stop timer locally (keep elapsed visible)
      setIsRunning(false);
      startTimeRef.current = null;

      if (!userId) {
        const error = new Error("User not authenticated");
        onError?.(error);
        throw error;
      }

      try {
        const saved = await logSession(userId, subjectId, startTime, endTime, {
          taskId: taskId ?? null,
        });

        console.log("Session saved", {
          id: saved?.id,
          user: userId,
          subject: subjectId,
          seconds: safeSeconds,
        });

        if (saved?.id) {
          onSessionComplete?.(saved.id, safeSeconds);
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error("Error saving session", error);
        onError?.(error);
        throw error;
      }
    },
    [userId, seconds, onSessionComplete, onError]
  );

  const reset = useCallback(() => {
    setIsRunning(false);
    startTimeRef.current = null;
    setSeconds(0);
  }, []);

  const formattedTime = formatTimeUtil(seconds);

  return {
    seconds,
    isRunning,
    start,
    stop,
    reset,
    formattedTime,
  };
}
