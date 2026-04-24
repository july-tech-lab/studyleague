import {
  markStudySessionActive,
  markStudySessionIdle,
  touchStudyPresence,
} from "@/utils/queries";
import { useEffect, useRef } from "react";

const HEARTBEAT_MS = 45_000;

/**
 * Publishes timer "studying" state for group live view (Supabase `user_study_presence`).
 * Clears when the timer stops; heartbeat keeps rows fresh while the app stays open.
 */
export function useStudyPresenceSync(userId: string | null, isRunning: boolean) {
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  useEffect(() => {
    if (!userId) return;

    if (!isRunning) {
      void markStudySessionIdle(userId).catch((err) => {
        console.warn("study presence: clear failed", err);
      });
      return;
    }

    void markStudySessionActive(userId).catch((err) => {
      console.warn("study presence: start failed", err);
    });

    const interval = setInterval(() => {
      const u = userIdRef.current;
      if (!u) return;
      void touchStudyPresence(u).catch((err) => {
        console.warn("study presence: heartbeat failed", err);
      });
    }, HEARTBEAT_MS);

    return () => {
      clearInterval(interval);
    };
  }, [userId, isRunning]);

  useEffect(() => {
    const captured = userId;
    return () => {
      if (captured) {
        void markStudySessionIdle(captured).catch(() => undefined);
      }
    };
  }, [userId]);
}
