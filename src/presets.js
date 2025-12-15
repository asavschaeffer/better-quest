export const QUEST_PRESETS = [
  {
    id: "reading",
    description: "Reading",
    duration: 25,
    taskType: "INTELLIGENCE",
  },
  {
    id: "coding",
    description: "Coding",
    duration: 50,
    taskType: "INTELLIGENCE",
  },
  {
    id: "weightlifting",
    description: "Weightlifting",
    duration: 45,
    taskType: "STRENGTH",
  },
  {
    id: "yoga",
    description: "Yoga",
    duration: 30,
    taskType: "MIXED",
  },
];

export function applyPreset({ id, descriptionInput, durationInput, taskTypeSelect }) {
  if (id === "custom") {
    descriptionInput?.focus?.();
    return;
  }
  const preset = QUEST_PRESETS.find((p) => p.id === id);
  if (!preset) return;

  if (descriptionInput) descriptionInput.value = preset.description;
  if (durationInput && preset.duration) {
    durationInput.value = String(preset.duration);
  }
  if (taskTypeSelect && preset.taskType) {
    taskTypeSelect.value = preset.taskType;
  }
}

export function setActiveChip(nodeList, activeBtn) {
  nodeList.forEach((btn) => {
    if (btn === activeBtn) {
      btn.setAttribute("data-active", "true");
    } else {
      btn.removeAttribute("data-active");
    }
  });
}


