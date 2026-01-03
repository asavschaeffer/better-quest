// Stat meaning copy is sourced from `docs/todo.txt` (kept in sync manually for now).
// STR/DEX/STA/INT/SPI/CHA/VIT

export const STAT_INFO = {
  STR: {
    name: "Strength",
    color: "#ef4444",
    colorDark: "#7f1d1d",
    icon: "barbell-outline",
    description: "That which requires great force—physical or mental. The genuinely hard things.",
    quote: "Strength does not come from physical capacity. It comes from an indomitable will.",
    quoteAuthor: "Mahatma Gandhi",
  },
  DEX: {
    name: "Dexterity",
    color: "#f97316",
    colorDark: "#7c2d12",
    icon: "hand-left-outline",
    description: "Technical mastery and fine motor skills. Precision, craft, and attention to detail.",
    quote: "Excellence is not a skill, it's an attitude.",
    quoteAuthor: "Ralph Marston",
  },
  STA: {
    name: "Stamina",
    color: "#eab308",
    colorDark: "#713f12",
    icon: "fitness-outline",
    description: "Sustained effort over time. Endurance through discomfort and fatigue.",
    quote: "It's not that I'm so smart, it's just that I stay with problems longer.",
    quoteAuthor: "Albert Einstein",
  },
  INT: {
    name: "Intelligence",
    color: "#3b82f6",
    colorDark: "#1e3a8a",
    icon: "bulb",
    description: "Deep thinking, learning, and expanding your mental capacity.",
    quote: "The mind is not a vessel to be filled, but a fire to be kindled.",
    quoteAuthor: "Plutarch",
  },
  SPI: {
    name: "Spirit",
    color: "#e5e7eb",
    colorDark: "#374151",
    icon: "ellipse-outline",
    description: "Stillness and presence. The godliness between moments of suffering.",
    quote: "Almost everything will work again if you unplug it for a few minutes, including you.",
    quoteAuthor: "Anne Lamott",
  },
  CHA: {
    name: "Charisma",
    color: "#a855f7",
    colorDark: "#581c87",
    icon: "chatbubbles",
    description: "Connection, communication, and social presence. Interpersonal mastery.",
    quote: "The most important thing in communication is hearing what isn't said.",
    quoteAuthor: "Peter Drucker",
  },
  VIT: {
    name: "Vitality",
    color: "#22c55e",
    colorDark: "#14532d",
    icon: "nutrition-outline",
    description: "Health optimization and recovery. The foundation that powers all other stats.",
    quote: "Take care of your body. It's the only place you have to live.",
    quoteAuthor: "Jim Rohn",
  },
};

export function getStatInfo(statKey) {
  if (!statKey) return null;
  return STAT_INFO?.[statKey] ?? null;
}


