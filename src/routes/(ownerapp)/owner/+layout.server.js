// ╔═══════════════════════════════════════════════════════════════════╗
// ║  src/routes/owner/+layout.server.js — Owner Auth Guard          ║
// ╚═══════════════════════════════════════════════════════════════════╝
//
// WHAT THIS FILE IS:
//   Auth guard for every route under /owner/*.
//   Runs on the server before any /owner page renders.
//   In production: checks for a valid session cookie.
//   In development: skips auth entirely — direct access.
//
// HOW SVELTEKIT LAYOUT SERVERS WORK:
//   +layout.server.js in a folder runs before every page in that folder.
//   src/routes/owner/+layout.server.js protects:
//     /owner
//     /owner/experience
//     /owner/skills
//     /owner/projects
//   All in one place — no per-page auth checks needed.
//
// AUTH FLOW (production only):
//   Request arrives → read "owner_session" cookie
//   Cookie missing or invalid → redirect to /owner-login
//   Cookie valid → page renders normally
//
// DEV SHORTCUT:
//   NODE_ENV=development → skip all checks, always allow access.
//   Dev runs on localhost — only the developer can access it.
//   No password friction during local development.

import { redirect } from "@sveltejs/kit";
import { dev } from "$app/environment";
// dev is a SvelteKit boolean — true when running via `vite dev`, false in production build.
// React equivalent: process.env.NODE_ENV === 'development'
import { DEV_FLAGS } from '$lib/config.js';

import {
  SESSION_COOKIE,
  SESSION_TOKEN,
} from "$lib/server/constants.js";

export async function load({ cookies }) {
  // ── Dev Flag: Skip Auth ────────────────────────────────────────
  // In dev, the server only runs on localhost.
  // Only the developer has access — no auth needed.
  // This removes friction when iterating on the owner interface locally.
  // DEV_FLAGS to control direct access to /owner/* pages.
  if (DEV_FLAGS.skipOwnerAuth) return {};

  // ── Production: verify session cookie ───────────────────────────
  // cookies.get() reads the httpOnly cookie set by the login endpoint.
  // httpOnly cookies cannot be read or set by browser JavaScript —
  // only the server can see them, making them resistant to XSS attacks.
  const session = cookies.get(SESSION_COOKIE);

  if (session !== SESSION_TOKEN) {
    // No valid session → redirect to login page.
    // throw redirect() in SvelteKit load() = immediate redirect, no page renders.
    // 303 See Other = correct status for post-auth redirects.
    throw redirect(303, "/owner-login");
  }

  // Valid session → allow page to render.
  // Return empty object — this layout has no data to pass down.
  return {};
}
