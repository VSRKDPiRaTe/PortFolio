<script>
  // ── Imports ───────────────────────────────────────────────────────
  // reveal: custom Svelte action — fades + slides element in when it
  // enters the viewport. Applied via use:reveal on any element.
  import { reveal } from '$lib/actions/reveal.js';
  import { experienceStore, formatDateRange } from '$lib/data/experience.js';

  // ── Experience Data ───────────────────────────────────────────────
  // Subscribe to the live experience store instead of taking a one-time
  // snapshot with getExperience().
  //
  // WHY THIS MATTERS:
  //   getExperience() reads the store once and returns the current value.
  //   That is fine for plain JS helpers, but visible UI should stay reactive.
  //
  //   experienceStore is populated from the root layout via stores, so using
  //   $derived($experienceStore) keeps this component in sync after:
  //     - hard refresh
  //     - navigation
  //     - future owner-side edits that repopulate the source store
  let experience = $derived($experienceStore);

  // ── Expanded State ────────────────────────────────────────────────
  // One boolean per job entry — all start collapsed (false).
  // expanded[i] = true means that job's bullets are visible.
  //
  // Because the experience list is now reactive, the expanded state must stay
  // aligned with the current number of jobs.
  //
  // IMPORTANT:
  //   Do not rebuild this array inside an effect that both reads and writes
  //   `expanded`, otherwise the effect can trigger itself repeatedly.
  //
  //   Instead, resize only when the experience length changes:
  //     - preserve existing open/closed values where possible
  //     - append new false values for new entries
  //     - trim removed entries if the list becomes shorter
  let expanded = $state([]);

  let experienceCount = $derived(experience.length);

  $effect(() => {
    const next = Array.from(
      { length: experienceCount },
      (_, i) => expanded[i] ?? false
    );

    // Only assign if length actually differs, so we do not create
    // unnecessary state writes during normal renders.
    if (expanded.length !== next.length) {
      expanded = next;
    }
  });
</script>


<section id="experience" class="section-pad bg-bg2">
  <div class="max-w-6xl mx-auto px-8">

    <!-- Section eyebrow + heading -->
    <div use:reveal class="section-label">EXPERIENCE.LOG</div>
    <h2
      use:reveal={{ delay: 100 }}
      class="font-display font-bold text-text-hi mb-14"
      style="font-size: clamp(1.8rem, 4vw, 2.8rem);"
    >
      MISSION <span class="neon-g">HISTORY</span>
    </h2>


    <!-- ── Timeline Container ──────────────────────────────────────────
      position:relative on the container + position:absolute on the
      vertical line and dots creates the timeline layout.
      pl-10/pl-14 = left padding to make room for the line + dots.
    ──────────────────────────────────────────────────────────────── -->
    <div class="timeline relative pl-10 md:pl-14">

      <!-- Vertical neon line — runs full height of timeline container -->
      <div
        class="absolute left-0 top-0 bottom-0 w-px"
        style="background: linear-gradient(180deg, var(--cyan), var(--magenta), var(--cyan)); box-shadow: 0 0 8px rgba(0,245,255,0.3);"
      ></div>


      <!-- ── Job Entries ───────────────────────────────────────────────
        {#each experience as job, i} — i is the index (0, 1, 2...).
        delay: i * 100 staggers each card's reveal animation by 100ms.
        last:mb-0 removes bottom margin from the final entry.
      ──────────────────────────────────────────────────────────────── -->
      {#each experience as job, i}
        <div
          use:reveal={{ delay: i * 100 }}
          class="timeline-item relative mb-12 last:mb-0"
        >

          <!-- ── Timeline Dot ─────────────────────────────────────────
            Positioned absolutely relative to .timeline-item.
            Negative left value pulls it out to sit on the vertical line.
            Inner div creates the filled center of the dot.
          ──────────────────────────────────────────────────────────── -->
          <div
            class="absolute -left-[2.65rem] md:-left-[3.45rem] top-1 w-3.5 h-3.5 rounded-full bg-bg border-2 border-cyan"
            style="box-shadow: var(--glow-c);"
          >
            <div
              class="absolute inset-0.75 rounded-full bg-cyan"
              style="box-shadow: var(--glow-c);"
            ></div>
          </div>


          <!-- ── Job Metadata ──────────────────────────────────────────
            Date → Role → Company → Location displayed in sequence.
            Colors and font sizes give visual hierarchy without headings.
          ──────────────────────────────────────────────────────────── -->
          <div
            class="font-mono text-[0.7rem] tracking-widest uppercase mb-1.5"
            style="color: var(--magenta);"
          >
            {formatDateRange(job.startDate, job.endDate, job.current)}
          </div>

          <h3 class="font-display font-bold text-text-hi text-lg mb-0.5">
            {job.role}
          </h3>

          <div class="font-mono text-[0.78rem] neon-c mb-1">{job.company}</div>

          <div
            class="font-mono text-[0.72rem] mb-3"
            style="color: var(--magenta);"
          >
            {job.location}
          </div>


          <!-- ── Description ───────────────────────────────────────────
            AI-generated summary paragraph from the DB-backed experience data.
            Shown by default — concise overview for quick scanning.
            Bullet points below remain optional detail-on-demand.
          ──────────────────────────────────────────────────────────── -->
          <p class="text-text-dim text-[0.92rem] leading-relaxed max-w-2xl mb-3">
            {job.desc}
          </p>


          <!-- ── Bullet Points (expandable) ────────────────────────────
            Only renders if job.bullets exists and has items.
            job.bullets?.length — optional chaining: safe if bullets
            is undefined (future jobs without bullets won't crash).

            Collapsed by default — shows a toggle button with count.
            expanded[i] tracks open/closed state per job independently.

            WHY collapsed by default?
              bullet points per job = wall of text if all visible.
              desc already gives the summary. Bullets are for recruiters
              who want detail — they can expand on demand.

            on:click={() => expanded[i] = !expanded[i]}:
              Toggles the boolean at index i in the expanded array.
              Because expanded is component state, reassigning that slot
              updates the DOM immediately for that one job entry.
          ──────────────────────────────────────────────────────────── -->
          {#if job.bullets?.length}

            <!-- Toggle button -->
            <button
              type="button"
              class="font-mono text-[0.68rem] tracking-widest uppercase mb-3 neon-c
                     hover:opacity-70 transition-opacity flex items-center gap-2 bg-transparent border-none cursor-pointer p-0"
              onclick={() => expanded[i] = !expanded[i]}
            >
              <!-- Arrow rotates to indicate open/closed state -->
              <span class="transition-transform duration-200" style="display:inline-block; transform: {expanded[i] ? 'rotate(90deg)' : 'rotate(0deg)'}"
              >▶</span>
              {expanded[i] ? 'HIDE DETAILS' : `VIEW ${job.bullets.length} HIGHLIGHTS`}
            </button>

            <!-- Bullet list — only in DOM when expanded[i] is true -->
            {#if expanded[i]}
              <ul class="mb-4 max-w-3xl space-y-2 text-text-dim text-[0.9rem] leading-relaxed list-none pl-0">
                {#each job.bullets as bullet}
                  <!-- Custom bullet style — neon dash instead of default disc -->
                  <li class="flex gap-2">
                    <span class="neon-c shrink-0 mt-0.5">→</span>
                    <span>{bullet}</span>
                  </li>
                {/each}
              </ul>
            {/if}

          {/if}


          <!-- ── Tech Tags ─────────────────────────────────────────────
            Key technologies from job.tags in the DB-backed experience data.
            .tag-pill defined in app.css (or add to style block below).
          ──────────────────────────────────────────────────────────── -->
          <div class="flex flex-wrap gap-1.5">
            {#each job.tags as tag}
              <span class="tag-pill">{tag}</span>
            {/each}
          </div>

        </div>
      {/each}

    </div>
  </div>
</section>


<style>
  /* Section vertical padding */
  .section-pad { padding: 100px 0; }
</style>