<!--
  ╔═══════════════════════════════════════════════════════════════════╗
  ║  src/routes/(site)/+layout.svelte — Public Site Layout           ║
  ╚═══════════════════════════════════════════════════════════════════╝

  WHAT THIS FILE IS:
    The shared layout for the PUBLIC portfolio site.

    It wraps all public routes inside the (site) route group:
      /                  → homepage
      /projects          → all projects page
      /projects/[slug]   → project detail page

    Owner routes are separate under (ownerapp), so owner/admin UI does
    not share this public layout.

  WHAT IT DOES:
    1. Imports app.css — applies global styles to the entire site
    2. Receives server data from (site)/+layout.server.js via $props()
    3. Pushes DB-backed portfolio data into Svelte stores.
    4. Exposes common server data via setContext so any component can access it
    5. Renders the active public page via {@render children()}.

  RELATIONSHIP WITH +layout.server.js:
    +layout.server.js runs on the server.
    It reads database data and safe environment values.
    +layout.svelte receives that data as `data` prop
    It then distributes it to stores/context for components.
    This separation keeps secrets on the server and clean data in the browser.

  CURRENT DATA ARCHITECTURE:
    Database is the public site's source of truth.

    GitHub sync happens from the owner interface:

      /owner/projects
        → fetch GitHub repos
        → sync repos into DB
        → public site reads projects from DB

  WHY CONTEXT INSTEAD OF PROPS:
    Without context, passing data to deeply nested components requires
    threading props through every intermediate component — "prop drilling".
    setContext solves this: data is set once here at the root and any
    component anywhere in the tree can read it with getContext('site').

    React equivalent: a Context.Provider wrapping the entire app.
    Svelte equivalent: setContext here, getContext in any component.

  WHY STORES:
    Some data helpers, like projects.js and stats.js, are plain JavaScript
    modules. Plain JS modules cannot use Svelte context. They also cannot receive props.
    A Svelte store (writable) is accessible from anywhere — components,
    plain JS modules, and helper files.

    So Stores solve that:
      server → layout data → stores → data helpers/components

    This allows:
      - projects.js to call get(githubReposStore)
      - stats.js to derive live counts reactively
      - components to stay simple and consume already-prepared data

  IMPORTANT REACTIVITY NOTE:
    Sync stores inside $effect(), not by directly passing the reactive
    `data` object during setup. Doing that can capture only the initial value
    of `data` and trigger Svelte's "state_referenced_locally" warning.

    Reading data.projects / data.skills / etc. inside $effect() means
    Svelte tracks those reactive reads properly.

    it ensures:
      - stores populate on first render / refresh
      - stores update again on later client-side navigations
      - Svelte tracks the reactive references correctly

    Avoid taking one-time snapshots like:
      const projects = data.projects

    That can capture only the initial value and trigger stale data issues.
-->

<script>
  import { dev } from "$app/environment";
  // ── Global Styles ─────────────────────────────────────────────────
  // Imported once at the public layout level.
  // Applies global Tailwind/theme/base styles to the public site.
  // app.css is imported here — the root layout — so it applies to
  // every page automatically. Contains:
  //   @import Tailwind v4
  //   @theme CSS variables (colors, fonts, animations)
  //   Global component classes (btn-cyan, tag-pill, section-label etc.)
  //   Custom keyframe animations (glitch, blink, float, pulse-border)
  import "../../app.css";

  // ── Svelte APIs ───────────────────────────────────────────────────
  // setContext — stores a value in Svelte's component context tree.
  //   Components anywhere below this layout can read it with getContext.
  //   Only accessible inside Svelte components (not plain JS modules).
  import { setContext, onMount, onDestroy } from "svelte";

  // ── SvelteKit Navigation ───────────────────────────────────────────
  // invalidate(...) re-runs load functions that declared a matching
  // depends(...) key, such as:
  //   depends('app:projects')
  //   depends('app:experience')
  //   depends('app:skills')
  //
  // This is how live sync events refresh the public site without a full
  // browser reload.
  import { invalidate } from "$app/navigation";

  // ── Stores ────────────────────────────────────────────────────────
  // These stores are populated from server data here in the root layout
  // and then consumed elsewhere in the app.
  //
  // These stores are populated from DB-backed server data.
  //
  // Used by:
  //   projects.js → reads via mergedProjectsStore
  //   stats.js    → derived stores react automatically
  //   components  → may subscribe directly if needed
  import {
    experienceData as experienceStore,
    skillTabsData as skillTabsStore,
    skillsData as skillsStore,
    projectsData as projectsStore,
  } from "$lib/stores/ui.js";

  // ── Props ─────────────────────────────────────────────────────────
  // Svelte 5: $props() replaces the old export let syntax.
  //
  // children → the current page content (rendered via {@render children()})
  //            This is how SvelteKit passes the active page into the layout.
  //            React equivalent: {children} prop in a wrapper component.
  //
  // data     → returned by (site)/+layout.server.js. load() function.
  //            Contains:
  //              { links, experience, skillTabs, skills }
  //
  //            Reactive — if server data updates after navigation,
  //            components and effects re-run with the new values.
  let { children, data } = $props();

  // ── Store Sync Helper ───────────────────────────────────────────
  // Keep all store writes in one function so the data pipeline is easy
  // to understand and maintain.
  //
  // IMPORTANT:
  //   Accept plain field values instead of the reactive `data` object itself.
  //   Passing `data` directly outside a closure can capture only the initial
  //   value and trigger Svelte's state_referenced_locally warning.
  //
  //   By passing a plain object of values from inside $effect(), Svelte tracks
  //   the reads correctly and re-runs the effect whenever those fields change.
  function syncStores({ projects, experience, skillTabs, skills }) {
    projectsStore.set(projects ?? []);
    experienceStore.set(experience ?? []);
    skillTabsStore.set(skillTabs ?? []);
    skillsStore.set(skills ?? {});
  }

  // ── Sync Server Data → Stores ────────────────────────────────────
  // $effect runs once on initial render and again whenever any reactive
  // value used inside changes.
  //
  // This is the place to push server data into stores:
  //   - hard refresh / first render → stores get populated
  //   - client-side navigation      → stores update with new data
  //
  // This keeps plain JS modules like projects.js working consistently
  // without relying on stale snapshots.
  //
  // TLDR: Runs on first render and when SvelteKit updates layout data.
  $effect(() => {
    syncStores({
      projects: data.projects,
      experience: data.experience,
      skillTabs: data.skillTabs,
      skills: data.skills,
    });
  });

  // ── Dev-only Live Site Sync Listener ───────────────────────────────────────
  // Server-Sent Events are enabled only in local development.
  //
  // The owner interface can update portfolio data from another browser,
  // another device, or another tab.
  //
  // Server-Sent Events (SSE) gives the public site a lightweight
  // server → browser notification channel:
  //
  //   Owner action updates DB
  //     → server query calls notifyProjectsChanged()
  //     → /api/sync broadcasts "projects-updated"
  //     → this layout receives the event
  //     → invalidate('app:projects') re-runs matching load functions
  //     → this layout receives fresh data
  //     → syncStores(...) pushes fresh data into Svelte stores
  //
  // WHY THIS LIVES IN THE SITE LAYOUT:
  //   This layout owns the public site's shared data pipeline.
  //   Any public page under (site) benefits from one listener here instead
  //   of every component opening its own EventSource connection.
  //
  // WHY onMount:
  //   EventSource is a browser API. It does not exist during SSR.
  //   onMount guarantees this runs only in the browser.
  //
  // WHY DEV ONLY:
  //   Local dev server is a long-running Node process, so SSE works well.
  //   Vercel serverless functions should not keep long-running streams open.
  //
  // PRODUCTION:
  //   Production reads fresh DB data on normal page loads/redeploys.
  //   No long-running /api/sync stream is opened.
  let syncSource;

  onMount(() => {
    if (!dev) return; // Only enable live sync in development for now, to avoid unnecessary complexity and potential issues in production.
    syncSource = new EventSource("/api/sync");

    syncSource.addEventListener("sync", async (event) => {
      let payload;

      try {
        payload = JSON.parse(event.data);
      } catch {
        return;
      }

      const type = payload?.type;

      if (type === "projects-updated") {
        await invalidate("app:projects");
      }

      if (type === "experience-updated") {
        await invalidate("app:experience");
      }

      if (type === "skills-updated") {
        await invalidate("app:skills");
      }
    });

    syncSource.onerror = () => {
      // EventSource retries automatically in dev.
      // No manual reconnect code needed.
    };
  });

  onDestroy(() => {
    syncSource?.close();
  });

  // ── Site Context ──────────────────────────────────────────────────
  // setContext('site', ...) makes this data available to any component
  // in the tree via: const site = getContext('site')
  //
  // GETTER FUNCTIONS instead of plain values:
  //   setContext('site', { links: data.links })     ← WRONG: stale snapshot
  //   setContext('site', { get links() { ... } })   ← CORRECT: live reference
  //
  //   Without getters: context captures data.links at the time setContext
  //   is called. If data updates (e.g. after navigation), components still
  //   see the old value — a stale snapshot.
  //
  //   With getters: every time a component reads site.links, it calls the
  //   getter which reads the current data value — always fresh.
  //
  // AVAILABLE VIA getContext('site'):
  //   site.links.site      → portfolio URL
  //   site.links.email     → contact email
  //   site.links.github    → GitHub profile URL
  //   site.links.linkedin  → LinkedIn profile URL
  //   site.links.spotify_playlist → Spotify playlist URL (About section)
  setContext("site", {
    get links() {
      return data.links;
    },
  });
</script>

<!--
  Renders the active public page here.
  {@render children()} outputs the current page content here.

  SvelteKit replaces children with the matching +page.svelte for the
  current route. So visiting / renders +page.svelte here.
  Visiting /projects renders routes/projects/+page.svelte here.

  React equivalent: {children} inside a layout wrapper component,
  or Next.js layout.tsx with {children} in the return.

  Example:
    /projects → routes/(site)/projects/+page.svelte
-->
{@render children()}