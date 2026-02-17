import FocusModule from "@/modules/focus-module";
import { logSession } from "@/utils/queries";
import { formatTime as formatTimeUtil } from "@/utils/time";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";

export interface UseTimerOptions {
  userId: string | null;
  onSessionComplete?: (sessionId: string, seconds: number) => void;
  onError?: (error: Error) => void;
  requireFocusMode?: boolean; // Default: true - focus mode required to record time
  onFocusModeLost?: () => void; // Called when focus mode is disabled during session
}

export interface UseTimerReturn {
  seconds: number;
  isRunning: boolean;
  focusModeActive: boolean; // Track if focus mode is active
  canStart: boolean; // Can timer start (focus mode available)
  start: () => Promise<boolean>; // Returns success/failure, now async
  stop: (subjectId: string, taskId?: string | null) => Promise<{ saved: boolean; reason?: string }>;
  reset: () => void;
  formattedTime: { hours: string; mins: string; secs: string };
}

export function useTimer({
  userId,
  onSessionComplete,
  onError,
  requireFocusMode = true,
  onFocusModeLost,
}: UseTimerOptions): UseTimerReturn {
  const [isRunning, setIsRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [focusModeActive, setFocusModeActive] = useState(false);
  const [canStart, setCanStart] = useState(false);
  const startTimeRef = useRef<number | null>(null);
  const focusModeStartRef = useRef<boolean>(false); // Track if focus mode was active when timer started

  // Check if focus mode can be enabled (permission + iOS apps selected)
  useEffect(() => {
    const checkCanStart = async () => {
      if (!requireFocusMode) {
        setCanStart(true);
        return;
      }

      // On web, focus mode is not available
      if (Platform.OS === 'web') {
        setCanStart(false);
        return;
      }

      try {
        const hasPermission = await FocusModule.checkPermission();
        if (!hasPermission) {
          setCanStart(false);
          return;
        }

        if (Platform.OS === 'ios') {
          const hasSelectedApps = FocusModule.getSelectedApps();
          setCanStart(hasSelectedApps);
        } else {
          setCanStart(true); // Android doesn't need app selection
        }
      } catch (error) {
        console.error('Error checking focus mode availability:', error);
        setCanStart(false);
      }
    };

    checkCanStart();
    
    // Re-check periodically and when app comes to foreground
    const interval = setInterval(checkCanStart, 5000); // Check every 5 seconds
    
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        checkCanStart();
      }
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [requireFocusMode]);

  // Monitor focus mode status while timer is running
  useEffect(() => {
    if (!isRunning || !requireFocusMode) return;

    // On web, focus mode is not available
    if (Platform.OS === 'web') {
      setFocusModeActive(false);
      return;
    }

    let checkInterval: ReturnType<typeof setInterval> | null = null;

    const checkFocusMode = async () => {
      try {
        const hasPermission = await FocusModule.checkPermission();
        if (!hasPermission) {
          setFocusModeActive(false);
          if (onFocusModeLost) {
            onFocusModeLost();
          }
          return;
        }

        // For iOS, we can't directly check if shields are active,
        // but we can check if permission is still granted
        // The actual shield state is managed by the system
        setFocusModeActive(hasPermission);
      } catch (error) {
        console.error('Error checking focus mode during timer:', error);
        setFocusModeActive(false);
      }
    };

    // Check immediately and then every 5 seconds
    checkFocusMode();
    checkInterval = setInterval(checkFocusMode, 5000);

    return () => {
      if (checkInterval) clearInterval(checkInterval);
    };
  }, [isRunning, requireFocusMode, onFocusModeLost]);

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

  const start = useCallback(async (): Promise<boolean> => {
    if (isRunning) return false;

    // If focus mode is required, enable it first
    if (requireFocusMode) {
      // On web, focus mode is not available
      if (Platform.OS === 'web') {
        onError?.(new Error('Focus mode is not available on web'));
        return false;
      }

      try {
        // Check permission
        const hasPermission = await FocusModule.checkPermission();
        if (!hasPermission) {
          return false;
        }

        // On iOS, check if apps are selected
        if (Platform.OS === 'ios') {
          const hasSelectedApps = FocusModule.getSelectedApps();
          if (!hasSelectedApps) {
            return false;
          }
        }

        // Enable focus mode
        await FocusModule.setFocusMode(true);
        setFocusModeActive(true);
        focusModeStartRef.current = true;
      } catch (error: any) {
        console.error('Error enabling focus mode:', error);
        setFocusModeActive(false);
        focusModeStartRef.current = false;
        onError?.(new Error(error?.message || 'Failed to enable focus mode'));
        return false;
      }
    } else {
      focusModeStartRef.current = false;
    }

    // Start timer
    startTimeRef.current = Date.now();
    setSeconds(0);
    setIsRunning(true);
    return true;
  }, [isRunning, requireFocusMode, onError]);

  const stop = useCallback(
    async (subjectId: string, taskId?: string | null): Promise<{ saved: boolean; reason?: string }> => {
      const finalSeconds = seconds;
      const safeSeconds = Math.max(finalSeconds, 1); // Avoid zero-length sessions
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - safeSeconds * 1000);

      // Always stop timer locally (keep elapsed visible)
      setIsRunning(false);
      startTimeRef.current = null;

      // Disable focus mode if it was enabled
      if (requireFocusMode && focusModeStartRef.current && Platform.OS !== 'web') {
        try {
          await FocusModule.setFocusMode(false);
        } catch (error) {
          console.error('Error disabling focus mode:', error);
        }
        setFocusModeActive(false);
        focusModeStartRef.current = false;
      }

      // Check if we should save the session
      if (requireFocusMode && !focusModeStartRef.current) {
        return {
          saved: false,
          reason: 'focus_mode_required',
        };
      }

      if (!userId) {
        const error = new Error("User not authenticated");
        onError?.(error);
        return {
          saved: false,
          reason: 'not_authenticated',
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
          reason: 'save_failed',
        };
      }
    },
    [userId, seconds, onSessionComplete, onError, requireFocusMode]
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
    focusModeActive,
    canStart,
    start,
    stop,
    reset,
    formattedTime,
  };
}
