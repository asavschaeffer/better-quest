import { createTaskSession } from "./models.js";

export function formatTime(ms) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function applySessionBonuses(session, baseExp) {
  const mult = session.bonusMultiplier ?? 1;
  if (mult === 1) return baseExp;
  const totalExp = Math.round(baseExp.totalExp * mult);
  const standExp = {};
  if (baseExp.standExp) {
    Object.entries(baseExp.standExp).forEach(([key, value]) => {
      const v = typeof value === "number" ? value : 0;
      standExp[key] = Math.round(v * mult);
    });
  }
  return {
    totalExp,
    standExp,
  };
}

export function startBreakSession({
  durationMinutes,
  sessionManager,
  sessionTaskText,
  sessionTaskType,
  sessionEmoji,
  showSessionView,
}) {
  const id = `break-${Date.now()}`;
  const description = "Break";

  const breakSession = createTaskSession({
    id,
    description,
    durationMinutes,
    startTime: new Date().toISOString(),
    isBreak: true,
  });

  breakSession.icon = "☕";

  sessionManager.startSession(breakSession);

  sessionTaskText.textContent = "Break";
  sessionTaskType.textContent = "Break";
  sessionEmoji.textContent = breakSession.icon;

  showSessionView();

  return breakSession;
}


