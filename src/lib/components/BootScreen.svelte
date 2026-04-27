<!--
  ═══════════════════════════════════════════════════════════════════
  src/lib/components/BootScreen.svelte — CRT Boot Sequence
  ═══════════════════════════════════════════════════════════════════
  Full-viewport boot animation before the portfolio reveals.
  Simulates an old CRT terminal booting — cyberpunk aesthetic.

  SEQUENCE (~5 seconds prod / ~12 seconds dev-slow):
    0.0s  → Boot screen appears, cursor blinks
    0.3s  → Lines start appearing one by one
    3.5s  → All lines visible, progress bar fills
    4.5s  → Progress hits 100%, READY state
    5.0s  → CRT power-off exit:
              1. Screen flickers (rapid opacity flashes)
              2. Collapses to horizontal line (scaleY crush)
              3. Phosphor white flash
              4. Fades to nothing

  DEV FLAGS (controlled from .env.development via config.js):
    DEV_FLAGS.bootSlow   → slow timing, 1 line/sec for observation
    DEV_FLAGS.bootAlways → skip sessionStorage, show every page load

  SVELTE 5 CONCEPTS USED:
    $props()    → receives props from parent (replaces export let)
    $state()    → reactive variables (replaces plain let for reactivity)
    bind:this   → DOM element reference (like React useRef)
    {#if}       → conditional rendering
    {#each}     → loop rendering
  ═══════════════════════════════════════════════════════════════════
-->

<script>
  import { onMount } from "svelte";
  import { sequenceDone, bootWasSkipped }       from '$lib/stores/ui.js';
  import { DEV_FLAGS, SITE_FULL_NAME } from "$lib/config.js";

  // ── Session Config ────────────────────────────────────────────
  // DEV_FLAGS come from .env.development via config.js.
  // In production: both flags are always false (vars not set).
  // See config.js DEV_FLAGS section for full documentation.
  const SHOW_EVERY_VISIT = DEV_FLAGS.bootAlways;
  const SESSION_KEY = "portfolio_booted";

  // ── Timing Config ─────────────────────────────────────────────
  // Two timing sets: slow (dev observation) and fast (production).
  // Switched by DEV_FLAGS.bootSlow from .env.development.
  //
  // progressFull = ms to animate 0% → 60% (during line loading)
  // progressEnd  = ms to animate 60% → 95% (after lines complete)
  const TIMING = DEV_FLAGS.bootSlow
    ? { progressFull: 8000, progressEnd: 1500 } // dev: slow & observable
    : { progressFull: 3200, progressEnd: 600 }; // prod: cinematic 5s

  // ── Boot Lines ────────────────────────────────────────────────
  // Each line appears at its `delay` millisecond mark from sequence start.
  // Two sets: slow (dev) and fast (prod) — driven by DEV_FLAGS.bootSlow.
  //
  // status values and their display:
  //   'info'  → [ INFO ]  cyan   — neutral progress updates
  //   'ok'    → [ OK ]    green  — successful step completions
  //   'warn'  → [ WARN ]  yellow — attention-grabbing line (personality)
  //   'ready' → [ READY ] cyan bold — final "we're live" line
  const BOOT_LINES = DEV_FLAGS.bootSlow
    ? [
        { text: "BIOS v2.0.4 initializing...", delay: 800, status: "info" },
        { text: "Memory check: 32768MB OK", delay: 1800, status: "ok" },
        { text: "Loading kernel modules...", delay: 2800, status: "info" },
        { text: "Mounting filesystem...", delay: 3800, status: "ok" },
        {
          text: "Establishing network connection...",
          delay: 4800,
          status: "info",
        },
        { text: "Fetching portfolio data...", delay: 5800, status: "info" },
        { text: "Decrypting project manifests...", delay: 6800, status: "ok" },
        { text: "Compiling shaders...", delay: 7500, status: "info" },
        {
          text: "WARNING: High creativity levels detected",
          delay: 8200,
          status: "warn",
        },
        { text: "All systems nominal.", delay: 9000, status: "ok" },
        {
          text: `${SITE_FULL_NAME} // PORTFOLIO v2.0 — READY`,
          delay: 10000,
          status: "ready",
        },
      ]
    : [
        { text: "BIOS v2.0.4 initializing...", delay: 300, status: "info" },
        { text: "Memory check: 32768MB OK", delay: 700, status: "ok" },
        { text: "Loading kernel modules...", delay: 1100, status: "info" },
        { text: "Mounting filesystem...", delay: 1500, status: "ok" },
        {
          text: "Establishing network connection...",
          delay: 1900,
          status: "info",
        },
        { text: "Fetching portfolio data...", delay: 2300, status: "info" },
        { text: "Decrypting project manifests...", delay: 2700, status: "ok" },
        { text: "Compiling shaders...", delay: 3000, status: "info" },
        {
          text: "WARNING: High creativity levels detected",
          delay: 3200,
          status: "warn",
        },
        { text: "All systems nominal.", delay: 3500, status: "ok" },
        {
          text: `${SITE_FULL_NAME} // PORTFOLIO v2.0 — READY`,
          delay: 3900,
          status: "ready",
        },
      ];

  // ── Status Display Maps ───────────────────────────────────────
  const STATUS_COLOR = {
    ok: "var(--green)",
    warn: "var(--yellow)",
    info: "var(--cyan)",
    ready: "var(--cyan)",
  };

  const STATUS_PREFIX = {
    ok: "[ OK ]",
    warn: "[ WARN ]",
    info: "[ INFO ]",
    ready: "[ READY ]",
  };

  // ── Reactive State ────────────────────────────────────────────
  // Svelte 5: $state() makes variables reactive.
  // When any $state variable changes, affected template nodes re-render.
  //
  // React equivalent:
  //   const [visibleLines, setVisibleLines] = useState([])
  //   const [progress, setProgress]         = useState(0)
  //   const [phase, setPhase]               = useState('boot')
  //   const [skip, setSkip]                 = useState(false)
  let visibleLines = $state([]); // lines shown so far (grows as sequence runs)
  let progress = $state(0); // progress bar percentage 0-100
  let phase = $state("boot"); // current phase: 'boot'|'complete'|'exit'|'hidden'

  // false = not booted, true = already booted this session
  // If Started With: skip=false → On refresh boot screen flashes → onMount → skip=true → gone
  // If Started With: skip=true  → On refresh nothing renders     → onMount → skip=false → boot screen
  let skip = $state(true);

  // ── Utility ───────────────────────────────────────────────────
  // Promise-based sleep — pauses async execution for `ms` milliseconds.
  // await sleep(500) = wait 500ms before next line runs.
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ── Progress Bar Animation ────────────────────────────────────
  // Animates `progress` from its current value to `targetPct`
  // over `duration` ms using cubic ease-out curve.
  //
  // requestAnimationFrame = browser-native animation loop.
  // Fires ~60 times/second, synced to display refresh rate.
  // Much smoother than setInterval for animations.
  function animateProgress(targetPct, duration) {
    return new Promise((resolve) => {
      const start = progress;
      const range = targetPct - start;
      const startTime = performance.now();

      function step(now) {
        const elapsed = now - startTime;
        const t = Math.min(elapsed / duration, 1);

        // Cubic ease-out: 1 - (1-t)³
        // Starts fast (when t is small) and decelerates toward target.
        // Makes the progress bar feel organic rather than mechanical.
        progress = Math.floor(start + range * (1 - Math.pow(1 - t, 3)));

        if (t < 1) requestAnimationFrame(step);
        else {
          progress = targetPct;
          resolve();
        }
      }
      requestAnimationFrame(step);
    });
  }

  // ── Boot Sequence Orchestrator ────────────────────────────────
  // Runs the full sequence using async/await for readable timing.
  //
  // Promise.all() starts all line timers simultaneously —
  // each resolves at its own delay. This is more efficient than
  // chaining setTimeouts and gives us parallel progress animation.
  async function runBootSequence() {
    // Start all line appearance timers concurrently
    const linePromises = BOOT_LINES.map((line) =>
      sleep(line.delay).then(() => {
        // Must reassign (not push) to trigger $state reactivity in Svelte 5
        // push() mutates the array in place — Svelte 5 doesn't detect that
        // Reassignment creates a new array reference — Svelte detects it
        visibleLines = [...visibleLines, line];
      }),
    );

    // Animate progress bar while lines are loading
    animateProgress(60, TIMING.progressFull); // 0% → 60% (concurrent with lines)
    await Promise.all(linePromises); // wait for all lines to appear
    await animateProgress(95, TIMING.progressEnd); // 60% → 95% (winding down)
    await sleep(200);
    progress = 100; // snap to 100%
    phase = "complete";

    // Brief pause at 100% so user can read "READY", then signal CRTWrapper to take over
    await sleep(600);

    sequenceDone.set(true); // Signal CRTWrapper to start exit animation
  }

  // ── Lifecycle ─────────────────────────────────────────────────
  // onMount fires after component mounts to the DOM.
  // sessionStorage is browser-only — can't access during SSR.
  // onMount is guaranteed to run only in the browser.
  //
  // React equivalent: useEffect(() => { ... }, [])
  onMount(() => {
    // Session check: has this tab already booted?
    if (!SHOW_EVERY_VISIT && sessionStorage.getItem(SESSION_KEY)) {

      // Already booted — signal skip path, CRTWrapper takes over - skips animations
      bootWasSkipped.set(true);
      sequenceDone.set(true);

      return;
    }

    // Mark session: future refreshes in this tab will skip
    sessionStorage.setItem(SESSION_KEY, "1");

    skip = false;  // NOW show the boot screen

    // Kick off the boot sequence
    runBootSequence();
  });
</script>

{#if !skip}
  <!-- Content only — NO wrapper div with animations here.
       CRTWrapper provides the animated wrapper around this component. -->
  <div class="boot-content">
 
    <div class="boot-header">
      <div class="boot-logo">{SITE_FULL_NAME.toUpperCase()} PORTFOLIO OS</div>
      <div class="boot-subtitle">Version 2.0.4 — Cyberpunk Edition</div>
      <div class="boot-divider">{'─'.repeat(60)}</div>
    </div>
 
    <div class="boot-log">
      {#each visibleLines as line}
        <div
          class="boot-line"
          class:boot-line-ready={line.status === 'ready'}
          style="color: {STATUS_COLOR[line.status] ?? 'var(--cyan)'};"
        >
          <span class="boot-prefix" style="color: {STATUS_COLOR[line.status]};">
            {STATUS_PREFIX[line.status]}
          </span>
          <span class="boot-text">{line.text}</span>
        </div>
      {/each}
 
      {#if phase === 'boot'}
        <div class="boot-cursor">
          <span class="animate-blink">█</span>
        </div>
      {/if}
    </div>
 
    <div class="boot-progress-section">
      <div class="boot-progress-label">
        <span>BOOT PROGRESS</span>
        <span>{progress}%</span>
      </div>
      <div class="boot-progress-track">
        <div
          class="boot-progress-fill"
          class:boot-progress-complete={progress === 100}
          style="width: {progress}%;"
        ></div>
      </div>
    </div>
 
    <div class="boot-status">
      {#if phase === 'boot'}
        <span style="color: var(--cyan);">LOADING...</span>
      {:else}
        <span style="color: var(--green);">ALL SYSTEMS ONLINE — ENTERING PORTFOLIO</span>
      {/if}
    </div>
 
  </div>
{/if}

<style>
  /* Terminal content box — CRTWrapper provides the outer boot-screen div */
  .boot-content {
    position: relative;
    z-index: 2;
    width: min(700px, 90vw);
    padding: 2rem;
    border: 1px solid rgba(0,245,255,0.2);
    box-shadow: 0 0 40px rgba(0,245,255,0.08), inset 0 0 40px rgba(0,245,255,0.03);
  }
 
  .boot-header    { margin-bottom: 1.5rem; }
  .boot-logo      { font-size: 1rem; font-weight: 700; letter-spacing: 0.15em; color: var(--cyan); text-shadow: var(--glow-c); margin-bottom: 0.25rem; }
  .boot-subtitle  { font-size: 0.7rem; letter-spacing: 0.1em; color: rgba(168,184,216,0.5); margin-bottom: 0.75rem; }
  .boot-divider   { font-size: 0.7rem; color: rgba(0,245,255,0.2); overflow: hidden; white-space: nowrap; }
 
  .boot-log {
    min-height: 220px;
    margin-bottom: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
 
  .boot-line {
    font-size: 0.75rem;
    letter-spacing: 0.05em;
    display: flex;
    gap: 0.75rem;
    align-items: baseline;
    animation: line-appear 0.1s ease forwards;
  }
 
  @keyframes line-appear {
    from { opacity: 0; transform: translateX(-4px); }
    to   { opacity: 1; transform: none; }
  }
 
  .boot-line-ready { margin-top: 0.5rem; font-size: 0.85rem; font-weight: 700; letter-spacing: 0.1em; text-shadow: var(--glow-c); }
  .boot-prefix     { font-size: 0.65rem; letter-spacing: 0.08em; white-space: nowrap; flex-shrink: 0; }
  .boot-text       { color: rgba(168,184,216,0.85); }
  .boot-line-ready .boot-text { color: var(--cyan); }
  .boot-cursor     { font-size: 0.85rem; color: var(--cyan); margin-top: 0.25rem; }
 
  .boot-progress-section  { margin-bottom: 1rem; }
  .boot-progress-label    { display: flex; justify-content: space-between; font-size: 0.65rem; letter-spacing: 0.15em; color: rgba(168,184,216,0.5); margin-bottom: 0.4rem; }
  .boot-progress-track    { height: 4px; background: rgba(255,255,255,0.06); border: 1px solid rgba(0,245,255,0.1); overflow: hidden; }
  .boot-progress-fill     { height: 100%; background: linear-gradient(90deg, var(--cyan), var(--magenta)); box-shadow: 0 0 8px var(--cyan); transition: width 0.1s linear; }
  .boot-progress-complete { background: linear-gradient(90deg, var(--green), var(--cyan)); box-shadow: 0 0 12px var(--green); }
 
  .boot-status { font-size: 0.68rem; letter-spacing: 0.15em; text-transform: uppercase; border-top: 1px solid rgba(0,245,255,0.1); padding-top: 0.75rem; }
</style>