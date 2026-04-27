// ╔═══════════════════════════════════════════════════════════════════╗
// ║  src/lib/data/skills.js — Skills Data Layer                      ║
// ╚═══════════════════════════════════════════════════════════════════╝
//
// WHAT THIS FILE IS:
//   The single access layer for skills data used across the portfolio.
//
// DATA SOURCE:
//   Data comes from two writable stores populated by +layout.svelte:
//     skillTabsData → array of skill tab metadata
//     skillsData    → skills grouped by tab id
//
//   Those stores are filled from DB data fetched in +layout.server.js.
//
// WHY THIS FILE EXISTS:
//   Components should not need to know where the skills data came from
//   or whether it was loaded from JSON, DB, or an API.
//
//   This file gives two access styles:
//     1. Reactive store access  → for Svelte components
//     2. Snapshot helper access → for plain JS modules
//
// WHY REACTIVE STORES ARE EXPORTED:
//   On refresh / SSR / first render, data can arrive after component setup.
//   A one-time get(...) call can capture an empty initial snapshot.
//   Exporting readable derived stores lets Svelte components subscribe
//   and update automatically when layout data populates the source stores.
//
// COMPATIBILITY:
//   The helper functions keep the same shape as the old skills.json access:
//     getSkillTabs() → [{ id, label }, ...]
//     getSkills()    → { languages: [...], frontend: [...], ... }
//
//   That means plain JS modules can still do one-off reads when needed,
//   while Svelte components should prefer the exported stores.

import { derived, get } from 'svelte/store';
import { skillTabsData, skillsData } from '$lib/stores/ui.js';

// ── skillTabsStore ────────────────────────────────────────────────
// Reactive store of all skill tabs in display order.
// Shape: [{ id: "languages", label: "LANGUAGES" }, ...]
//
// WHY A DERIVED STORE HERE:
//   skillTabsData is already a writable store.
//   Wrapping it in derived(...) gives this file a stable public export
//   and lets us apply a safe fallback so components always receive an array.
export const skillTabsStore = derived(
  skillTabsData,
  ($skillTabsData) => $skillTabsData ?? []
);

// ── skillsStore ───────────────────────────────────────────────────
// Reactive store of all skills grouped by tab id.
// Shape: { languages: [{ name, pct, primary, exposure }], ... }
//
// WHY A DERIVED STORE HERE:
//   skillsData is the writable source populated by layout.
//   This export keeps the public data-layer API consistent and ensures
//   components always receive an object, even before data is populated.
export const skillsStore = derived(
  skillsData,
  ($skillsData) => $skillsData ?? {}
);

// ── getSkillTabs ──────────────────────────────────────────────────
// Snapshot helper.
// Returns all skill tabs in display order.
//
// USE THIS WHEN:
//   You are in a plain .js module and need the current value once.
//
// DO NOT USE THIS FOR REACTIVE SVELTE UI:
//   In .svelte files, prefer $skillTabsStore so the UI updates automatically.
export function getSkillTabs() {
  return get(skillTabsStore);
}

// ── getSkills ─────────────────────────────────────────────────────
// Snapshot helper.
// Returns all skills grouped by tab id.
//
// USE THIS WHEN:
//   You are in a plain .js module and need the current value once.
//
// DO NOT USE THIS FOR REACTIVE SVELTE UI:
//   In .svelte files, prefer $skillsStore so the UI updates automatically.
export function getSkills() {
  return get(skillsStore);
}