// ╔═══════════════════════════════════════════════════════════════════╗
// ║  src/lib/config.js — Client-Safe Static Configuration            ║
// ╚═══════════════════════════════════════════════════════════════════╝
//
// WHAT THIS FILE IS:
//   The central registry for all static, browser-safe configuration.
//   Imported directly by any .svelte component or plain JS module
//   that needs identity, SEO, roles, dev flags, or availability status.
//
// WHAT BELONGS HERE:
//   Static identity  → name, roles, tagline, location
//   SEO metadata     → page title, og:title, og:desc, twitter card
//   Dev flags        → boot speed, boot visibility (env-driven)
//   Status config    → availability status display (pulse, color, label)
//
// WHAT DOES NOT BELONG HERE:
//   URLs and links   → constructed server-side in +layout.server.js
//                       (they depend on private env vars like GITHUB_USERNAME)
//   Hero stats       → live-computed in stats.js (depend on GitHub API data)
//   Project data     → in projects.js (depends on githubRepos store)
//   Private env vars → NEVER import $env/static/private here
//                       This file runs in the browser — secrets would leak
//
// BROWSER-SAFE RULE:
//   This file can ONLY import from $env/static/public.
//   PUBLIC_ prefix = safe for browser, not a secret.
//   SvelteKit enforces this — importing private vars here throws a build error.
//
// DATA FLOW POSITION:
//   +layout.server.js  → fetches GitHub data (server only)
//   +layout.svelte     → distributes server data via context
//   config.js          → static constants, read directly by components
//   stats.js           → live counters, derived from data + store
//   projects.js        → merged project list, reads githubRepos store
//   Components         → import from config.js OR read from context
//
// USED IN:
//   +page.svelte       → SEO meta tags (<svelte:head>)
//   Hero.svelte        → SITE_FIRST_NAME, SITE_LAST_NAME, SITE_ROLES, SITE_TAGLINE
//   Navbar.svelte      → SITE_OWNER, SITE_NAME, STATUS_CURRENT
//   About.svelte       → SITE_FULL_NAME, SITE_ROLE_PRIMARY, LOCATION, SITE_TAGLINE, STATUS_CURRENT
//   Footer.svelte      → SITE_FULL_NAME, SITE_NAME
//   BootScreen.svelte  → DEV_FLAGS (boot speed + visibility)
//   CRTWrapper.svelte  → DEV_FLAGS (boot visibility)

import { dev } from "$app/environment";
import {
  PUBLIC_SITE_URL,
  PUBLIC_DEV_STRICT,
  PUBLIC_AVAILABILITY_STATUS,
} from "$env/static/public";
// $env/static/public is a SvelteKit virtual module — not a real file.
// It reads PUBLIC_* variables from .env files at BUILD TIME.
// "static" means values are inlined into the bundle — no runtime lookup.
// Changing a PUBLIC_ variable requires restarting the dev server to take effect.
// If a listed variable is missing from .env, SvelteKit throws a build error.

// ── Identity ──────────────────────────────────────────────────────
// Core branding constants used across multiple components.
// SITE_FULL_NAME is derived so updating first or last name
// automatically propagates to every place that uses SITE_FULL_NAME.
export const SITE_OWNER = "VIKRAM"; // short owner name, used in Navbar logo
export const SITE_FULL_NAME_INITIALS = "V.K"; // initials, shown in Hero orbit avatar
export const SITE_NAME = "VIKRAM.DEV"; // brand name, used in browser tab + logo
export const SITE_FIRST_NAME = "Vikram";
export const SITE_LAST_NAME = "Karra";
export const SITE_FULL_NAME = `${SITE_FIRST_NAME} ${SITE_LAST_NAME}`;

// ── Roles ─────────────────────────────────────────────────────────
// SITE_ROLES: the typewriter animation in Hero cycles through this array.
//   Each role types in, pauses, deletes, then the next one starts.
//   Order matters — the first role is shown immediately on page load.
//   Add, remove, or reorder roles here to change the Hero animation.
//
// SITE_ROLE_PRIMARY: a single string used where only one role fits.
//   Used in: og:title, Footer, About section heading.
//   Keep under 60 characters for clean display in Google search results.
export const SITE_ROLES = [
  "Software Engineer",
  "Full Stack Developer",
  "Frontend Architect",
  "Data Engineer",
  "UI/UX Enthusiast",
  "Open Source Developer",
  "Systems Thinker",
];
export const SITE_ROLE_PRIMARY = `${SITE_ROLES[0]} & ${SITE_ROLES[1]}`;

// ── Content ───────────────────────────────────────────────────────
// SITE_TAGLINE: the short pitch shown in the Hero section below the typewriter.
//   Also used as og:description — visible in LinkedIn and Twitter share previews.
//   Aim for 1-2 sentences that communicate what makes the work distinctive.
//
// SITE_DESCRIPTION: used for the HTML meta description tag.
//   Appears in Google search result snippets.
//   Keep under 160 characters — Google truncates longer descriptions.
export const SITE_TAGLINE =
  "Engineering bold digital experiences from the intersection of elegant code and obsessive design. I build systems that feel as good as they perform.";

export const SITE_DESCRIPTION = `${SITE_FULL_NAME} Portfolio. Building bold systems and digital experiences from Auckland, NZ.`;

// ── Location ──────────────────────────────────────────────────────
// Shown in the About section terminal window and bio paragraph.
export const LOCATION = "Auckland, New Zealand";

// ── SEO / Open Graph ──────────────────────────────────────────────
// Controls how the portfolio appears when shared or searched.
//
// WHERE EACH FIELD IS USED:
//   title        → <title> tag: browser tab text + Google search headline
//   description  → <meta name="description">: Google search snippet
//   ogTitle      → og:title: LinkedIn, Facebook, Discord share card title
//   ogDesc       → og:description: share card description
//   ogUrl        → og:url: canonical URL — tells search engines the real domain
//                   prevents duplicate content issues if the site is accessible
//                   from multiple URLs
//   twitterCard  → twitter:card: controls Twitter/X share card layout
//                   'summary'             = small square thumbnail + text
//                   'summary_large_image' = full-width banner image + text
//                   Use summary_large_image with a static/og-image.png for
//                   a professional-looking share card on all platforms
//
// og: tags work on LinkedIn, Facebook, Discord, Slack, and iMessage previews.
// twitter: tags are specific to Twitter/X (though Twitter also reads og: as fallback).
export const SEO = {
  title: `${SITE_NAME}`,
  description: SITE_DESCRIPTION,
  ogTitle: `${SITE_FULL_NAME} — ${SITE_ROLE_PRIMARY}`,
  ogDesc: SITE_TAGLINE,
  ogUrl: PUBLIC_SITE_URL,
  twitterCard: "summary_large_image",
};

// ── Dev Mode ──────────────────────────────────────────────────────
// Environment-driven flag for controlling development behaviour.
// Defined here so components never hardcode dev behaviour — they read
// from DEV_FLAGS and the flag is toggled via .env.development only.
//
// dev (Node environment)            → true when running `vite dev`, false in production build
// strict (.env.development boolean) → opt-in to simulate production behaviour in dev
//                                     set PUBLIC_DEV_STRICT=true in .env.development to test
//                                     prod behaviour without deploying
//
// HOW TO USE:
//   1. Edit .env.development PUBLIC_DEV_STRICT value (true or false) for Production-like behaviour in dev, or not.
//   2. Restart the dev server: make dev
//   3. The flag takes effect
//
// MASTER RULE:
//   dev && !strict = full dev mode (all shortcuts active)
//   dev &&  strict = simulates production (all shortcuts disabled)
//   !dev           = production (strict always true, flag ignored)

// The full behaviour matrix:
// Environment         isDev   bootSlow  bootAlways  skipOwnerAuth
// ─────────────────────────────────────────────────────────────────
// make dev            true    true      true        true
// make dev + STRICT   false   false     false       false
// make build          false   false     false       false
// production          false   false     false       false
const strict = PUBLIC_DEV_STRICT === "true";
const isDev = dev && !strict;

// ── Dev Feature Flags ─────────────────────────────────────────────
// All flags derive from isDev — no individual env vars needed.
// In dev mode: boot is slow + always visible so you can observe it.
// In prod or strict mode: both flags off — cinematic speed, once per session.
//
// To temporarily disable a single flag without going full strict:
//   just comment out the relevant $effect or session check directly.
//   These flags are intentionally coarse — they cover the common case.
export const DEV_FLAGS = {
  bootSlow: isDev, // dev → 1 line/sec,  prod/strict → full speed
  bootAlways: isDev, // dev → every load,  prod/strict → once per session
  skipOwnerAuth: isDev, // dev → no password, prod/strict → full auth flow
};

// ── Availability Status ───────────────────────────────────────────
// Controls the availability badge shown in the Navbar and About section.
// Driven by a single PUBLIC_AVAILABILITY_STATUS env variable so the
// status can be updated, just change the env var
// and run make sync-env to push to Vercel.
//
// VALID VALUES FOR PUBLIC_AVAILABILITY_STATUS:
//   open          → actively looking for full-time roles
//   contract      → open to contract or freelance work only
//   opportunities → open to selective or interesting opportunities
//   closed        → not currently available for new work
//
// HOW TO UPDATE STATUS:
//   1. Edit PUBLIC_AVAILABILITY_STATUS in .env.production
//   2. Run: make sync-env  (pushes env vars to Vercel, triggers rebuild)
//   3. Status updates on live site — no code commit required
//
// DISPLAY FIELDS PER STATUS:
//   key    → the status identifier (matches the env var value)
//   label  → text shown in the badge (Navbar + About terminal)
//   color  → CSS utility class for the neon colour (defined in app.css)
//   pulse  → true = animated blinking dot, false = static dot
//             open/contract/opportunities pulse to draw attention
//             closed does not pulse — static indicates unavailability
//   glow   → CSS box-shadow value for the neon dot glow effect
const STATUS_MAP = {
  open: {
    key: "open",
    label: "Open To Work",
    color: "neon-g",
    pulse: true,
    glow: "0 0 2px #22ffaa, 0 0 6px #22ffaa, 0 0 12px #22ffaa, 0 0 18px rgba(34,255,170,0.9)",
  },
  contract: {
    key: "contract",
    label: "Open To Contracts",
    color: "neon-c",
    pulse: true,
    glow: "0 0 2px #00ffff, 0 0 6px #00ffff, 0 0 12px #00ffff, 0 0 18px rgba(0,255,255,0.9)",
  },
  opportunities: {
    key: "opportunities",
    label: "Open To Opportunities",
    color: "text-yellow-400",
    pulse: true,
    glow: "0 0 2px #facc15, 0 0 6px #facc15, 0 0 12px #facc15, 0 0 18px rgba(250,204,21,0.9)",
  },
  closed: {
    key: "closed",
    label: "Not Available",
    color: "neon-m",
    pulse: false,
    glow: "0 0 2px #ff0078, 0 0 6px #ff0078, 0 0 10px rgba(255,0,120,0.8)",
  },
};

// Normalise the raw env value — trim whitespace, convert to lowercase.
// This makes the comparison forgiving: "Open" and "open" both work.
const rawStatus = (PUBLIC_AVAILABILITY_STATUS || "").trim().toLowerCase();

// If the env value is missing or does not match any known status key,
// fall back to 'closed' — safer to show "Not Available" than a broken badge.
const resolvedStatus = STATUS_MAP[rawStatus] ? rawStatus : "closed";

// STATUS_CURRENT is the resolved status object ready for component use.
// Components import this one export and access all display fields:
//   STATUS_CURRENT.label  → badge text
//   STATUS_CURRENT.color  → CSS colour class
//   STATUS_CURRENT.pulse  → whether the dot animates
//   STATUS_CURRENT.glow   → CSS box-shadow for the neon dot
export const STATUS_CURRENT = STATUS_MAP[resolvedStatus];

// AVAILABILITY_STATUS exports the raw resolved key string.
// Useful when a component needs to branch on the status value:
//   if (AVAILABILITY_STATUS === 'closed') { ... }
export const AVAILABILITY_STATUS = resolvedStatus;
