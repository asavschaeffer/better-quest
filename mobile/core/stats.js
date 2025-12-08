import { STAT_KEYS } from "./models";

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

export function playerStatsToChartValues(standExp) {
  const chartValues = {};
  const values = STAT_KEYS.map((key) => standExp?.[key] ?? 0);
  const maxStat = Math.max(...values, 1);

  STAT_KEYS.forEach((key) => {
    const exp = standExp?.[key] ?? 0;
    if (exp === 0) {
      chartValues[key] = 1;
    } else {
      const logValue = Math.log10(exp + 1);
      const logMax = Math.log10(maxStat + 1);
      const normalized = logMax > 0 ? logValue / logMax : 0;
      // Base value from relative normalization (1 to MAX_CHART_VALUE)
      const baseValue = 1 + normalized * (MAX_CHART_VALUE - 1);
      // Add floor so stats with meaningful EXP don't sit at E
      // 100+ EXP = at least D (2), 50+ EXP = at least D- (1.5)
      const floor = exp >= 100 ? 2 : exp >= 50 ? 1.5 : 1;
      chartValues[key] = Math.max(floor, baseValue);
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
