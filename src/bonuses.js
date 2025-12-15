export function computeBonusesForNewSession({
  comboFromSessionId,
  lastCompletedSession,
  wellRestedUntil,
  comboMultiplier,
  restMultiplier,
  persistState,
}) {
  let hasCombo = false;
  let hasRest = false;

  let nextComboFromSessionId = comboFromSessionId;
  let nextWellRestedUntil = wellRestedUntil;

  if (comboFromSessionId && lastCompletedSession) {
    if (comboFromSessionId === lastCompletedSession.id) {
      hasCombo = true;
      nextComboFromSessionId = null;
    }
  }

  if (wellRestedUntil) {
    const now = Date.now();
    const until = Date.parse(wellRestedUntil);
    if (!Number.isNaN(until) && now < until) {
      hasRest = true;
      nextWellRestedUntil = null;
    }
  }

  let multiplier = 1;
  if (hasCombo) multiplier *= comboMultiplier;
  if (hasRest) multiplier *= restMultiplier;

  // Persist in case we cleared flags.
  persistState?.();

  return {
    hasCombo,
    hasRest,
    multiplier,
    nextComboFromSessionId,
    nextWellRestedUntil,
  };
}


