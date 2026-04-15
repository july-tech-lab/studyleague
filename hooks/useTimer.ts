import { logSession } from "@/utils/queries";
import { formatTime as formatTimeUtil } from "@/utils/time";
import { useCallback, useEffect, useRef, useState } from "react";

export interface UseTimerOptions {
  userId: string | null;
  onSessionComplete?: (sessionId: string, seconds: number) => void;
  onError?: (error: Error) => void;
}

export interface UseTimerReturn {
  seconds: number;
  isRunning: boolean;
  start: () => Promise<boolean>;
  stop: (subjectId: string, taskId?: string | null) => Promise<{ saved: boolean; reason?: string }>;
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
      syncElapsed();
      interval = setInterval(syncElapsed, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning]);

  const start = useCallback(async (): Promise<boolean> => {
    if (isRunning) return false;

    startTimeRef.current = Date.now();
    setSeconds(0);
    setIsRunning(true);
    return true;
  }, [isRunning]);

  const stop = useCallback(
    async (subjectId: string, taskId?: string | null): Promise<{ saved: boolean; reason?: string }> => {
      const finalSeconds = seconds;
      const safeSeconds = Math.max(finalSeconds, 1);
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - safeSeconds * 1000);

      setIsRunning(false);
      startTimeRef.current = null;

      if (!userId) {
        const error = new Error("User not authenticated");
        onError?.(error);
        return {
          saved: false,
          reason: "not_authenticated",
        };
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

        return { saved: true };
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error("Error saving session", error);
        onError?.(error);
        return {
          saved: false,
          reason: "save_failed",
        };
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
