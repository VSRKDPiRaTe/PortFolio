// ─── experience.js ───────────────────────────────────────────────
// Source of truth is now the experienceData store.
// That store is populated from DB-backed data returned by the site layout.
//
// This file is the experience data layer used by components and helpers.
// It exposes:
//
//   1. experienceStore   → reactive store for Svelte components
//   2. getExperience()   → one-time snapshot helper for plain JS modules
//   3. formatDateRange() → shared date formatting helper
//
// experience entry shape:
//   id        → unique identifier / slug
//   role      → job title
//   company   → company name
//   location  → city, country
//   startDate → "YYYY-MM"
//   endDate   → "YYYY-MM" or null
//   current   → boolean, true if current job
//   desc      → summary paragraph
//   bullets   → resume bullet points
//   tags      → technologies used
// ─────────────────────────────────────────────────────────────────
// ╔═══════════════════════════════════════════════════════════════════╗
// ║  src/lib/data/experience.js — Experience Data Layer              ║
// ╚═══════════════════════════════════════════════════════════════════╝
//
// Reads experience data from the experienceData store.
// Store is populated by +layout.svelte from DB data fetched in
// +layout.server.js via src/lib/server/queries/experience.js.
//
// When this module was using experience.json directly, changes required
// editing a file. Now changes go through the Owner Interface → DB → here.
//
// WHY THIS FILE EXPORTS A STORE:
//   A one-time get(...) read is only a snapshot.
//   Svelte components that must stay in sync after refresh, navigation,
//   or owner-side edits should subscribe to a reactive store instead.
//
//   So this file now provides:
//     experienceStore → reactive for .svelte files
//     getExperience() → snapshot for plain .js files

import { derived, get } from 'svelte/store';
import { experienceData } from '$lib/stores/ui.js';

// ── experienceStore ──────────────────────────────────────────────
// Reactive list of all experience entries in display order.
//
// WHY DERIVED HERE:
//   experienceData is already a writable store populated by the layout.
//   This derived export gives the data layer a stable public API and
//   guarantees a safe fallback so components always receive an array.
export const experienceStore = derived(
  experienceData,
  ($experienceData) => $experienceData ?? []
);

// ── getExperience ────────────────────────────────────────────────
// Snapshot helper.
// Returns all experience entries once.
//
// USE THIS WHEN:
//   You are in a plain .js module and only need the current value once.
//
// DO NOT USE THIS FOR REACTIVE UI:
//   In .svelte files, prefer experienceStore / $experienceStore.
export function getExperience() {
  return get(experienceStore);
}

// ── formatDateRange ──────────────────────────────────────────────
// Formats a startDate/endDate pair into a display string.
// Used in Experience.svelte for the date range shown per job.
//
// @param {string} startDate — "YYYY-MM" e.g. "2022-06"
// @param {string|null} endDate — "YYYY-MM" or null if current
// @param {boolean} current — true if still employed here
// @returns {string} e.g. "JUN 2022 — MAR 2025" or "MAR 2025 — PRESENT"
export function formatDateRange(startDate, endDate, current) {
  const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN',
                  'JUL','AUG','SEP','OCT','NOV','DEC'];

  function fmt(iso) {
    const [year, month] = iso.split('-').map(Number);
    return `${MONTHS[month - 1]} ${year}`;
  }

  const start = fmt(startDate);
  const end = (current || !endDate) ? 'PRESENT' : fmt(endDate);
  return `${start} — ${end}`;
}