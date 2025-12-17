# Better Quest - Manual Testing Guide

## Quick Start

The application is ready to test! Here's how:

### 1. Start the Server
```bash
npm start
```

This will start a local server. You should see output like:
```
   Accepting connections at http://localhost:3000
```

### 2. Open in Browser
- Go to `http://localhost:3000`
- You should see the Better Quest interface with:
  - Header: "Better Quest – Turn real-world focus into RPG EXP."
  - Setup form with three fields
  - Empty "Recent sessions" section below

---

## Test Scenario 1: Quick 5-Minute Session

**Goal:** Experience the basic session flow

### Steps:
1. **Fill the form:**
   - Description: "Study coding" (or any task)
   - Duration: 5 minutes
   - Type: Intelligence

2. **Click "Start focus session"**
   - You should see the session view with:
     - ✓ Your task description
     - ✓ Task type (Intelligence)
     - ✓ Avatar name "Adventurer" and "Lv 1"
     - ✓ A large timer showing 05:00
     - ✓ Emoji 💻 (for "coding")
   - The timer should count down smoothly

3. **Watch for 10 seconds**
   - Verify timer counts down (05:00 → 04:50)

4. **Click "Cancel session"**
   - Should return to setup form
   - No EXP awarded
   - Avatar level still "Lv 1"

---

## Test Scenario 2: Complete a Session & Earn EXP

**Goal:** See EXP calculation and avatar progression

### Steps:
1. **Start a 1-minute session** (short for testing!)
   - Description: "Quick test"
   - Duration: 1 minute
   - Type: Intelligence
   - Click "Start focus session"

2. **Wait for completion** (about 60 seconds)
   - Timer counts down to 00:00
   - Automatically shows "Session complete" view

3. **Verify EXP reward:**
   - Total EXP: +10 (1 min × 10 EXP/min)
   - Intelligence: +10
   - Strength: +0
   - Stamina: +0
   - Avatar level: Still "Lv 1" (needs 100 total)

4. **Choose next action:**
   - "Continue this quest" → repeats same task
   - "Take a break" → 5-minute break timer
   - "End for now" → back to setup

---

## Test Scenario 3: Level Up Avatar

**Goal:** Experience avatar progression

### Steps:
1. **Complete multiple 25-minute sessions:**
   - Session 1: 25 min Intelligence → +250 EXP (Total: 250)
   - Session 2: 25 min Intelligence → +250 EXP (Total: 500)

2. **After Session 2:**
   - Avatar should be "Lv 2"
   - Progress bar shows: 400 / 200 EXP (into next level)

3. **One more 25-minute session:**
   - Session 3: 25 min Intelligence → +250 EXP (Total: 750)
   - Avatar should be "Lv 3" (needs 300 total EXP)

---

## Test Scenario 4: Test Persistence (CRITICAL!)

**Goal:** Verify state saves across page reload

### Steps:
1. **Complete 2-3 focus sessions:**
   - Note final avatar level and total EXP
   - Note number of sessions in history

2. **Reload the page** (F5 or Ctrl+R)
   - Avatar level should be the SAME
   - Total EXP should be the SAME
   - All sessions should appear in history

3. **Open DevTools** (F12)
   - Go to Application → Local Storage
   - Look for key: `better-quest-state-v1`
   - You should see JSON with avatar and sessions data

4. **Optional: Clear localStorage**
   - Right-click the `better-quest-state-v1` key
   - Select Delete
   - Reload page
   - Avatar resets to Level 1, 0 EXP (default state)

---

## Test Scenario 5: Different Task Types

**Goal:** Verify EXP splits for different task types

### Complete these sessions and check EXP:

#### Intelligence Task (25 min)
- Expected: +250 total, all Intelligence
- Example: "Study math"

#### Strength Task (20 min)
- Expected: +200 total
  - Strength: +140 (70%)
  - Stamina: +60 (30%)
- Example: "Lift weights"

#### Stamina Task (20 min)
- Expected: +200 total
  - Stamina: +160 (80%)
  - Strength: +40 (20%)
- Example: "Run for 20 minutes"

#### Mixed Task (20 min)
- Expected: +200 total
  - Stamina: +100 (50%)
  - Intelligence: +100 (50%)
- Example: "Do yoga"

---

## Test Scenario 6: Emoji Matching

**Goal:** Verify emojis display correctly for different tasks

### Try these task descriptions:

| Description | Expected Emoji |
|---|---|
| "Study math" | 📚 |
| "Run a mile" | 🏃 |
| "Lift weights" | 🏋️ |
| "Yoga session" | 🧘 |
| "Cycling" | 🚴 |
| "Write journal" | ✍️ |
| "Play guitar" | 🎵 |
| "Random task" | ⏳ (default) |

---

## Test Scenario 7: Break Sessions

**Goal:** Experience break functionality

### Steps:
1. **Complete any focus session**
2. **Click "Take a break"**
   - Timer shows 05:00
   - Emoji shows ☕
   - Label shows "Break"

3. **Wait for break to complete**
   - Returns to setup view
   - No EXP awarded
   - Avatar level unchanged

4. **Optional: Multiple breaks**
   - Click "Take a break" again after another session
   - Can chain breaks together

---

## Test Scenario 8: Session History

**Goal:** Verify history tracking and persistence

### Steps:
1. **Complete 5+ different sessions:**
   - Different descriptions
   - Different durations
   - Different task types

2. **Check "Recent sessions" section:**
   - Sessions appear in reverse order (newest first)
   - Each entry shows:
     - Task description
     - EXP awarded
     - Task type
     - Duration
     - Time completed

3. **Reload page:**
   - All history should still appear

4. **Complete 21+ sessions:**
   - Only last 20 appear (max history)
   - Oldest session is removed

---

## Test Scenario 9: Full Multi-Session Workflow

**Goal:** Experience the complete intended flow

### Steps:
1. Start Session A: "Study" 25 min, Intelligence
   - Completes in ~25 seconds (simulated timer)
2. Click "Continue this quest"
3. Change duration to 15 min
4. Complete Session B: "Study" 15 min
5. Click "Take a break" → 5 min break
6. Click "Take a break" again → another break
7. Click "End for now" → back to setup
8. Complete Session C: "Code" 20 min, Intelligence
9. Check history → shows 3 sessions
10. Reload page → verify all state persists

---

## Test Scenario 10: Quest Picker UX (Miller's Law Suggestions)

**Goal:** Verify the new Apple-search-style quest picker works correctly

### Steps:

1. **Open the Quest Setup screen:**
   - Click the big center button on the navbar (or tap "Start Quest" from home)
   - You should see the radar chart and a search input

2. **Verify suggestion grid:**
   - Below the search input, you should see 5–9 quest buttons in a grid layout
   - The default shows 7 suggestions (Miller's Law center)
   - Buttons should be compact and wrap to multiple rows if needed

3. **Test chart-driven suggestions:**
   - Drag on the radar chart to emphasize a stat (e.g., drag STR axis outward)
   - Watch the suggestion grid update in real-time
   - Quests matching your selected stats should appear higher/more prominent

4. **Test budget-gap prioritization:**
   - Complete a few sessions focusing on one stat (e.g., INT)
   - Return to Quest Setup
   - Suggestions should now prioritize stats you haven't trained today
   - Stats with remaining daily budget get weighted higher

5. **Test text search:**
   - Type a keyword like "gym" or "study" in the search field
   - Suggestions filter to matching quests immediately
   - Non-matching quests disappear from the grid

6. **Test "+ New" button:**
   - When your search text doesn't match any quest name, a "+ New" button should appear
   - Clicking it opens the New Quest screen with your text pre-filled

7. **Test quest selection:**
   - Tap a quest button in the grid
   - It should highlight (active state with glow)
   - The chart, duration, and description should update to match the selected quest

8. **Test "All quests" link:**
   - If there are more quests than shown in the grid, an "All quests (N)" link appears
   - (Note: This leads to the full library if implemented)

### Expected Behavior:

| Action | Expected Result |
|--------|-----------------|
| Open Quest Setup | 7 suggested quests shown in grid |
| Drag chart to emphasize STR | STR-heavy quests rise in suggestions |
| Type "run" in search | Only running-related quests shown |
| Clear search | Full 7 suggestions return |
| Tap a quest button | Quest selected, chart updates, button glows |
| Complete INT session, return | INT quests deprioritized (budget spent) |

### Verify:
- [ ] Suggestions update live as chart changes
- [ ] Suggestions update live as text changes
- [ ] Grid shows 5–9 buttons (clamped to Miller's Law range)
- [ ] Selected quest has visual highlight
- [ ] User quests show ★ badge
- [ ] "+ New" button appears when search doesn't match

---

## Common Issues & Troubleshooting

### Issue: Timer doesn't start
- **Check:** Did you click "Start focus session" button?
- **Check:** Did the form validate? (all fields required)

### Issue: Avatar level doesn't increase
- **Remember:** Level 1→2 requires 100 EXP
  - 10 min session = 100 EXP (just enough for Level 2)
  - 1 min session = 10 EXP (not enough for level up)

### Issue: History disappeared after reload
- **Check:** Did you complete a session? (history only appears when sessions exist)
- **Check:** Open DevTools (F12) → Application → Local Storage
- **Check:** Is `better-quest-state-v1` key present?

### Issue: localStorage not saving
- **Check:** Are you in private/incognito mode? (localStorage may be disabled)
- **Solution:** Try normal browser mode

### Issue: Emoji not showing
- **Remember:** Emoji only shows if task description matches keywords
- **Example:** "coding" matches → 💻
- **Example:** "foobar" doesn't match → ⏳ (default)

---

## What to Verify

After completing manual tests, you should confirm:

- [ ] Page loads without errors
- [ ] Setup form requires all three fields
- [ ] Timer counts down smoothly
- [ ] Sessions complete successfully
- [ ] EXP is calculated correctly
- [ ] Avatar level increases appropriately
- [ ] State persists across page reload
- [ ] Session history appears and persists
- [ ] Emojis display for matched keywords
- [ ] Break sessions don't award EXP
- [ ] Can chain multiple sessions together
- [ ] UI is responsive and styled nicely

---

## Performance Notes

- **Timer Accuracy:** ±500ms acceptable (updates every 500ms)
- **localStorage:** Saves after each session completion
- **UI Response:** Should be instant (no lag)
- **Memory:** Application is lightweight, no performance issues expected

---

## Next Steps

After manual testing:
1. Document any issues found
2. Verify all features work as expected
3. The application is ready for real-world use
4. Users can start using it to track focus sessions!

---

**Happy testing! 🎮**

To see automated test results, check `TEST_RESULTS.md`
