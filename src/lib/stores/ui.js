// ╔═══════════════════════════════════════════════════════════════════╗
// ║  src/lib/stores/ui.js — Global UI + Public Data State             ║
// ╚═══════════════════════════════════════════════════════════════════╝
//
// WHAT THIS FILE IS:
//   A centralised collection of Svelte stores for global UI state and
//   public portfolio data.
//
//   Any component or plain JavaScript module can import these stores
//   without prop drilling or threading data through intermediate files.
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
//
//   projectsData    → all public projects from DB
//   experienceData  → all experience entries from DB
//   skillTabsData   → skill tab headings from DB
//   skillsData      → skills grouped by tab from DB
//
// CURRENT DATA ARCHITECTURE:
//   Database is the public site's source of truth.
//
//   GitHub API is now an ingestion source only:
//     /owner/projects
//       → fetch GitHub repos
//       → sync into projects table
//       → public site reads projectsData from DB
//

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



// ── Public Data Stores ─────────────────────────────────────────────
// Set by:
//   src/routes/(site)/+layout.svelte
//
// Source:
//   src/routes/(site)/+layout.server.js reads from DB and passes data down.
//
// WHY STORES:
//   Plain JavaScript modules such as projects.js, experience.js, skills.js,
//   and stats.js cannot use Svelte context. Stores let those modules read
//   the latest public data safely.

// ── projectsData ──────────────────────────────────────────────────
// All projects from DB:
//   - GitHub-synced projects
//   - Manual/professional projects
//
// Read by:
//   src/lib/data/projects.js → mergedProjectsStore / getMergedProjects()
export const projectsData = writable([]);

// ── experienceData ────────────────────────────────────────────────
// Experience entries from DB.
//
// Read by:
//   src/lib/data/experience.js → getExperience()
//   src/lib/data/stats.js      → years/experience calculations
export const experienceData = writable([]);

// ── skillTabsData ─────────────────────────────────────────────────
// Skill tabs from DB.
// Shape: [{ id, label, sort_order }]
//
// Read by:
//   src/lib/data/skills.js → getSkillTabs()
export const skillTabsData = writable([]);

// ── skillsData ────────────────────────────────────────────────────
// Skills grouped by tab.
// Shape:
//   {
//     languages: [...],
//     frontend: [...],
//     ...
//   }
//
// Read by:
//   src/lib/data/skills.js → getSkills()
//   src/lib/data/stats.js  → technology count
export const skillsData = writable({});