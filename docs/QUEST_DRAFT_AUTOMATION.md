# Quest Draft Automation (Links, Thumbnails, and “Share to Better Quest”)

This doc captures the **quest draft** direction around:

- **Link-based quests** (YouTube-first)
- **Auto cover images** (no backend / no scraping)
- **Open-in-app** behavior (YouTube deep links)
- **“Share/import” flows** for creating a quest draft from a link

It’s intentionally biased toward **high leverage** and **low complexity**.

---

## Current state (implemented)

### 1) YouTube thumbnail as quest cover (no new data model)

- We store a cover image in `quest.imageUri`.
- For YouTube URLs, we can derive a thumbnail URL and store it directly in `imageUri`:
  - Example: `https://i.ytimg.com/vi/<videoId>/hqdefault.jpg`

**Key behavior (UX rules):**

- If the quest has a YouTube URL and the user has **no custom image**, set `imageUri` to the derived thumbnail.
- If the user later picks a custom image (app-local `file://...`), **do not override it** with the auto thumbnail.
- If the YouTube URL is removed/changed and the cover was only an auto thumbnail, **clear** `imageUri`.

Why this is good:

- Zero backend.
- Zero new fields.
- Works instantly (just a URL).

### 2) Open YouTube links in the YouTube app when possible

We attempt to open the YouTube app via deep link schemes first, then fall back to `https://...`.

This improves UX by avoiding the “open in browser → prompt to open app” friction.

**Important iOS note:** `Linking.canOpenURL("youtube://...")` requires whitelisting URL schemes.
We add this in `mobile/app.json` under `ios.infoPlist.LSApplicationQueriesSchemes`.

---

## Concepts (simple explanation)

### Deep link vs web link

- **Web link**: `https://m.youtube.com/watch?v=...`  
  Works everywhere; the OS may still route it into the app via Universal Links/App Links.

- **Deep link**: `youtube://watch?v=...` or `vnd.youtube://watch?v=...`  
  Only works if the YouTube app is installed and registered to handle that scheme.

We “explicitly try” deep links by calling `Linking.canOpenURL()` and `Linking.openURL()` on those schemes first.

---

## Next steps (quest draft automation roadmap)

### Phase A — “Import from link” without native share extensions (recommended next)

Goal: let users get a “draft quest” quickly from content they’re already looking at.

Options:

1) **Paste link in the quest editor (already supported)**  
   - We already get the thumbnail for YouTube.
   - Add small UX sugar:
     - “Paste from clipboard” button
     - “Detect YouTube link → suggest title”

2) **App deep link import** (works from Messages/Notes/etc without being a share target)  
   - Add support for something like:
     - `betterquest://import?url=<encodedUrl>`
   - When opened:
     - Navigate to New Quest screen
     - Pre-fill:
       - `action = { type: "url", value: <url> }`
       - `imageUri = derived thumbnail (if supported)`
       - `label = derived title (if easy)`

**Title automation:** use YouTube oEmbed for title + author without an API key.

**Duration automation:** hard; requires YouTube Data API (key) or a scraping approach. Not recommended for Phase A.

### Phase B — True “Share → Better Quest” integration (native)

Goal: appear in the OS share sheet as a destination app.

- iOS: Share Extension
- Android: Intent filter for `ACTION_SEND`

This is very doable, but not in Expo Go. It requires:

- EAS build / custom dev client
- native config + testing

Phase B should wait until Phase A feels good, because it’s more maintenance.

---

## Implementation checklist (actionable TODOs)

### YouTube support (already shipped)

- [x] Parse YouTube video IDs across common URL formats (`youtube.com/watch`, `youtu.be`, `shorts`, `embed`)
- [x] Derive thumbnail URL and set `quest.imageUri` to the remote thumbnail
- [x] Do not override user-picked cover images
- [x] Clear auto thumbnail if link removed/unsupported

### Open-in-app behavior (already shipped)

- [x] Try YouTube deep-link scheme(s) first, fall back to `https://...`
- [x] iOS: add `LSApplicationQueriesSchemes` for `youtube` and `vnd.youtube`

### Phase A (recommended next)

- [ ] Add “Paste from clipboard” button in quest editor (mobile-first)
- [ ] Add “Import link” deep link route (e.g., `betterquest://import?url=...`)
- [ ] If URL is YouTube: fetch oEmbed to prefill title (optional, but high value)
- [ ] Add “confirm/adjust” step before saving quest (avoid surprising edits)

### Phase B (later)

- [ ] Add iOS share extension (Share → Better Quest)
- [ ] Add Android share intent handler
- [ ] Map shared URL → draft quest flow (same code path as Phase A)

---

## Data model / storage notes

- Current: `quest.imageUri` can be:
  - `file://...` (user-selected persistent file in app storage)
  - `https://...` (remote thumbnail, e.g. YouTube)
- For Phase A/B, consider adding a lightweight `quest.sourceUrl` or `quest.importMeta`
  only if you need richer provenance later. For now, we avoided new fields on purpose.


