<script>
  // ── Imports ───────────────────────────────────────────────────────
  import { reveal } from '$lib/actions/reveal.js';
  import ProjectCard from '$lib/components/ProjectCard.svelte';
  import { groups, badges, mergedProjectsStore } from '$lib/data/projects.js';

  // ── Projects ──────────────────────────────────────────────────────
  // Subscribe to the live merged projects store instead of taking a
  // one-time snapshot. This keeps the UI in sync after refresh and
  // whenever the root layout repopulates the source stores.
  let projects = $derived($mergedProjectsStore);

  // Homepage shows first 3 projects from the merged array.
  // Control what appears here by reordering the upstream merged priority.
  let featured = $derived(projects.slice(0, 3));
</script>


<section id="projects" class="section-pad bg-bg">
  <div class="max-w-6xl mx-auto px-8">

    <div use:reveal class="section-label">PROJECTS.SYS</div>
    <h2
      use:reveal={{ delay: 100 }}
      class="font-display font-bold text-text-hi mb-4"
      style="font-size: clamp(1.8rem, 4vw, 2.8rem);"
    >
      FEATURED <span class="neon-m">WORK</span>
    </h2>

    <!-- Project count — shows how many are featured vs total -->
    <div use:reveal={{ delay: 150 }} class="mb-12">
      <p class="text-text-dim font-mono text-[0.78rem] tracking-wide">
        {featured.length} of {projects.length} projects
      </p>
    </div>

    <!-- Featured project cards — 3 column grid on large screens -->
    <div class="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
      {#each featured as project, i}
        <div use:reveal={{ delay: i * 80 }}>
          <ProjectCard {project} {groups} {badges} />
        </div>
      {/each}
    </div>

    <!-- Single View All button at bottom -->
    <div use:reveal={{ delay: 300 }} class="mt-12 text-center">
      <a href="/projects" class="btn-outline btn-angled inline-flex items-center gap-3">
        VIEW ALL PROJECTS
        <svg viewBox="0 0 16 16" width="13" fill="currentColor">
          <path d="M2 2h5v2H4v8h8V9h2v5H2V2zm7 0h5v5h-2V4.414L7.707 9.707 6.293 8.293 11.586 3H9V1z"/>
        </svg>
      </a>
    </div>

  </div>
</section>


<style>
  .section-pad { padding: 100px 0; }
</style>