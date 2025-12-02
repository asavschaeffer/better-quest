export const TaskType = Object.freeze({
  STRENGTH: "STRENGTH",
  STAMINA: "STAMINA",
  INTELLIGENCE: "INTELLIGENCE",
  MIXED: "MIXED",
});

export const SessionStatus = Object.freeze({
  IDLE: "idle",
  RUNNING: "running",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
});

export function createUser({ id = "user-1", name = "You", avatar } = {}) {
  return {
    id,
    name,
    avatar: avatar ?? createDefaultAvatar(),
  };
}

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

export function createTaskSession({
  id,
  description,
  durationMinutes,
  taskType,
  startTime,
  isBreak = false,
}) {
  if (!id) {
    throw new Error("TaskSession id is required");
  }
  if (!description || !description.trim()) {
    throw new Error("TaskSession description is required");
  }
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    throw new Error("TaskSession durationMinutes must be > 0");
  }

  return {
    id,
    description: description.trim(),
    durationMinutes,
    taskType: taskType ?? TaskType.INTELLIGENCE,
    status: SessionStatus.RUNNING,
    startTime: startTime ?? new Date().toISOString(),
    endTime: null,
    expGranted: null,
    icon: null,
    isBreak,
  };
}


