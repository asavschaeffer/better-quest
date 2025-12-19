# Navigation Architecture

This document describes how navigation is structured in the Better Quest mobile app.

## Overview

The app uses **React Navigation** (`@react-navigation/native`, `@react-navigation/native-stack`, `@react-navigation/bottom-tabs`) exclusively. All navigation setup lives in [`mobile/app/AppShell.js`](../mobile/app/AppShell.js).

## Navigator hierarchy

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

