# Navigation Architecture

This document describes how navigation is structured in the Better Quest mobile app.

> See `docs/PRIMITIVES.md` for the canonical primitives and how screens compose from them.

## Overview

The app uses **React Navigation** (`@react-navigation/native`, `@react-navigation/native-stack`, `@react-navigation/bottom-tabs`) exclusively. All navigation setup lives in [`mobile/app/AppShell.js`](../mobile/app/AppShell.js).

---

## Proposed Navigation Structure

### Bottom Tab Bar (L → R)

```
[ Library ]  [ Home ]  [ Feed ]  [ Ranks ]
```

| Tab | Purpose | Screen |
|-----|---------|--------|
| **Library** | Browse all 21 quests, explore, curate | LibraryScreen |
| **Home** | Dashboard, quick start, motivation | HomeScreen |
| **Feed** | Activity stream (You/Friends/Global) | FeedScreen |
| **Ranks** | Leaderboards, competition | LeaderboardScreen |

### Feed Sub-tabs

Feed has internal tab navigation:

```
┌─────────────────────────────────────────┐
│  Feed            [You] [Friends] [All]  │
├─────────────────────────────────────────┤
│  (content changes based on sub-tab)     │
└─────────────────────────────────────────┘
```

| Sub-tab | Scope | Description |
|---------|-------|-------------|
| **You** | `scope: me` | Your history (formerly HistoryTab) |
| **Friends** | `scope: following` | People you follow |
| **All** | `scope: all` | Global activity feed |

### Top-Right Header Icons

```
                              [ 🔔 ] [ 👤 ] [ ⚙️ ]
                              notif  profile settings
```

| Icon | Action |
|------|--------|
| **Notifications** | Open notifications sheet/screen |
| **Profile** | Navigate to your UserProfile |
| **Settings** | Navigate to SettingsScreen |

### Picker Flow (Modal)

The Picker is **not a tab** - it's a modal flow triggered when starting a quest:

**Entry points:**
- Home → "Start Quest" CTA
- Library → Tap quest row → Quest Profile → "Start Quest"
- Anywhere a "Start" action exists

**Flow:**
```
Entry point → QuestSetup (picker) → Session (timer) → Complete
```

---

## Current Navigator Hierarchy

> **Transitional note:** The current build still includes the center **QuestActionTab** (Play button) from the legacy 5-tab layout. The proposed end-state is 4 tabs (Library / Home / Feed / Ranks), with the Play button removed and "Start Quest" triggered from Home or Library. See Legacy section below for the 5-tab structure.

```
RootStack (native-stack)
├── Tabs (bottom-tabs) ─────────────────────────────────────
│   ├── LibraryTab   → LibraryScreen
│   ├── HomeTab      → HomeScreen
│   ├── QuestActionTab (center Play button - triggers QuestFlow) [transitional]
│   ├── FeedTab      → FeedScreen (with internal You/Friends/All tabs)
│   └── RankTab      → LeaderboardScreen
│
├── Settings         → SettingsScreen
├── Profile          → ProfileScreen (your profile)
├── UserProfile      → UserProfileScreen (other users)
├── QuestProfile     → QuestProfileScreen (quest detail)
├── SessionDetail    → SessionDetailScreen (past session)
│
├── QuestFlow (nested native-stack, fullScreenModal)
│   ├── QuestSetup   → QuestSetupScreen (quest picker)
│   └── QuestEditor  → NewQuestScreen (create/edit quest)
│
└── Session group (fullScreenModal, gestures disabled)
    ├── Session      → SessionScreen (timer running)
    └── Complete     → CompleteScreen (post-session)
```

---

## Legacy Navigator Hierarchy (for reference)

Previous structure before Feed consolidation:

```
RootStack (native-stack)
├── Tabs (bottom-tabs) ─────────────────────────────────────
│   ├── HomeTab      → HomeScreen
│   ├── LibraryTab   → LibraryScreen
│   ├── QuestActionTab (center button - triggers QuestFlow)
│   ├── HistoryTab   → HistoryScreen
│   └── RankTab      → LeaderboardScreen
│
├── Settings         → SettingsScreen
├── Profile          → ProfileScreen
│
├── QuestFlow (nested native-stack, fullScreenModal)
│   ├── QuestSetup   → QuestSetupScreen (quest picker)
│   └── QuestEditor  → NewQuestScreen (create/edit quest)
│
└── Session group (fullScreenModal, gestures disabled)
    ├── Session      → SessionScreen (timer running)
    └── Complete     → CompleteScreen (post-session)
```

## Route constants

Defined at the top of `AppShell.js`:

```js
const ROUTES = {
  TABS: "Tabs",
  SETTINGS: "Settings",
  PROFILE: "Profile",
  QUEST_FLOW: "QuestFlow",
  QUEST_SETUP: "QuestSetup",
  QUEST_EDITOR: "QuestEditor",
  SESSION: "Session",
  COMPLETE: "Complete",
};

const TAB_ROUTES = {
  HOME: "HomeTab",
  LIBRARY: "LibraryTab",
  QUEST_ACTION: "QuestActionTab",
  HISTORY: "HistoryTab",
  RANK: "RankTab",
};
```

## How to navigate

Navigation is done via a ref-based helper defined in `AppShell`:

```js
const navigationRef = createNavigationContainerRef();

const nav = useCallback((name, params) => {
  if (!navigationRef.isReady()) return;
  navigationRef.navigate(name, params);
}, []);
```

Screens receive navigation callbacks as props (e.g., `onOpenSettings`, `onViewProfile`). This keeps screen components decoupled from the navigation library.

## Adding a new screen

1. **Create the screen component** in `mobile/screens/`.
2. **Import it** in `mobile/app/AppShell.js`.
3. **Add a route constant** to `ROUTES` (or `TAB_ROUTES` if it's a new tab).
4. **Register the screen** in the appropriate navigator:
   - Top-level drill-down? Add to `RootStack`.
   - Part of an existing flow (e.g., quest details)? Add to the relevant nested stack (e.g., `QuestStack` inside `QUEST_FLOW`).
   - New tab? Add to `Tab.Navigator` (rare).
5. **Wire callbacks** from parent screens or context to trigger navigation.

## Legacy notes

A previous custom navigation hook (`mobile/navigation/navigator.js`) existed but was **never imported or used**. It has been deleted to avoid confusion. All navigation now goes through React Navigation as documented above.

