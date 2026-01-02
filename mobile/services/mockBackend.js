// A lightweight "mock backend" for mobile.
// Purpose: centralize data mutations behind async functions so we can later swap
// to a real backend (Supabase, etc.) without rewriting UI screens.

import { loadUserQuests, addUserQuest, deleteUserQuest } from "../core/questStorage.js";
import { loadAppState, mergeAppState } from "./storage.js";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const DEFAULT_LATENCY_MS = 120;

export async function fetchLibraryState({ latencyMs = DEFAULT_LATENCY_MS } = {}) {
  await sleep(latencyMs);
  const [{ state }, userQuests] = await Promise.all([loadAppState(), loadUserQuests()]);
  return {
    userQuests: Array.isArray(userQuests) ? userQuests : [],
    savedQuestIds: Array.isArray(state?.savedQuestIds) ? state.savedQuestIds : [],
  };
}

export async function saveBuiltInQuestId(questId, { latencyMs = DEFAULT_LATENCY_MS } = {}) {
  await sleep(latencyMs);
  const { state } = await loadAppState();
  const current = Array.isArray(state?.savedQuestIds) ? state.savedQuestIds : [];
  if (!questId || current.includes(questId)) return current;
  const next = [...current, questId];
  await mergeAppState({ savedQuestIds: next });
  return next;
}

export async function unsaveBuiltInQuestId(questId, { latencyMs = DEFAULT_LATENCY_MS } = {}) {
  await sleep(latencyMs);
  const { state } = await loadAppState();
  const current = Array.isArray(state?.savedQuestIds) ? state.savedQuestIds : [];
  const next = current.filter((id) => id !== questId);
  await mergeAppState({ savedQuestIds: next });
  return next;
}

export async function upsertUserQuest(quest, { latencyMs = DEFAULT_LATENCY_MS } = {}) {
  await sleep(latencyMs);
  const updated = await addUserQuest(quest);
  return Array.isArray(updated) ? updated : [];
}

export async function removeUserQuest(questId, { latencyMs = DEFAULT_LATENCY_MS } = {}) {
  await sleep(latencyMs);
  const updated = await deleteUserQuest(questId);
  return Array.isArray(updated) ? updated : [];
}


