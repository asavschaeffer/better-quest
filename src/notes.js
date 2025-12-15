export function saveCompletionNotes({
  sessionNotesInput,
  sessions,
  lastCompletedSessionIndex,
  renderHistory,
  persistState,
}) {
  if (!sessionNotesInput) return;
  const notes = sessionNotesInput.value.trim();
  if (lastCompletedSessionIndex < 0) return;
  if (!sessions[lastCompletedSessionIndex]) return;
  sessions[lastCompletedSessionIndex].notes = notes;
  renderHistory();
  persistState();
}


