// ╔═══════════════════════════════════════════════════════════════════╗
// ║  src/routes/(site)/+layout.server.js — Public Site Data Gateway  ║
// ╚═══════════════════════════════════════════════════════════════════╝
//
// WHAT THIS FILE IS:
//   The server-side data gateway for the PUBLIC portfolio site.
//   It runs on the server before public pages render.
//
//   This file loads the public display data from the database:
//     - projects
//     - experience
//     - skill tabs
//     - grouped skills
//
// WHY THIS FILE EXISTS:
//   SvelteKit separates server code from browser code at the file level.
//
//   +layout.server.js:
//     - server only
//     - can read private environment variables
//     - can talk to the database
//     - never ships to the browser
//
//   +layout.svelte:
//     - receives this returned data
//     - hydrates stores/context for components
//
// CURRENT ARCHITECTURE:
//   Database is the source of truth for public project display.
//
//   GitHub is no longer fetched on every public page load.
//   Instead:
//     Owner opens /owner/projects
//       → owner route fetches GitHub
//       → syncGithubRepos() writes latest GitHub data into DB
//       → public site reads projects from DB
//
// WHY THIS IS BETTER:
//   - Public pages render faster.
//   - GitHub API rate limits do not affect visitors.
//   - Private GitHub token usage stays limited to owner/server flows.
//   - Project cards have one consistent source: the database.
//
// SECURITY RULE:
//   Never return raw secrets from this file.
//   Private env vars may be used to construct safe public URLs,
//   but tokens/passwords must never leave the server.
//
// DATA FLOW:
//   load()
//     → returns links + DB-backed portfolio data
//     → src/routes/(site)/+layout.svelte receives it as `data`
//     → layout syncs stores/context
//     → public components render from stores/context

import { GITHUB_USERNAME, LINKEDIN_USERNAME } from '$env/static/private';
import {
  PUBLIC_SITE_URL,
  PUBLIC_EMAIL,
  PUBLIC_SPOTIFY_PLAYLIST_URL,
} from '$env/static/public';

import { getAllExperience } from '$lib/server/queries/experience.js';
import { getAllTabs, getAllSkillsGrouped } from '$lib/server/queries/skills.js';
import { getAllProjects } from '$lib/server/queries/projects.js';

// ── Cache TTL ─────────────────────────────────────────────────────
// 3600 seconds = 1 hour.
//
// NOTE:
//   This layout is DB-backed. If you want owner edits to appear instantly
//   on the public site after deployment, use no-store or a smaller TTL.
//
// CURRENT TRADEOFF:
//   Cache keeps public pages fast and reduces server/database work.
//   Hard refresh/redeploy can force fresh data when needed.
const CACHE_MAX_AGE = 3600;

// ── load ──────────────────────────────────────────────────────────
// Runs on the server before public pages render.
//
// depends(...):
//   Creates invalidation keys for SvelteKit.
//   Client code can later call invalidate('app:projects') etc.
//   to force this load function to re-run.
export async function load({ setHeaders, depends }) {
  depends('app:projects');
  depends('app:experience');
  depends('app:skills');

  // ── Cache Headers ──────────────────────────────────────────────
  // These headers tell Vercel/CDN/browser how long this public layout
  // response can be cached.
  try {
    setHeaders({
      'Cache-Control': `public, max-age=${CACHE_MAX_AGE}, s-maxage=${CACHE_MAX_AGE}, stale-while-revalidate=${CACHE_MAX_AGE}`,
    });
  } catch {
    // Some adapters/routes may already set headers.
    // If so, we do not crash the page.
  }

  // ── Safe Defaults ───────────────────────────────────────────────
  // If DB loading fails, public pages should still render instead of
  // crashing completely. Components are designed to handle empty arrays.
  let experience = [];
  let skillTabs = [];
  let skills = {};
  let projects = [];

  // ── Database Reads ──────────────────────────────────────────────
  // Fetch all public portfolio data in parallel.
  try {
    [experience, skillTabs, skills, projects] = await Promise.all([
      getAllExperience(),
      getAllTabs(),
      getAllSkillsGrouped(),
      getAllProjects(),
    ]);
  } catch (err) {
    console.error('[site/layout.server] DB fetch failed:', err.message);
  }

  // ── Return Safe Data ────────────────────────────────────────────
  // Everything returned here flows into the public layout.
  // Only safe public values are returned.
  return {
    links: {
      site: PUBLIC_SITE_URL,
      email: PUBLIC_EMAIL,
      github: `https://github.com/${GITHUB_USERNAME}`,
      linkedin: `https://linkedin.com/in/${LINKEDIN_USERNAME}`,
      spotify_playlist: PUBLIC_SPOTIFY_PLAYLIST_URL,
    },

    projects,
    experience,
    skillTabs,
    skills,
  };
}