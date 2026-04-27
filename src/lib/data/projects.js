// ╔═══════════════════════════════════════════════════════════════════╗
// ║  src/lib/data/projects.js — Single Project Data Layer            ║
// ╚═══════════════════════════════════════════════════════════════════╝
//
// WHAT THIS FILE IS:
//   The single source of truth for all project data in the portfolio.
//   Every component that displays projects imports from here
//
// TWO DATA SOURCES:
//   1. Database  → manual entries: professional work, project overrides
//                       Edited by the portfolio owner via Owner Interface (Phase 4)
//                       or directly in the JSON file until then
//
//   2. githubRepos store → live GitHub data fetched server-side
//                          Set in +layout.svelte after +layout.server.js runs
//                          Contains all repos (public + private) with badge,
//                          tags, links, and metadata derived automatically
//
// MERGE PRIORITY (when same slug exists in both sources):
//   Database entry wins on ALL fields it defines.
//   GitHub-only fields (stars, pushedAt, language) are always kept
//   from the live API even when Database data overrides other fields.
//   This allows custom titles and descriptions while keeping live stats.
//
// ARCHITECTURE RULE:
//   Components never merge or transform project data themselves.
//   All components call getMergedProjects() for a one-time snapshot,
//   or subscribe to mergedProjectsStore for live reactive updates.
//
// CONSTANTS DEFINED HERE (not in Database):
//   groups  → structural UI constants for section headings
//   badges  → display metadata for each badge type (color, label, desc)
//   These are code constants, not content — adding a new group or badge
//   type requires a code change regardless, so they live here.
//
// USAGE IN COMPONENTS:
//   import { groups, badges, mergedProjectsStore, getByGroup, getBySlug }
//     from '$lib/data/projects.js'
//
//   In Svelte components, prefer mergedProjectsStore for reactivity.
//   getMergedProjects() is kept as a snapshot helper for plain JS usage.

import { derived, get } from "svelte/store";

import {
  githubRepos as githubReposStore,
  customisedRepos as customisedReposStore,
  manualProjectsData as manualProjectsStore,
} from '$lib/stores/ui.js';

// ── groups ────────────────────────────────────────────────────────
// Defines the two display groups used to organise projects.
// Rendered as section headings on the /projects page.
//
// id       → matches the project.group field in both JSON and GitHub repos
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
// Each badge key matches the project.badge field value (lowercase).
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
//   wip        → work in progress, personal GitHub repo
//   live       → deployed and accessible, personal GitHub repo
//   done       → completed, no longer maintained, personal GitHub repo
//   delivered  → client or freelance work, source private
//   production → employment work, source private
//
// GitHub repos do NOT use a hardcoded badge here — their badge is
// derived automatically in +layout.server.js based on repo topics
// and flags (archived, private). See +layout.server.js badge detection.
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

// ── repoToCard ────────────────────────────────────────────────────
// Converts a raw GitHub repo object (shaped in +layout.server.js)
// into the normalised card shape used by all project components.
//
// WHY NORMALISE:
//   GitHub repo objects and manual Database entries have different
//   field names and structures. Normalising both to the same shape means
//   components receive identical data regardless of the source.
//   A ProjectCard component does not need to know where the data came from.
//
// NOTE: badge and tags are already computed in +layout.server.js
//   before the repo reaches this function. This function trusts those
//   values and maps them through without recomputing.
//
// @param {object} repo — a repo object shaped by +layout.server.js
// @returns {object} — normalised project card shape
function repoToCard(repo) {
  return {
    id: repo.slug,
    slug: repo.slug,
    group: repo.group, // all GitHub repos = personal group
    source: repo.source, // origin flag for merge tracking
    title: repo.title ?? repo.name.replace(/-/g, " ").toUpperCase(),
    subtitle: repo.name,
    desc:
      repo.description ||
      "No description — add one in GitHub repo Settings → Description.",
    tags: repo.tags ?? [], // topics + primary language (set in layout.server.js)
    badge: repo.badge, // derived in layout.server.js from topics/flags
    github: repo.github, // null for private repos
    demo: repo.demo ?? null,
    private: repo.private,

    // GitHub-only metadata — not available in manual Database entries
    // Used on the project detail page (/projects/[slug])
    language: repo.language ?? null, // primary language detected by GitHub
    stars: repo.stars ?? 0, // stargazer count
    pushedAt: repo.pushedAt ?? null, // ISO string of last push date
    createdAt: repo.createdAt ?? null,
    archived: repo.archived ?? false,
  };
}

// ── mergeProjects ─────────────────────────────────────────────────
// Pure merge function.
// Accepts raw source arrays and returns one normalised merged array.
//
// WHY PURE:
//   This lets us reuse the exact same merge logic for:
//     1. snapshot reads (getMergedProjects)
//     2. live reactive store output (mergedProjectsStore)
//
//   One source of merge truth = no duplicated logic, no drift.
export function mergeProjects({ githubRepos = [], customisedProjects = [], manualProjects = [] }) {
  // Build a map of slug → DB override for fast lookup
  const overrideMap = new Map(customisedProjects.map((p) => [p.slug, p]));

  // Step 1: Convert GitHub repos to card shape, applying manual overrides
  const githubCards = githubRepos.map((repo) => {
    const baseCard = repoToCard(repo);
    const override = overrideMap.get(repo.slug);

    if (override) {
      // Owner has customised this repo — DB wins for display fields.
      // Live GitHub fields (stars, pushedAt, language, private, github URL)
      // are always kept current from the API regardless.
      return {
        ...baseCard,
        ...override,
        title: override.title || baseCard.title,
        desc: override.desc || baseCard.desc,
        tags: override.tags?.length ? override.tags : baseCard.tags,
        badge: override.badge || baseCard.badge,
        demo: override.demo ?? baseCard.demo,

        // Always preserve live GitHub-owned fields
        github: baseCard.github,
        private: baseCard.private,
        language: baseCard.language,
        stars: baseCard.stars,
        pushedAt: baseCard.pushedAt,
        createdAt: baseCard.createdAt,
        archived: baseCard.archived,

        // Correctly mark that this card is a merged result
        source: "github+manual",
      };
    }

    // No manual override — pure GitHub data
    return baseCard;
  });

  const githubSlugs = new Set(githubRepos.map((r) => r.slug));

  // Step 2: Manual projects that have no GitHub repo equivalent
  // These are professional/client projects that never had a personal repo
  const manualOnly = manualProjects.filter((p) => !githubSlugs.has(p.slug));

  // GitHub repos first (already sorted upstream), then manual-only entries
  return [...githubCards, ...manualOnly];
}

// ── mergedProjectsStore ───────────────────────────────────────────
// Reactive merged projects output.
// This is the correct export for Svelte components that need live updates.
//
// WHY THIS FIXES THE BUG:
//   derived(...) subscribes to the underlying stores directly.
//   So when +layout.svelte writes githubRepos/customisedRepos/manualProjects
//   into their stores, this derived store recomputes automatically.
//
//   Unlike getMergedProjects(), this does NOT rely on hidden get(...) calls,
//   so Svelte reactivity can track updates properly.
export const mergedProjectsStore = derived(
  [githubReposStore, customisedReposStore, manualProjectsStore],
  ([$githubRepos, $customisedRepos, $manualProjects]) =>
    mergeProjects({
      githubRepos: $githubRepos ?? [],
      customisedProjects: $customisedRepos ?? [],
      manualProjects: $manualProjects ?? [],
    })
);

// ── getMergedProjects ─────────────────────────────────────────────
// Snapshot helper.
// Reads the current store values once and returns the merged result.
//
// IMPORTANT:
//   This is useful in plain JS modules or one-off utility code,
//   but not ideal for reactive Svelte UI.
//
//   In Svelte components, prefer mergedProjectsStore instead.
export function getMergedProjects() {
  return mergeProjects({
    githubRepos: get(githubReposStore) ?? [],
    customisedProjects: get(customisedReposStore) ?? [],
    manualProjects: get(manualProjectsStore) ?? [],
  });
}

// ── Helpers ───────────────────────────────────────────────────────
// Accept the already-merged array so callers do not re-merge on every call.
//
// Pattern:
//   const all = $mergedProjectsStore
//   const personal = getByGroup(all, 'personal')
//   const project  = getBySlug(all, 'securetrack')

// Returns all projects belonging to a specific group.
// groupId must match a value in the groups array ('personal' | 'professional')
export function getByGroup(projects, groupId) {
  return projects.filter((p) => p.group === groupId);
}

// Returns a single project by its slug, or null if not found.
// Used by /projects/[slug]/+page.js to load detail page data.
// Returns null (not undefined) so callers can check with a simple if-check.
export function getBySlug(projects, slug) {
  return projects.find((p) => p.slug === slug) ?? null;
}