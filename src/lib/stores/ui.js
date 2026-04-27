// ╔═══════════════════════════════════════════════════════════════════╗
// ║  src/lib/stores/ui.js — Global UI State                          ║
// ╚═══════════════════════════════════════════════════════════════════╝
//
// WHAT THIS FILE IS:
//   A centralised collection of Svelte stores for global UI state.
//   Any component or module in the application can read or write these
//   stores without prop drilling or threading data through intermediaries.
//
// WHAT IS A SVELTE STORE?
//   A store is a reactive container for a value that lives outside components.
//   When a store value changes, every subscriber automatically re-renders.
//
//   React equivalent comparison:
//     React local state:  const [open, setOpen] = useState(false)
//                         Only accessible in that one component.
//     React global state: useContext(), Zustand, Redux
//                         Requires setup, providers, selectors.
//     Svelte store:       writable(false)
//                         Global by default — import and use anywhere.
//
// THREE STORE TYPES (from svelte/store):
//   writable(initial)      → readable and writable from anywhere
//                            store.set(value)    — replace the value
//                            store.update(fn)    — transform the value
//   readable(initial, fn)  → read-only externally, set internally
//                            useful for values only the creator should change
//   derived(stores, fn)    → computed from one or more other stores
//                            auto-updates whenever source stores change
//                            React equivalent: useMemo with store deps
//
// THE $ PREFIX — AUTO-SUBSCRIPTION:
//   Inside a Svelte component, the $ prefix auto-subscribes and auto-cleans up.
//
//   Without $:
//     const unsub = store.subscribe(val => { ... })
//     onDestroy(() => unsub())    ← manual cleanup required
//
//   With $:
//     $storeName                  ← reads current value, auto-subscribes
//     $storeName = newValue       ← writes value, notifies all subscribers
//     Svelte compiler handles subscribe/unsubscribe automatically.
//
//   Outside components (plain .js files):
//     import { get } from 'svelte/store'
//     get(storeName)              ← reads current value synchronously, once
//                                    no subscription, no cleanup needed
//
// STORES IN THIS FILE:
//   mobileNavOpen   → hamburger menu open/closed state
//   activeSection   → which page section is currently in viewport
//   bootComplete    → whether the CRT boot animation has fully finished
//   sequenceDone    → whether BootScreen lines/progress sequence is done
//   bootWasSkipped  → whether boot was skipped (session already booted)
//   githubRepos     → GitHub repos fetched server-side, distributed here

import { writable } from 'svelte/store';

// ── UI stores ─────────────────────────────────────────────────────

// ── mobileNavOpen ─────────────────────────────────────────────────
// Controls the mobile hamburger navigation menu visibility.
//
// Written by: Navbar.svelte on hamburger button click
// Read by:    Navbar.svelte to show/hide the dropdown and animate
//             the hamburger icon (three lines → X shape)
//
// Flow:
//   Hamburger click → mobileNavOpen.update(v => !v) → menu shows/hides
//   Nav link click  → mobileNavOpen.set(false)       → menu closes
//
// Default: false (menu closed on page load)
export const mobileNavOpen = writable(false);


// ── activeSection ─────────────────────────────────────────────────
// Tracks which portfolio section is currently visible in the viewport.
// Used to highlight the corresponding link in the Navbar as the user scrolls.
//
// Written by: IntersectionObserver watching each section element
// Read by:    Navbar.svelte to apply active link styles
//
// Valid values: 'hero' | 'about' | 'experience' | 'projects' | 'skills'
// These match the id= attributes on each section component.
//
// Default: 'hero' (first section visible on initial page load)
export const activeSection = writable('hero');


// ── bootComplete ──────────────────────────────────────────────────
// Marks whether the entire boot sequence AND CRT animations are done.
// This is the FINAL state — portfolio is fully visible and interactive.
//
// Written by: CRTWrapper.svelte after crtReveal animation finishes
// Read by:    CRTWrapper.svelte to unmount the reveal panels
//             (the {#if !$bootComplete} condition on the overlay)
//
// Sequence of events:
//   BootScreen lines play → sequenceDone = true
//   CRTWrapper runs crtExit (boot screen collapses)
//   CRTWrapper runs crtReveal (panels slide apart)
//   bootComplete = true ← this store, set last
//
// Default: false (boot sequence plays on first load)
export const bootComplete = writable(false);


// ── sequenceDone ──────────────────────────────────────────────────
// Marks whether the BootScreen terminal sequence (lines + progress bar)
// has completed. This triggers CRTWrapper to begin the exit animation.
//
// Written by: BootScreen.svelte after last boot line appears + pause
// Read by:    CRTWrapper.svelte — watches this to start crtExit()
//
// Why separate from bootComplete?
//   sequenceDone = "boot lines are done, start the CRT exit"
//   bootComplete = "CRT animations are done, portfolio is visible"
//   Each store has one clear owner with one clear responsibility.
//   CRTWrapper is the bridge between them — it watches sequenceDone
//   and sets bootComplete after its own animations finish.
//
// Default: false
export const sequenceDone = writable(false);


// ── bootWasSkipped ────────────────────────────────────────────────
// Indicates whether the boot sequence was skipped on this page load.
// Skipping happens when sessionStorage shows the session already booted.
//
// Written by: BootScreen.svelte in onMount when session key is found
// Read by:    CRTWrapper.svelte to decide whether to run animations
//             When true: skip crtExit + crtReveal, show portfolio immediately
//             When false: run full CRT transition sequence
//
// sessionStorage behaviour:
//   Tab stays open → same session → boot skipped on refresh
//   Tab closed     → session ends → boot plays again on next open
//   DEV_FLAGS.bootAlways = true → skipping disabled (for development)
//
// Default: false (boot plays on fresh session)
export const bootWasSkipped = writable(false);




// ── Data Stores ───────────────────────────────────────────────────


// Set by +layout.svelte $effect after server data arrives.
// Read by data layer modules via get() — stores bridge the gap
// between server-fetched data and plain JS modules that cannot
// use getContext (context is Svelte-component-only).

// ── githubRepos ───────────────────────────────────────────────────
// Holds the array of GitHub repositories fetched server-side.
// Acts as the bridge between server-loaded data and plain JS modules.
//
// Written by: +layout.svelte via $effect when server data arrives
//             githubReposStore.set(data.githubRepos ?? [])
// Read by:    projects.js → getMergedProjects() via get(githubReposStore)
//             stats.js    → STATS derived store reacts to changes here
//
// Why a store instead of context?
//   getContext() only works inside Svelte component scripts.
//   projects.js and stats.js are plain JavaScript modules.
//   A Svelte store is accessible from anywhere — components AND modules.
//   This store is the only way to pass server-fetched data into plain modules.
//
// Default: [] (empty until +layout.svelte populates it after server fetch)
export const githubRepos = writable([]);

// Experience entries from DB
// Read by: experience.js getExperience()
export const experienceData = writable([]);
 
// Skill tabs from DB — array of { id, label }
// Read by: skills.js getSkillTabs()
export const skillTabsData = writable([]);
 
// Skills grouped by tab from DB — { languages: [...], frontend: [...], ... }
// Read by: skills.js getSkills()
// Read by: stats.js for techCount
export const skillsData = writable({});
 
// Manual projects from DB — professional work + GitHub overrides
// Read by: projects.js getMergedProjects() as manualProjects
export const manualProjectsData = writable([]);

// GitHub repos with manually_updated=1 — these override GitHub data with DB data
// Read by: projects.js getMergedProjects() as customisedRepos
export const customisedRepos    = writable([]);  // DB rows with manually_updated=1