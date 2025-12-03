const EMOJI_RULES = [
  { keywords: ["run", "jog", "cardio"], emoji: "🏃" },
  { keywords: ["walk"], emoji: "🚶" },
  { keywords: ["yoga", "stretch"], emoji: "🧘" },
  { keywords: ["lift", "weights", "gym"], emoji: "🏋️" },
  { keywords: ["bike", "cycling"], emoji: "🚴" },
  { keywords: ["study", "read", "homework", "exam"], emoji: "📚" },
  { keywords: ["code", "program", "bug"], emoji: "💻" },
  { keywords: ["math"], emoji: "➗" },
  { keywords: ["write", "journal", "essay"], emoji: "✍️" },
  { keywords: ["meditate", "breath", "breathe"], emoji: "🧘" },
  { keywords: ["music", "guitar", "piano"], emoji: "🎵" },
];

export function inferEmojiForDescription(description, fallback = "⏳") {
  if (!description) return fallback;
  const text = description.toLowerCase();

  for (const rule of EMOJI_RULES) {
    if (rule.keywords.some((kw) => text.includes(kw))) {
      return rule.emoji;
    }
  }

  return fallback;
}


