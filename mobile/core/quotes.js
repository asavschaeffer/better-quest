import AsyncStorage from "@react-native-async-storage/async-storage";

const QUOTES_STORAGE_KEY = "better-quest-user-quotes";

// Built-in quotes from various sources
export const BUILT_IN_QUOTES = [
  // Classic motivational
  "The journey of a thousand miles begins with a single step.",
  "You don't have to be great to start, but you have to start to be great.",
  "Small daily improvements are the key to staggering long-term results.",
  "Discipline is choosing between what you want now and what you want most.",
  "The only way to do great work is to love what you do.",
  
  // Andrej Karpathy on learning
  "Learning is not supposed to be fun. The primary feeling should be that of effort.",
  "You want the mental equivalent of sweating.",
  "Close those tabs of 'Learn XYZ in 10 minutes'. Seek the meal - textbooks, docs, papers, manuals, longform.",
  "Allocate a 4 hour window. Don't just read, take notes, re-read, re-phrase, process, manipulate, learn.",
  "Iteratively take on concrete projects and accomplish them depth wise, learning 'on demand'.",
  "Teach and summarize everything you learn in your own words.",
  "Only compare yourself to younger you, never to others.",
  
  // Stoic / Philosophy
  "We suffer more in imagination than in reality. - Seneca",
  "The impediment to action advances action. What stands in the way becomes the way. - Marcus Aurelius",
  "No man is free who is not master of himself. - Epictetus",
  "It is not that we have a short time to live, but that we waste a lot of it. - Seneca",
  
  // Growth mindset
  "The master has failed more times than the beginner has even tried.",
  "Every expert was once a beginner.",
  "Progress, not perfection.",
  "Done is better than perfect.",
  "The best time to plant a tree was 20 years ago. The second best time is now.",
  
  // Dark Souls wisdom
  "Don't give up, skeleton!",
  "Praise the sun!",
  "Every fleeing man must be caught. Every secret must be unearthed.",
];

/**
 * Load user-added quotes from storage
 */
export async function loadUserQuotes() {
  try {
    const raw = await AsyncStorage.getItem(QUOTES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn("Failed to load user quotes:", err);
    return [];
  }
}

/**
 * Save the full array of user quotes
 */
export async function saveUserQuotes(quotes) {
  try {
    await AsyncStorage.setItem(QUOTES_STORAGE_KEY, JSON.stringify(quotes));
  } catch (err) {
    console.warn("Failed to save user quotes:", err);
  }
}

/**
 * Add a new user quote
 */
export async function addUserQuote(text) {
  const trimmed = (text || "").trim();
  if (!trimmed) return [];
  
  const existing = await loadUserQuotes();
  // Avoid duplicates
  if (existing.some((q) => q.text === trimmed)) {
    return existing;
  }
  
  const newQuote = {
    id: `quote-${Date.now()}`,
    text: trimmed,
    createdAt: new Date().toISOString(),
  };
  
  const updated = [...existing, newQuote];
  await saveUserQuotes(updated);
  return updated;
}

/**
 * Delete a user quote by id
 */
export async function deleteUserQuote(quoteId) {
  const existing = await loadUserQuotes();
  const updated = existing.filter((q) => q.id !== quoteId);
  await saveUserQuotes(updated);
  return updated;
}

/**
 * Get all quotes (built-in + user)
 */
export function getAllQuotes(userQuotes = [], includeBuiltIn = true) {
  const all = [];
  
  if (includeBuiltIn) {
    BUILT_IN_QUOTES.forEach((text, i) => {
      all.push({ id: `builtin-${i}`, text, isBuiltIn: true });
    });
  }
  
  userQuotes.forEach((q) => {
    all.push({ ...q, isBuiltIn: false });
  });
  
  return all;
}

/**
 * Get a deterministic "quote of the day" based on date
 */
export function getQuoteOfTheDay(allQuotes) {
  if (!allQuotes || allQuotes.length === 0) {
    return BUILT_IN_QUOTES[0];
  }
  
  const today = new Date().toDateString();
  let hash = 0;
  for (let i = 0; i < today.length; i++) {
    hash = ((hash << 5) - hash) + today.charCodeAt(i);
    hash |= 0;
  }
  
  const index = Math.abs(hash) % allQuotes.length;
  const quote = allQuotes[index];
  return typeof quote === "string" ? quote : quote.text;
}

/**
 * Get a random quote (changes on each call)
 */
export function getRandomQuote(allQuotes) {
  if (!allQuotes || allQuotes.length === 0) {
    return BUILT_IN_QUOTES[0];
  }
  
  const index = Math.floor(Math.random() * allQuotes.length);
  const quote = allQuotes[index];
  return typeof quote === "string" ? quote : quote.text;
}
