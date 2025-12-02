import { createUser, createTaskSession, TaskType } from "./models.js";
import { SessionManager } from "./timer.js";
import {
  calculateExpForSession,
  applyExpToAvatar,
  getLevelProgress,
} from "./exp.js";
import { inferEmojiForDescription } from "./emoji.js";
import { loadState, saveState } from "./storage.js";

let user = createUser();
let avatar = user.avatar;
let sessions = [];

const sessionManager = new SessionManager({
  onSessionTick: handleSessionTick,
  onSessionCompleted: handleSessionCompleted,
  onSessionCancelled: handleSessionCancelled,
});

let lastCompletedSession = null;
let lastExpResult = null;

// DOM references
const setupView = document.getElementById("setup-view");
const sessionView = document.getElementById("session-view");
const completeView = document.getElementById("complete-view");

const form = document.getElementById("session-form");
const descriptionInput = document.getElementById("task-description");
const durationInput = document.getElementById("task-duration");
const taskTypeSelect = document.getElementById("task-type");
const setupError = document.getElementById("setup-error");

const sessionTaskText = document.getElementById("session-task-text");
const sessionTaskType = document.getElementById("session-task-type");
const sessionTimerText = document.getElementById("session-timer");
const sessionEmoji = document.getElementById("session-emoji");
const cancelSessionBtn = document.getElementById("cancel-session-btn");

const avatarNameEls = [document.getElementById("avatar-name")];
const avatarLevelEls = [
  document.getElementById("avatar-level"),
  document.getElementById("avatar-level-complete"),
];

const expTotalEl = document.getElementById("exp-total");
const expStrengthEl = document.getElementById("exp-strength");
const expStaminaEl = document.getElementById("exp-stamina");
const expIntelligenceEl = document.getElementById("exp-intelligence");
const completeSummaryEl = document.getElementById("complete-summary");
const avatarExpProgressEl = document.getElementById("avatar-exp-progress");
const avatarExpBarEl = document.getElementById("avatar-exp-bar");

const historyListEl = document.getElementById("history-list");
const historyEmptyEl = document.getElementById("history-empty");

const continueSessionBtn = document.getElementById("continue-session-btn");
const takeBreakBtn = document.getElementById("take-break-btn");
const endSessionBtn = document.getElementById("end-session-btn");

function init() {
  hydrateFromStorage();
  updateAvatarUI();
  wireEvents();
  renderHistory();
}

function wireEvents() {
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    startFocusSessionFromForm();
  });

  cancelSessionBtn.addEventListener("click", () => {
    sessionManager.cancelSession();
  });

  continueSessionBtn.addEventListener("click", () => {
    if (!lastCompletedSession) {
      showSetupView();
      return;
    }
    // Reuse description/type, ask again for duration.
    descriptionInput.value = lastCompletedSession.description;
    taskTypeSelect.value = lastCompletedSession.taskType;
    showSetupView();
  });

  takeBreakBtn.addEventListener("click", () => {
    // Start a short break timer (e.g. 5 minutes).
    startBreakSession(5);
  });

  endSessionBtn.addEventListener("click", () => {
    showSetupView();
  });
}

function startFocusSessionFromForm() {
  const description = descriptionInput.value.trim();
  const durationMinutes = Number.parseInt(durationInput.value, 10);
  const taskTypeValue = taskTypeSelect.value || TaskType.INTELLIGENCE;

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
    taskType: taskTypeValue,
    startTime: new Date().toISOString(),
  });

  // Pick an emoji based on the task description.
  session.icon = inferEmojiForDescription(description);

  sessionManager.startSession(session);

  sessionTaskText.textContent = session.description;
  sessionTaskType.textContent = prettyTaskType(taskTypeValue);
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
    showSetupView();
    return;
  }

  const expResult = calculateExpForSession(session);
  lastExpResult = expResult;
  lastCompletedSession = {
    ...session,
    expGranted: expResult,
  };
  avatar = applyExpToAvatar(avatar, expResult);
  user = { ...user, avatar };

  updateAvatarUI();
  populateCompletionUI(session, expResult);

  showCompleteView();
}

function handleSessionCancelled() {
  showSetupView();
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
}

function populateCompletionUI(session, expResult) {
  const vibe = vibeTextForTaskType(session.taskType);
  completeSummaryEl.textContent = `You focused on “${session.description}” for ${session.durationMinutes} minutes. ${vibe}`;
  expTotalEl.textContent = `+${expResult.totalExp}`;
  expStrengthEl.textContent = `+${expResult.strengthExp}`;
  expStaminaEl.textContent = `+${expResult.staminaExp}`;
  expIntelligenceEl.textContent = `+${expResult.intelligenceExp}`;

  // Record in local history for the SLC.
  sessions.unshift({
    id: session.id,
    description: session.description,
    durationMinutes: session.durationMinutes,
    taskType: session.taskType,
    expResult,
    completedAt: session.endTime ?? new Date().toISOString(),
  });
  sessions = sessions.slice(0, 20);

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

function showSetupView() {
  setupView.classList.remove("bq-hidden");
  sessionView.classList.add("bq-hidden");
  completeView.classList.add("bq-hidden");
}

function showSessionView() {
  setupView.classList.add("bq-hidden");
  sessionView.classList.remove("bq-hidden");
  completeView.classList.add("bq-hidden");
}

function showCompleteView() {
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

function prettyTaskType(value) {
  switch (value) {
    case TaskType.STRENGTH:
      return "Strength";
    case TaskType.STAMINA:
      return "Stamina";
    case TaskType.INTELLIGENCE:
      return "Intelligence";
    case TaskType.MIXED:
    default:
      return "Mixed";
  }
}

function startBreakSession(durationMinutes) {
  const id = `break-${Date.now()}`;
  const description = "Break";

  const breakSession = createTaskSession({
    id,
    description,
    durationMinutes,
    taskType: TaskType.STAMINA,
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
}

function persistState() {
  saveState({ avatar, sessions });
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
    meta.textContent = `${when} • ${prettyTaskType(session.taskType)} • ${
      session.durationMinutes
    } min`;

    li.appendChild(primary);
    li.appendChild(meta);
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

function vibeTextForTaskType(taskType) {
  switch (taskType) {
    case TaskType.STRENGTH:
      return "Strength training complete.";
    case TaskType.STAMINA:
      return "Stamina up – nice endurance work.";
    case TaskType.INTELLIGENCE:
      return "Intelligence leveled – your brain thanks you.";
    case TaskType.MIXED:
    default:
      return "Balanced quest complete.";
  }
}

init();


