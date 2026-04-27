<script>
  // ── /projects — All Projects Page ────────────────────────────────
  // Shows all projects grouped by personal / professional.
  // Each card links to /projects/[slug] for full detail.
  import ProjectCard  from '$lib/components/ProjectCard.svelte';
  import { SITE_NAME } from '$lib/config';
  import { mergedProjectsStore, groups, badges, getByGroup } from '$lib/data/projects.js';

  const projects = $derived($mergedProjectsStore);
</script>


<svelte:head>
  <title>Projects // {SITE_NAME}</title>
  <meta name="description" content="All projects — personal, open source, and professional work by Vikram Karra." />
</svelte:head>


<!-- Back to home nav -->
<div class="max-w-6xl mx-auto px-8 pt-32 pb-4">
  <a
    href="/#projects"
    class="font-mono text-[0.7rem] tracking-widest uppercase text-text-dim hover:text-cyan transition-colors flex items-center gap-2"
  >
    ← BACK TO PORTFOLIO
  </a>
</div>


<main class="max-w-6xl mx-auto px-8 pb-24">

  <!-- Page heading -->
  <div class="mb-16">
    <div class="section-label mb-3">PROJECTS.SYS</div>
    <h1 class="font-display font-bold text-text-hi mb-4" style="font-size: clamp(2rem, 5vw, 3.5rem);">
      ALL <span class="neon-m">PROJECTS</span>
    </h1>
    <p class="text-text-dim font-mono text-[0.82rem]">
      {projects.length} total projects - personal, open source, and professional work.
    </p>
  </div>


  <!-- ── Grouped Sections ───────────────────────────────────────────
    Render each group as its own labeled section.
    Groups come from projects.json groups array — order is preserved.
  ──────────────────────────────────────────────────────────────── -->
  {#each groups as group}
    {@const groupProjects = getByGroup(projects, group.id)}
    {#if groupProjects.length}

      <section class="mb-20">
        <!-- Group heading -->
        <div class="flex items-end gap-4 mb-2">
          <h2 class="font-display font-bold text-text-hi text-xl">{group.label}</h2>
          <span class="font-mono text-[0.7rem] text-text-dim mb-0.5">
            {groupProjects.length} {groupProjects.length === 1 ? 'project' : 'projects'}
          </span>
        </div>
        <p class="text-text-dim font-mono text-[0.75rem] mb-8">{group.desc}</p>

        <!-- Project cards grid -->
        <div class="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
          {#each groupProjects as project}
            <ProjectCard {project} {groups} {badges} />
          {/each}
        </div>
      </section>

    {/if}
  {/each}

</main>


<style>
  :global(body) { background: var(--bg); }
</style>