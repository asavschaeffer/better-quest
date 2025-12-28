// Intended v1: keep numbers small and legible.
const EXP_PER_MINUTE = 1;
const MIN_SESSION_MINUTES = 1;
const MAX_SESSION_MINUTES = 240;
const STAND_KEYS = ["STR", "DEX", "STA", "INT", "SPI", "CHA", "VIT"];

// Level curve:
// - Fast early leveling
// - Slows down over time
// - Asymptotically approaches MAX_LEVEL
const MAX_LEVEL = 999;
// "How many EXP to reach ~63% of the max delta" (since 1 - e^-1 ≈ 0.632).
// Tune this to make early leveling faster/slower.
const LEVEL_EXP_SCALE = 22_000;

export function getTotalExpForLevel(level) {
  const lv =
    typeof level === "number" && Number.isFinite(level) ? Math.floor(level) : 1;
  if (lv <= 1) return 0;
  if (lv >= MAX_LEVEL) return Number.POSITIVE_INFINITY;

  // Invert the asymptotic curve used by getLevelForTotalExp.
  // Continuous curve (before flooring):
  //   L = 1 + (MAX_LEVEL - 1) * (1 - exp(-E / S))
  // Solve for E:
  //   E = -S * ln(1 - (L - 1) / (MAX_LEVEL - 1))
  const x = (lv - 1) / (MAX_LEVEL - 1); // in (0, 1)
  const required = -LEVEL_EXP_SCALE * Math.log(1 - x);
  return Math.ceil(required);
}

export function getLevelForTotalExp(totalExp) {
  const e =
    typeof totalExp === "number" && Number.isFinite(totalExp) ? totalExp : 0;
  if (e <= 0) return 1;

  const raw =
    1 + (MAX_LEVEL - 1) * (1 - Math.exp(-e / LEVEL_EXP_SCALE));
  return Math.min(MAX_LEVEL, Math.max(1, Math.floor(raw)));
}

export function getLevelProgress(totalExp) {
  const level = getLevelForTotalExp(totalExp);
  if (level >= MAX_LEVEL) {
    return {
      level: MAX_LEVEL,
      current: 0,
      required: 0,
      ratio: 1,
    };
  }
  const currentLevelFloor = getTotalExpForLevel(level);
  const nextLevel = level + 1;
  const nextLevelFloor = getTotalExpForLevel(nextLevel);
  const span = nextLevelFloor - currentLevelFloor || 1;
  const e =
    typeof totalExp === "number" && Number.isFinite(totalExp) ? totalExp : 0;
  const intoLevel = e - currentLevelFloor;

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
      typeof raw === "number" && Number.isFinite(raw) ? Math.max(0, Math.min(2, Math.floor(raw))) : 0;
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


