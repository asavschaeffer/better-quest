## Better Quest

Better Quest is a focus-timer RPG: you run a timed session for a quest, then earn EXP that grows your avatar's Stand stats (STR/DEX/STA/INT/SPI/CHA/VIT). This repo contains a **web** version and an **Expo mobile** version.

### Quick start

- **Web (static app served locally)**:

  - `npm install`
  - `npm start` (serves on `http://localhost:3000`)

- **Mobile (Expo)**:
  - `npm install`
  - `npm run dev:mobile` (or `npm --workspace mobile run start`)

#### Expo / Metro config gotcha (monorepo)

Metro loads `mobile/metro.config.js` via CommonJS. **Do not add `"type": "module"` to `mobile/package.json`** unless you also rename config files to `.cjs` (e.g. `metro.config.cjs`, `babel.config.cjs`), or Expo may fail with “metro.config.js could not be loaded”.

### Tests

- **Web unit tests**: `npm test`
- **Web full suite (includes Puppeteer browser tests)**: `npm run test:all`
- **Mobile tests**: `npm --workspace mobile test`

### TypeScript (optional)

This repo is currently **JavaScript-first** (no `.ts/.tsx` yet). We still keep a root `tsconfig.json` to define the project boundary/settings for editor tooling, and to make a future TypeScript migration easy. It’s configured as **no-build** (`noEmit`) and does **not** type-check JS by default (`checkJs: false`).

### Docs

- `START_HERE.md`
- `docs/PRIMITIVES.md` (shared vocabulary: entities, projections, surfaces)
- `docs/` (testing guides, roadmap, and design notes)
