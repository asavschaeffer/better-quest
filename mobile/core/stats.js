import { STAT_KEYS } from "./models.js";

// Canonical stat axis definitions (order matters).
// Used by radar charts and compact stat badge formatting across the app.
export const STAT_ATTRS = [
  { key: "STR", label: "STR", color: "#ef4444" },
  { key: "DEX", label: "DEX", color: "#f97316" },
  { key: "STA", label: "STA", color: "#eab308" },
  { key: "INT", label: "INT", color: "#3b82f6" },
  { key: "SPI", label: "SPI", color: "#a855f7" },
  { key: "CHA", label: "CHA", color: "#ec4899" },
  { key: "VIT", label: "VIT", color: "#22c55e" },
];

export function getPlayerTitle(level) {
  if (level >= 50) return "Legendary Hero";
  if (level >= 40) return "Master";
  if (level >= 30) return "Expert";
  if (level >= 20) return "Veteran";
  if (level >= 10) return "Adventurer";
  if (level >= 5) return "Apprentice";
  return "Novice";
}

export function getAvatarPose(standExp = {}) {
  const entries = STAT_KEYS.map((k) => [k, standExp[k] ?? 0]);
  const [topKey] = entries.sort((a, b) => b[1] - a[1])[0] || ["STR", 0];
  if (topKey === "STR") return "flex";
  if (topKey === "SPI") return "serene";
  return "idle";
}

export function getUnlockedAccessories(level) {
  const accessories = [];
  if (level >= 3) accessories.push("wand");
  if (level >= 10) accessories.push("wizardHat");
  if (level >= 25) accessories.push("crown");
  if (level >= 50) accessories.push("popeHat");
  return accessories;
}

// Chart scale: E=1, D=2, C=3, B=4, A=5, S=6
const MAX_CHART_VALUE = 6;

export function playerStatsToChartValues(standExp, options = {}) {
  const chartValues = {};
  const values = STAT_KEYS.map((key) => standExp?.[key] ?? 0);
  const override = options?.maxStatOverride;
  const maxStat =
    typeof override === "number" && Number.isFinite(override) && override > 0
      ? override
      : Math.max(...values, 1);

  STAT_KEYS.forEach((key) => {
    const exp = standExp?.[key] ?? 0;
    if (exp === 0) {
      chartValues[key] = 1; // E tier for zero
    } else {
      // Linear normalization: ratio to max stat
      const ratio = exp / maxStat;
      // Map ratio to chart scale: 0→E(1), 1→S(6)
      const baseValue = 1 + ratio * (MAX_CHART_VALUE - 1);
      // Small floor: stats with some EXP don't show as completely empty
      // 50+ EXP = at least E+ (1.3)
      const floor = exp >= 50 ? 1.3 : 1;
      chartValues[key] = Math.min(MAX_CHART_VALUE, Math.max(floor, baseValue));
    }
  });

  return chartValues;
}

export function addStandExp(current = {}, delta = {}) {
  const next = {};
  STAT_KEYS.forEach((k) => {
    const base = typeof current[k] === "number" ? current[k] : 0;
    const add = typeof delta[k] === "number" ? delta[k] : 0;
    next[k] = base + add;
  });
  return next;
}

export function aggregateStandGains(sessions = []) {
  const totals = {};
  STAT_KEYS.forEach((k) => {
    totals[k] = 0;
  });
  sessions.forEach((s) => {
    const gains = s.expResult?.standExp || {};
    STAT_KEYS.forEach((k) => {
      const inc = gains[k] ?? 0;
      totals[k] += typeof inc === "number" ? inc : 0;
    });
  });
  return totals;
}

export function computeTodayStandExp(sessions = []) {
  const totals = {};
  STAT_KEYS.forEach((k) => {
    totals[k] = 0;
  });
  if (!sessions.length) return totals;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();
  sessions.forEach((s) => {
    const d = new Date(s.completedAt || s.endTime || s.startTime);
    if (Number.isNaN(d.getTime())) return;
    d.setHours(0, 0, 0, 0);
    if (d.getTime() !== todayMs) return;
    const gains = s.expResult?.standExp || {};
    STAT_KEYS.forEach((k) => {
      totals[k] += typeof gains[k] === "number" ? gains[k] : 0;
    });
  });
  return totals;
}

/**
 * formatStatBadges - Compact stat summary string for list rows.
 *
 * Allocation mode (0-2): STR+ / STR++ (omits zeros)
 * Gains mode (arbitrary numbers): top stats converted into + / ++ based on relative magnitude.
 */
export function formatStatBadges(stats, options = {}) {
  const maxParts =
    typeof options.maxParts === "number" && Number.isFinite(options.maxParts) && options.maxParts > 0
      ? Math.floor(options.maxParts)
      : 3;
  const mode = options.mode || "auto"; // "auto" | "allocation" | "gains"

  const obj = stats && typeof stats === "object" ? stats : null;
  if (!obj) return "";

  // Determine mode.
  let resolvedMode = mode;
  if (resolvedMode === "auto") {
    const vals = STAT_KEYS.map((k) => obj[k]);
    const looksLikeAllocation = vals.every((v) => {
      if (typeof v !== "number" || !Number.isFinite(v)) return true; // treat missing as 0
      return v >= 0 && v <= 2;
    });
    resolvedMode = looksLikeAllocation ? "allocation" : "gains";
  }

  if (resolvedMode === "allocation") {
    const parts = [];
    STAT_KEYS.forEach((k) => {
      const raw = obj[k];
      const v = typeof raw === "number" && Number.isFinite(raw) ? Math.floor(raw) : 0;
      if (v <= 0) return;
      if (v >= 2) parts.push(`${k}++`);
      else parts.push(`${k}+`);
    });
    return parts.slice(0, maxParts).join(" ");
  }

  // Gains: pick top stats and quantize into + / ++ relative to max.
  const entries = STAT_KEYS.map((k) => {
    const raw = obj[k];
    const v = typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
    return { k, v };
  }).filter((e) => e.v > 0);

  if (!entries.length) return "";

  entries.sort((a, b) => b.v - a.v);
  const top = entries.slice(0, maxParts);
  const max = top[0]?.v ?? 0;
  if (max <= 0) return "";

  const threshold = max * 0.6; // "biggest gains" show as ++
  return top
    .map((e) => (e.v >= threshold ? `${e.k}++` : `${e.k}+`))
    .join(" ");
}
