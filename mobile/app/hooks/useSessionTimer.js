import { useEffect, useState } from "react";

export function useSessionTimer({ currentSession, screen, onComplete }) {
  const [remainingMs, setRemainingMs] = useState(0);

  useEffect(() => {
    if (!currentSession || screen !== "session") return;
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
        onComplete?.(endTime);
      }
    }, 500);

    return () => clearInterval(id);
  }, [currentSession?.id, screen, onComplete]);

  return { remainingMs, setRemainingMs };
}


