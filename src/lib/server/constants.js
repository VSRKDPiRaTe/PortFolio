// ╔═══════════════════════════════════════════════════════════════════╗
// ║  src/lib/server/constants.js — Server-Side Constants             ║
// ╚═══════════════════════════════════════════════════════════════════╝
//
// Shared constants used across owner interface server files.
// Centralised here so changing a value updates everywhere at once.
// Server-only — never import this in .svelte components.

// ── Auth ──────────────────────────────────────────────────────────
// Cookie name written on login, read on every /owner/* request,
// deleted on logout. Must match across all three auth files.
export const SESSION_COOKIE = 'owner_session';

// Value stored inside the cookie. Simple shared secret —
// not user-facing, never shown in UI.
export const SESSION_TOKEN  = 'owner_authenticated';

// How long the session cookie lasts in seconds.
// 7 days — owner does not need to re-login frequently.
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;