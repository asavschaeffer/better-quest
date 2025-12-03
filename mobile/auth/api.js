// Shared interface for future backend integration on mobile.
// Currently everything is local-only; these stubs let us swap in a real
// backend (e.g. Supabase) without changing screens.

/**
 * @typedef {Object} SyncPayload
 * @property {Object} avatar
 * @property {Array<Object>} sessions
 */

/**
 * Upload avatar and sessions to backend, returning the canonical state.
 * @param {SyncPayload} payload
 * @returns {Promise<SyncPayload>}
 */
export async function syncAvatarAndSessions(payload) {
  // TODO: Implement actual HTTP or Supabase client call.
  return payload;
}

/**
 * Sign in with email/password.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ userId: string }>}
 */
export async function signInWithEmail(email, password) {
  // TODO: Wire this to real auth (e.g. Supabase, Firebase).
  throw new Error("signInWithEmail is not implemented yet.");
}

/**
 * Sign out current user.
 * @returns {Promise<void>}
 */
export async function signOut() {
  // TODO: Wire this to real auth provider.
  return;
}


