// ═══════════════════════════════════════════════════════════════════
// svelte.config.js — SvelteKit Framework Configuration
//
// This file controls how SvelteKit compiles and deploys your app.
// It has two main concerns:
//   1. ADAPTER  → where/how your app gets deployed
//   2. KIT CONFIG → routing, aliases, CSP headers, and more
//
// This file is read at BUILD TIME (npm run build), not at runtime.
// Changes here require restarting your dev server to take effect.
// ═══════════════════════════════════════════════════════════════════

// ── Adapter Import ────────────────────────────────────────────────
// An adapter transforms your built SvelteKit app into something a
// specific hosting platform can run.
//
// We switched from adapter-auto → adapter-vercel because:
//   adapter-auto  = detects platform at build time (guesswork, slower)
//   adapter-vercel = explicit, optimized specifically for Vercel,
//                    enables edge functions, image optimization, etc.
//
// If you ever switch hosting (Netlify, Cloudflare, self-hosted Node),
// swap this import and update package.json devDependencies to match.
//
// Full list of official adapters:
// → https://svelte.dev/docs/kit/adapters
import adapter from '@sveltejs/adapter-vercel';

// ── Config Type Hint ──────────────────────────────────────────────
// This JSDoc comment gives VS Code full autocomplete and type checking
// on the config object below, even though we're using plain JS.
// It imports the Config type from SvelteKit's type definitions.
/** @type {import('@sveltejs/kit').Config} */
const config = {

  // ── Kit Options ─────────────────────────────────────────────────
  // All SvelteKit-specific settings live under the `kit` key.
  // Svelte compiler options (if needed) go at the top level instead.
  kit: {

    // ── Adapter ───────────────────────────────────────────────────
    // Calling adapter() with no args uses sensible Vercel defaults:
    //   - Serverless functions for SSR routes (+page.server.js)
    //   - Static files served from Vercel's CDN edge network
    //   - Automatic routing from your src/routes/ structure
    //
    // You can pass options if needed later, e.g.:
    //   adapter({ runtime: 'edge' })  → use edge runtime instead of serverless
    //   adapter({ regions: ['syd1'] }) → deploy to Sydney region
    adapter: adapter(),

    // ── Path Aliases ──────────────────────────────────────────────
    // $lib is the only built-in alias SvelteKit provides.
    // It maps to src/lib/ automatically — no config needed here.
    //
    // You can add custom aliases if your project grows:
    // alias: {
    //   $components: 'src/lib/components',
    //   $data: 'src/lib/data',
    // }
    // Then import like: import Hero from '$components/Hero.svelte'

  }
};

// ── Default Export ────────────────────────────────────────────────
// SvelteKit reads this export when it starts up.
// Must be a default export — named exports are ignored here.
export default config;