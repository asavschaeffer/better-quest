/**
 * Feed primitives - pure helpers for session list rendering
 *
 * Used by HistoryScreen (Insights + Feed) and FeedScreen (scoped Feeds).
 * No React imports - keep this in core/ per ARCHITECTURE.md.
 */

/**
 * Get the canonical timestamp for a session (used for sorting and grouping).
 * Priority: completedAt > endTime > startTime
 *
 * @param {object} session
 * @returns {Date}
 */
export function getSessionTimestamp(session) {
  const raw = session?.completedAt || session?.endTime || session?.startTime;
  return raw ? new Date(raw) : new Date(0);
}

/**
 * Group sessions by day (locale date string).
 * Returns an object where keys are date strings and values are arrays of sessions.
 *
 * @param {object[]} sessions
 * @returns {Record<string, object[]>}
 */
export function groupSessionsByDay(sessions) {
  const groups = {};
  (sessions || []).forEach((session) => {
    const dateKey = getSessionTimestamp(session).toLocaleDateString();
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(session);
  });
  return groups;
}

/**
 * Get ordered day keys from grouped sessions (most recent first).
 *
 * @param {Record<string, object[]>} grouped - Output from groupSessionsByDay
 * @returns {string[]}
 */
export function getOrderedDayKeys(grouped) {
  return Object.keys(grouped).sort((a, b) => {
    // Parse locale date strings back to Date for comparison
    const dateA = new Date(a);
    const dateB = new Date(b);
    return dateB - dateA; // Most recent first
  });
}

/**
 * Filter sessions to a time window (days back from now).
 *
 * @param {object[]} sessions
 * @param {number|null} days - Number of days back, or null for all
 * @param {Date} [now] - Reference date (defaults to now)
 * @returns {object[]}
 */
export function filterSessionsByPeriod(sessions, days, now = new Date()) {
  if (days === null || days === undefined) {
    return sessions || [];
  }
  const start = new Date(now);
  start.setDate(start.getDate() - days);
  return (sessions || []).filter((s) => getSessionTimestamp(s) >= start);
}

