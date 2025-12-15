import { useEffect, useRef, useState } from "react";

export function useToast({ durationMs = 2000 } = {}) {
  const [toastMessage, setToastMessage] = useState("");
  const timerRef = useRef(null);

  function showToast(message) {
    if (!message) return;
    setToastMessage(message);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => setToastMessage(""), durationMs);
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return { toastMessage, showToast };
}


