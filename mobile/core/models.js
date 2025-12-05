export const TaskType = Object.freeze({
  STRENGTH: "STRENGTH",
  STAMINA: "STAMINA",
  INTELLIGENCE: "INTELLIGENCE",
  MIXED: "MIXED",
});

export function createDefaultAvatar() {
  return {
    id: "avatar-1",
    name: "Adventurer",
    level: 1,
    totalExp: 0,
    standExp: {
      STR: 0,
      DEX: 0,
      STA: 0,
      INT: 0,
      SPI: 0,
      CRE: 0,
      VIT: 0,
    },
  };
}

export function createUser({ id = "user-1", name = "You", avatar } = {}) {
  return {
    id,
    name,
    avatar: avatar ?? createDefaultAvatar(),
  };
}

export function createTaskSession({
  id,
  description,
  durationMinutes,
  taskType,
  startTime,
  standStats,
  isBreak = false,
  comboBonus = false,
  restBonus = false,
  bonusMultiplier = 1,
}) {
  return {
    id,
    description: description.trim(),
    durationMinutes,
    taskType: taskType ?? TaskType.INTELLIGENCE,
    startTime: startTime ?? new Date().toISOString(),
    endTime: null,
    standStats: standStats ?? null,
    isBreak,
    comboBonus,
    restBonus,
    bonusMultiplier,
    icon: null,
  };
}


