import { useEffect, useRef, useState } from "react";

export function useSessionTimer({ currentSession, isActive, onComplete }) {
  const [remainingMs, setRemainingMs] = useState(0);

  // Avoid re-running the interval effect when parent passes a new inline callback each render.
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!currentSession || !isActive) return;
    const endTime =
      currentSession.endTimeMs ??
      Date.now() + currentSession.durationMinutes * 60 * 1000;
    setRemainingMs(endTime - Date.now());

    const id = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, endTime - now);
      setRemainingMs(remaining);
      if (remaining <= 0) {
        clearInterval(id);
        onCompleteRef.current?.(endTime);
      }
    }, 500);

    return () => clearInterval(id);
  }, [currentSession?.id, isActive]);

  return { remainingMs, setRemainingMs };
}


