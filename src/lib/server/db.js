// ╔═══════════════════════════════════════════════════════════════════╗
// ║  src/lib/server/db.js — Database Client Singleton                ║
// ╚═══════════════════════════════════════════════════════════════════╝
//
// WHAT THIS FILE IS:
//   The single database connection used by all server-side query files.
//   Imported by every file in src/lib/server/queries/*.js
//
// WHY A SINGLETON:
//   Creating a new client on every request wastes connections and memory.
//   One client instance is created when the server starts and reused
//   for the lifetime of the process.
//
// LOCAL vs PRODUCTION:
//   Local dev:   TURSO_DB_URL=file:local.db  → reads/writes local SQLite file
//   Production:  TURSO_DB_URL=libsql://...   → connects to Turso cloud DB
//   The client API is identical in both cases — zero code changes needed
//   when switching from local to production.
//
// NEVER IMPORT THIS IN:
//   .svelte components, +page.svelte, +layout.svelte
//   Those run in the browser — DB credentials would leak.
//   Only import in: +layout.server.js, +page.server.js, +server.js,
//   and src/lib/server/queries/*.js files.
//
// USAGE:
//   import { db } from '$lib/server/db.js';
//   const rows = await db.execute('SELECT * FROM experience ORDER BY sort_order');

import { createClient } from '@libsql/client';
import { TURSO_DB_URL, TURSO_AUTH_TOKEN } from '$env/static/private';

// createClient returns a client that works with both:
//   file:local.db      → local SQLite file (no auth token needed)
//   libsql://x.turso.io → Turso cloud (auth token required)
export const db = createClient({
  url:       TURSO_DB_URL,
  authToken: TURSO_AUTH_TOKEN ?? '',
  // authToken is empty string for local SQLite — that is correct.
  // Turso cloud requires a real token set in .env.production.
});