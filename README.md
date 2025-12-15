## Better Quest

Better Quest is a focus-timer RPG: you run a timed session for a quest, then earn EXP that grows your avatar’s Stand stats (STR/DEX/STA/INT/SPI/CRE/VIT). This repo contains a **web** version and an **Expo mobile** version.

### Quick start

- **Web (static app served locally)**:

  - `npm install`
  - `npm start` (serves on `http://localhost:3000`)

- **Mobile (Expo)**:
  - `npm install`
  - `npm run dev:mobile` (or `npm --workspace mobile run start`)

### Tests

- **Web unit tests**: `npm test`
- **Web full suite (includes Puppeteer browser tests)**: `npm run test:all`
- **Mobile tests**: `npm --workspace mobile test`

### Docs

- `START_HERE.md`
- `docs/` (testing guides, roadmap, and design notes)
