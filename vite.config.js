// ═══════════════════════════════════════════════════════════════════
// vite.config.js — Vite Build Tool Configuration
//
// WHAT IS VITE?
// Vite is the engine powering your dev server and production builds.
// It sits between your source code and the browser:
//
//   Your .svelte files → Vite processes → browser-ready JS/CSS/HTML
//
// In dev mode:    serves files instantly via native ES modules (fast)
// In production:  bundles, minifies, tree-shakes, optimises everything
//
// You rarely touch this file. SvelteKit and Tailwind configure
// themselves via their plugins. Only add config here when you need
// custom build behaviour (ports, proxies, aliases etc.)
// ═══════════════════════════════════════════════════════════════════

// ── Imports ───────────────────────────────────────────────────────
// tailwindcss  → Tailwind v4 Vite plugin. Replaces the old PostCSS
//                setup from Tailwind v3. Scans your .svelte files for
//                class names and generates ONLY the CSS you actually
//                use. Zero unused styles shipped to production.
//
// sveltekit    → The SvelteKit Vite plugin. Wires up everything:
//                  - File-based routing (src/routes/)
//                  - SSR (server-side rendering)
//                  - $lib alias → src/lib/
//                  - +page, +layout, +server file conventions
//                  - Hot module replacement in dev mode
//
// defineConfig → A Vite helper that gives you autocomplete on the
//                config object in VS Code. Functionally identical to
//                exporting a plain object — just a typed wrapper.
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// ── Config Export ─────────────────────────────────────────────────
// Vite reads this default export on startup.
//
// Plugin order matters:
//   tailwindcss() runs first → processes your CSS
//   sveltekit()   runs second → compiles components, handles SSR
export default defineConfig({
  plugins: [
    // Processes app.css @import "tailwindcss" and generates all
    // utility classes used across your .svelte files.
    tailwindcss(),

    // Compiles .svelte files, handles routing, SSR, and all
    // SvelteKit conventions. The core of your entire app.
    sveltekit()
  ],

  // ── Server Options (dev mode only) ──────────────────────────────
  // Uncomment to customise the dev server:
  // server: {
  //   port: 5173,    // default port — change if already in use
  //   host: true,    // expose to local network for mobile testing
  // },

  // ── Build Options (production only) ─────────────────────────────
  // Uncomment to customise the production build:
  // build: {
  //   sourcemap: true,   // include sourcemaps for debugging prod builds
  // },
});