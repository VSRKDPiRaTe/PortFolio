<!--
  ═══════════════════════════════════════════════════════════════════
  src/lib/components/Hero.svelte — Full-Screen Hero Section
  ═══════════════════════════════════════════════════════════════════
  RESPONSIBILITY:
    - Glitch name animation (SITE_FIRST_NAME / SITE_LAST_NAME)
    - Typewriter role rotator (cycles through SITE_ROLES)
    - Animated stat counters (Years, Projects, Technologies)
    - CTA buttons (View Projects + GitHub)
    - Decorative orbit ring visual

  DATA SOURCES:
    config.js          → SITE_FIRST_NAME, SITE_LAST_NAME, SITE_ROLES,
                         SITE_TAGLINE, SITE_FULL_NAME_INITIALS
    stats.js           → STATS reactive store (live Years / Projects / Technologies)
    getContext('site') → links.github (server-loaded from env vars)

  SVELTE CONCEPTS USED:
    onMount     → runs AFTER component mounts to DOM (browser only)
    onDestroy   → cleanup before component is removed
    use:reveal  → custom action for scroll-reveal animation
    {#each}     → loop over arrays (like .map() in React)
    $props()    → Svelte 5 way to receive component props
    $store      → subscribes to a Svelte store inside a .svelte file
  ═══════════════════════════════════════════════════════════════════
-->

<script>
  // ── Svelte Lifecycle ───────────────────────────────────────────
  // onMount  = runs once after component renders to DOM
  //            Safe to access window/document here (not during SSR)
  //            React equivalent: useEffect(() => {}, [])
  //
  // onDestroy = runs before component is removed from DOM
  //             Use to cancel timers, disconnect observers etc.
  //             React equivalent: return () => cleanup() in useEffect
  import { onMount, onDestroy, getContext } from "svelte";

  // ── Custom Action ─────────────────────────────────────────────
  // Imported once, used on any element via use:reveal
  // No props, no refs — just attach and forget
  import { reveal } from "$lib/actions/reveal.js";

  // ── Config ────────────────────────────────────────────────────
  // Static content from config.js — safe to import anywhere
  import {
    SITE_FIRST_NAME,
    SITE_LAST_NAME,
    SITE_ROLES,
    SITE_TAGLINE,
    SITE_FULL_NAME_INITIALS,
  } from "$lib/config.js";

  // ── Reactive Stats Store ──────────────────────────────────────
  // STATS is now a derived store exported from stats.js.
  //
  // Why a store instead of computeStats()?
  //   The Hero counters depend on data that arrives through stores:
  //     skillsData
  //     experienceData
  //     mergedProjectsStore
  //
  //   A plain function call can run too early during SSR / refresh and
  //   capture empty initial values. A store keeps the full dependency
  //   chain reactive, so Hero always sees the latest values.
  //
  // In a .svelte file, `$STATS` means:
  //   "subscribe to the store and give me its current value"
  import { STATS } from "$lib/data/stats.js";

  // ── Server Data via Context ───────────────────────────────────
  // getContext('site') reads what +layout.svelte set via setContext.
  // This is how server-loaded data (from +layout.server.js) flows
  // down to components without prop drilling.
  //
  // site.links.github = constructed on server from GITHUB_USERNAME env var
  // Never hardcoded here — update .env files to change it.
  //
  // React equivalent: useContext(SiteContext)
  const site = getContext("site");

  // ═══════════════════════════════════════════════════════════════
  // TYPEWRITER ANIMATION
  // ═══════════════════════════════════════════════════════════════
  // Cycles through SITE_ROLES array, typing and deleting each role.
  //
  // State — plain `let` in Svelte = reactive state (no useState needed)
  // When any of these change, Svelte re-renders the affected DOM nodes.
  let roleIdx = 0; // which role we're currently showing
  let charIdx = 0; // how many characters are visible
  let deleting = false; // are we typing forward or deleting?
  let displayed = $state(""); // the current visible string
  let timer; // setTimeout reference (for cleanup)

  function typewrite() {
    const current = SITE_ROLES[roleIdx];

    if (!deleting) {
      // Typing forward — reveal one more character
      displayed = current.slice(0, ++charIdx);

      if (charIdx === current.length) {
        // Reached end of word — pause 2 seconds before deleting
        deleting = true;
        timer = setTimeout(typewrite, 2000);
        return;
      }
    } else {
      // Deleting — remove one character
      displayed = current.slice(0, --charIdx);

      if (charIdx === 0) {
        // Fully deleted — move to next role and start typing
        deleting = false;
        roleIdx = (roleIdx + 1) % SITE_ROLES.length; // loop back to 0
      }
    }

    // Speed: delete faster (40ms) than type (80ms) — feels more natural
    timer = setTimeout(typewrite, deleting ? 40 : 80);
  }

  // ═══════════════════════════════════════════════════════════════
  // COUNTER ANIMATION
  // ═══════════════════════════════════════════════════════════════
  // Animates stat numbers from 0 up to their target values.
  //
  // counts is an array of numbers, one per stat.
  // Svelte reactivity: when counts[i] changes, the {counts[i]} in
  // the template re-renders automatically. No setState needed.
  //
  // IMPORTANT:
  //   STATS is now a store, so the actual array lives in `$STATS`.
  //   Because `$STATS` can update later, counts must stay in sync with it.
  // Keep counts aligned to the current stat array length.
  // This covers:
  //   - first render
  //   - refresh
  //   - any future stat shape changes
  let counts = $state([]);


  // Track every interval so all animations can be cleaned up safely.
  let counterIntervals = [];

  function clearCounterIntervals() {
    counterIntervals.forEach(clearInterval);
    counterIntervals = [];
  }

  function animateCounts(stats) {
    // Cancel previous counter animations before starting new ones.
    // This prevents stacked intervals if stats update more than once.
    clearCounterIntervals();

    stats.forEach((stat, i) => {
      let current = 0;
      const step = stat.target / 40; // reach target in ~40 steps

      const interval = setInterval(() => {
        current = Math.min(current + step, stat.target);

        // rounds to 1 decimal — handles targets like 3.5 correctly
        // Math.floor would turn 3.5 → 3 and never display the .5
        // Reassign the array so Svelte sees the update immediately
        counts[i] = Math.round(current * 10) / 10;
        counts = [...counts];

        if (current >= stat.target) clearInterval(interval);
      }, 40); // 40ms × 40 steps = ~1.6 seconds total animation

      counterIntervals.push(interval);
    });
  }

  // Re-run counter animation whenever the live stats array becomes available
  // or changes. Guard against empty initial values to avoid animating nothing.
  //
  // Svelte 5 note:
  //   $effect tracks $STATS automatically because it is read inside the effect.
  $effect(() => {
    if (!$STATS.length) return;

    counts = $STATS.map(() => 0);
    animateCounts($STATS);
  });

  // ── Profile Avatar State ──────────────────────────────────────
  let avatarFailed = $state(false);

  // ═══════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ═══════════════════════════════════════════════════════════════
  onMount(() => {
    // 800ms delay before typewriter starts — lets page settle first
    timer = setTimeout(typewrite, 800);
  });

  onDestroy(() => {
    // Always clean up timers — prevents memory leaks if user
    // navigates away before animations complete
    clearTimeout(timer);
    clearCounterIntervals();
  });
</script>

<!-- ── HERO SECTION ─────────────────────────────────────────────── -->
<section
  id="hero"
  class="relative min-h-screen flex items-center pt-28 pb-16 overflow-hidden"
>
  <!-- Cyberpunk grid background — CSS grid lines via background-image -->
  <div class="hero-grid absolute inset-0 pointer-events-none"></div>

  <!-- Horizontal scan beam — animates top to bottom via CSS keyframe -->
  <div
    class="absolute left-0 right-0 h-0.5 pointer-events-none"
    style="background: linear-gradient(90deg, transparent, #00f5ff, transparent); opacity: 0.3; animation: scan-line 4s linear infinite;"
  ></div>

  <div class="container max-w-6xl mx-auto px-8 relative z-10">
    <!-- ── Eyebrow Label ─────────────────────────────────────────
      Small terminal-style label above the name.
      use:reveal with no options = default delay:0, threshold:0.12
    ──────────────────────────────────────────────────────────── -->
    <div
      use:reveal
      class="font-mono text-[0.78rem] tracking-[0.3em] uppercase mb-2 flex items-center gap-4"
      style="color: var(--green); text-shadow: var(--glow-g);"
    >
      <span class="animate-blink">&gt;</span>
      SYSTEM ONLINE
    </div>
    <div
      use:reveal={{ delay: 300 }}
      class="font-mono text-[0.78rem] tracking-[0.3em] uppercase mb-6 flex items-center gap-4"
      style="color: var(--green); text-shadow: var(--glow-g);"
    >
      <span class="animate-blink">&gt;</span>
      PORTFOLIO LOADED
    </div>

    <!-- ── Name + Glitch Effect ──────────────────────────────────
      Two <h1> tags — one per name line (SITE_FIRST_NAME / SITE_LAST_NAME).
      Each has two hidden duplicate layers (.glitch-layer1/2) that
      animate independently to create the CRT glitch illusion.
      aria-hidden="true" on duplicates — screen readers ignore them.
    ──────────────────────────────────────────────────────────── -->
    <div use:reveal={{ delay: 100 }}>
      <h1
        class="glitch-name font-display font-black text-text-hi leading-none mb-2"
        style="font-size: clamp(3.5rem, 10vw, 9rem);"
      >
        {SITE_FIRST_NAME}
        <span class="glitch-layer1" aria-hidden="true">{SITE_FIRST_NAME}</span>
        <span class="glitch-layer2" aria-hidden="true">{SITE_FIRST_NAME}</span>
      </h1>
      <h1
        class="glitch-name font-display font-black text-text-hi leading-none mb-6"
        style="font-size: clamp(3.5rem, 10vw, 9rem);"
      >
        {SITE_LAST_NAME}
        <span class="glitch-layer1" aria-hidden="true">{SITE_LAST_NAME}</span>
        <span class="glitch-layer2" aria-hidden="true">{SITE_LAST_NAME}</span>
      </h1>
    </div>

    <!-- ── Typewriter Role ───────────────────────────────────────
      `displayed` is the reactive string that updates character by character.
      The cursor blinks via animate-blink Tailwind class.
      min-h-[2em] prevents layout shift as text changes length.
    ──────────────────────────────────────────────────────────── -->
    <div
      use:reveal={{ delay: 200 }}
      class="font-display mb-6 flex items-center gap-2 min-h-[2em]"
      style="font-size: clamp(1rem, 2.5vw, 1.6rem); color: var(--cyan); text-shadow: var(--glow-c);"
    >
      {displayed}<span class="typewriter-cursor animate-blink"></span>
    </div>

    <!-- ── Tagline ───────────────────────────────────────────────
      From config.js SITE_TAGLINE — update there, reflects here.
    ──────────────────────────────────────────────────────────── -->
    <p
      use:reveal={{ delay: 300 }}
      class="text-text-dim font-body text-lg leading-relaxed max-w-xl mb-10"
      style="font-weight: 300;"
    >
      {SITE_TAGLINE}
    </p>

    <!-- ── CTA Buttons ──────────────────────────────────────────
      btn-cyan and btn-outline are global classes from app.css.
      GitHub URL comes from server context — never hardcoded.
    ──────────────────────────────────────────────────────────── -->
    <div use:reveal={{ delay: 400 }} class="flex gap-4 flex-wrap mb-12">
      <!-- site.links.github comes from +layout.server.js via context -->
      <!-- Fallback to '#' if context not yet available (SSR edge case) -->
      <a
        href={site?.links?.github ?? "#"}
        target="_blank"
        rel="noreferrer"
        class="btn-outline btn-angled"
      >
        <svg viewBox="0 0 24 24" width="14" fill="currentColor">
          <path
            d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"
          />
        </svg>
        GITHUB
      </a>
    </div>

    <!-- ── Stat Counters ─────────────────────────────────────────
      {#each} = Svelte's loop syntax. Equivalent to array.map() in React.
      Second argument `i` is the index.
      `counts[i]` updates reactively as animateCounts() runs.
      `stat.suffix` comes from STATS in config.js — usually '+'
      `stat.color` = CSS class like 'neon-c', 'neon-m', 'neon-g'
    ──────────────────────────────────────────────────────────── -->
    <div use:reveal={{ delay: 500 }} class="flex gap-12 flex-wrap">
      {#each $STATS as stat, i}
        <div>
          <div
            class="font-display font-black text-4xl leading-none {stat.color}"
          >
            {counts[i]}{stat.suffix}
          </div>
          <div
            class="font-mono text-[0.65rem] tracking-widest uppercase text-text-dim mt-1"
          >
            {stat.label}
          </div>
        </div>
      {/each}
    </div>
  </div>

  <!-- ── Decorative Orbit Ring ─────────────────────────────────
    Hidden on mobile (hidden lg:block) — too large for small screens.
    Three concentric rings with different animation speeds/directions.
    Two orbital dots that follow the ring paths.
    Center avatar circle with initials.
  ──────────────────────────────────────────────────────────── -->
  <div
    class="orbit-ring hidden lg:block absolute right-[6%] top-1/2 -translate-y-1/2 pointer-events-none"
    style="width: clamp(280px, 34vw, 460px); aspect-ratio: 1;"
  >
    <!-- Outer ring — clockwise slow spin -->
    <div
      class="absolute inset-0 rounded-full animate-spin-slow border border-cyan/10"
    ></div>

    <!-- Middle ring — counter-clockwise, dashed -->
    <div
      class="absolute inset-[10%] rounded-full border border-dashed border-magenta/12"
      style="animation: spin-ccw 15s linear infinite;"
    ></div>

    <!-- Inner ring — static -->
    <div
      class="absolute inset-[22%] rounded-full border border-ngreen/10"
    ></div>

    <!-- Orbital dot on outer ring -->
    <div
      class="absolute top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-cyan"
      style="box-shadow: var(--glow-c);"
    ></div>

    <!-- Orbital dot on top -->
    <div
      class="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-magenta"
      style="box-shadow: var(--glow-m);"
    ></div>

    <!-- Avatar circle — floats up and down via animate-float.
        Uses src/lib/assets/about-profile.jpg and blends it into the
        cyberpunk theme with scanlines, neon glow, and cyan/magenta tint. -->
    <div class="avatar absolute inset-[18%] rounded-full animate-float">
      {#if !avatarFailed}
        <img
          src="/about-profile.jpg"
          alt={SITE_FULL_NAME_INITIALS}
          class="avatar-img"
          onerror={() => (avatarFailed = true)}
        />

        <div class="avatar-tint"></div>
        <div class="avatar-scan"></div>
      {:else}
        <span class="avatar-initials">{SITE_FULL_NAME_INITIALS}</span>
      {/if}
    </div>
  </div>
</section>

<!-- ── Scoped Styles ───────────────────────────────────────────────
  <style> in Svelte is automatically scoped to this component.
  Class names here (like .glitch-name) won't leak to other components.
  Svelte adds a unique hash to selectors at build time.
──────────────────────────────────────────────────────────────────── -->
<style>
  /* Cyberpunk grid lines — CSS background-image pattern.
     mask-image fades the grid out toward edges for a natural look. */
  .hero-grid {
    background-image: linear-gradient(
        rgba(0, 245, 255, 0.04) 1px,
        transparent 1px
      ),
      linear-gradient(90deg, rgba(0, 245, 255, 0.04) 1px, transparent 1px);
    background-size: 60px 60px;
    mask-image: radial-gradient(
      ellipse 80% 80% at 50% 50%,
      black 40%,
      transparent 100%
    );
  }

  /* Glitch name wrapper — needs position:relative for absolute layers */
  .glitch-name {
    position: relative;
  }

  /* Hidden duplicate layers for glitch effect.
     position:absolute overlaps exactly on the real text.
     opacity:0 by default — animations briefly set it to ~0.8 */
  .glitch-layer1,
  .glitch-layer2 {
    position: absolute;
    inset: 0;
    opacity: 0;
  }

  /* Layer 1 — cyan tint, uses glitch keyframe from app.css */
  .glitch-layer1 {
    color: var(--cyan);
    animation: glitch 5s infinite;
  }

  /* Layer 2 — magenta tint, offset by 0.3s for depth effect */
  .glitch-layer2 {
    color: var(--magenta);
    animation: glitch2 5s 0.3s infinite;
  }

  /* Typewriter cursor — blinking vertical bar after the displayed text */
  .typewriter-cursor {
    display: inline-block;
    width: 3px;
    height: 1.1em;
    background: var(--cyan);
    vertical-align: text-bottom;
    box-shadow: var(--glow-c);
    /* animate-blink class handles the blinking via Tailwind @theme */
  }

  /* Avatar image frame — replaces initials with themed profile image */
.avatar {
  overflow: hidden;
  background: var(--bg3, #0b1428);
  border: 2px solid rgba(0, 245, 255, 0.28);
  box-shadow:
    0 0 18px rgba(0, 245, 255, 0.28),
    0 0 42px rgba(255, 0, 200, 0.12);
  transform: scale(1);
  display: flex;
  align-items: center;
  justify-content: center;
}

  /* Actual image */
  .avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;

    image-rendering: pixelated;
    image-rendering: crisp-edges;

    filter: contrast(1.25) brightness(0.85) saturate(1.35);
  }

  /* Cyan/magenta colour blend layer */
  .avatar-tint {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: radial-gradient(
        circle at 25% 25%,
        rgba(0, 245, 255, 0.22),
        transparent 55%
      ),
      radial-gradient(
        circle at 75% 75%,
        rgba(255, 0, 200, 0.2),
        transparent 55%
      );
    mix-blend-mode: screen;
  }

  /* CRT scanline overlay */
  .avatar-scan {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: repeating-linear-gradient(
      to bottom,
      transparent 0px,
      transparent 3px,
      rgba(0, 0, 0, 0.22) 3px,
      rgba(0, 0, 0, 0.22) 4px
    );
    opacity: 0.35;
  }

  .avatar-initials {
    font-family: "Orbitron", monospace;
    font-size: 2rem;
    font-weight: 900;
    color: var(--cyan);
    text-shadow: var(--glow-c);
  }
</style>
