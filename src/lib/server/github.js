// ╔═══════════════════════════════════════════════════════════════════╗
// ║  src/lib/server/github.js — Server-only GitHub API Helper         ║
// ╚═══════════════════════════════════════════════════════════════════╝
//
// WHAT THIS FILE IS:
//   Central GitHub API helper used by server routes only.
//
// WHY THIS EXISTS:
//   Owner routes GitHub ingestion
//   must fetch GitHub directly on the owner side.
//   GitHub is now an ingestion source, not a public render dependency.
//
//   Public site:
//     reads projects from DB only.
//
//   Owner projects page:
//     fetches GitHub repos directly
//     syncs them into the projects table
//     lets the owner customise DB-backed project records.
//
// ARCHITECTURE:
//   GitHub API = ingestion source
//   Database   = project source of truth
//   Public site reads DB-backed project data only.
//   ** GitHub API → owner-side ingestion → projects table → public site **
//
// SECURITY:
//   This file imports private env vars.
//   Never import this file in .svelte components.
//   Only server routes / server query flows should use it.

import { GITHUB_TOKEN, GITHUB_USERNAME } from "$env/static/private";

const GITHUB_API_BASE = "https://api.github.com";

// ── GitHub API Headers ────────────────────────────────────────────
// Centralised so every GitHub fetch uses the same auth token and API version.
//
// IMPORTANT FOR PRIVATE REPOS:
//   Private repos are only visible through authenticated endpoints.
//   So unlike public profile fetching, repo fetching must prove that
//   the token is valid and belongs to the expected account.
//
// Authorization: Bearer token → authenticates as token owner
//                             → unlocks private repo visibility (if permitted)
// X-GitHub-Api-Version → pins to a specific API version → prevents
//                         breaking changes from silently affecting the app
function githubHeaders() {
  return {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

// ── readJsonOrThrow ───────────────────────────────────────────────
// Reads GitHub response JSON and throws helpful errors when GitHub rejects.
// Small helper to keep GitHub error handling clean and readable.
// If GitHub rejects the request, we capture the response body too.
// That makes debugging token/scope/repository-permission issues much easier.
//
// Why capture response text?
//   GitHub error bodies usually explain whether the issue is:
//     - bad token
//     - missing repo scope
//     - rate limit
//     - endpoint permission problem
async function readJsonOrThrow(res, label) {
  const text = await res.text();

  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    throw new Error(
      `${label} Error: ${res.status} ${res.statusText}${text ? ` | ${text}` : ""}`,
    );
  }

  return json;
}

// ── formatRepoTitle ───────────────────────────────────────────────
// Converts repo-name → Repo Name.
//
// This becomes the default title stored in DB on GitHub sync.
// Owner can later customise the title from the Owner Interface.
function formatRepoTitle(name) {
  return name
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

// ── fetchAuthenticatedGitHubUser ──────────────────────────────────
// Validates which GitHub account the token belongs to.
//
// Why this exists:
//   /user/repos is token-driven, not username-driven.
//   /users/:username         → proves the username exists publicly
//   /user                    → proves WHICH account the token belongs to
//   If the token belongs to another GitHub account, repo sync would import
//   the wrong repos.
//
// So before syncing repos, we confirm:
//   authenticated token user === configured GITHUB_USERNAME
async function fetchAuthenticatedGitHubUser(fetch) {
  const res = await fetch(`${GITHUB_API_BASE}/user`, {
    headers: githubHeaders(),
  });

  const raw = await readJsonOrThrow(res, "GitHub Auth User API");

  return raw;
}

// ── fetchOwnerGitHubRepos ─────────────────────────────────────────
// Fetches repos owned by the authenticated GitHub account.
// Includes public and private repos.
//
// Used by:
//   src/routes/(ownerapp)/owner/projects/+page.server.js
//
// ENDPOINT PARAMS:
//   visibility=all     → public + private
//   affiliation=owner  → only repos owned by the authenticated account
//   per_page=100       → GitHub max page size
//   sort=pushed        → most recently active first
//
// IMPORTANT:
//   This endpoint is auth-driven, not username-driven.
//   So before calling it, we validate that the token owner matches
//   GITHUB_USERNAME. That removes ambiguity completely.
//
// Returns normalised repo objects shaped for syncGithubRepos().
export async function fetchOwnerGitHubRepos(fetch) {
  const authUser = await fetchAuthenticatedGitHubUser(fetch);

  if ((authUser?.login ?? '').toLowerCase() !== GITHUB_USERNAME.toLowerCase()) {
    throw new Error(
      `GitHub token user "${authUser?.login}" does not match GITHUB_USERNAME "${GITHUB_USERNAME}".`,
    );
  }

  const res = await fetch(
    `${GITHUB_API_BASE}/user/repos?visibility=all&affiliation=owner&per_page=100&sort=pushed`,
    { headers: githubHeaders() },
  );

  const raw = await readJsonOrThrow(res, "GitHub Repos API");

  if (!Array.isArray(raw)) {
    console.error("GitHub repos response is not an array:", raw);
    return [];
  }

  return raw
    .filter((r) => !r.fork) // exclude forks — not user work
    .map((r) => {
      // ── Badge Detection ─────────────────────────────────────────
      // Default badge is decided only during sync.
      // Owner can later override badge from Owner Interface.
      //
      // Archived → done
      // Private  → wip
      // Public   → live
      const badge = r.archived ? "done" : r.private ? "wip" : "live";

      // ── Tags = Topics + Primary Language ────────────────────────
      // topics: user-added tags in GitHub repo → Topics
      // language: GitHub-detected primary language
      //
      // Merge and deduplicate case-insensitively.
      const topics = Array.isArray(r.topics) ? r.topics : [];
      const langTag = r.language ?? null;

      const tags =
        langTag &&
        !topics.some((t) => t.toLowerCase() === langTag.toLowerCase())
          ? [...topics, langTag]
          : [...topics];

      return {
        // ── Identity ───────────────────────────────────────────────
        github_id: r.id, // stable numeric GitHub ID
        slug: r.name, // used in /projects/[slug]
        name: r.name,
        title: formatRepoTitle(r.name),
        subtitle: r.name,
        description: r.description ?? "",

        // ── Privacy ────────────────────────────────────────────────
        private: r.private,

        // ── Links ──────────────────────────────────────────────────
        // Public repos can expose GitHub URL.
        // Private repos hide GitHub link from public visitors.
        github: r.private ? null : r.html_url,
        demo: r.homepage ?? null,

        // ── Display Defaults ──────────────────────────────────────
        tags,
        badge,
        group: "personal",

        // ── Synced GitHub Metadata ────────────────────────────────
        language: r.language ?? null,
        stars: r.stargazers_count ?? 0,
        pushedAt: r.pushed_at ?? null,
        createdAt: r.created_at ?? null,
        archived: r.archived ?? false,

        // source flag — tells syncGithubRepos this is a GitHub-backed project
        source: "github",
      };
    });
}
