<script>
  // ── ProjectCard.svelte — Shared Project Card Component ───────────
  // Used in three places:
  //   Projects.svelte          → homepage featured section
  //   /projects/+page.svelte   → all projects page
  //
  // Receives a single project object as a prop.
  // All display logic lives here — parent just passes data.
  //
  // Svelte 5: $props() replaces export let propName
  let { project, groups, badges } = $props();

  // ── Helpers ───────────────────────────────────────────────────────
  // Find the group metadata (label, desc) for this project
  function getGroup(groupId) {
    return groups?.find(g => g.id === groupId) ?? null;
  }

  // Find the badge metadata (color, label, desc) for this project.
  // Normalises to lowercase so badge values are case-insensitive.
  function getBadge(badgeKey) {
    const key = String(badgeKey ?? '').toLowerCase();
    return badges?.[key] ?? {
      label: String(badgeKey ?? 'UNKNOWN').toUpperCase(),
      full:  'UNKNOWN STATUS',
      desc:  '',
      color: '#94a3b8',
      textColor: '#000000',
    };
  }

let group = $derived(getGroup(project.group));
let badge = $derived(getBadge(project.badge));

  // SVG icon strings — inline for zero extra requests
  const githubIcon   = `<svg viewBox="0 0 24 24" width="12" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>`;
  const externalIcon = `<svg viewBox="0 0 16 16" width="11" fill="currentColor"><path d="M2 2h5v2H4v8h8V9h2v5H2V2zm7 0h5v5h-2V4.414L7.707 9.707 6.293 8.293 11.586 3H9V1z"/></svg>`;
</script>


<!--
  Single project card — used on homepage + /projects page.
  Clicking the card title or DETAILS link goes to /projects/[slug].
  No hover panel — detail is on the slug page.
-->
<article class="project-card">

  <!-- ── Card Header ──────────────────────────────────────────────
    Slug watermark behind the badges for depth effect.
    Group sub-label on left, company + status badge on right.
  ──────────────────────────────────────────────────────────────── -->
  <div class="card-header relative p-5 pb-4">

    <!-- Faint slug text watermark — aria-hidden so screen readers skip it -->
    <span class="project-id-watermark font-display font-black" aria-hidden="true">
      {project.slug}
    </span>

    <div class="relative z-10 flex items-start justify-between gap-3">
      <!-- Group label pill — PERSONAL or PROFESSIONAL -->
      <span class="sub-badge font-mono text-[0.56rem] tracking-widest uppercase px-2.5 py-1">
        {group?.subLabel ?? group?.label ?? 'PROJECT'}
      </span>

      <div class="flex flex-wrap justify-end gap-2">
        <!-- Company pill — only for professional projects -->
        {#if project.company}
          <span class="company-badge font-mono text-[0.56rem] tracking-widest uppercase px-2.5 py-1">
            {project.company}
          </span>
        {/if}

        <!-- Status badge — color from badges config in projects.json -->
        <span
          class="badge font-mono text-[0.58rem] tracking-widest uppercase px-2.5 py-1"
          style="background: {badge.color}; color: {badge.textColor};"
        >
          {badge.label}
        </span>
      </div>
    </div>
  </div>


  <!-- ── Card Body ─────────────────────────────────────────────────
    Title links to /projects/[slug] — the full detail page.
    Description + tags + action links below.
  ──────────────────────────────────────────────────────────────── -->
  <div class="px-5 pb-5">

    <!-- Title — links to detail page -->
    <a href="/projects/{project.slug}" class="project-title-link">
      <h3 class="project-title font-display font-bold text-text-hi text-[0.95rem] mb-2">
        {project.title}
      </h3>
    </a>

    <p class="text-text-dim text-[0.88rem] leading-relaxed mb-4">
      {project.desc}
    </p>

    <!-- Tech tags -->
    <div class="flex flex-wrap gap-1.5 mb-5">
      {#each project.tags as tag}
        <span class="tag-pill">{tag}</span>
      {/each}
    </div>

    <!-- ── Action Links ───────────────────────────────────────────
      DETAILS always shows — links to /projects/[slug].
      SOURCE shown only if project.github is set.
      DEMO shown only if project.demo is set.
      RESTRICTED shown when neither github nor demo exist.
    ──────────────────────────────────────────────────────────────── -->
    <div class="flex flex-wrap gap-x-5 gap-y-3">

      <a
        href="/projects/{project.slug}"
        class="proj-link font-mono text-[0.65rem] tracking-widest uppercase flex items-center gap-1.5 no-underline"
      >
        {@html externalIcon} DETAILS
      </a>

      {#if project.github}
        <a
          href={project.github}
          target="_blank"
          rel="noreferrer"
          class="proj-link font-mono text-[0.65rem] tracking-widest uppercase flex items-center gap-1.5 no-underline"
        >
          {@html githubIcon} SOURCE
        </a>
      {/if}

      {#if project.demo}
        <a
          href={project.demo}
          target="_blank"
          rel="noreferrer"
          class="proj-link font-mono text-[0.65rem] tracking-widest uppercase flex items-center gap-1.5 no-underline"
        >
          {@html externalIcon} DEMO
        </a>
      {/if}

      {#if !project.github && !project.demo}
        <span class="proj-link-muted font-mono text-[0.65rem] tracking-widest uppercase flex items-center gap-1.5">
          SOURCE PRIVATE
        </span>
      {/if}

    </div>
  </div>

</article>


<style>
  .project-card {
    background: rgba(6,12,26,0.85);
    border: 1px solid rgba(255,255,255,0.08);
    position: relative;
    transition: all 0.4s;
    clip-path: polygon(20px 0%, 100% 0%, 100% calc(100% - 20px), calc(100% - 20px) 100%, 0% 100%, 0% 20px);
  }

  .project-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 2px;
    background: linear-gradient(90deg, var(--cyan), var(--magenta));
    opacity: 0;
    transition: opacity 0.4s;
  }

  .project-card:hover {
    transform: translateY(-6px);
    border-color: rgba(0,245,255,0.35);
    box-shadow: 0 20px 50px rgba(0,245,255,0.08);
  }

  .project-card:hover::before { opacity: 1; }

  .card-header {
    min-height: 92px;
    overflow: hidden;
  }

  .project-id-watermark {
    position: absolute;
    left: 1.25rem;
    top: 1rem;
    font-size: clamp(2.2rem, 3.2vw, 3.2rem);
    line-height: 0.9;
    opacity: 0.12;
    pointer-events: none;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: calc(100% - 2.5rem);
    color: var(--text-hi);
  }

  .sub-badge {
    color: var(--cyan);
    border: 1px solid rgba(0,245,255,0.22);
    background: rgba(0,245,255,0.06);
  }

  .company-badge {
    color: var(--magenta);
    border: 1px solid rgba(255,0,200,0.22);
    background: rgba(255,0,200,0.08);
    max-width: 140px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .project-title-link {
    text-decoration: none;
    display: block;
  }

  .project-title {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: color 0.3s;
  }

  .project-title-link:hover .project-title {
    color: var(--cyan);
    text-shadow: var(--glow-c);
  }

  .proj-link {
    color: var(--cyan);
    transition: text-shadow 0.3s;
  }
  .proj-link:hover { text-shadow: var(--glow-c); }

  .proj-link-muted { color: rgba(168,184,216,0.45); }
</style>