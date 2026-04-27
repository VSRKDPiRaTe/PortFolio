// ╔═══════════════════════════════════════════════════════════════════╗
// ║  src/routes/api/owner/auth/+server.js — Logout Endpoint         ║
// ╚═══════════════════════════════════════════════════════════════════╝
//
// Handles logout — clears the session cookie.
// Called by the owner layout when the owner clicks "Logout".
//
// POST /api/owner/auth → clears cookie → redirects to /owner-login

import { redirect } from '@sveltejs/kit';

import { SESSION_COOKIE } from '$lib/server/constants.js';

export async function POST({ cookies }) {
  // Delete the session cookie by setting maxAge to 0.
  // path must match what was set on login — /owner.
  cookies.delete(SESSION_COOKIE, { path: '/owner' });

  // Redirect to login page after logout.
  throw redirect(303, '/owner-login');
}