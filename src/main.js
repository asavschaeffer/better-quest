import { createUser, createTaskSession } from "./models.js";
import { SessionManager } from "./timer.js";
import {
  calculateExpForSession,
  applyExpToAvatar,
  getLevelProgress,
} from "./exp.js";
import { inferEmojiForDescription } from "./emoji.js";
import { loadState, saveState } from "./storage.js";
import {
  generateRawLog,
  generateTwitterLog,
  generateLinkedInLog,
} from "./logFormats.js";
import { dom } from "./dom.js";
import { applyPreset, setActiveChip } from "./presets.js";

let user = createUser();
let avatar = user.avatar;
let sessions = [];
let motivation = "";
let wellRestedUntil = null;
let comboFromSessionId = null;

let currentView = "home"; // "home" | "questSetup" | "session" | "complete"

const sessionManager = new SessionManager({
  onSessionTick: handleSessionTick,
  onSessionCompleted: handleSessionCompleted,
  onSessionCancelled: handleSessionCancelled,
});

let lastCompletedSession = null;
let lastExpResult = null;
let lastCompletedSessionIndex = -1;

const COMBO_BONUS_MULTIPLIER = 1.2;
const REST_BONUS_MULTIPLIER = 1.1;
const REST_BONUS_WINDOW_MINUTES = 45;

const {
  // Views
  homeView,
  setupView,
  sessionView,
  completeView,

  // Setup form
  form,
  descriptionInput,
  durationInput,
  taskTypeSelect,
  setupError,

  // Session view
  sessionTaskText,
  sessionTaskType,
  sessionTimerText,
  sessionEmoji,
  cancelSessionBtn,

  // Avatar display (session + completion)
  avatarNameEls,
  avatarLevelEls,

  // Completion view
  expTotalEl,
  expStrengthEl,
  expStaminaEl,
  expIntelligenceEl,
  completeSummaryEl,
  avatarExpProgressEl,
  avatarExpBarEl,

  // History + logs
  historyListEl,
  historyEmptyEl,
  logStyleSelect,
  copyLogBtn,
  logCopiedEl,

  // Home view controls
  startQuestBtn,
  motivationInput,
  avatarNameHomeEl,
  avatarLevelHomeEl,
  avatarExpProgressHomeEl,
  avatarExpBarHomeEl,

  // Completion actions
  continueSessionBtn,
  takeBreakBtn,
  endSessionBtn,
  sessionNotesInput,
} = dom;

function init() {
  hydrateFromStorage();
  updateAvatarUI();
  wireEvents();
  renderHistory();
  showHomeView();
}

function wireEvents() {
  if (startQuestBtn) {
    startQuestBtn.addEventListener("click", () => {
      showQuestSetupView();
      descriptionInput.focus();
    });
  }

  if (motivationInput) {
    motivationInput.addEventListener("blur", () => {
      motivation = motivationInput.value.trim();
      persistState();
    });
  }

  if (copyLogBtn && logStyleSelect) {
    copyLogBtn.addEventListener("click", async () => {
      const style = logStyleSelect.value || "raw";
      const text = generateLogText(style, sessions);
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          // Fallback: use a temporary textarea.
          const ta = document.createElement("textarea");
          ta.value = text;
          ta.setAttribute("readonly", "");
          ta.style.position = "absolute";
          ta.style.left = "-9999px";
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
        }
        showLogCopiedToast();
      } catch (err) {
        console.error("Failed to copy log", err);
        alert("Could not copy log to clipboard.");
      }
    });
  }

  const presetButtons = document.querySelectorAll(
    ".bq-quest-presets-row .bq-chip-btn",
  );
  presetButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-preset-id");
      applyPresetFromUI(id);
      setActiveChip(presetButtons, btn);
    });
  });

  const durationChips = document.querySelectorAll(
    ".bq-duration-chips .bq-chip-btn",
  );
  durationChips.forEach((btn) => {
    btn.addEventListener("click", () => {
      const value = Number.parseInt(btn.getAttribute("data-duration") ?? "0", 10);
      if (Number.isFinite(value) && value > 0) {
        durationInput.value = String(value);
      }
      setActiveChip(durationChips, btn);
    });
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    startFocusSessionFromForm();
  });

  cancelSessionBtn.addEventListener("click", () => {
    const remainingSeconds =
      (sessionManager.currentSession?.remainingMs ?? 0) / 1000;
    if (remainingSeconds > 0) {
      const sure = window.confirm(
        "Cancel this session? You won't gain EXP from it.",
      );
      if (!sure) return;
    }
    sessionManager.cancelSession();
  });

  continueSessionBtn.addEventListener("click", () => {
    saveCompletionNotes();
    if (!lastCompletedSession) {
      showQuestSetupView();
      return;
    }
    comboFromSessionId = lastCompletedSession.id;
    persistState();
    // Reuse description/type, ask again for duration.
    descriptionInput.value = lastCompletedSession.description;
    taskTypeSelect.value = lastCompletedSession.taskType;
    showQuestSetupView();
  });

  takeBreakBtn.addEventListener("click", () => {
    saveCompletionNotes();
    // Start a short break timer (e.g. 5 minutes).
    startBreakSession(5);
  });

  endSessionBtn.addEventListener("click", () => {
    saveCompletionNotes();
    showHomeView();
  });
}

function applyPresetFromUI(id) {
  applyPreset({ id, descriptionInput, durationInput, taskTypeSelect });
}

function startFocusSessionFromForm() {
  const description = descriptionInput.value.trim();
  const durationMinutes = Number.parseInt(durationInput.value, 10);
  const taskType = (taskTypeSelect?.value || "MIXED").trim();

  if (!description) {
    showSetupError("Please enter what you want to work on.");
    return;
  }
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    showSetupError("Please enter a valid duration in minutes.");
    return;
  }

  hideSetupError();

  const id = `session-${Date.now()}`;

  const session = createTaskSession({
    id,
    description,
    durationMinutes,
    startTime: new Date().toISOString(),
  });
  session.taskType = taskType;

  const bonuses = computeBonusesForNewSession();
  session.comboBonus = bonuses.hasCombo;
  session.restBonus = bonuses.hasRest;
  session.bonusMultiplier = bonuses.multiplier;

  // Pick an emoji based on the task description.
  session.icon = inferEmojiForDescription(description);

  sessionManager.startSession(session);

  sessionTaskText.textContent = session.description;
  if (sessionTaskType) sessionTaskType.textContent = taskType;
  sessionEmoji.textContent = session.icon;

  showSessionView();
}

function handleSessionTick(session) {
  const remaining = session.remainingMs ?? session.durationMinutes * 60 * 1000;
  sessionTimerText.textContent = formatTime(remaining);
}

function handleSessionCompleted(session) {
  // Break sessions do not grant EXP in the SLC; they just return the user to setup.
  if (session.isBreak) {
    const now = Date.now();
    const windowMs = REST_BONUS_WINDOW_MINUTES * 60 * 1000;
    wellRestedUntil = new Date(now + windowMs).toISOString();
    persistState();
    showHomeView();
    return;
  }

  const baseExp = calculateExpForSession(session);
  const finalExp = applySessionBonuses(session, baseExp);
  lastExpResult = finalExp;
  lastCompletedSession = {
    ...session,
    expGranted: finalExp,
  };
  avatar = applyExpToAvatar(avatar, finalExp);
  user = { ...user, avatar };

  updateAvatarUI();
  populateCompletionUI(session, finalExp);

  showCompleteView();
}

function handleSessionCancelled() {
  showHomeView();
}

function updateAvatarUI() {
  avatarNameEls.forEach((el) => {
    if (el) el.textContent = avatar.name;
  });
  avatarLevelEls.forEach((el) => {
    if (el) el.textContent = `Lv ${avatar.level}`;
  });

  const { current, required, ratio } = getLevelProgress(avatar.totalExp);
  avatarExpProgressEl.textContent = `${current} / ${required} EXP`;
  avatarExpBarEl.style.width = `${ratio * 100}%`;

  if (avatarNameHomeEl) avatarNameHomeEl.textContent = avatar.name;
  if (avatarLevelHomeEl) avatarLevelHomeEl.textContent = `Lv ${avatar.level}`;
  if (avatarExpProgressHomeEl) {
    avatarExpProgressHomeEl.textContent = `${current} / ${required} EXP`;
  }
  if (avatarExpBarHomeEl) {
    avatarExpBarHomeEl.style.width = `${ratio * 100}%`;
  }
}

function populateCompletionUI(session, expResult) {
  const vibe = vibeTextForTaskType();
  let summary = `You focused on “${session.description}” for ${session.durationMinutes} minutes. ${vibe}`;
  if (session.bonusMultiplier && session.bonusMultiplier > 1) {
    const parts = [];
    if (session.comboBonus) parts.push("combo bonus");
    if (session.restBonus) parts.push("well-rested bonus");
    const label = parts.length ? parts.join(" & ") : "bonus";
    summary += ` ${label} applied (x${session.bonusMultiplier.toFixed(
      2,
    )} EXP).`;
  }
  completeSummaryEl.textContent = summary;
  expTotalEl.textContent = `+${expResult.totalExp}`;
  if (expResult.standExp) {
    const parts = Object.entries(expResult.standExp)
      .filter(([, v]) => (v ?? 0) > 0)
      .map(([k, v]) => `${k}+${v}`);
    expStrengthEl.textContent = parts.join("  ");
    expStaminaEl.textContent = "";
    expIntelligenceEl.textContent = "";
  } else {
    expStrengthEl.textContent = "";
    expStaminaEl.textContent = "";
    expIntelligenceEl.textContent = "";
  }

  if (sessionNotesInput) {
    sessionNotesInput.value = "";
  }

  // Record in local history for the SLC.
  sessions.unshift({
    id: session.id,
    description: session.description,
    durationMinutes: session.durationMinutes,
    expResult,
    completedAt: session.endTime ?? new Date().toISOString(),
    notes: "",
    bonusMultiplier: session.bonusMultiplier ?? 1,
    comboBonus: !!session.comboBonus,
    restBonus: !!session.restBonus,
  });
  sessions = sessions.slice(0, 20);
  lastCompletedSessionIndex = 0;

  renderHistory();
  persistState();
}

function showSetupError(message) {
  setupError.textContent = message;
  setupError.hidden = false;
}

function hideSetupError() {
  setupError.hidden = true;
}

function showHomeView() {
  currentView = "home";
  if (homeView) homeView.classList.remove("bq-hidden");
  setupView.classList.add("bq-hidden");
  sessionView.classList.add("bq-hidden");
  completeView.classList.add("bq-hidden");
}

function showQuestSetupView() {
  currentView = "questSetup";
  if (homeView) homeView.classList.add("bq-hidden");
  setupView.classList.remove("bq-hidden");
  sessionView.classList.add("bq-hidden");
  completeView.classList.add("bq-hidden");
}

function showSessionView() {
  currentView = "session";
  if (homeView) homeView.classList.add("bq-hidden");
  setupView.classList.add("bq-hidden");
  sessionView.classList.remove("bq-hidden");
  completeView.classList.add("bq-hidden");
}

function showCompleteView() {
  currentView = "complete";
  if (homeView) homeView.classList.add("bq-hidden");
  setupView.classList.add("bq-hidden");
  sessionView.classList.add("bq-hidden");
  completeView.classList.remove("bq-hidden");
}

function formatTime(ms) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
    2,
    "0",
  )}`;
}

function startBreakSession(durationMinutes) {
  const id = `break-${Date.now()}`;
  const description = "Break";

  const breakSession = createTaskSession({
    id,
    description,
    durationMinutes,
    startTime: new Date().toISOString(),
    isBreak: true,
  });

  breakSession.icon = "☕";

  sessionManager.startSession(breakSession);

  sessionTaskText.textContent = "Break";
  sessionTaskType.textContent = "Break";
  sessionEmoji.textContent = breakSession.icon;

  showSessionView();
}

function hydrateFromStorage() {
  const state = loadState();
  if (!state) return;

  if (state.avatar) {
    avatar = state.avatar;
    user = { ...user, avatar };
  }
  if (Array.isArray(state.sessions)) {
    sessions = state.sessions;
  }
  if (typeof state.motivation === "string") {
    motivation = state.motivation;
    if (motivationInput) {
      motivationInput.value = motivation;
    }
  }
  if (state.wellRestedUntil) {
    wellRestedUntil = state.wellRestedUntil;
  }
  if (state.comboFromSessionId) {
    comboFromSessionId = state.comboFromSessionId;
  }
}

function persistState() {
  saveState({ avatar, sessions, motivation, wellRestedUntil, comboFromSessionId });
}

function renderHistory() {
  if (!historyListEl || !historyEmptyEl) return;

  historyListEl.innerHTML = "";

  if (!sessions.length) {
    historyEmptyEl.style.display = "block";
    return;
  }

  historyEmptyEl.style.display = "none";

  for (const session of sessions) {
    const li = document.createElement("li");

    const primary = document.createElement("div");
    primary.className = "bq-history-item-primary";
    const expText = session.expResult
      ? ` (+${session.expResult.totalExp} EXP)`
      : "";
    primary.textContent = `${session.description}${expText}`;

    const meta = document.createElement("div");
    meta.className = "bq-history-item-meta";
    const when = formatShortDate(session.completedAt);
    meta.textContent = `${when} • ${session.durationMinutes} min`;

    li.appendChild(primary);
    li.appendChild(meta);
    if (session.notes) {
      const notes = document.createElement("div");
      notes.className = "bq-history-item-notes";
      notes.textContent = session.notes;
      li.appendChild(notes);
    }
    historyListEl.appendChild(li);
  }
}

function formatShortDate(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function vibeTextForTaskType() {
  return "Quest complete – deliberate practice logged.";
}

function computeBonusesForNewSession() {
  let hasCombo = false;
  let hasRest = false;

  if (comboFromSessionId && lastCompletedSession) {
    if (comboFromSessionId === lastCompletedSession.id) {
      hasCombo = true;
      comboFromSessionId = null;
    }
  }

  if (wellRestedUntil) {
    const now = Date.now();
    const until = Date.parse(wellRestedUntil);
    if (!Number.isNaN(until) && now < until) {
      hasRest = true;
      wellRestedUntil = null;
    }
  }

  let multiplier = 1;
  if (hasCombo) multiplier *= COMBO_BONUS_MULTIPLIER;
  if (hasRest) multiplier *= REST_BONUS_MULTIPLIER;

  // Persist in case we cleared flags.
  persistState();

  return { hasCombo, hasRest, multiplier };
}

function applySessionBonuses(session, baseExp) {
  const mult = session.bonusMultiplier ?? 1;
  if (mult === 1) return baseExp;
  const totalExp = Math.round(baseExp.totalExp * mult);
  const standExp = {};
  if (baseExp.standExp) {
    Object.entries(baseExp.standExp).forEach(([key, value]) => {
      const v = typeof value === "number" ? value : 0;
      standExp[key] = Math.round(v * mult);
    });
  }
  return {
    totalExp,
    standExp,
  };
}

function saveCompletionNotes() {
  if (!sessionNotesInput) return;
  const notes = sessionNotesInput.value.trim();
  if (lastCompletedSessionIndex < 0) return;
  if (!sessions[lastCompletedSessionIndex]) return;
  sessions[lastCompletedSessionIndex].notes = notes;
  renderHistory();
  persistState();
}

function generateLogText(style, sessionsInput) {
  switch (style) {
    case "twitter":
      return generateTwitterLog(sessionsInput);
    case "linkedin":
      return generateLinkedInLog(sessionsInput);
    case "raw":
    default:
      return generateRawLog(sessionsInput);
  }
}

function showLogCopiedToast() {
  if (!logCopiedEl) return;
  logCopiedEl.hidden = false;
  setTimeout(() => {
    logCopiedEl.hidden = true;
  }, 1800);
}

init();


