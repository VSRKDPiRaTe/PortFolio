<!--
  ╔═══════════════════════════════════════════════════════════════════╗
  ║  src/routes/+layout.svelte — Root Layout                         ║
  ╚═══════════════════════════════════════════════════════════════════╝

  WHAT THIS FILE IS:
    The root layout — wraps every single page in the application.
    Any component or style placed here appears on ALL routes:
      /            → homepage
      /projects    → all projects page
      /projects/[slug] → project detail page

    Think of it as the outermost shell of the application.

  WHAT IT DOES:
    1. Imports app.css — applies global styles to the entire site
    2. Receives server data from +layout.server.js via $props()
    3. Pushes GitHub + DB data into Svelte stores (for plain JS modules to read)
    4. Exposes common server data via setContext so any component can access it
    5. Renders child pages via {@render children()}

  RELATIONSHIP WITH +layout.server.js:
    +layout.server.js runs on the server → fetches GitHub data → returns it
    +layout.svelte receives that data as `data` prop → distributes it
    This separation keeps secrets on the server and clean data in the browser.

  WHY CONTEXT INSTEAD OF PROPS:
    Without context, passing data to deeply nested components requires
    threading props through every intermediate component — "prop drilling".
    setContext solves this: data is set once here at the root and any
    component anywhere in the tree can read it with getContext('site').

    React equivalent: a Context.Provider wrapping the entire app.
    Svelte equivalent: setContext here, getContext in any component.

  WHY STORES FOR PROJECT / SKILL / EXPERIENCE DATA:
    projects.js is a plain JavaScript module (not a Svelte component).
    Plain modules cannot use getContext — that only works inside components.
    A Svelte store (writable) is accessible from anywhere — components,
    plain JS modules, and helper files.

    So the data flows:
      server → layout → store → projects.js / stats.js / other helpers

    This allows:
      - projects.js to call get(githubReposStore)
      - stats.js to derive live counts reactively
      - components to stay simple and consume already-prepared data

  IMPORTANT REACTIVITY NOTE:
    We sync stores inside $effect(), not by directly passing the reactive
    `data` object during setup. Doing that can capture only the initial value
    of `data` and trigger Svelte's "state_referenced_locally" warning.

    Reading data.githubRepos / data.skills / etc. inside $effect() ensures:
      - stores populate on first render / refresh
      - stores update again on later client-side navigations
      - Svelte tracks the reactive references correctly
-->

<script>
  // ── Global Styles ─────────────────────────────────────────────────
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
  // Read in:
  //   projects.js → reads via mergedProjectsStore
  //   stats.js    → derived stores react automatically
  //   components  → may subscribe directly if needed
  import {
    githubRepos as githubReposStore,
    experienceData as experienceStore,
    skillTabsData as skillTabsStore,
    skillsData as skillsStore,
    manualProjectsData as manualProjectsStore,
    customisedRepos as customisedReposStore,
  } from "$lib/stores/ui.js";

  // ── Props ─────────────────────────────────────────────────────────
  // Svelte 5: $props() replaces the old export let syntax.
  //
  // children → the current page content (rendered via {@render children()})
  //            This is how SvelteKit passes the active page into the layout.
  //            React equivalent: {children} prop in a wrapper component.
  //
  // data     → returned by +layout.server.js load() function.
  //            Contains:
  //              { links, githubProfile, githubRepos, customisedRepos,
  //                manualProjects, experience, skillTabs, skills }
  //
  //            Reactive — if server data updates after navigation,
  //            components and effects re-run with the new values.
  let { children, data } = $props();

  // ── Store Sync Helper ─────────────────────────────────────────────
  // Keep all store population in one place so the write logic is
  // consistent and easy to maintain.
  //
  // IMPORTANT:
  //   Accept plain field values instead of the reactive `data` object itself.
  //   Passing `data` directly outside a closure can capture only the initial
  //   value and trigger Svelte's state_referenced_locally warning.
  //
  //   By passing a plain object of values from inside $effect(), Svelte tracks
  //   the reads correctly and re-runs the effect whenever those fields change.
  function syncStores({
    githubRepos,
    experience,
    skillTabs,
    skills,
    manualProjects,
    customisedRepos,
  }) {
    githubReposStore.set(githubRepos ?? []);
    experienceStore.set(experience ?? []);
    skillTabsStore.set(skillTabs ?? []);
    skillsStore.set(skills ?? {});
    manualProjectsStore.set(manualProjects ?? []);
    customisedReposStore.set(customisedRepos ?? []);
  }

  // ── Sync Server Data → Stores ────────────────────────────────────
  // $effect runs once on initial render and again whenever any reactive
  // value used inside changes.
  //
  // That makes this the correct place to push server data into stores:
  //   - hard refresh / first render → stores get populated
  //   - client-side navigation      → stores update with new data
  //
  // This keeps plain JS modules like projects.js working consistently
  // without relying on stale snapshots.
  $effect(() => {
    syncStores({
      githubRepos: data.githubRepos,
      experience: data.experience,
      skillTabs: data.skillTabs,
      skills: data.skills,
      manualProjects: data.manualProjects,
      customisedRepos: data.customisedRepos,
    });
  });

  // ── Live Site Sync Listener ───────────────────────────────────────
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
  let syncSource;

  onMount(() => {
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
      // EventSource automatically retries by itself.
      // No manual reconnect needed here.
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
  //   site.githubProfile   → { avatar, bio, followers, following, repos, joined, login, name }
  //                           null if GitHub API fetch failed
  setContext("site", {
    get links() {
      return data.links;
    },
    get githubProfile() {
      return data.githubProfile;
    },
  });
</script>

<!--
  {@render children()} outputs the current page content here.

  SvelteKit replaces children with the matching +page.svelte for the
  current route. So visiting / renders +page.svelte here.
  Visiting /projects renders routes/projects/+page.svelte here.

  React equivalent: {children} inside a layout wrapper component,
  or Next.js layout.tsx with {children} in the return.
-->
{@render children()}
