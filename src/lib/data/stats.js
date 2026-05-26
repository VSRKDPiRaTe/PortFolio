// ╔═══════════════════════════════════════════════════════════════════╗
// ║  src/lib/data/stats.js — Hero Section Stat Counters              ║
// ╚═══════════════════════════════════════════════════════════════════╝
//
// WHAT THIS FILE IS:
//   Computes the three animated stat counters shown in the Hero section:
//     Years Experience  → derived from experience start/end dates
//     Projects Shipped  → derived from DB-backed project count
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
// CURRENT DATA ARCHITECTURE:
//   Database is the source of truth.
//   Owner Interface writes experience/projects/skills to DB.
//   Public site reads DB-backed data into stores.
//   This file computes stats from those stores.

import { derived } from "svelte/store";
import { skillsData, experienceData } from "$lib/stores/ui.js";
import { projectsStore } from "$lib/data/projects.js";

// ── Date helpers ──────────────────────────────────────────────────
// Converts "YYYY-MM" into a Date object.
//
// Returns null for invalid/missing dates so calculations can safely skip
// broken rows instead of crashing the Hero section.
function monthDate(isoMonth) {
  if (!isoMonth || typeof isoMonth !== "string") return null;

  const [year, month] = isoMonth.split("-").map(Number);

  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
  if (month < 1 || month > 12) return null;

  // month - 1 because JavaScript Date months are 0-indexed.
  return new Date(year, month - 1, 1);
}

// ── yearsFromStartDate ────────────────────────────────────────────
// Converts an earliest start date into a display-ready
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
// @param {Date} start — earliest valid job start date
// @returns {{ target: number, suffix: string }}
function yearsFromStartDate(start) {
  const now = new Date();

  if (!(start instanceof Date) || Number.isNaN(start.getTime())) {
    return { target: 0, suffix: "+" };
  }

  const raw = Math.max(0, (now - start) / (1000 * 60 * 60 * 24 * 365.25));
  const whole = Math.floor(raw);
  const decimal = raw % 1;

  if (decimal < 0.4) return { target: whole, suffix: "+" };
  if (decimal < 0.6) return { target: whole + 0.5, suffix: "" };
  if (decimal < 0.8) return { target: whole + 0.5, suffix: "+" };
  return { target: Math.ceil(raw), suffix: "" };
}

// ── calculateExperienceYears ──────────────────────────────────────
// Calculates total visible years of professional experience.
//
// CURRENT STRATEGY:
//   Use the earliest valid startDate from all experience rows and count
//   from that month until now.
//
// WHY NOT USE ARRAY POSITION:
//   Experience array order can change depending on SQL ORDER BY,
//   owner sorting, or newly inserted rows.
//
//   The old logic used:
//     expEntries[expEntries.length - 1]
//
//   That only worked if the array was perfectly newest-first.
//   This function is safer because it reads actual startDate values.
//
// WHY NOT SUM EVERY JOB DURATION:
//   Summing durations can over-count if jobs overlap.
//   For a portfolio headline stat, earliest professional start → present
//   is usually the cleanest and most honest "Years Experience" number.
function calculateExperienceYears(expEntries = []) {
  const validStarts = (expEntries ?? [])
    .map((entry) => monthDate(entry.startDate))
    .filter(Boolean)
    .sort((a, b) => a - b);

  const earliestStart = validStarts[0];

  return earliestStart
    ? yearsFromStartDate(earliestStart)
    : { target: 0, suffix: "+" };
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
//   projects   → DB-backed project list from projects.js
//   skills     → grouped skills object from the skills store
//   expEntries → experience array from the experience store
//
// OUTPUT:
//   Array of stat objects:
//     { target, suffix, label, color }
function buildStats(projects = [], skills = {}, expEntries = []) {
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
    .filter((skill) => skill.primary && !skill.exposure).length;

  // ── projectCount ────────────────────────────────────────────────
  // Live count of all DB-backed projects.
  //
  // projects already includes:
  //   GitHub-synced projects → source='github'
  //   Manual projects        → source='manual'
  const projectCount = projects.length;

  // ── yearsExp ────────────────────────────────────────────────────
  // Uses actual startDate values from all experience rows.
  //
  const { target: yearsTarget, suffix: yearsSuffix } = calculateExperienceYears(expEntries);

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
//              '+' = "at least this many" / approximate value
//              ''  = exact count
//   label  → small uppercase text shown below the counter
//   color  → CSS utility class for neon colour
//              'neon-c' = cyan
//              'neon-m' = magenta
//              'neon-g' = green
//
// WHY THIS IS A STORE:
//   Source data arrives asynchronously through layout/store updates.
//   Exporting STATS as a derived store means any component can subscribe
//   and always receive the latest computed values.
export const STATS = derived(
  [projectsStore, skillsData, experienceData],
  ([$projects, $skills, $experience]) =>
    buildStats($projects ?? [], $skills ?? {}, $experience ?? [])
);