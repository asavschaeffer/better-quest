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
    strengthExp: 0,
    staminaExp: 0,
    intelligenceExp: 0,
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
    isBreak,
    comboBonus,
    restBonus,
    bonusMultiplier,
    icon: null,
  };
}


