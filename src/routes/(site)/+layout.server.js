// ╔═══════════════════════════════════════════════════════════════════╗
// ║  src/routes/+layout.server.js — Root Server Layout Loader        ║
// ╚═══════════════════════════════════════════════════════════════════╝
//
// WHAT THIS FILE IS:
//   The "backend gateway" of the portfolio.
//   Runs on the SERVER before any page renders — never reaches the browser.
//   Has full access to private env vars (tokens, usernames).
//   Fetches external data (GitHub API) and returns clean, safe values.
//   Whatever load() returns flows down to ALL pages and components.
//
// WHY IT EXISTS:
//   SvelteKit separates server code from browser code at the file level.
//   +layout.server.js = server only.
//   +layout.svelte    = runs on both server (SSR) and browser.
//   Components (.svelte) = browser primarily, hydrated from SSR.
//
//   This separation means secrets (GITHUB_TOKEN) never reach the browser
//   bundle, even accidentally. SvelteKit enforces this at build time.
//
// DATA FLOW FROM THIS FILE:
//   load() returns { links, githubProfile, githubRepos }
//         ↓
//   +layout.svelte receives as `data` prop
//         ↓
//   setContext('site', data) makes it available to all components
//         ↓
//   Any component: const site = getContext('site')
//
// SECURITY RULE:
//   Never return raw secrets from load().
//   GITHUB_TOKEN → used to fetch, never returned.
//   GITHUB_USERNAME → used to construct URLs, only the final URL is returned.
//   Browser only ever sees: "https://github.com/yourusername" — not the username var.
//
// CACHING STRATEGY:
//   Cache-Control headers tell Vercel CDN to cache this response.
//
//   Without caching:
//     Every page visit → hits server → calls GitHub API → waits 200-500ms
//     GitHub rate limit: 5000 req/hour with token (risky if popular portfolio)
//
//   With caching (stale-while-revalidate):
//     First visit     → hits server → fetches GitHub → CDN caches response
//     Next 3600s      → CDN serves instantly, zero API calls, zero wait
//     After 3600s     → CDN serves STALE data instantly + fetches fresh in background
//                        user never waits, data silently updates
//     Rate limit risk → near zero (one fetch per hour max)


import { GITHUB_TOKEN, GITHUB_USERNAME, LINKEDIN_USERNAME } from '$env/static/private';
import { PUBLIC_SITE_URL, PUBLIC_EMAIL, PUBLIC_SPOTIFY_PLAYLIST_URL } from '$env/static/public';
import { getAllExperience } from '$lib/server/queries/experience.js';
import { getAllTabs, getAllSkillsGrouped } from '$lib/server/queries/skills.js';
import { getManualProjects, getCustomisedGithubProjects } from '$lib/server/queries/projects.js';

// ── Cache TTL ─────────────────────────────────────────────────────
// 3600 seconds = 1 hour.
// Portfolio data (repos, profile) doesn't change minute-to-minute.
// Increase to 86400 (24h) if you want even fewer API calls.
const CACHE_MAX_AGE = 3600;

const GITHUB_API_BASE = 'https://api.github.com';

// ── GitHub API Headers ────────────────────────────────────────────
// Centralised so every fetch call uses the same auth token and API version.
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
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

// ── readJsonOrThrow ───────────────────────────────────────────────
// Small helper to keep GitHub error handling clean and readable.
// If GitHub rejects the request, we capture the response body too.
// That makes debugging token/scope/repository-permission issues much easier.
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
      `${label} Error: ${res.status} ${res.statusText}${text ? ` | ${text}` : ''}`
    );
  }

  return json;
}

// ── formatRepoTitle ───────────────────────────────────────────────
// Converts repo-name → Repo Name
// Cleaner for UI cards and project headings.
function formatRepoTitle(name) {
  return name
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

// ── fetchAuthenticatedGitHubUser ──────────────────────────────────
// This is the MOST IMPORTANT call when private repos are involved.
//
// Why this exists:
//   /users/:username         → proves the username exists publicly
//   /user                    → proves WHICH account the token belongs to
//
// If /user.login !== GITHUB_USERNAME, then profile data and repo data
// are coming from different identities, and private repo fetching will
// never behave the way you expect.
async function fetchAuthenticatedGitHubUser(fetch) {
  const res = await fetch(`${GITHUB_API_BASE}/user`, {
    headers: githubHeaders(),
  });

  const raw = await readJsonOrThrow(res, 'GitHub Auth User API');

  return raw;
}

// ── fetchGitHubProfile ────────────────────────────────────────────
// Fetches PUBLIC profile data for the configured GitHub username.
// This is still useful for avatar/name/bio display.
//
// Note:
//   We intentionally keep this as /users/:username because profile display
//   is about the configured portfolio identity.
//
//   Private repo access is handled separately through /user.
async function fetchGitHubProfile(fetch) {
  const res = await fetch(
    `${GITHUB_API_BASE}/users/${GITHUB_USERNAME}`,
    { headers: githubHeaders() }
  );

  const raw = await readJsonOrThrow(res, 'GitHub Profile API');

  return {
    avatar: raw.avatar_url,   // profile picture URL
    bio: raw.bio,             // "About" text from GitHub profile
    followers: raw.followers, // follower count
    following: raw.following, // following count
    repos: raw.public_repos,  // public repo count only (GitHub profile field)
    joined: raw.created_at,   // account creation date (ISO string)
    login: raw.login,
    name: raw.name,
  };
}

// ── fetchGitHubRepos ──────────────────────────────────────────────
// Fetches ALL repos owned by the AUTHENTICATED user — public AND private.
//
// ENDPOINT PARAMS:
//   visibility=all     → public + private
//   affiliation=owner  → only repos YOU own
//   per_page=100       → GitHub max page size
//   sort=pushed        → most recently active repos first
//
// IMPORTANT:
//   This endpoint is auth-driven, not username-driven.
//   So before calling it, we validate that the token owner matches
//   GITHUB_USERNAME. That removes ambiguity completely.
async function fetchGitHubRepos(fetch) {
  const res = await fetch(
    `${GITHUB_API_BASE}/user/repos?visibility=all&affiliation=owner&per_page=100&sort=pushed`,
    { headers: githubHeaders() }
  );

  const raw = await readJsonOrThrow(res, 'GitHub Repos API');

  if (!Array.isArray(raw)) {
    console.error('GitHub repos response is not an array:', raw);
    return [];
  }

  return raw
    .filter((r) => !r.fork) // exclude forks — not user work
    .map((r) => {
      // ── Badge Detection ─────────────────────────────────────────
      // Defaults based on repo flags.
      // Archived → done
      // Private  → wip
      // Public   → live
      const badge = r.archived ? 'done'
                  : r.private  ? 'wip'
                  :              'live';

      // ── Tags = Topics + Primary Language ────────────────────────
      // topics: user-added tags in repo Settings → Topics
      // language: GitHub-detected primary language
      // Merge and deduplicate (case-insensitive comparison).
      const topics  = Array.isArray(r.topics) ? r.topics : [];
      const langTag = r.language ?? null;

      const tags = langTag && !topics.some((t) => t.toLowerCase() === langTag.toLowerCase())
        ? [...topics, langTag]
        : [...topics];

      return {
        // ── Identity ───────────────────────────────────────────────
        github_id: r.id,                 // stable numeric GitHub ID
        slug: r.name,                    // used in /projects/[slug]
        name: r.name,
        title: formatRepoTitle(r.name),
        subtitle: r.name,
        description: r.description ?? '',

        // ── Privacy ────────────────────────────────────────────────
        private: r.private,

        // ── Links ──────────────────────────────────────────────────
        // Public repos: show the GitHub URL.
        // Private repos: hide the GitHub link from visitors unless you later
        // build an authenticated owner-only view for yourself.
        github: r.private ? null : r.html_url,
        demo: r.homepage ?? null,

        // ── Display ────────────────────────────────────────────────
        tags,
        badge,
        group: 'personal',

        // ── Meta ───────────────────────────────────────────────────
        language: r.language ?? null,
        stars: r.stargazers_count ?? 0,
        pushedAt: r.pushed_at ?? null,
        createdAt: r.created_at ?? null,
        archived: r.archived ?? false,

        // source flag — tells projects.js where this data came from
        source: 'github',
      };
    });
}

// ── load ──────────────────────────────────────────────────────────
// SvelteKit's server load function.
// Automatically called before any page renders.
// Whatever this returns becomes the `data` prop in +layout.svelte.
//
// INJECTED PARAMETERS (provided by SvelteKit, not called manually):
//   fetch      → SvelteKit's fetch — use this instead of global fetch
//   setHeaders → sets response headers on the SSR response
//                used here for CDN cache control
export async function load({ fetch, setHeaders, depends }) {

  depends('app:projects');
  depends('app:experience');
  depends('app:skills');

  // ── Cache Headers ──────────────────────────────────────────────
  // These headers tell Vercel's CDN (and the browser) how to cache this page.
  try {
    setHeaders({
      'Cache-Control': `public, max-age=${CACHE_MAX_AGE}, s-maxage=${CACHE_MAX_AGE}, stale-while-revalidate=${CACHE_MAX_AGE}`,
    });
  } catch {
    // Header already set by the Vercel adapter — safe to ignore.
  }

  // ── Fetch GitHub + DB in parallel where safe ───────────────────
  // We fetch authenticated user first because private repo logic depends on it.
  let githubProfile = null;
  let githubRepos = [];
  let experience = [];
  let skillTabs = [];
  let skills = {};
  let customisedRepos = [];
  let manualProjects = [];

  try {
    const authUser = await fetchAuthenticatedGitHubUser(fetch);

    // ── Identity Safety Check ────────────────────────────────────
    // If these differ, the token and configured username do not point to
    // the same account. Public profile may still load, but private repos
    // will not behave as intended for the configured portfolio user.
    if ((authUser?.login ?? '').toLowerCase() !== GITHUB_USERNAME.toLowerCase()) {
      throw new Error(
        `GitHub token user "${authUser?.login}" does not match GITHUB_USERNAME "${GITHUB_USERNAME}".`
      );
    }

    [githubProfile, githubRepos] = await Promise.all([
      fetchGitHubProfile(fetch),
      fetchGitHubRepos(fetch),
    ]);

  } catch (err) {
    // Log to server console for debugging — not visible to users.
    // Components handle null/[] gracefully — site still loads.
    console.error('[layout.server] GitHub API fetch failed:', err.message);
  }

  try {
    [experience, skillTabs, skills, customisedRepos, manualProjects] = await Promise.all([
      getAllExperience(),
      getAllTabs(),
      getAllSkillsGrouped(),
      getCustomisedGithubProjects(), // GitHub repos with manually_updated=1
      getManualProjects(),           // professional entries with no GitHub repo
    ]);
  } catch (err) {
    console.error('[layout.server] DB fetch failed:', err.message);
  }

  // ── Return Safe Data ───────────────────────────────────────────
  // Everything returned here flows to ALL pages via +layout.svelte context.
  // RULE: No raw secrets. Tokens stay here. Only constructed values leave.
  return {
    links: {
      site: PUBLIC_SITE_URL,
      email: PUBLIC_EMAIL,
      github: `https://github.com/${GITHUB_USERNAME}`,
      linkedin: `https://linkedin.com/in/${LINKEDIN_USERNAME}`,
      spotify_playlist: PUBLIC_SPOTIFY_PLAYLIST_URL,
    },
    githubProfile,
    githubRepos,
    customisedRepos, // DB overrides for GitHub repos (manually_updated=1)
    manualProjects,  // professional entries
    experience,
    skillTabs,
    skills,
  };
}