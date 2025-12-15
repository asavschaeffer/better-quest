import React from "react";
import { AppStateProvider } from "./state/store.js";
import { getDefaultState } from "./services/storage.js";
import AppShell from "./app/AppShell.js";

export default function App() {
  return (
    <AppStateProvider initialState={getDefaultState()}>
      <AppShell />
    </AppStateProvider>
  );
}
