<script>
  // ── Imports ───────────────────────────────────────────────────────
  // tick() — Svelte utility that waits for the DOM to update.
  // Used after switching tabs so animateBars() sees the new bar elements.
  // React equivalent: useEffect with a dependency on activeTab.
  import { tick } from 'svelte';
  import { reveal } from '$lib/actions/reveal.js';
  import { skillTabsStore, skillsStore } from '$lib/data/skills.js';

  // ── Reactive Skills Data ──────────────────────────────────────────
  // These values come from stores populated by +layout.svelte.
  //
  // Using $skillTabsStore / $skillsStore keeps the component reactive:
  // if layout repopulates the stores after refresh or navigation,
  // this component re-renders automatically with the latest values.
  let skillTabs = $derived($skillTabsStore);
  let skills = $derived($skillsStore);

  // ── Active Tab State ──────────────────────────────────────────────
  // In Svelte 5 runes mode, mutable component-local state should use
  // $state(...). That tells Svelte this value is expected to change
  // over time and should trigger reactive updates when reassigned.
  let activeTab = $state('languages');

  // Keep the active tab valid once tabs arrive or change.
  // If the current tab no longer exists, fall back to the first tab.
  $effect(() => {
    const firstTabId = skillTabs[0]?.id ?? 'languages';

    if (!skillTabs.some((tab) => tab.id === activeTab)) {
      activeTab = firstTabId;
    }
  });

  // ── Derived: current skills list ─────────────────────────────────
  // Recomputes whenever either:
  //   1. the active tab changes
  //   2. the grouped skills data changes
  //
  // React equivalent: useMemo(() => skills[activeTab], [skills, activeTab])
  let currentSkills = $derived(skills[activeTab] ?? []);

  // ── Tab Switch ────────────────────────────────────────────────────
  // 1. Set new tab — Svelte schedules a DOM update
  // 2. await tick() — wait for DOM to commit new skill bars
  // 3. animateBars() — set widths so CSS transition fires
  async function switchTab(id) {
    activeTab = id;
    await tick();
    animateBars();
  }

  // ── Bar Animation ─────────────────────────────────────────────────
  // Skill bars start at width:0 (set in HTML).
  // This function sets them to their real pct value so the CSS
  // transition (1.2s ease) animates them from 0 to pct.
  //
  // requestAnimationFrame ensures the browser paints the 0% state
  // before immediately jumping to the target — without it the
  // transition sometimes doesn't fire.
  function animateBars() {
    document.querySelectorAll('.skill-bar-fill').forEach((bar) => {
      requestAnimationFrame(() => {
        bar.style.width = `${bar.dataset.width}%`;
      });
    });
  }

  // ── Viewport Reveal Action ────────────────────────────────────────
  // Fires animateBars() the first time the skills section enters the
  // viewport. Without this, bars stay at 0% if the user lands on
  // the page already scrolled past the section.
  //
  // Returns { destroy } so the observer is cleaned up when the
  // element leaves the DOM.
  function barReveal(node) {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        animateBars();
        observer.disconnect();
      }
    }, { threshold: 0.2 });

    observer.observe(node);
    return { destroy: () => observer.disconnect() };
  }

  // Re-run bar animation whenever the visible skills list changes.
  // This covers:
  //   - first data arrival after refresh
  //   - switching tabs
  //   - future live updates to skill data
  $effect(() => {
    if (!currentSkills.length) return;

    tick().then(() => {
      animateBars();
    });
  });
</script>


<section id="skills" class="section-pad bg-bg2">
  <div class="max-w-6xl mx-auto px-8">

    <div use:reveal class="section-label">SKILLS.DAT</div>
    <h2
      use:reveal={{ delay: 100 }}
      class="font-display font-bold text-text-hi mb-12"
      style="font-size: clamp(1.8rem, 4vw, 2.8rem);"
    >
      TECH <span class="neon-c">STACK</span>
    </h2>


    <!-- ── Layout: Left Tabs + Right Skills Grid ─────────────────────
      Two column layout — tab list on left, skill cards on right.
      Vertical tabs suit many groups (9 tabs) better than horizontal
      tabs which would wrap awkwardly on narrow screens.
      On mobile: tabs collapse to a horizontal scrollable row on top.
    ──────────────────────────────────────────────────────────────── -->
    <div use:reveal={{ delay: 150 }} class="skills-layout">

      <!-- ── Left Tab List ───────────────────────────────────────────
        Each button sets activeTab on click.
        class:active adds the active styles when tab.id matches.
        {#each skillTabs} loops from skills.json tabs array.
        The count badge shows how many skills are in each group.
      ──────────────────────────────────────────────────────────────── -->
      <nav class="tab-list" aria-label="Skill categories">
        {#each skillTabs as tab}
          <button
            class="tab-btn"
            class:active={activeTab === tab.id}
            role="tab"
            onclick={() => switchTab(tab.id)}
            aria-selected={activeTab === tab.id}
          >
            <span class="tab-label">{tab.label}</span>
            <!-- Skill count badge per tab -->
            <span class="tab-count">
              {skills[tab.id]?.length ?? 0}
            </span>
          </button>
        {/each}
      </nav>


      <!-- ── Right Skills Grid ─────────────────────────────────────────
        {#key activeTab} unmounts and remounts the grid when tab changes.
        This resets bar widths to 0 so animations re-fire on each switch.
        Without {#key}, Svelte would patch existing DOM nodes and the
        CSS transitions would not replay.
      ──────────────────────────────────────────────────────────────── -->
      {#key activeTab}
        <div use:barReveal class="skills-grid">
          {#each currentSkills as skill, i}
            <div use:reveal={{ delay: i * 40 }} class="skill-card">

              <!-- ── Skill Header: Name + Badges + Percentage ───────── -->
              <div class="flex items-start justify-between gap-2 mb-3">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="font-body font-semibold text-text-hi text-[0.92rem]">
                    {skill.name}
                  </span>

                  <!-- exposure badge — limited/learning exposure -->
                  {#if skill.exposure}
                    <span class="skill-badge exposure-badge">EXPOSURE</span>
                  <!-- primary badge — core production skill -->
                  {:else if skill.primary}
                    <span class="skill-badge primary-badge">CORE</span>
                  {/if}
                </div>

                <!-- Percentage — only shown for primary skills -->
                {#if !skill.exposure}
                  <span class="font-mono text-[0.7rem] neon-c flex-shrink-0">
                    {skill.pct}%
                  </span>
                {/if}
              </div>

              <!-- ── Progress Bar ─────────────────────────────────────
                Starts at width:0. animateBars() sets data-width value
                so CSS transition (1.2s ease) animates it in.
                Exposure skills show a muted dashed bar instead.
              ──────────────────────────────────────────────────────── -->
              {#if skill.exposure}
                <!-- Dashed bar for exposure — visually distinct -->
                <div class="h-[3px] rounded-full overflow-hidden exposure-bar"></div>
              {:else}
                <div class="h-[3px] bg-white/[0.06] rounded-full overflow-hidden">
                  <div
                    class="skill-bar-fill h-full rounded-full"
                    style="width: 0%;"
                    data-width={skill.pct}
                  ></div>
                </div>
              {/if}

            </div>
          {/each}
        </div>
      {/key}

    </div>
  </div>
</section>


<style>
  .section-pad { padding: 100px 0; }

  /* ── Two Column Layout ─────────────────────────────────────────────
     Left: fixed-width tab nav. Right: flexible skills grid.
     Gap between them. On mobile: stacks vertically. */
  .skills-layout {
    display: grid;
    grid-template-columns: 200px 1fr;
    gap: 2rem;
    align-items: start;
  }

  @media (max-width: 768px) {
    /* Mobile: tabs become a horizontal scrollable row above the grid */
    .skills-layout {
      grid-template-columns: 1fr;
    }
    .tab-list {
      display: flex !important;
      flex-direction: row !important;
      overflow-x: auto;
      border-right: none !important;
      border-bottom: 1px solid rgba(255,255,255,0.08);
      padding-bottom: 0.5rem;
      gap: 0.25rem !important;
    }
    .tab-btn {
      white-space: nowrap;
      border-left: none !important;
      border-bottom: 2px solid transparent;
      padding: 0.5rem 0.75rem !important;
    }
    .tab-btn.active {
      border-left: none !important;
      border-bottom-color: var(--cyan) !important;
    }
    .tab-count {
      display: none;
    }
  }

  /* ── Tab List ──────────────────────────────────────────────────────
     Vertical list of tab buttons.
     border-right = the dividing line between tabs and grid. */
  .tab-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    border-right: 1px solid rgba(255,255,255,0.08);
    padding-right: 1rem;
    position: sticky;
    top: 5rem;         /* stays visible while scrolling through skills */
  }

  /* ── Tab Button ────────────────────────────────────────────────────
     Each group tab. Left border highlight on active.
     Full width so label + count span the whole left column. */
  .tab-btn {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.6rem 0.75rem;
    background: none;
    border: none;
    border-left: 2px solid transparent;
    cursor: pointer;
    text-align: left;
    transition: all 0.2s;
  }

  .tab-btn:hover .tab-label { color: var(--cyan); }

  .tab-btn.active {
    border-left-color: var(--cyan);
    background: rgba(0,245,255,0.04);
  }
  .tab-btn.active .tab-label {
    color: var(--cyan);
    text-shadow: var(--glow-c);
  }
  .tab-btn.active .tab-count {
    color: var(--cyan);
    border-color: rgba(0,245,255,0.3);
  }

  .tab-label {
    font-family: 'Share Tech Mono', monospace;
    font-size: 0.68rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: rgba(168,184,216,0.7);
    transition: color 0.2s;
  }

  /* Count badge — shows number of skills in each tab */
  .tab-count {
    font-family: 'Share Tech Mono', monospace;
    font-size: 0.6rem;
    color: rgba(168,184,216,0.4);
    border: 1px solid rgba(255,255,255,0.08);
    padding: 0.1rem 0.35rem;
    border-radius: 3px;
    flex-shrink: 0;
    transition: all 0.2s;
  }

  /* ── Skills Grid ───────────────────────────────────────────────────
     Two column grid for skill cards.
     Gap between cards. */
  .skills-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
    align-content: start;
  }

  @media (max-width: 640px) {
    .skills-grid { grid-template-columns: 1fr; }
  }

  /* ── Skill Card ────────────────────────────────────────────────────
     Angled card with cyberpunk clip-path.
     Hover lifts and adds cyan border glow. */
  .skill-card {
    background: rgba(6,12,26,0.8);
    border: 1px solid rgba(255,255,255,0.08);
    padding: 1rem 1.25rem;
    clip-path: polygon(12px 0%, 100% 0%, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0% 100%, 0% 12px);
    transition: all 0.3s;
  }

  .skill-card:hover {
    border-color: rgba(0,245,255,0.3);
    background: rgba(0,245,255,0.03);
    transform: translateY(-2px);
  }

  /* ── Skill Badges ──────────────────────────────────────────────────
     CORE badge — green, primary skills used in production.
     EXPOSURE badge — yellow, limited/learning exposure.
     Both are small monospace labels. */
  .skill-badge {
    font-family: 'Share Tech Mono', monospace;
    font-size: 0.52rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 0.1rem 0.4rem;
    border-radius: 2px;
  }

  .primary-badge {
    color: var(--green);
    border: 1px solid rgba(0,255,136,0.3);
    background: rgba(0,255,136,0.06);
  }

  .exposure-badge {
    color: var(--yellow);
    border: 1px solid rgba(255,230,0,0.3);
    background: rgba(255,230,0,0.06);
  }

  /* ── Progress Bar ──────────────────────────────────────────────────
     Starts at 0%, animated to pct value by animateBars().
     1.2s cubic-bezier gives the satisfying slow-ease-in effect. */
  .skill-bar-fill {
    background: linear-gradient(90deg, var(--cyan), var(--magenta));
    box-shadow: 0 0 6px var(--cyan);
    transition: width 1.2s cubic-bezier(0.17, 0.55, 0.55, 1) 0.1s;
  }

  /* Exposure bar — dashed appearance, muted color, no animation */
  .exposure-bar {
    background: repeating-linear-gradient(
      90deg,
      rgba(255,230,0,0.25) 0px,
      rgba(255,230,0,0.25) 8px,
      transparent 8px,
      transparent 12px
    );
  }
</style>