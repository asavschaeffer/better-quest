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
    const levelNorm = Math.max(0, Math.min(2, level)) / 2;
    score += prefs[key] * levelNorm;
  });
  return score;
}

export function computeTextScore(template, query) {
  const q = (query ?? "").trim().toLowerCase();
  if (!q) return 0;

  const parts = [
    template.label,
    template.description,
    template.verb,
    ...(template.keywords ?? []),
    ...(template.tags ?? []),
  ]
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

/**
 * Miller's Law-based quest suggestions (5–9 quests).
 * Combines budget-gap need + chart selection + text scoring.
 *
 * Text and stats always blend (soft boost, never hard filter):
 * - Text contributes a bonus score (prefix > word-boundary > substring)
 * - Stats from budget gap + chart selection determine the base ranking
 * - The stat chart can always reshuffle rankings, even with text present
 *
 * @param {object} params
 * @param {Array} params.quests - All quest templates (user + built-in)
 * @param {object} params.budgets - Per-stat daily budgets (EXP)
 * @param {object} params.spentToday - Per-stat EXP spent today
 * @param {object} params.selectedAllocation - Per-stat allocation (0–2) from chart selection
 * @param {string} params.query - Text search query (or intent seed from selected quest)
 * @param {number} params.limit - Max results (default 7, clamped 5–9)
 * @param {number} params.textWeight - Override text influence (default 0.45; use lower for intent seeds)
 * @returns {Array} Top quest suggestions
 */
export function suggestQuests({
  quests = [],
  budgets = {},
  spentToday = {},
  selectedAllocation = {},
  scopeId = "", // optional hierarchy scope (family id). When set, filter to that family (+ itself).
  query = "",
  textMode = "filter_if_matches", // "filter_if_matches" | "filter_if_confident" | "score_only"
  limit = 7,
  textWeight = 0.45,
} = {}) {
  // Miller's Law: limit to 5–9 suggestions
  const effectiveLimit = Math.max(5, Math.min(9, limit));

  // Compute budget-gap weights (per stat)
  const remainingAbs = {};
  const remainingFrac = {};
  STAT_KEYS.forEach((k) => {
    const budget = budgets?.[k] ?? 0;
    const spent = spentToday?.[k] ?? 0;
    remainingAbs[k] = Math.max(0, budget - spent);
    remainingFrac[k] = budget > 0 ? Math.max(0, 1 - spent / budget) : 0;
  });

  // Normalize vectors to 0..1 range
  const normalize = (obj) => {
    const vals = STAT_KEYS.map((k) => obj[k] ?? 0);
    const maxVal = Math.max(...vals, 1);
    const result = {};
    STAT_KEYS.forEach((k) => {
      result[k] = (obj[k] ?? 0) / maxVal;
    });
    return result;
  };

  const normAbs = normalize(remainingAbs);
  const normFrac = normalize(remainingFrac);

  // needWeight = 70% fraction + 30% absolute
  const needWeight = {};
  STAT_KEYS.forEach((k) => {
    needWeight[k] = 0.7 * normFrac[k] + 0.3 * normAbs[k];
  });

  // chartWeight from selectedAllocation (normalize 0–2 to 0–1)
  const chartWeight = {};
  STAT_KEYS.forEach((k) => {
    const alloc = selectedAllocation?.[k] ?? 0;
    chartWeight[k] = Math.max(0, Math.min(2, alloc)) / 2;
  });

  // Final stat weight: 50% need + 50% chart
  const statWeight = {};
  STAT_KEYS.forEach((k) => {
    statWeight[k] = 0.5 * needWeight[k] + 0.5 * chartWeight[k];
  });

  // Ignore very short queries (reduces noise while typing)
  const rawQuery = (query ?? "").trim();
  const qText = rawQuery.length >= 2 ? rawQuery : "";

  // Optional hierarchy scope: a single canonical parent defines the "zoomed in" set.
  const scopedQuests = (() => {
    const s = (scopeId ?? "").trim();
    if (!s) return Array.isArray(quests) ? quests : [];
    const filtered = (Array.isArray(quests) ? quests : []).filter(
      (q) => q?.id === s || q?.parentId === s,
    );
    // Robustness: if the caller provided a scopeId that doesn't exist in this quest pool
    // (e.g., legacy "flat" quests), fall back to the full set instead of returning nothing.
    return filtered.length ? filtered : (Array.isArray(quests) ? quests : []);
  })();

  // Score each quest by dot product with stat weights + text bonus
  const scoredWithText = scopedQuests.map((quest) => {
    const stats = quest.stats || {};
    let statScore = 0;
    STAT_KEYS.forEach((k) => {
      const questStatNorm = Math.max(0, Math.min(2, stats[k] ?? 0)) / 2;
      statScore += statWeight[k] * questStatNorm;
    });

    const textScore = computeTextScore(quest, qText);

    return {
      ...quest,
      suggestionScore: statScore + textScore * textWeight,
      __textScore: textScore,
    };
  });

  // Sort by score descending
  scoredWithText.sort((a, b) => b.suggestionScore - a.suggestionScore);

  const stripInternal = (arr) =>
    arr.map(({ __textScore, ...rest }) => rest);

  // Text modes:
  // - filter_if_matches: if query is present, return only matches (else empty)
  // - filter_if_confident: only filter when the text signal is strong (avoids jumpiness for weak queries)
  // - score_only: never filter; text only boosts ranking
  if (!qText) {
    return stripInternal(scoredWithText.slice(0, effectiveLimit));
  }

  if (textMode === "score_only") {
    return stripInternal(scoredWithText.slice(0, effectiveLimit));
  }

  const matches = scoredWithText.filter((q) => (q.__textScore || 0) > 0);
  if (!matches.length) {
    // For strict filtering modes, no matches means no results.
    return [];
  }

  if (textMode === "filter_if_confident") {
    const maxTextScore = Math.max(...matches.map((m) => m.__textScore || 0), 0);
    const shouldFilter = maxTextScore >= 2 || matches.length <= 12;
    return stripInternal(
      (shouldFilter ? matches : scoredWithText).slice(0, effectiveLimit),
    );
  }

  // Default: strict filter when query exists and any match exists
  return stripInternal(matches.slice(0, effectiveLimit));
}