import { STAT_KEYS } from "./models.js";
import { computeStreakDays, updateQuestStreaks } from "./quests.js";

export const DEFAULT_SUNRISE_TIME_LOCAL = "06:30";

// Brahma Muhurta window relative to sunrise (in minutes before sunrise).
// Classic traditions vary; we pick a simple UX-friendly window for v1.
export const BRAHMA_WINDOW_START_MIN_BEFORE_SUNRISE = 96;
export const BRAHMA_WINDOW_END_MIN_BEFORE_SUNRISE = 48;

export function parseHHMM(input) {
  const s = (input ?? "").trim();
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number.parseInt(m[1], 10);
  const min = Number.parseInt(m[2], 10);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  if (h < 0 || h > 23) return null;
  if (min < 0 || min > 59) return null;
  return { hours: h, minutes: min };
}

export function getSunriseAtLocalMs({ referenceTimeMs, sunriseTimeLocal = DEFAULT_SUNRISE_TIME_LOCAL } = {}) {
  const parsed = parseHHMM(sunriseTimeLocal) ?? parseHHMM(DEFAULT_SUNRISE_TIME_LOCAL);
  if (!parsed) return null;
  const d = new Date(referenceTimeMs ?? Date.now());
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(parsed.hours, parsed.minutes, 0, 0);
  return d.getTime();
}

export function isWithinBrahmaWindow({
  endTimeMs,
  sunriseAtLocalMs,
  startMinBeforeSunrise = BRAHMA_WINDOW_START_MIN_BEFORE_SUNRISE,
  endMinBeforeSunrise = BRAHMA_WINDOW_END_MIN_BEFORE_SUNRISE,
} = {}) {
  const end = typeof endTimeMs === "number" ? endTimeMs : Date.parse(endTimeMs ?? "");
  if (!Number.isFinite(end)) return false;
  if (!Number.isFinite(sunriseAtLocalMs)) return false;
  const startOffset = Math.max(0, startMinBeforeSunrise) * 60 * 1000;
  const endOffset = Math.max(0, endMinBeforeSunrise) * 60 * 1000;
  const windowStart = sunriseAtLocalMs - startOffset;
  const windowEnd = sunriseAtLocalMs - endOffset;
  return end >= windowStart && end <= windowEnd;
}

export function sumStandExp(standExp = {}) {
  return STAT_KEYS.reduce((sum, k) => {
    const v = standExp?.[k];
    return sum + (typeof v === "number" && Number.isFinite(v) ? v : 0);
  }, 0);
}

/**
 * Apply Brahma Muhurta bonus: double SPI gains for "spiritual practice" sessions
 * (defined as allocation.SPI > 0) that end inside the configured window.
 *
 * This increases total EXP (does not steal from other stats).
 */
export function applyBrahmaMuhurtaBonus({
  session,
  exp,
  sunriseTimeLocal = DEFAULT_SUNRISE_TIME_LOCAL,
} = {}) {
  if (!exp?.standExp) return { exp, applied: false, breakdownEntry: null };
  const spiPoints = session?.allocation?.SPI ?? 0;
  if (!(typeof spiPoints === "number" && spiPoints > 0)) {
    return { exp, applied: false, breakdownEntry: null };
  }
  const endTimeMs =
    typeof session?.endTimeMs === "number"
      ? session.endTimeMs
      : Date.parse(session?.endTime || session?.completedAt || "");
  if (!Number.isFinite(endTimeMs)) return { exp, applied: false, breakdownEntry: null };

  const sunriseAt = getSunriseAtLocalMs({ referenceTimeMs: endTimeMs, sunriseTimeLocal });
  if (!Number.isFinite(sunriseAt)) return { exp, applied: false, breakdownEntry: null };
  const within = isWithinBrahmaWindow({ endTimeMs, sunriseAtLocalMs: sunriseAt });
  if (!within) return { exp, applied: false, breakdownEntry: null };

  const currentSpi = exp.standExp.SPI ?? 0;
  if (!(typeof currentSpi === "number" && currentSpi > 0)) {
    // If the quest has SPI points but split produced 0 SPI gain (very small sessions),
    // we skip to avoid implying a bonus that didn't change anything.
    return { exp, applied: false, breakdownEntry: null };
  }

  const nextStand = { ...exp.standExp, SPI: currentSpi * 2 };
  const nextTotal = sumStandExp(nextStand);
  const breakdownEntry = {
    key: "brahma",
    label: "Brahma Muhurta",
    mode: "stat_mult",
    stat: "SPI",
    value: 2,
    sunriseTimeLocal,
  };
  return {
    exp: { totalExp: nextTotal, standExp: nextStand },
    applied: true,
    breakdownEntry,
  };
}

/**
 * Compute strict streak bonuses for a session completion.
 *
 * Rules (v1):
 * - Global streak bonus: +20% if global streak days >= 2 (day 1 gives no bonus)
 * - Mandala (per-quest) bonus: +10% per day after day 1, capped at +100% (double)
 *   - i.e. streak=1 => +0%, streak=2 => +10%, ..., streak=11 => +100%
 */
export function computeStreakBonusEntries({
  sessions = [],
  questStreaks = {},
  questKey,
  completedAt,
} = {}) {
  const completedIso = completedAt
    ? new Date(completedAt).toISOString()
    : new Date().toISOString();
  const sessionsPlus = [
    { completedAt: completedIso },
    ...(Array.isArray(sessions) ? sessions : []),
  ];

  const globalStreakDays = computeStreakDays(sessionsPlus);
  const entries = [];
  if (globalStreakDays >= 2) {
    entries.push({
      key: "global_streak",
      label: "Global streak",
      mode: "add",
      value: 0.2,
      days: globalStreakDays,
    });
  }

  const nextQuestStreaks = updateQuestStreaks(questStreaks, questKey, completedIso);
  const mandalaDays = questKey ? nextQuestStreaks?.[questKey]?.streak ?? 0 : 0;
  if (mandalaDays >= 2) {
    const value = Math.min(1.0, 0.1 * (mandalaDays - 1));
    entries.push({
      key: "mandala_streak",
      label: "Mandala streak",
      mode: "add",
      value,
      days: mandalaDays,
      questKey,
    });
  }

  return { entries, nextQuestStreaks, globalStreakDays, mandalaDays };
}

export function resolveBonusMultiplier({ bonusBreakdown, fallbackMultiplier = 1 } = {}) {
  const breakdown = Array.isArray(bonusBreakdown) ? bonusBreakdown : [];
  const multProduct = breakdown
    .filter((b) => b?.mode === "mult")
    .reduce((p, b) => {
      const v = typeof b?.value === "number" && Number.isFinite(b.value) ? b.value : 1;
      return p * v;
    }, 1);
  const addSum = breakdown
    .filter((b) => b?.mode === "add")
    .reduce((s, b) => {
      const v = typeof b?.value === "number" && Number.isFinite(b.value) ? b.value : 0;
      return s + v;
    }, 0);

  const base = multProduct !== 1 ? multProduct : (fallbackMultiplier ?? 1);
  return base * (1 + addSum);
}


