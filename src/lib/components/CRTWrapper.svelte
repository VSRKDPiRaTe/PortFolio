<script>
  import { tick }                                       from 'svelte';
  import { get }                                        from 'svelte/store';
  import { sequenceDone, bootWasSkipped, bootComplete } from '$lib/stores/ui.js';
  import BootScreen                                     from '$lib/components/BootScreen.svelte';

  // Children snippet from +page.svelte
  // Svelte 5: $props() receives content between <CRTWrapper>...</CRTWrapper>
  // React equivalent: function CRTWrapper({ children }) {}
  let { children } = $props();

  // DOM refs — assigned via bind:this after Svelte renders the elements.
  // $state() required in Svelte 5 for variables assigned post-creation.
  // bootWrapEl     = boot screen overlay div (crtExit animates this)
  // revealTopEl    = top black panel, covers 0 to 50vh (slides UP)
  // revealBottomEl = bottom black panel, covers 50vh to 100vh (slides DOWN)
  let bootWrapEl     = $state();
  let revealTopEl    = $state();
  let revealBottomEl = $state();

  // Visibility flags — control when divs are added to DOM.
  // showPortfolio: true AFTER crtExit — portfolio renders under panels
  // showReveal:    true AFTER crtExit — panels render on top of portfolio
  // Both are false until crtExit completes so nothing renders prematurely.
  let showPortfolio = $state(false);
  let showReveal    = $state(false);

  // Promise-based pause for async timing control.
  // await sleep(300) = pause 300ms then continue.
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // crtExit: collapses the boot screen overlay inward.
  // bootWrapEl is position:fixed with inset:0 — fills full viewport.
  // transform-origin:center center on a full-viewport fixed element
  // correctly targets the actual viewport center for the scaleY collapse.
  //
  // Flicker targets .boot-content brightness (not bootWrapEl opacity)
  // so the black background stays solid — no portfolio bleed-through.
  async function crtExit() {
    if (!bootWrapEl) return;

    const content = bootWrapEl.querySelector('.boot-content');

    // Step 1: Flicker — 3 rapid brightness drops simulate unstable power
    for (let i = 0; i < 3; i++) {
      if (content) content.style.filter = 'brightness(0.15)';
      await sleep(60);
      if (content) content.style.filter = 'brightness(1)';
      await sleep(80);
    }
    await sleep(100);

    // Step 2: classList.add triggers crt-off keyframe (see style block).
    // Crushes screen to 2px horizontal line from center, then to nothing.
    // classList.add used instead of reactive class because we need
    // ms-level timing — fires exactly here, not on next Svelte render.
    bootWrapEl.classList.add('crt-collapse');
    await sleep(400);

    // Step 3: Phosphor flash — white burst like residual CRT dot
    bootWrapEl.style.background = '#ffffff';
    bootWrapEl.style.opacity    = '0.6';
    await sleep(80);

    // Step 4: Fade to nothing
    bootWrapEl.style.transition = 'opacity 0.25s ease';
    bootWrapEl.style.opacity    = '0';
    await sleep(280);

    bootWrapEl.style.display = 'none';
  }

  // crtReveal: two black panels slide apart to reveal portfolio.
  //
  // WHY TWO PANELS instead of a single scaleY?
  //   Closing: scaleY on full-viewport fixed div works — its center IS
  //   the viewport center. Collapse goes top+bottom inward to center.
  //
  //   Opening: we want the OPPOSITE — reveal from center outward.
  //   Expanding scaleY on the portfolio div fails because that div
  //   is not full viewport height on first render, so its center is
  //   not the viewport center — causes the sliding-up bug.
  //
  //   Two fixed panels (top 50vh + bottom 50vh) solve this:
  //     revealTopEl slides UP    → reveals top half from center to top edge
  //     revealBottomEl slides DOWN → reveals bottom half from center to bottom
  //   The gap between them starts at viewport center and grows outward.
  //   Portfolio is revealed CENTER FIRST — exactly how CRTs warm up.
  async function crtReveal() {
    if (!revealTopEl || !revealBottomEl) return;

    // Phosphor glow at seam between panels — simulates the bright
    // horizontal line CRTs show just before the screen starts expanding.
    // box-shadow on bottom of top panel + top of bottom panel = glowing seam.
    revealTopEl.style.boxShadow    = '0 2px 20px 4px #00f5ff';
    revealBottomEl.style.boxShadow = '0 -2px 20px 4px #00f5ff';
    await sleep(120);

    revealTopEl.style.boxShadow    = 'none';
    revealBottomEl.style.boxShadow = 'none';
    await sleep(60);

    // Slide apart — classList.add triggers keyframes (see style block).
    // Both panels animate simultaneously.
    // Gap starts at center (50vh mark) and grows toward top and bottom edges.
    revealTopEl.classList.add('slide-up');
    revealBottomEl.classList.add('slide-down');

    await sleep(550);

    // Panels done — bootComplete unmounts them via {#if showReveal && !$bootComplete}
    bootComplete.set(true);
  }

  // Watch sequenceDone store.
  // $effect runs whenever reactive dependencies change.
  // React equivalent: useEffect(() => { if (x) ... }, [x])
  //
  // CRITICAL — tick() usage explained:
  //   After crtExit(), we set showPortfolio=true and showReveal=true.
  //   Svelte needs one render cycle to create those divs in the DOM
  //   and assign bind:this refs (revealTopEl, revealBottomEl).
  //   Without tick(), the refs are still undefined when crtReveal() runs.
  //   tick() returns a Promise that resolves after Svelte's next DOM update,
  //   guaranteeing refs are assigned before we try to animate them.
  $effect(() => {
    if ($sequenceDone) {
      if (get(bootWasSkipped)) {
        // Already booted this session — skip all animations
        showPortfolio = true;
        bootComplete.set(true);
      } else {
        crtExit().then(async () => {
          showPortfolio = true; // portfolio in DOM, under panels
          showReveal    = true; // panels in DOM, on top of portfolio
          await tick();         // wait for Svelte to assign bind:this refs
          crtReveal();          // now safe to animate
        });
      }
    }
  });
</script>


<!-- Boot Screen Overlay.
     Exists until bootComplete fires.
     Must be !$bootComplete (not !$sequenceDone) so it stays during crtExit.
     CRTWrapper owns this div — crtExit animates it directly. -->
{#if !$bootComplete}
  <div class="boot-screen" bind:this={bootWrapEl}>
    <div class="boot-scanlines"></div>
    <div class="boot-vignette"></div>
    <!-- BootScreen renders terminal UI content inside this overlay.
         CRTWrapper owns the animated shell, BootScreen owns the content. -->
    <BootScreen />
  </div>
{/if}


<!-- Portfolio content.
     Rendered after crtExit completes (showPortfolio set in $effect).
     Normal document flow — never scaled or animated.
     Reveal panels sit on top until crtReveal slides them away. -->
{#if showPortfolio}
  <div class="portfolio-wrap">
    <!-- Svelte 5: @render outputs the children snippet from +page.svelte.
         React equivalent: {children} -->
    {@render children()}
  </div>
{/if}


<!-- Two reveal panels — full black screen over portfolio.
     showReveal && !$bootComplete keeps them alive during crtReveal,
     then unmounts them when bootComplete fires. -->
{#if showReveal && !$bootComplete}
  <!-- Top panel: 0 to 50vh. Slides UP out of viewport. -->
  <div class="crt-panel crt-panel-top"    bind:this={revealTopEl}></div>
  <!-- Bottom panel: 50vh to 100vh. Slides DOWN out of viewport. -->
  <div class="crt-panel crt-panel-bottom" bind:this={revealBottomEl}></div>
{/if}


<style>
  /* Boot screen overlay — fixed full viewport, above all content */
  /* transform-origin:center center ensures crt-off collapses to true viewport center */
  .boot-screen {
    position: fixed;
    inset: 0;
    z-index: 9998;
    background: #02040a;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Share Tech Mono', monospace;
    overflow: hidden;
    transform-origin: center center;
  }

  /* :global() needed because Svelte prunes selectors it cannot see at
     compile time. classList.add() is invisible to the compiler. */
  :global(.boot-screen.crt-collapse) {
    animation: crt-off 0.35s cubic-bezier(0.23, 1, 0.32, 1) forwards;
  }

  /* CRT power-off:
     0%  = full screen
     30% = crushed to 2px horizontal line, phosphor glow building
     60% = still 2px line, maximum brightness
     100%= fully collapsed, invisible */
  @keyframes crt-off {
    0%   { transform: scaleY(1);    opacity: 1;   filter: brightness(1);           }
    30%  { transform: scaleY(0.02); opacity: 1;   filter: brightness(3);           }
    60%  { transform: scaleY(0.02); opacity: 0.8; filter: brightness(5) blur(1px); }
    100% { transform: scaleY(0);    opacity: 0;   filter: brightness(0);           }
  }

  /* CRT scanlines: repeating 1px dark lines = horizontal row texture */
  .boot-scanlines {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 1;
    background: repeating-linear-gradient(
      to bottom,
      transparent 0px,        transparent 3px,
      rgba(0,0,0,0.15) 3px,  rgba(0,0,0,0.15) 4px
    );
    opacity: 0.6;
  }

  /* Vignette: dark corners like curved CRT monitor glass */
  .boot-vignette {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 1;
    background: radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.7) 100%);
  }

  /* Portfolio wrapper — normal document flow, never animated */
  .portfolio-wrap {
    position: relative;
  }

  /* Reveal panels base styles.
     position:fixed = always covers full viewport width regardless of scroll.
     z-index 9997 = above portfolio (1) but below boot screen (9998).
     pointer-events:none = clicks pass through to portfolio underneath.
     transition on box-shadow = smooth phosphor glow flash. */
  .crt-panel {
    position: fixed;
    left: 0;
    right: 0;
    z-index: 9997;
    background: #02040a;
    pointer-events: none;
    transition: box-shadow 0.1s ease;
  }

  /* Top panel: anchored to top edge, covers upper half of viewport */
  .crt-panel-top    { top: 0;    height: 50vh; }

  /* Bottom panel: anchored to bottom edge, covers lower half of viewport */
  .crt-panel-bottom { bottom: 0; height: 50vh; }

  /* :global() needed — same reason as .boot-screen.crt-collapse above */
  :global(.crt-panel-top.slide-up) {
    animation: slide-up 0.5s cubic-bezier(0.23, 1, 0.32, 1) forwards;
  }

  :global(.crt-panel-bottom.slide-down) {
    animation: slide-down 0.5s cubic-bezier(0.23, 1, 0.32, 1) forwards;
  }

  /* Top panel slides up 100% of its height (50vh) — exits viewport top.
     translateY(-100%) = move element up by its own full height. */
  @keyframes slide-up {
    from { transform: translateY(0);     }
    to   { transform: translateY(-100%); }
  }

  /* Bottom panel slides down 100% of its height (50vh) — exits viewport bottom.
     translateY(100%) = move element down by its own full height. */
  @keyframes slide-down {
    from { transform: translateY(0);    }
    to   { transform: translateY(100%); }
  }
</style>