<!--
  src/routes/owner/+page.svelte — Owner Dashboard
  ─────────────────────────────────────────────────
  Three stat cards, each a direct link to its management section.
  No quick actions — cards are the navigation.
  No VIEW SITE — already in the sidebar layout.

  ANALYTICS:
    Dashboard also shows privacy-friendly visitor analytics:
      - people visited     → unique anonymous visitors
      - people today       → unique visitors whose first visit was today
      - views              → total public page views
      - views today        → public page views today
      - top pages
      - recent unique visitors

    These values come from src/lib/server/queries/analytics.js.
    Raw IP addresses are NOT stored. Visitors are counted using hashed
    visitor identifiers.
-->
<script>
  import { onMount, onDestroy } from "svelte";
  import { invalidate } from "$app/navigation";

  let { data } = $props();

  let experienceCount = $derived(data.experienceCount);
  let skillsCount = $derived(data.skillsCount);
  let projectsCount = $derived(data.projectsCount);

  // ── Analytics Data ──────────────────────────────────────────────
  // Safe fallback keeps the dashboard from crashing if analytics data
  // is temporarily unavailable during early setup or DB changes.
  let analytics = $derived(
    data.analytics ?? {
      totalUniqueVisitors: 0,
      uniqueToday: 0,
      totalPageviews: 0,
      pageviewsToday: 0,
      topPages: [],
      recentVisits: [],
    },
  );

  // ── Live Analytics Refresh ──────────────────────────────────────
  // Owner dashboard can stay open while the public site receives visits.
  //
  // Flow:
  //   public page visit
  //     → hooks.server.js tracks analytics
  //     → analytics query publishes "analytics-updated"
  //     → this page receives the SSE event
  //     → invalidate('app:analytics') re-runs owner dashboard load()
  //
  // EventSource is browser-only, so it must run inside onMount().
  let syncSource;

  onMount(() => {
    syncSource = new EventSource("/api/sync");

    syncSource.addEventListener("sync", async (event) => {
      let payload;

      try {
        payload = JSON.parse(event.data);
      } catch {
        return;
      }

      if (payload?.type === "analytics-updated") {
        await invalidate("app:analytics");
      }
    });

    syncSource.onerror = () => {
      // EventSource reconnects automatically.
      // No manual retry logic needed here.
    };
  });

  onDestroy(() => {
    syncSource?.close();
  });

  // Formats Unix seconds into a compact local date/time string.
  function formatVisitTime(seconds) {
    if (!seconds) return "—";

    return new Date(seconds * 1000).toLocaleString(undefined, {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // Shows location cleanly.
  // Local dev normally appears as Local / Local Network.
  function formatLocation(visit) {
    const country = visit.country ?? "";
    const city = visit.city ?? "";

    if (city && country) return `${city}, ${country}`;
    if (country) return country;
    if (city) return city;

    return "Unknown location";
  }
</script>

<svelte:head>
  <title>Owner Dashboard</title>
</svelte:head>

<div class="page-header">
  <div class="section-label">OWNER.INTERFACE</div>
  <h1 class="page-title">DASHBOARD</h1>
  <p class="page-sub">Portfolio data overview. Select a section to manage.</p>
</div>

<div class="stat-grid">
  <a href="/owner/experience" class="stat-card">
    <div class="stat-count neon-c">{experienceCount}</div>
    <div class="stat-label">EXPERIENCE</div>
  </a>
  <a href="/owner/skills" class="stat-card">
    <div class="stat-count neon-g">{skillsCount}</div>
    <div class="stat-label">SKILLS</div>
  </a>
  <a href="/owner/projects" class="stat-card">
    <div class="stat-count neon-m">{projectsCount}</div>
    <div class="stat-label">PROJECTS</div>
  </a>
</div>

<!-- ── Visitor Analytics Summary ─────────────────────────────────── -->
<section class="analytics-section">
  <div class="section-row">
    <div>
      <h2 class="section-title">VISITOR ANALYTICS</h2>
      <p class="section-sub">
        People visited = unique visitors. Views = every public page load.
      </p>
    </div>
  </div>

  <div class="analytics-grid">
    <div class="analytics-card">
      <div class="analytics-count neon-c">{analytics.totalUniqueVisitors}</div>
      <div class="analytics-label">PEOPLE VISITED</div>
    </div>

    <div class="analytics-card">
      <div class="analytics-count neon-g">{analytics.uniqueToday}</div>
      <div class="analytics-label">PEOPLE TODAY</div>
    </div>

    <div class="analytics-card">
      <div class="analytics-count neon-m">{analytics.totalPageviews}</div>
      <div class="analytics-label">VIEWS</div>
    </div>

    <div class="analytics-card">
      <div class="analytics-count neon-c">{analytics.pageviewsToday}</div>
      <div class="analytics-label">VIEWS TODAY</div>
    </div>
  </div>
</section>

<!-- ── Top Pages + Recent Visitors ───────────────────────────────── -->
<section class="analytics-panels">
  <div class="panel-card">
    <h3 class="panel-title">TOP PAGES</h3>

    {#if analytics.topPages.length}
      <div class="mini-list">
        {#each analytics.topPages as page}
          <div class="mini-row">
            <span class="mini-main">{page.path}</span>
            <span class="mini-count">{page.views} views</span>
          </div>
        {/each}
      </div>
    {:else}
      <div class="empty-state">No pageviews yet.</div>
    {/if}
  </div>

  <div class="panel-card">
    <h3 class="panel-title">RECENT UNIQUE VISITORS</h3>

    {#if analytics.recentVisits.length}
      <div class="mini-list">
        {#each analytics.recentVisits as visit}
          <div class="mini-row stacked">
            <div class="mini-text">
              <span class="mini-main">{visit.path}</span>
              <span class="mini-meta">
                {formatLocation(visit)} · {visit.pageviews} views
              </span>
            </div>
            <span class="mini-count">{formatVisitTime(visit.lastSeen)}</span>
          </div>
        {/each}
      </div>
    {:else}
      <div class="empty-state">No visitors yet.</div>
    {/if}
  </div>
</section>

<style>
  .page-header {
    margin-bottom: 2rem;
  }
  .page-title {
    font-family: "Orbitron", monospace;
    font-size: clamp(1.3rem, 4vw, 1.8rem);
    font-weight: 900;
    color: var(--text-hi);
    margin: 0.5rem 0 0.4rem;
  }
  .page-sub {
    font-size: 0.78rem;
    color: rgba(168, 184, 216, 0.5);
  }

  .stat-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
  }

  .stat-card {
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(6, 12, 26, 0.7);
    padding: 1.5rem;
    text-decoration: none;
    display: block;
    transition: all 0.2s;
  }
  .stat-card:hover {
    border-color: rgba(0, 245, 255, 0.3);
    background: rgba(0, 245, 255, 0.03);
    transform: translateY(-1px);
  }

  .stat-count {
    font-family: "Orbitron", monospace;
    font-size: 2.5rem;
    font-weight: 900;
    line-height: 1;
    margin-bottom: 0.5rem;
  }
  .stat-label {
    font-size: 0.65rem;
    letter-spacing: 0.15em;
    color: rgba(168, 184, 216, 0.5);
  }

  .analytics-section {
    margin-top: 2.5rem;
  }

  .section-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .section-title {
    font-family: "Orbitron", monospace;
    font-size: 0.9rem;
    color: var(--text-hi);
    margin: 0 0 0.25rem;
  }

  .section-sub {
    font-size: 0.72rem;
    color: rgba(168, 184, 216, 0.45);
    margin: 0;
  }

  .analytics-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.85rem;
  }

  .analytics-card {
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(6, 12, 26, 0.7);
    padding: 1rem;
  }

  .analytics-count {
    font-family: "Orbitron", monospace;
    font-size: 1.8rem;
    font-weight: 900;
    line-height: 1;
    margin-bottom: 0.45rem;
  }

  .analytics-label {
    font-size: 0.58rem;
    letter-spacing: 0.15em;
    color: rgba(168, 184, 216, 0.5);
  }

  .analytics-panels {
    display: grid;
    grid-template-columns: 1fr 1.35fr;
    gap: 1rem;
    margin-top: 1rem;
  }

  .panel-card {
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(6, 12, 26, 0.7);
    padding: 1rem;
    min-width: 0;
  }

  .panel-title {
    font-family: "Orbitron", monospace;
    font-size: 0.75rem;
    letter-spacing: 0.12em;
    color: var(--cyan);
    margin: 0 0 0.9rem;
  }

  .mini-list {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
  }

  .mini-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    padding-top: 0.55rem;
    min-width: 0;
  }

  .mini-row:first-child {
    border-top: none;
    padding-top: 0;
  }

  .mini-row.stacked {
    align-items: flex-start;
  }

  .mini-text {
    min-width: 0;
  }

  .mini-main {
    display: block;
    font-family: "Share Tech Mono", monospace;
    font-size: 0.72rem;
    color: rgba(224, 234, 255, 0.82);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mini-meta {
    display: block;
    margin-top: 0.18rem;
    font-size: 0.62rem;
    color: rgba(168, 184, 216, 0.38);
  }

  .mini-count {
    flex-shrink: 0;
    font-family: "Share Tech Mono", monospace;
    font-size: 0.68rem;
    color: var(--magenta);
    white-space: nowrap;
  }

  .empty-state {
    color: rgba(168, 184, 216, 0.35);
    font-size: 0.72rem;
    border: 1px dashed rgba(255, 255, 255, 0.06);
    padding: 1rem;
    text-align: center;
  }

  @media (max-width: 900px) {
    .analytics-grid {
      grid-template-columns: repeat(2, 1fr);
    }

    .analytics-panels {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 640px) {
    .stat-grid {
      grid-template-columns: 1fr;
    }

    .stat-card {
      display: flex;
      align-items: center;
      gap: 1.25rem;
      padding: 1rem 1.25rem;
    }
    .stat-card:hover {
      transform: none;
    }

    .stat-count {
      font-size: 2rem;
      margin-bottom: 0;
      flex-shrink: 0;
      min-width: 3rem;
    }

    .analytics-grid {
      grid-template-columns: 1fr;
    }
  }
</style>