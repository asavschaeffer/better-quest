// Intended v1: keep numbers small and legible.
const EXP_PER_MINUTE = 1;
const MIN_SESSION_MINUTES = 1;
const MAX_SESSION_MINUTES = 240;
const STAND_KEYS = ["STR", "DEX", "STA", "INT", "SPI", "CHA", "VIT"];

export function getTotalExpForLevel(level) {
  if (level <= 1) return 0;
  return 50 * (level - 1) * level;
}

export function getLevelForTotalExp(totalExp) {
  if (totalExp <= 0) return 1;

  let level = 1;
  while (true) {
    const nextLevel = level + 1;
    const requiredForNext = getTotalExpForLevel(nextLevel);
    if (totalExp < requiredForNext) {
      return level;
    }
    level = nextLevel;
    if (level > 1000) return 1000;
  }
}

export function getLevelProgress(totalExp) {
  const level = getLevelForTotalExp(totalExp);
  const currentLevelFloor = getTotalExpForLevel(level);
  const nextLevel = level + 1;
  const nextLevelFloor = getTotalExpForLevel(nextLevel);
  const span = nextLevelFloor - currentLevelFloor || 1;
  const intoLevel = totalExp - currentLevelFloor;

  return {
    level,
    current: intoLevel,
    required: span,
    ratio: Math.max(0, Math.min(1, intoLevel / span)),
  };
}

export function calculateExpForSession(session) {
  const durationMinutes = clamp(
    Math.floor(session.durationMinutes ?? 0),
    MIN_SESSION_MINUTES,
    MAX_SESSION_MINUTES,
  );

  if (durationMinutes <= 0) {
    return zeroExpResult();
  }

  const totalExp = durationMinutes * EXP_PER_MINUTE;

  // Mechanical intent: use allocation points (0–3 per stat) as weights.
  // If allocation is missing (older sessions), fall back to standStats snapshot.
  const standExp = splitTotalExp(totalExp, session.allocation ?? null, session.standStats ?? null);
  return {
    totalExp,
    standExp,
  };
}

export function applyExpToAvatar(avatar, expResult) {
  const totalExp = (avatar.totalExp ?? 0) + (expResult.totalExp ?? 0);

  const standExp = { ...(avatar.standExp ?? {}) };
  const gainedStand = expResult.standExp ?? {};
  STAND_KEYS.forEach((key) => {
    const prev = typeof standExp[key] === "number" ? standExp[key] : 0;
    const add = typeof gainedStand[key] === "number" ? gainedStand[key] : 0;
    standExp[key] = prev + add;
  });

  const level = getLevelForTotalExp(totalExp);

  return {
    ...avatar,
    totalExp,
    standExp,
    level,
  };
}

export function splitTotalExp(totalExp, allocation, standStatsFallback) {
  const total = typeof totalExp === "number" && Number.isFinite(totalExp) ? Math.max(0, Math.round(totalExp)) : 0;
  if (total <= 0) return zeroExpResult().standExp;

  // Prefer allocation points (0–3). These are the authoritative weights.
  const points = {};
  let sumPoints = 0;
  STAND_KEYS.forEach((key) => {
    const raw = allocation?.[key];
    const val =
      typeof raw === "number" && Number.isFinite(raw) ? Math.max(0, Math.min(3, Math.floor(raw))) : 0;
    points[key] = val;
    sumPoints += val;
  });

  // Back-compat fallback: older sessions stored chart-ish standStats values.
  // Convert 1–6-ish values into non-negative weights using (raw - 1).
  if (sumPoints <= 0 && standStatsFallback) {
    STAND_KEYS.forEach((key) => {
      const raw = standStatsFallback?.[key];
      const val =
        typeof raw === "number" && Number.isFinite(raw) ? Math.max(0, raw - 1) : 0;
      points[key] = val;
      sumPoints += val;
    });
  }

  // If still zero, split uniformly (prevents "no weights => no XP").
  if (sumPoints <= 0) {
    const base = Math.floor(total / STAND_KEYS.length);
    const remainder = total - base * STAND_KEYS.length;
    const standExp = {};
    STAND_KEYS.forEach((k, idx) => {
      standExp[k] = base + (idx < remainder ? 1 : 0);
    });
    return standExp;
  }

  // Conserved split:
  // - allocate floors
  // - distribute remainder by fractional part (ties broken by fixed key order)
  const rawParts = STAND_KEYS.map((key) => {
    const raw = (total * points[key]) / sumPoints;
    const flo = Math.floor(raw);
    return { key, raw, flo, frac: raw - flo };
  });

  const standExp = {};
  let used = 0;
  rawParts.forEach((p) => {
    standExp[p.key] = p.flo;
    used += p.flo;
  });
  let remainder = total - used;

  rawParts
    .slice()
    .sort((a, b) => {
      if (b.frac !== a.frac) return b.frac - a.frac;
      return STAND_KEYS.indexOf(a.key) - STAND_KEYS.indexOf(b.key);
    })
    .forEach((p) => {
      if (remainder <= 0) return;
      standExp[p.key] += 1;
      remainder -= 1;
    });

  return standExp;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function zeroExpResult() {
  const standExp = {};
  STAND_KEYS.forEach((key) => {
    standExp[key] = 0;
  });
  return {
    totalExp: 0,
    strengthExp: 0,
    staminaExp: 0,
    intelligenceExp: 0,
    standExp,
  };
}


