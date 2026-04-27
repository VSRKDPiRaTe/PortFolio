<script>
  // ── /projects/[slug] — Project Detail Page ───────────────────────
  // SvelteKit dynamic route — [slug] in folder name = URL parameter.
  // /projects/securetrack → slug = "securetrack"
  // /projects/portfolio   → slug = "portfolio"
  //
  // data comes from +page.js load() which finds the project by slug.
  // If slug not found, load() returns 404 via SvelteKit error().
  let { data } = $props();

  let project = $derived(data.project);
  let group = $derived(data.group);
  let badge = $derived(data.badge);

  const githubIcon = `<svg viewBox="0 0 24 24" width="16" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>`;
  const externalIcon = `<svg viewBox="0 0 16 16" width="14" fill="currentColor"><path d="M2 2h5v2H4v8h8V9h2v5H2V2zm7 0h5v5h-2V4.414L7.707 9.707 6.293 8.293 11.586 3H9V1z"/></svg>`;
</script>

<svelte:head>
  <title>{project.title} // VIKRAM.DEV</title>
  <meta name="description" content={project.desc} />
</svelte:head>

<!-- Back navigation -->
<div class="max-w-4xl mx-auto px-8 pt-32 pb-4">
  <a
    href="/projects"
    class="font-mono text-[0.7rem] tracking-widest uppercase text-text-dim hover:text-cyan transition-colors flex items-center gap-2"
  >
    ← ALL PROJECTS
  </a>
</div>

<main class="max-w-4xl mx-auto px-8 pb-24">
  <!-- ── Project Header ───────────────────────────────────────────── -->
  <div class="mb-12">
    <!-- Group + status badges -->
    <div class="flex flex-wrap items-center gap-3 mb-6">
      <span
        class="font-mono text-[0.62rem] tracking-widest uppercase px-3 py-1 border border-cyan/20 bg-cyan/5 text-cyan"
      >
        {group?.subLabel ?? group?.label ?? "PROJECT"}
      </span>

      {#if project.company}
        <span
          class="font-mono text-[0.62rem] tracking-widest uppercase px-3 py-1 border border-magenta/20 bg-magenta/5 text-magenta"
        >
          {project.company}
        </span>
      {/if}

      <span
        class="font-mono text-[0.62rem] tracking-widest uppercase px-3 py-1"
        style="background: {badge.color}; color: {badge.textColor};"
      >
        {badge.full}
      </span>
    </div>

    <!-- Project title -->
    <h1
      class="font-display font-bold text-text-hi mb-4"
      style="font-size: clamp(2rem, 5vw, 3.5rem);"
    >
      {project.title}
    </h1>

    <!-- Full description -->
    <p class="text-text-dim text-lg leading-relaxed max-w-2xl mb-8">
      {project.desc}
    </p>

    <!-- Action links -->
    <div class="flex flex-wrap gap-4 mb-10">
      {#if project.github}
        <a
          href={project.github}
          target="_blank"
          rel="noreferrer"
          class="btn-cyan btn-angled inline-flex items-center gap-2"
        >
          {@html githubIcon} SOURCE CODE
        </a>
      {/if}
      {#if project.demo}
        <a
          href={project.demo}
          target="_blank"
          rel="noreferrer"
          class="btn-outline btn-angled inline-flex items-center gap-2"
        >
          {@html externalIcon} LIVE DEMO
        </a>
      {/if}
      {#if !project.github && !project.demo}
        <span
          class="font-mono text-[0.75rem] tracking-widest uppercase text-text-dim border border-white/10 px-4 py-2"
        >
          SOURCE PRIVATE — EMPLOYMENT PROJECT
        </span>
      {/if}
    </div>

    <!-- Tech stack tags -->
    <div class="flex flex-wrap gap-2">
      {#each project.tags as tag}
        <span class="tag-pill">{tag}</span>
      {/each}
    </div>
  </div>

  <!-- ── Badge Explanation ─────────────────────────────────────────── -->
  <div class="detail-block mb-8">
    <div class="detail-label">STATUS</div>
    <div class="detail-value">{badge.full}</div>
    <p class="text-text-dim text-[0.88rem] leading-relaxed mt-2">
      {badge.desc}
    </p>
  </div>

  <!-- ── Group Info ────────────────────────────────────────────────── -->
  {#if group}
    <div class="detail-block mb-8">
      <div class="detail-label">PROJECT TYPE</div>
      <div class="detail-value">{group.label}</div>
      <p class="text-text-dim text-[0.88rem] leading-relaxed mt-2">
        {group.desc}
      </p>
    </div>
  {/if}

  <!-- ── Company ───────────────────────────────────────────────────── -->
  {#if project.company}
    <div class="detail-block mb-8">
      <div class="detail-label">BUILT AT</div>
      <div class="detail-value">{project.company}</div>
    </div>
  {/if}
</main>

<style>
  :global(body) {
    background: var(--bg);
  }

  .detail-block {
    padding: 1.5rem;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(6, 12, 26, 0.6);
  }

  .detail-label {
    font-family: "Share Tech Mono", monospace;
    font-size: 0.65rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--cyan);
    margin-bottom: 0.5rem;
  }

  .detail-value {
    font-family: "Orbitron", monospace;
    font-size: 1rem;
    font-weight: 700;
    color: var(--text-hi);
  }
</style>
