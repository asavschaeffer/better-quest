import { getSessionTimestamp } from "./feed.js";
import { applyExpToAvatar } from "./exp.js";
import { computeStreakDays } from "./quests.js";

export const ActivityEventType = Object.freeze({
  SESSION_COMPLETED: "session_completed",
  LEVEL_UP: "level_up",
  STREAK_MILESTONE: "streak_milestone",
});

const DEFAULT_STREAK_MILESTONES = [3, 7, 14, 30, 60, 100];

export function getActivityEventTimestamp(event) {
  const raw = event?.at || event?.time || event?.createdAt;
  return raw ? new Date(raw) : new Date(0);
}

/**
 * Derive an ActivityEvent stream from Sessions (and only Sessions) without persisting events.
 *
 * This is the "Virtual ActivityEvent" approach:
 * - Canonical stored primitive remains Session (plus Avatar totals).
 * - Feeds/History render ActivityEvents projected from Sessions.
 *
 * @param {object} params
 * @param {object[]} params.sessions - Session history (any order)
 * @param {object} [params.startingAvatar] - Avatar state before the first session
 * @param {number[]} [params.streakMilestones] - Days to emit a streak milestone event for
 * @returns {object[]} ActivityEvents sorted newest-first (stable within same timestamp)
 */
export function deriveActivityEventsFromSessions({
  sessions = [],
  // If you want accurate derived "level up" events, pass the avatar state from BEFORE
  // the first session in this list. If absent, we skip emitting level-up events to
  // avoid incorrect histories for existing users.
  startingAvatar = null,
  includeLevelUps = false,
  includeStreakMilestones = false,
  streakMilestones = DEFAULT_STREAK_MILESTONES,
} = {}) {
  const input = Array.isArray(sessions) ? sessions.filter(Boolean) : [];
  const milestones = Array.isArray(streakMilestones) ? streakMilestones : DEFAULT_STREAK_MILESTONES;
  const emittedStreak = new Set();

  // Process oldest -> newest so we can derive level transitions.
  const ordered = input
    .slice()
    .sort((a, b) => getSessionTimestamp(a).getTime() - getSessionTimestamp(b).getTime());

  let avatar = startingAvatar;
  const processedForStreak = [];
  const events = [];

  for (const s of ordered) {
    const atDate = getSessionTimestamp(s);
    const atIso = atDate.toISOString();

    // Always emit the "session completed" event.
    events.push({
      id: `ev:${s.id}:session_completed`,
      type: ActivityEventType.SESSION_COMPLETED,
      at: atIso,
      sortOrder: 0,
      session: s,
    });

    // Level-up events (derived by replaying EXP).
    // Only emit if we have a known correct starting avatar.
    if (includeLevelUps && avatar && s?.expResult) {
      const next = applyExpToAvatar(avatar, s.expResult);
      const from = avatar?.level ?? 1;
      const to = next?.level ?? from;
      if (to > from) {
        events.push({
          id: `ev:${s.id}:level_up:${to}`,
          type: ActivityEventType.LEVEL_UP,
          at: atIso,
          sortOrder: 1,
          fromLevel: from,
          toLevel: to,
          sessionId: s.id,
        });
      }
      avatar = next;
    }

    // Streak milestone events (global streak, derived).
    if (includeStreakMilestones) {
      processedForStreak.unshift({ completedAt: atIso });
      const streakDays = computeStreakDays(processedForStreak);
      if (milestones.includes(streakDays) && !emittedStreak.has(streakDays)) {
        emittedStreak.add(streakDays);
        events.push({
          id: `ev:${s.id}:streak:${streakDays}`,
          type: ActivityEventType.STREAK_MILESTONE,
          at: atIso,
          sortOrder: 2,
          streakDays,
        });
      }
    }
  }

  // Newest-first; stable ordering within same timestamp via sortOrder and then id.
  return events.sort((a, b) => {
    const ta = getActivityEventTimestamp(a).getTime();
    const tb = getActivityEventTimestamp(b).getTime();
    if (tb !== ta) return tb - ta;
    const oa = typeof a?.sortOrder === "number" ? a.sortOrder : 0;
    const ob = typeof b?.sortOrder === "number" ? b.sortOrder : 0;
    if (oa !== ob) return oa - ob;
    return String(a?.id || "").localeCompare(String(b?.id || ""));
  });
}


