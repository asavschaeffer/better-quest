const EXP_PER_MINUTE = 10;
const MIN_SESSION_MINUTES = 1;
const MAX_SESSION_MINUTES = 240;
const STAND_KEYS = ["STR", "DEX", "STA", "INT", "SPI", "CRE", "VIT"];

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

  // Use the stand stats snapshot on the session (1–5 values) to decide
  // how EXP is distributed across the seven axes.
  const splits = getStandSplits(session.standStats);

  const standExp = {};
  STAND_KEYS.forEach((key) => {
    const share = splits[key] ?? 0;
    standExp[key] = Math.round(totalExp * share);
  });
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

function getStandSplits(standStats) {
  // standStats holds values 1–5 for each axis. Convert to 0–1 weights.
  const weights = {};
  let sum = 0;
  STAND_KEYS.forEach((key) => {
    const raw = standStats?.[key];
    const val =
      typeof raw === "number" && Number.isFinite(raw) ? Math.max(0, raw - 1) : 0;
    weights[key] = val;
    sum += val;
  });

  if (sum <= 0) {
    const uniform = 1 / STAND_KEYS.length;
    STAND_KEYS.forEach((key) => {
      weights[key] = uniform;
    });
    return weights;
  }

  STAND_KEYS.forEach((key) => {
    weights[key] = weights[key] / sum;
  });
  return weights;
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


