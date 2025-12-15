// Centralized DOM bindings for the web app (keeps src/main.js readable).

export const dom = {
  // Views
  homeView: document.getElementById("home-view"),
  setupView: document.getElementById("setup-view"),
  sessionView: document.getElementById("session-view"),
  completeView: document.getElementById("complete-view"),

  // Setup form
  form: document.getElementById("session-form"),
  descriptionInput: document.getElementById("task-description"),
  durationInput: document.getElementById("task-duration"),
  taskTypeSelect: document.getElementById("task-type"),
  setupError: document.getElementById("setup-error"),

  // Session view
  sessionTaskText: document.getElementById("session-task-text"),
  sessionTaskType: document.getElementById("session-task-type"),
  sessionTimerText: document.getElementById("session-timer"),
  sessionEmoji: document.getElementById("session-emoji"),
  cancelSessionBtn: document.getElementById("cancel-session-btn"),

  // Avatar display (session + completion)
  avatarNameEls: [document.getElementById("avatar-name")],
  avatarLevelEls: [
    document.getElementById("avatar-level"),
    document.getElementById("avatar-level-complete"),
  ],

  // Completion view
  expTotalEl: document.getElementById("exp-total"),
  expStrengthEl: document.getElementById("exp-strength"),
  expStaminaEl: document.getElementById("exp-stamina"),
  expIntelligenceEl: document.getElementById("exp-intelligence"),
  completeSummaryEl: document.getElementById("complete-summary"),
  avatarExpProgressEl: document.getElementById("avatar-exp-progress"),
  avatarExpBarEl: document.getElementById("avatar-exp-bar"),

  // History + logs
  historyListEl: document.getElementById("history-list"),
  historyEmptyEl: document.getElementById("history-empty"),
  logStyleSelect: document.getElementById("log-style-select"),
  copyLogBtn: document.getElementById("copy-log-btn"),
  logCopiedEl: document.getElementById("log-copied"),

  // Home view controls
  startQuestBtn: document.getElementById("start-quest-btn"),
  motivationInput: document.getElementById("motivation-input"),
  avatarNameHomeEl: document.getElementById("avatar-name-home"),
  avatarLevelHomeEl: document.getElementById("avatar-level-home"),
  avatarExpProgressHomeEl: document.getElementById("avatar-exp-progress-home"),
  avatarExpBarHomeEl: document.getElementById("avatar-exp-bar-home"),

  // Completion actions
  continueSessionBtn: document.getElementById("continue-session-btn"),
  takeBreakBtn: document.getElementById("take-break-btn"),
  endSessionBtn: document.getElementById("end-session-btn"),
  sessionNotesInput: document.getElementById("session-notes"),
};


