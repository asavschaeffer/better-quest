import { STAT_KEYS } from "./models.js";
import { BUILT_IN_QUEST_TEMPLATES } from "./questStorage.js";
import { playerStatsToChartValues } from "./stats.js";

export function normalizePrefs(focusStats) {
  const prefs = {};
  STAT_KEYS.forEach((key) => {
    const raw = focusStats?.[key] ?? 1;
    const clamped = Math.max(1, Math.min(5, raw));
    prefs[key] = (clamped - 1) / 4;
  });
  return prefs;
}

export function scoreQuest(template, prefs) {
  let score = 0;
  const stats = template.stats || {};
  STAT_KEYS.forEach((key) => {
    const level = stats[key] ?? 0;
    const levelNorm = Math.max(0, Math.min(3, level)) / 3;
    score += prefs[key] * levelNorm;
  });
  return score;
}

export function computeTextScore(template, query) {
  const q = (query ?? "").trim().toLowerCase();
  if (!q) return 0;

  const parts = [template.label, template.description, ...(template.keywords ?? [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (!parts) return 0;
  if (parts.startsWith(q)) return 3;
  if (parts.includes(` ${q}`)) return 2;
  if (parts.includes(q)) return 1;
  return 0;
}

export function rankQuests(templates, focusStats, query) {
  const prefs = normalizePrefs(focusStats);
  return templates
    .map((t) => ({
      ...t,
      score: scoreQuest(t, prefs) + computeTextScore(t, query) * 0.5,
    }))
    .sort((a, b) => b.score - a.score);
}

export function computeQuickstartSuggestions(userQuests, avatar) {
  const focusStats = playerStatsToChartValues(avatar?.standExp || {});
  const templates = [...(userQuests || []), ...BUILT_IN_QUEST_TEMPLATES];
  const ranked = rankQuests(templates, focusStats, "");
  return ranked.slice(0, 3);
}

export function computeStreakDays(sessions = []) {
  if (!sessions.length) return 0;
  const dates = Array.from(
    new Set(
      sessions
        .map((s) => new Date(s.completedAt || s.endTime || s.startTime))
        .filter((d) => !Number.isNaN(d.getTime()))
        .map((d) => d.toDateString()),
    ),
  )
    .map((d) => new Date(d))
    .sort((a, b) => b - a);

  let streak = 0;
  let cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  for (const d of dates) {
    d.setHours(0, 0, 0, 0);
    if (d.getTime() === cursor.getTime()) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }
    // Allow the streak to start at "yesterday" if there is no session today,
    // but once the streak has started we require strict day-by-day continuity.
    if (streak === 0 && d.getTime() === cursor.getTime() - 86400000) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }
    break;
  }
  return streak;
}

export function updateQuestStreaks(prev = {}, questKey, completedAt) {
  if (!questKey) return prev;
  const d = new Date(completedAt || Date.now());
  if (Number.isNaN(d.getTime())) return prev;
  d.setHours(0, 0, 0, 0);
  const day = d.toISOString();
  const existing = prev[questKey];
  const lastDay = existing?.lastDay ? new Date(existing.lastDay) : null;
  let streak = 1;
  if (lastDay && !Number.isNaN(lastDay.getTime())) {
    lastDay.setHours(0, 0, 0, 0);
    const diff = d.getTime() - lastDay.getTime();
    if (diff === 0) {
      streak = existing.streak || 1;
    } else if (diff === 86400000) {
      streak = (existing.streak || 1) + 1;
    }
  }
  return {
    ...prev,
    [questKey]: {
      lastDay: day,
      streak,
    },
  };
}

export function getMaxMandalaStreak(streaks = {}) {
  const values = Object.values(streaks).map((s) => s?.streak || 0);
  if (!values.length) return 0;
  return Math.max(...values);
}

export function computeAggregateConsistency(sessions = []) {
  if (!sessions.length) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const msPerDay = 86400000;
  const activeDays = { week: new Set(), month: new Set() };
  sessions.forEach((s) => {
    const d = new Date(s.completedAt || s.endTime || s.startTime);
    if (Number.isNaN(d.getTime())) return;
    d.setHours(0, 0, 0, 0);
    const diffDays = (today.getTime() - d.getTime()) / msPerDay;
    if (diffDays >= 0 && diffDays < 7) {
      activeDays.week.add(d.toDateString());
    }
    if (diffDays >= 0 && diffDays < 30) {
      activeDays.month.add(d.toDateString());
    }
  });
  const weekRatio = activeDays.week.size / 7;
  const monthRatio = activeDays.month.size / 30;
  return Math.max(0, Math.min(1, weekRatio * 0.6 + monthRatio * 0.4));
}
