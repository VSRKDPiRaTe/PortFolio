// ╔═══════════════════════════════════════════════════════════════════╗
// ║  src/lib/data/projects.js — Single Project Data Layer             ║
// ╚═══════════════════════════════════════════════════════════════════╝
//
// WHAT THIS FILE IS:
//   The public project data layer for the portfolio.
//   Every component that displays projects imports from here.
//
// CURRENT ARCHITECTURE:
//   Database is the source of truth.
//
//   GitHub is now an ingestion source only:
//     /owner/projects
//       → fetch GitHub repos
//       → sync full repo data into projects table
//       → public site reads projects from DB
//
// DATA SOURCE:
//   projectsData store.
//
//   That store is populated by:
//     src/routes/(site)/+layout.svelte
//
//   using data returned by:
//     src/routes/(site)/+layout.server.js
//
// CONSTANTS DEFINED HERE (not in Database):
//   groups  → structural UI constants for section headings
//   badges  → display metadata for each badge type (color, label, desc)
//
//   These are code constants, not content. Adding a new group or badge
//   type requires a code change regardless, so they live here.
//
// USAGE IN COMPONENTS:
//   import { groups, badges, mergedProjectsStore, getByGroup, getBySlug }
//     from '$lib/data/projects.js'
//
//   In Svelte components, prefer mergedProjectsStore for reactivity.
//   getMergedProjects() is kept as a snapshot helper for plain JS usage.

import { derived, get } from "svelte/store";
import { projectsData } from '$lib/stores/ui.js';

// ── groups ────────────────────────────────────────────────────────
// Defines the display groups used to organise projects.
//
// id       → matches the project.group field from DB
// label    → full heading text shown above the group on /projects page
// subLabel → short label shown on individual project cards
// desc     → explanatory text shown below the group heading
export const groups = [
  {
    id: "personal",
    label: "PERSONAL & OPEN SOURCE",
    subLabel: "PERSONAL",
    desc: "Projects built and owned by the portfolio owner — source available on GitHub.",
  },
  {
    id: "professional",
    label: "PROFESSIONAL WORK",
    subLabel: "PROFESSIONAL",
    desc: "Projects built during employment — source is private, but live links available where permitted or feasible.",
  },
];

// ── badges ────────────────────────────────────────────────────────
// Display metadata for each badge type shown on project cards.
//
// Each badge key matches the project.badge field value from DB.
// Components look up badge metadata using: badges[project.badge]
//
// Fields per badge:
//   label     → short text shown on the card pill (e.g. "WIP", "LIVE")
//   full      → full status name shown on the project detail page
//   desc      → explanation of what this status means, shown on detail page
//   color     → background hex colour for the badge pill
//   textColor → text hex colour for the badge pill (ensure contrast)
//
// Badge types:
//   wip        → work in progress / ongoing personal project
//   live       → deployed and accessible personal project
//   done       → completed or archived personal project
//   delivered  → client or freelance work, source private
//   production → employment / production work, source private
//
// GitHub repo badges are chosen during owner-side GitHub sync.
// Manual project badges are chosen in the Owner Interface.
//
// Why hardcoded here instead of in Database?
//   Badge metadata is UI config — colors, labels, descriptions.
//   It changes only when adding a new badge type, which also requires
//   updating components.
export const badges = {
  wip: {
    label: "WIP",
    full: "WORK IN PROGRESS",
    desc: "Currently in development or early stages — source available on GitHub, may not be fully functional or polished yet.",
    color: "#00f5ff",
    textColor: "#000000",
  },
  live: {
    label: "LIVE",
    full: "LIVE PROJECT",
    desc: "Live and accessible to users — source available on GitHub.",
    color: "#00ff88",
    textColor: "#000000",
  },
  done: {
    label: "DONE",
    full: "COMPLETED PROJECT",
    desc: "Completed and stable — source available on GitHub, no longer actively maintained.",
    color: "#ff00c8",
    textColor: "#ffffff",
  },
  delivered: {
    label: "DELIVERED",
    full: "CLIENT / CONTRACT WORK",
    desc: "Built for private clients or freelance work — source is private, but live links available where permitted or feasible.",
    color: "#ffe600",
    textColor: "#000000",
  },
  production: {
    label: "PRODUCTION",
    full: "EMPLOYMENT WORK",
    desc: "Built during employment — source is private, live links available where permitted or feasible.",
    color: "#00ff88",
    textColor: "#000000",
  },
};

// ── normaliseProject ──────────────────────────────────────────────
// Normalises a DB project row into the card/detail shape components expect.
//
// Why normalise?
//   DB rows can contain nulls, numeric flags, or missing optional values.
//   Components should not need to repeat defensive checks everywhere.
//
// Output shape is stable for:
//   ProjectCard.svelte
//   /projects page
//   /projects/[slug] detail page
function normaliseProject(project) {
  return {
    id: project.id,
    slug: project.slug,
    group: project.group,
    source: project.source,

    title: project.title,
    subtitle: project.subtitle ?? project.slug,
    desc: project.desc || 'No description available yet.',

    tags: Array.isArray(project.tags) ? project.tags : [],
    badge: project.badge,

    github: project.github ?? null,
    demo: project.demo ?? null,
    private: project.private ?? false,

    company: project.company ?? null,

    language: project.language ?? null,
    stars: Number(project.stars ?? 0),
    pushedAt: project.pushedAt ?? null,
    createdAt: project.createdAt ?? null,
    archived: project.archived ?? false,
  };
}

// ── mergedProjectsStore ───────────────────────────────────────────
// Reactive project list used by Svelte components.
//
// Name kept as mergedProjectsStore for compatibility with existing
// components, but it no longer performs a GitHub/manual merge.
// It now means:
//   "the final DB-backed project list ready for display".
export const mergedProjectsStore = derived(projectsData, ($projects) =>
  ($projects ?? []).map(normaliseProject),
);

// ── getMergedProjects ─────────────────────────────────────────────
// Snapshot helper for plain JS usage.
//
// In Svelte components, prefer:
//   $mergedProjectsStore
//
// In plain JS, use this when you only need the current value once.
export function getMergedProjects() {
  return (get(projectsData) ?? []).map(normaliseProject);
}

// ── Helpers ───────────────────────────────────────────────────────
// Accept the already-normalised array so callers do not re-map/re-read
// the store on every helper call.
//
// Pattern:
//   const all = $mergedProjectsStore
//   const personal = getByGroup(all, 'personal')
//   const project  = getBySlug(all, 'securetrack')

// Returns all projects belonging to a specific group.
// groupId must match a value in the groups array ('personal' | 'professional')
export function getByGroup(projects, groupId) {
  return projects.filter((project) => project.group === groupId);
}

// Returns a single project by its slug, or null if not found.
// Used by /projects/[slug] route data to load detail page data.
// Returns null (not undefined) so callers can check with a simple if-check.
export function getBySlug(projects, slug) {
  return projects.find((project) => project.slug === slug) ?? null;
}