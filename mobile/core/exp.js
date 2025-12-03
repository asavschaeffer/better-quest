import { TaskType } from "./models";

const EXP_PER_MINUTE = 10;
const MIN_SESSION_MINUTES = 1;
const MAX_SESSION_MINUTES = 240;

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

  const baseTotal = durationMinutes * EXP_PER_MINUTE;
  const splits = getAttributeSplits(session.taskType);

  const strengthExp = Math.round(baseTotal * splits.strength);
  const staminaExp = Math.round(baseTotal * splits.stamina);
  const intelligenceExp = Math.round(baseTotal * splits.intelligence);

  const totalExp = strengthExp + staminaExp + intelligenceExp;

  return {
    totalExp,
    strengthExp,
    staminaExp,
    intelligenceExp,
  };
}

export function applyExpToAvatar(avatar, expResult) {
  const totalExp = (avatar.totalExp ?? 0) + expResult.totalExp;
  const strengthExp = (avatar.strengthExp ?? 0) + expResult.strengthExp;
  const staminaExp = (avatar.staminaExp ?? 0) + expResult.staminaExp;
  const intelligenceExp =
    (avatar.intelligenceExp ?? 0) + expResult.intelligenceExp;

  const level = getLevelForTotalExp(totalExp);

  return {
    ...avatar,
    totalExp,
    strengthExp,
    staminaExp,
    intelligenceExp,
    level,
  };
}

function getAttributeSplits(taskType) {
  switch (taskType) {
    case TaskType.STRENGTH:
      return { strength: 0.7, stamina: 0.3, intelligence: 0.0 };
    case TaskType.STAMINA:
      return { strength: 0.2, stamina: 0.8, intelligence: 0.0 };
    case TaskType.INTELLIGENCE:
      return { strength: 0.0, stamina: 0.0, intelligence: 1.0 };
    case TaskType.MIXED:
    default:
      return { strength: 0.0, stamina: 0.5, intelligence: 0.5 };
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function zeroExpResult() {
  return {
    totalExp: 0,
    strengthExp: 0,
    staminaExp: 0,
    intelligenceExp: 0,
  };
}


