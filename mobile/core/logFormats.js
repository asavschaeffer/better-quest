function formatMinutes(totalMinutes) {
  return `${totalMinutes} min`;
}

export function generateRawLog(sessions) {
  if (!sessions?.length) return "No sessions yet.";
  return sessions
    .map((s) => {
      const when = s.completedAt ?? "";
      return `- [${when}] ${s.description} (${formatMinutes(
        s.durationMinutes,
      )}) – ${s.expResult?.totalExp ?? 0} EXP`;
    })
    .join("\n");
}

export function generateTwitterLog(sessions) {
  if (!sessions?.length) {
    return "No quests logged today yet. Time to start one. ⚔️";
  }

  const totalMinutes = sessions.reduce(
    (sum, s) => sum + (s.durationMinutes ?? 0),
    0,
  );
  const totalExp = sessions.reduce(
    (sum, s) => sum + (s.expResult?.totalExp ?? 0),
    0,
  );

  const topSession = sessions[0];
  const mainLine = `Just logged ${formatMinutes(
    totalMinutes,
  )} of focused work for ${totalExp} EXP.`;
  const highlight = topSession
    ? ` MVP quest: “${topSession.description}” (${formatMinutes(
        topSession.durationMinutes,
      )}).`
    : "";

  return `${mainLine} ${highlight} #BetterQuest 🗡️📚`;
}

export function generateLinkedInLog(sessions) {
  if (!sessions?.length) {
    return [
      "Today I had no focused sessions logged in Better Quest.",
      "Tomorrow is an opportunity to invest intentionally in my growth.",
    ].join("\n");
  }

  const totalMinutes = sessions.reduce(
    (sum, s) => sum + (s.durationMinutes ?? 0),
    0,
  );
  const totalExp = sessions.reduce(
    (sum, s) => sum + (s.expResult?.totalExp ?? 0),
    0,
  );

  const header = `Today I invested ${formatMinutes(
    totalMinutes,
  )} into deliberate practice (${totalExp} EXP) in Better Quest:`;

  const bullets = sessions.map((s) => {
    return `• ${s.description} – ${formatMinutes(s.durationMinutes)}`;
  });

  const footer =
    "Consistent, focused work compounds over time. Grateful to be building this habit.";

  return [header, ...bullets, "", footer].join("\n");
}


