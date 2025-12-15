import { generateRawLog, generateTwitterLog, generateLinkedInLog } from "./logFormats.js";

export function renderHistory({ sessions, historyListEl, historyEmptyEl, formatShortDate }) {
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
    const expText = session.expResult ? ` (+${session.expResult.totalExp} EXP)` : "";
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

export function generateLogText(style, sessionsInput) {
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

export function showLogCopiedToast({ logCopiedEl, durationMs = 1800 }) {
  if (!logCopiedEl) return;
  logCopiedEl.hidden = false;
  setTimeout(() => {
    logCopiedEl.hidden = true;
  }, durationMs);
}


