// ╔═══════════════════════════════════════════════════════════════════╗
// ║  src/lib/data/stats.js — Hero Section Stat Counters              ║
// ╚═══════════════════════════════════════════════════════════════════╝
//
// WHAT THIS FILE IS:
//   Computes the three animated stat counters shown in the Hero section:
//     Years Experience  → derived from earliest job start date
//     Projects Shipped  → derived from live merged project count
//     Technologies      → derived from primary skills in the skills store
//
//   All three values are computed from real data — never hardcoded.
//   When the underlying data changes, these numbers update automatically.
//
// WHY A SEPARATE FILE:
//   config.js is browser-safe static config — no data dependencies.
//   +layout.server.js is server-only — fetches raw data, no business logic.
//   stats.js sits between them: reads from live stores, computes the final
//   stat objects, and exports one reactive store that Hero.svelte can use.
//
//   This separation means:
//     config.js          → stays clean (no live data logic)
//     +layout.server.js  → stays clean (no stat computation)
//     stats.js           → one job: produce the Hero stat data
//
// WHY THIS FILE USES derived(...) INSTEAD OF SNAPSHOT READS:
//   Hero counters depend on stores that are populated after layout data arrives.
//   A one-time snapshot can run too early during SSR / refresh and capture
//   empty initial values.
//
//   derived(...) subscribes to those stores directly:
//     1. +layout.server.js returns data
//     2. +layout.svelte pushes that data into the writable stores
//     3. the derived store below re-computes automatically
//     4. Hero.svelte receives the updated stat array
//
//   This keeps the entire dependency chain reactive from source data
//   all the way to the UI.
//
// WHEN TURSO REPLACES JSON FILES:
//   Replace the upstream store population with DB-backed data sources.
//   yearsFromISO(), buildStats(), and the final stat object shape can stay
//   exactly the same. Hero.svelte also stays untouched.

import { derived } from "svelte/store";
import { skillsData, experienceData } from "$lib/stores/ui.js";
import { mergedProjectsStore } from "$lib/data/projects.js";

// ── yearsFromISO ──────────────────────────────────────────────────
// Converts an ISO date string ("YYYY-MM") into a display-ready
// { target, suffix } pair for the animated counter.
//
// The suffix logic avoids both under-selling and over-selling:
//
//   Decimal range  → display example  → reasoning
//   0.0 – 0.4      → "3+"             → less than halfway, show floor with +
//   0.4 – 0.6      → "3.5"            → around halfway, show exactly
//   0.6 – 0.8      → "3.5+"           → past halfway, show 3.5 with +
//   0.8 – 1.0      → "4"              → close enough to round up cleanly
//
// @param {string} isoDate — "YYYY-MM" format (e.g. "2022-06")
// @returns {{ target: number, suffix: string }}
function yearsFromISO(isoDate) {
  const [year, month] = isoDate.split("-").map(Number);

  // month - 1 because JavaScript Date months are 0-indexed (January = 0)
  const start = new Date(year, month - 1, 1);
  const now = new Date();
  const raw = (now - start) / (1000 * 60 * 60 * 24 * 365);
  const decimal = raw % 1;

  if (decimal < 0.4) return { target: Math.floor(raw), suffix: "+" };
  if (decimal < 0.6) return { target: Math.floor(raw) + 0.5, suffix: "" };
  if (decimal < 0.8) return { target: Math.floor(raw) + 0.5, suffix: "+" };
  return { target: Math.ceil(raw), suffix: "" };
}

// ── buildStats ────────────────────────────────────────────────────
// Pure stat builder.
// Accepts plain values and returns the final stat array consumed by Hero.svelte.
//
// WHY KEEP THIS PURE:
//   A pure function is easy to understand, easy to test, and safe to reuse.
//   It does not know anything about stores, subscriptions, SSR, or layout timing.
//   It simply receives already-available data and converts it into the final
//   display shape used by the Hero counters.
//
// INPUTS:
//   mergedProjects → already merged project list from projects.js
//   skills         → grouped skills object from the skills store
//   expEntries     → experience array from the experience store
//
// OUTPUT:
//   Array of stat objects:
//     { target, suffix, label, color }
function buildStats(mergedProjects = [], skills = {}, expEntries = []) {
  // ── techCount ───────────────────────────────────────────────────
  // Counts primary skills across all tabs.
  //
  // primary: true  → core production skill, counted in the total
  // exposure: true → limited / learning exposure, excluded from count
  //
  // Why exclude exposure skills?
  //   Exposure flags honest "used briefly, not production depth".
  //   Including them would inflate the count. The number represents skills
  //   the portfolio owner is genuinely comfortable using professionally.
  //
  // Object.values(skills) → array of arrays (one per tab)
  // .flat()               → one flat array of all skill objects
  // .filter(...)          → keep only primary + non-exposure
  // .length               → final count
  const techCount = Object.values(skills ?? {})
    .flat()
    .filter((s) => s.primary && !s.exposure).length;

  // ── projectCount ────────────────────────────────────────────────
  // Live count of all projects — GitHub repos merged with manual entries.
  //
  // mergedProjects already includes:
  //   GitHub repos         → personal projects (public + private)
  //   Manual projects      → professional work (not on GitHub)
  //   Slug matches         → manual data overriding GitHub display fields
  //
  // Because this function receives the merged array directly,
  // counting projects is now a simple array length read.
  const projectCount = mergedProjects.length;

  // ── yearsExp ────────────────────────────────────────────────────
  // Uses the earliest experience entry to calculate total experience.
  //
  // Experience data is ordered newest-first, so:
  //   last entry = earliest role
  //
  // startDate format: "YYYY-MM"
  const earliest = expEntries[expEntries.length - 1];
  const { target: yearsTarget, suffix: yearsSuffix } = earliest
    ? yearsFromISO(earliest.startDate)
    : { target: 0, suffix: "+" };

  return [
    // Years of experience — approximate, uses dynamic suffix from yearsFromISO
    {
      target: yearsTarget,
      suffix: yearsSuffix,
      label: "Years Experience",
      color: "neon-c",
    },

    // Total projects shipped — exact live count from merged project data
    {
      target: projectCount,
      suffix: "",
      label: "Projects Shipped",
      color: "neon-m",
    },

    // Technologies — exact count of primary skills
    {
      target: techCount,
      suffix: "",
      label: "Technologies",
      color: "neon-g",
    },
  ];
}

// ── STATS ─────────────────────────────────────────────────────────
// Reactive stat store consumed by Hero.svelte.
//
// Each object defines one stat counter:
//   target → number the counter animates up to
//   suffix → appended after the number in the display
//              '+' = "at least this many" (approximate value)
//              ''  = exact count
//   label  → small uppercase text shown below the counter
//   color  → CSS utility class for neon colour
//              'neon-c' = cyan
//              'neon-m' = magenta
//              'neon-g' = green
//
// WHY THIS IS A STORE:
//   The source data arrives asynchronously through layout/store updates.
//   Exporting STATS as a derived store means any component can subscribe
//   to it and always receive the latest computed values.
export const STATS = derived(
  [mergedProjectsStore, skillsData, experienceData],
  ([$mergedProjects, $skills, $experience]) =>
    buildStats($mergedProjects ?? [], $skills ?? {}, $experience ?? [])
);