// Shared interface for future backend integration.
// For now, everything operates locally; these functions are stubs
// so the web app has a single place to talk to a backend later.

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
  // For now, just resolve with the provided payload.
  return payload;
}

/**
 * Sign in with email/password.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ userId: string }>}
 */
export async function signInWithEmail(email, password) {
  // TODO: Wire to real auth provider.
  throw new Error("signInWithEmail is not implemented yet.");
}

/**
 * Sign out current user.
 * @returns {Promise<void>}
 */
export async function signOut() {
  // TODO: Wire to real auth provider.
  return;
}


