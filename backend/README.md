# Better Quest Backend & Auth – Scaffold

This folder is reserved for a future backend (e.g. Supabase adapters, Node API,
or serverless functions). For now, web and mobile apps run entirely locally.

## Planned responsibilities

- Persist user avatars and sessions in a shared database.
- Handle authentication (email/password, magic links, OAuth).
- Provide APIs to:
  - Fetch avatar and recent sessions for a user.
  - Append a completed session and update avatar EXP atomically.
  - Optionally generate or serve log summaries.

## Integration points

Both web (`src/api.js`) and mobile (`mobile/auth/api.js`) call the same logical
functions:

- `signInWithEmail(email, password)`
- `signOut()`
- `syncAvatarAndSessions({ avatar, sessions })`

These are currently stubs. When a real backend is ready, implementations here
can be wired up without changing UI screens.


