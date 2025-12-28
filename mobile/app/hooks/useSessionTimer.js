import { useEffect, useRef, useState } from "react";

export function useSessionTimer({ currentSession, isActive, onComplete }) {
  const [remainingMs, setRemainingMs] = useState(0);
  const endTimeRef = useRef(null);

  // Avoid re-running the interval effect when parent passes a new inline callback each render.
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Keep the endTime ref in sync so time extensions take effect immediately
  // without needing to restart the interval (and without changing the session id).
  useEffect(() => {
    if (!currentSession) return;
    const fallbackEndTime = Date.now() + (currentSession.durationMinutes ?? 0) * 60 * 1000;
    endTimeRef.current = currentSession.endTimeMs ?? fallbackEndTime;
  }, [currentSession?.id, currentSession?.endTimeMs, currentSession?.durationMinutes]);

  useEffect(() => {
    if (!currentSession || !isActive) return;
    const fallbackEndTime = Date.now() + (currentSession.durationMinutes ?? 0) * 60 * 1000;
    const endTime = endTimeRef.current ?? currentSession.endTimeMs ?? fallbackEndTime;
    endTimeRef.current = endTime;
    setRemainingMs(endTime - Date.now());

    const id = setInterval(() => {
      const now = Date.now();
      const resolvedEndTime = endTimeRef.current ?? endTime;
      const remaining = Math.max(0, resolvedEndTime - now);
      setRemainingMs(remaining);
      if (remaining <= 0) {
        clearInterval(id);
        onCompleteRef.current?.(resolvedEndTime);
      }
    }, 500);

    return () => clearInterval(id);
  }, [currentSession?.id, isActive]);

  return { remainingMs, setRemainingMs };
}


