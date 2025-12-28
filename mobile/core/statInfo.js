// Stat meaning copy is sourced from `docs/todo.txt` (kept in sync manually for now).
// STR/DEX/STA/INT/SPI/CHA/VIT

export const STAT_INFO = {
  STR: {
    name: "Strength",
    description:
      "That which requires great force to do. Included, therefore, is mental strength. That which is genuinely hard to do.",
  },
  DEX: {
    name: "Dexterity",
    description:
      "That which requires great expertise to do. Technical, fine skills. Attention to detail.",
  },
  STA: {
    name: "Stamina",
    description: "Sustained unrelenting struggle over time.",
  },
  INT: {
    name: "Intelligence",
    description: "Thinking hard.",
  },
  SPI: {
    name: "Spirit",
    description: "Not thinking. Feeling. The godliness inbetween the moments of suffering.",
  },
  CHA: {
    name: "Charisma",
    description: "Interpersonal skills.",
  },
  VIT: {
    name: "Vitality",
    description: "Biohacking in general.",
  },
};

export function getStatInfo(statKey) {
  if (!statKey) return null;
  return STAT_INFO?.[statKey] ?? null;
}


