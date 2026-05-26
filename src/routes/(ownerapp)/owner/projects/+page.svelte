<!--
  src/routes/owner/projects/+page.svelte — Manage Projects
  ──────────────────────────────────────────────────────────
  TWO SECTIONS:

  1. GITHUB REPOS
     All repos synced from GitHub into DB. Each row shows DB-backed synced info.
     Owner can:
       - Change badge (lightweight — does NOT set manually_updated)
       - CUSTOMISE → opens slide-in panel to override title/desc/tags/demo
         (sets manually_updated=1, main site uses DB data)
       - RESET → clears overrides, next sync refreshes DB-backed GitHub data

  2. MANUAL PROJECTS
     Professional/client work with no GitHub repo.
     Full add/edit/delete. Always source='manual', group='professional'.
-->
<script>
  import { enhance } from "$app/forms";
  import { invalidate } from "$app/navigation";

  let { data, form } = $props();

  // BADGE_KEYS must stay reactive because `data` is a prop.
  // Reading Object.keys(data.badges) once in a plain const captures only
  // the initial prop value and can trigger Svelte's "state_referenced_locally"
  // warning. $derived(...) keeps the list in sync with the latest data.
  let BADGE_KEYS = $derived(Object.keys(data.badges ?? {}));

  // ── Notification scroll target ──────────────────────────────────
  // Action success / error messages render near the top of the page.
  // When the owner submits a form while scrolled further down, the action can
  // actually succeed but the message appears out of view, which feels like
  // "nothing happened".
  //
  // This anchor gives us one reliable place to scroll to whenever a fresh
  // form result arrives.
  let alertAnchor = $state(null);
  let lastAlertKey = $state("");

  // Scroll to the alert area whenever the success/error message changes.
  // requestAnimationFrame waits until the DOM has committed the new alert.
  $effect(() => {
    const nextAlertKey = [form?.success ?? "", form?.error ?? ""].join("|");

    if (!nextAlertKey || nextAlertKey === lastAlertKey) return;

    lastAlertKey = nextAlertKey;

    requestAnimationFrame(() => {
      alertAnchor?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  });

  // ── Local display copies ───────────────────────────────────────
  // These arrays are the actual source used by the template.
  //
  // WHY WE DO NOT RENDER data.githubProjects / data.manualProjects DIRECTLY:
  //   Form actions can succeed immediately, while server-loaded route data
  //   may still be one request behind for a moment.
  //
  //   If the UI renders only `data.*`, the owner experiences:
  //     "I changed it, but nothing changed until refresh."
  //
  //   So this page renders local state instead:
  //     1. optimistic patch updates the visible row instantly
  //     2. await invalidate('app:projects') re-runs the load
  //     3. when the fresh server data arrives, we sync local state to it
  //
  // IMPORTANT:
  //   The tricky bug was NOT the optimistic patch itself.
  //   The bug was that local state was being overwritten too early by the old
  //   incoming `data.*` before the fresh load completed.
  //
  //   To prevent that, we only re-sync local state when the incoming server
  //   payload actually changes signature.
  let githubProjects = $state([]);
  let manualProjects = $state([]);

  // Signature trackers for incoming route data.
  // These let us detect real server-data changes and avoid overwriting local
  // optimistic UI with stale pre-refresh props.
  let lastGithubSyncSig = $state("");
  let lastManualSyncSig = $state("");

  function githubSignature(projects) {
    return JSON.stringify(
      (projects ?? []).map((p) => [
        String(p.id),
        p.badge,
        p.title,
        p.desc,
        p.demo,
        p.manually_updated,
        p.private,
        p.stars,
        p.language,
        p.pushedAt,
        Array.isArray(p.tags) ? p.tags.join("|") : "",
      ]),
    );
  }

  function manualSignature(projects) {
    return JSON.stringify(
      (projects ?? []).map((p) => [
        String(p.id),
        p.title,
        p.slug,
        p.badge,
        p.desc,
        p.company,
        p.demo,
        Array.isArray(p.tags) ? p.tags.join("|") : "",
      ]),
    );
  }

  // Sync local arrays only when the incoming server payload actually changes.
  // This keeps optimistic UI intact until genuinely fresh route data arrives.
  $effect(() => {
    const nextGithubSig = githubSignature(data.githubProjects ?? []);
    if (nextGithubSig !== lastGithubSyncSig) {
      githubProjects = (data.githubProjects ?? []).map((project) => ({
        ...project,
      }));
      lastGithubSyncSig = nextGithubSig;
    }

    const nextManualSig = manualSignature(data.manualProjects ?? []);
    if (nextManualSig !== lastManualSyncSig) {
      manualProjects = (data.manualProjects ?? []).map((project) => ({
        ...project,
      }));
      lastManualSyncSig = nextManualSig;
    }
  });

  // Small id normaliser so local patch / delete logic behaves consistently
  // whether ids arrive as numbers or strings.
  function keyOf(id) {
    return String(id);
  }

  // Shared helper used by manual and GitHub form handling.
  // Owner-facing tag inputs are comma-separated strings, while the local
  // project objects use arrays. Converting in one place keeps patches clean.
  function parseInputTags(raw) {
    return String(raw ?? "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  // ── GitHub section state ──────────────────────────────────────
  let editingGithub = $state(null); // DB row being customised

  // Keeps the selected badge visually in sync immediately after a change.
  // Shape: { [projectId]: 'live' | 'wip' | ... }
  let optimisticGithubBadges = $state({});

  // Slide-in panel fields for GitHub customisation
  let gTitle = $state("");
  let gDesc = $state("");
  let gTags = $state("");
  let gDemo = $state("");
  let gBadge = $state("live");
  let gFormLoading = $state(false);

  function openGithubEdit(project) {
    editingGithub = project;

    // GitHub data is already synced into DB.
    // If manually_updated=false, these DB fields are the latest synced GitHub values.
    // If manually_updated=true, these DB fields are owner overrides.
    gTitle = project.title ?? "";
    gDesc = project.desc ?? "";
    gTags = Array.isArray(project.tags) ? project.tags.join(", ") : "";
    gDemo = project.demo ?? "";
    gBadge = getGithubBadge(project);
  }

  function closeGithubEdit() {
    editingGithub = null;
  }

  // Returns the badge currently shown in the UI.
  // If the owner has just changed the badge, prefer the optimistic local value
  // so the select and label update instantly. Otherwise fall back to the row.
  function getGithubBadge(project) {
    return optimisticGithubBadges[keyOf(project.id)] ?? project.badge;
  }

  // Applies a badge change to the locally rendered GitHub list immediately.
  function patchGithubProjectBadge(id, badge) {
    const target = keyOf(id);
    githubProjects = githubProjects.map((project) =>
      keyOf(project.id) === target ? { ...project, badge } : project,
    );
  }

  // Applies CUSTOMISE changes to the visible GitHub row immediately.
  // The owner should see title/description/tags/demo changes as soon as the
  // action succeeds, even before the reloaded page data arrives.
  function patchGithubProjectCustomisation(id, { title, desc, tags, demo }) {
    const target = keyOf(id);

    githubProjects = githubProjects.map((project) => {
      if (keyOf(project.id) !== target) return project;

      return {
        ...project,
        manually_updated: true,
        title: title || project.title,
        desc: desc || project.desc,
        tags: tags.length ? tags : project.tags,
        demo: demo || null,
      };
    });
  }

  // ── Manual section state ──────────────────────────────────────
  let editingManual = $state(null);
  let deletingId = $state(null); // only used for MANUAL projects
  let showManualForm = $state(false);
  let mFormLoading = $state(false);

  let mTitle = $state("");
  let mDesc = $state("");
  let mTags = $state("");
  let mBadge = $state("production");
  let mDemo = $state("");
  let mCompany = $state("");

  // Subtitle is no longer typed manually.
  // It is always derived from the title in lowercase form so the owner
  // only maintains one source of truth.
  let mSubtitle = $derived((mTitle ?? "").trim().toLowerCase());

  // Slug preview — auto-generated from subtitle or title
  let mSlugPreview = $derived.by(() => {
    const base = mSubtitle.trim() || mTitle.trim();
    return base
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  });

  function openManualAdd() {
    editingManual = null;
    mTitle = "";
    mDesc = "";
    mTags = "";
    mDemo = "";
    mCompany = "";
    mBadge = "production";
    showManualForm = true;
  }

  function openManualEdit(project) {
    editingManual = project;
    mTitle = project.title;
    mDesc = project.desc;
    mTags = project.tags.join(", ");
    mBadge = project.badge;
    mDemo = project.demo ?? "";
    mCompany = project.company ?? "";
    showManualForm = true;
  }

  function closeManualForm() {
    showManualForm = false;
    editingManual = null;
  }

  // Removes a manual project from the local rendered list immediately.
  function removeManualProject(id) {
    const target = keyOf(id);
    manualProjects = manualProjects.filter(
      (project) => keyOf(project.id) !== target,
    );
  }

  // Restores a removed manual project when a delete action fails.
  function restoreManualProject(project, originalIndex) {
    if (!project) return;

    const next = [...manualProjects];
    next.splice(originalIndex, 0, project);
    manualProjects = next;
  }

  // Applies manual project edits immediately after a successful update.
  function patchManualProject(id, nextFields) {
    const target = keyOf(id);

    manualProjects = manualProjects.map((project) =>
      keyOf(project.id) === target ? { ...project, ...nextFields } : project,
    );
  }

  // Resets a customised GitHub row back to live GitHub display immediately.
  // This mirrors what the server-side reset does:
  //   - manually_updated becomes false
  //   - overridden fields are cleared
  //   - visible card content falls back to live GitHub data
  //
  // WHY THIS HELPER EXISTS:
  //   The RESET action succeeds on the server first, but the owner should not
  //   have to wait for the next data sync to see the row visually revert.
  //   So we patch the local rendered row immediately after a successful reset.
  function patchGithubProjectReset(id) {
    const target = keyOf(id);

    githubProjects = githubProjects.map((project) => {
      if (keyOf(project.id) !== target) return project;

      return {
        ...project,
        manually_updated: false,
        title: "",
        desc: "",
        tags: [],
        demo: null,
      };
    });
  }

  // Small helper for more readable row previews.
  function previewText(value, fallback = "—") {
    const text = String(value ?? "").trim();
    return text || fallback;
  }

  function previewTags(tags) {
    return Array.isArray(tags) && tags.length ? tags.join(" · ") : "—";
  }
</script>

<svelte:head><title>Projects — Owner</title></svelte:head>

<div class="page-header" bind:this={alertAnchor}>
  <div class="section-label">OWNER.INTERFACE</div>
  <h1 class="page-title">PROJECTS</h1>
</div>

{#if form?.error}
  <div class="alert-error">{form.error}</div>
{/if}
{#if form?.success}
  <div class="alert-success">{form.success}</div>
{/if}

<!-- ══════════════════════════════════════════════════════════════
     SECTION 1 — GITHUB REPOS
     Auto-synced. Read-only fields (slug, private, group).
     Owner can change badge freely and optionally customise display.
══════════════════════════════════════════════════════════════════ -->
<section class="section">
  <div class="section-header">
    <div>
      <h2 class="section-title">GITHUB REPOS</h2>
      <p class="section-sub">
        Auto-synced from GitHub. Badge changes apply immediately. CUSTOMISE
        overrides title, description, tags and demo link.
      </p>
      <div class="section-legend">
        <span class="legend-chip">TITLE = what shows on the main site</span>
        <span class="legend-chip">SOURCE = GitHub sync source</span>
        <span class="legend-chip"
          >SYNCED DESCRIPTION / TAGS = latest DB-synced GitHub values</span
        >
        <span class="legend-chip">CUSTOMISED = owner override is active</span>
      </div>
    </div>
  </div>

  <div class="entry-list">
    {#each githubProjects as project (project.id)}
      <div class="entry-row">
        <div class="entry-info">
          <!-- Show live GitHub title unless customised -->
          <div class="entry-title">
            {project.title}
            {#if project.manually_updated}
              <span class="customised-badge">CUSTOMISED</span>
            {/if}
          </div>

          <div class="entry-meta-row">
            <span class="meta-chip"
              ><span class="meta-label">SLUG</span> /{project.slug}</span
            >
            <span class="meta-chip"
              ><span class="meta-label">GROUP</span> {project.group}</span
            >
            <span class="meta-chip"
              ><span class="meta-label">LANG</span>
              {project.language ?? "—"}</span
            >
            <span class="meta-chip"
              ><span class="meta-label">STARS</span> ★ {project.stars}</span
            >
            <span class="meta-chip"
              ><span class="meta-label">BADGE</span>
              {data.badges[getGithubBadge(project)]?.label ??
                getGithubBadge(project)}</span
            >
            <span class="meta-chip"
              ><span class="meta-label">VISIBILITY</span>
              {project.private ? "PRIVATE" : "PUBLIC"}</span
            >
          </div>

          <div class="entry-detail-grid">
            <div class="detail-block">
              <div class="detail-label">DISPLAY DESCRIPTION</div>
              <div class="detail-value">
                {previewText(project.desc)}
              </div>
            </div>

            <div class="detail-block">
              <div class="detail-label">DISPLAY TAGS</div>
              <div class="detail-value">
                {previewTags(project.tags)}
              </div>
            </div>
          </div>
        </div>

        <div class="entry-actions">
          <!-- Badge select — lightweight, no manually_updated change -->
          <form
            method="POST"
            action="?/updateBadge"
            use:enhance={({ formData, cancel }) => {
              const id = keyOf(formData.get("id") ?? project.id);
              const previousBadge = getGithubBadge(project);
              const nextBadge = String(formData.get("badge") ?? previousBadge);

              // If nothing changed, do not submit.
              if (nextBadge === previousBadge) {
                cancel();
                return;
              }

              // Optimistic UI update — visible immediately
              optimisticGithubBadges = {
                ...optimisticGithubBadges,
                [id]: nextBadge,
              };
              patchGithubProjectBadge(id, nextBadge);

              return async ({ result, update }) => {
                await update({ reset: false });
                await invalidate('app:projects');

                if (result.type !== "success") {
                  patchGithubProjectBadge(id, previousBadge);
                }

                const nextMap = { ...optimisticGithubBadges };
                delete nextMap[id];
                optimisticGithubBadges = nextMap;
              };
            }}
          >
            <input type="hidden" name="id" value={project.id} />
            <select
              name="badge"
              class="badge-select"
              value={getGithubBadge(project)}
              onchange={(e) => e.currentTarget.form.requestSubmit()}
            >
              {#each BADGE_KEYS as key}
                <option value={key} selected={getGithubBadge(project) === key}>
                  {data.badges[key].label}
                </option>
              {/each}
            </select>
          </form>

          <button class="btn-edit" onclick={() => openGithubEdit(project)}>
            CUSTOMISE
          </button>

          {#if project.manually_updated}
            <form
              method="POST"
              action="?/resetGithub"
              use:enhance={({ formData }) => {
                const targetId = keyOf(formData.get("id") ?? project.id);

                return async ({ result, update }) => {
                  await update({ reset: false });
                  await invalidate('app:projects');

                  if (result.type === "success") {
                    patchGithubProjectReset(targetId);
                  }
                };
              }}
            >
              <input type="hidden" name="id" value={project.id} />
              <button type="submit" class="btn-reset">RESET</button>
            </form>
          {/if}
        </div>
      </div>
    {:else}
      <div class="empty-state">
        No GitHub repos found. Check GITHUB_TOKEN in .env.
      </div>
    {/each}
  </div>
</section>

<!-- ══════════════════════════════════════════════════════════════
     SECTION 2 — MANUAL PROJECTS
     Professional/client work. No GitHub repo.
     Always group=professional, private=true.
══════════════════════════════════════════════════════════════════ -->
<section class="section">
  <div class="section-header">
    <div>
      <h2 class="section-title">MANUAL PROJECTS</h2>
      <p class="section-sub">
        Professional and client work with no GitHub repo. Always shown under
        PROFESSIONAL group on the main site.
      </p>
      <div class="section-legend">
        <span class="legend-chip">TITLE = main site card title</span>
        <span class="legend-chip"
          >SUBTITLE = lowercase title, auto-generated</span
        >
        <span class="legend-chip">SLUG = generated from subtitle / title</span>
        <span class="legend-chip">BADGE = project status on the main site</span>
      </div>
    </div>
    <button class="btn-add" onclick={openManualAdd}>+ ADD PROJECT</button>
  </div>

  <div class="entry-list">
    {#each manualProjects as project (project.id)}
      <div class="entry-row" class:confirming={deletingId === project.id}>
        <div class="entry-info">
          <div class="entry-title">{project.title}</div>

          <div class="entry-meta-row">
            <span class="meta-chip"
              ><span class="meta-label">SLUG</span> /{project.slug}</span
            >
            <span class="meta-chip"
              ><span class="meta-label">GROUP</span> {project.group}</span
            >
            <span class="meta-chip"
              ><span class="meta-label">BADGE</span>
              {data.badges[project.badge]?.label ?? project.badge}</span
            >
            {#if project.company}
              <span class="meta-chip"
                ><span class="meta-label">COMPANY</span> {project.company}</span
              >
            {/if}
          </div>

          <div class="entry-detail-grid">
            <div class="detail-block">
              <div class="detail-label">DESCRIPTION</div>
              <div class="detail-value">{previewText(project.desc)}</div>
            </div>

            <div class="detail-block">
              <div class="detail-label">TAGS</div>
              <div class="detail-value">{previewTags(project.tags)}</div>
            </div>
          </div>
        </div>

        <div class="entry-actions">
          {#if deletingId === project.id}
            <span class="delete-confirm-label">Delete?</span>
            <form
              method="POST"
              action="?/delete"
              use:enhance={({ formData }) => {
                const id = keyOf(formData.get("id") ?? project.id);
                const originalIndex = manualProjects.findIndex(
                  (entry) => keyOf(entry.id) === id,
                );
                const removedProject =
                  originalIndex >= 0 ? manualProjects[originalIndex] : null;

                removeManualProject(id);

                return async ({ result, update }) => {
                  await update({ reset: false });
                  await invalidate('app:projects');

                  if (result.type !== "success") {
                    restoreManualProject(removedProject, originalIndex);
                  }

                  deletingId = null;
                };
              }}
            >
              <input type="hidden" name="id" value={project.id} />
              <button type="submit" class="btn-confirm-delete">YES</button>
            </form>
            <button
              type="button"
              class="btn-cancel-delete"
              onclick={() => (deletingId = null)}
            >
              NO
            </button>
          {:else}
            <button class="btn-edit" onclick={() => openManualEdit(project)}
              >EDIT</button
            >
            <button
              type="button"
              class="btn-delete"
              onclick={() => (deletingId = project.id)}
            >
              DELETE
            </button>
          {/if}
        </div>
      </div>
    {:else}
      <div class="empty-state">
        No manual projects yet. Add professional work here.
      </div>
    {/each}
  </div>
</section>

<!-- ── GitHub Customise Panel ─────────────────────────────────────── -->
{#if editingGithub}
  <div
    class="form-overlay"
    role="presentation"
    onclick={(e) => {
      if (e.target === e.currentTarget) closeGithubEdit();
    }}
    onkeydown={(e) => {
      if (e.key === "Escape") closeGithubEdit();
    }}
  >
    <div class="form-panel">
      <div class="form-header">
        <h2 class="form-title">CUSTOMISE: {editingGithub.title}</h2>
        <button class="form-close" onclick={closeGithubEdit}>✕</button>
      </div>
      <p class="panel-note">
        Overrides what the main site shows for this repo. RESET removes all
        overrides and restores live GitHub data.
      </p>

      <form
        method="POST"
        action="?/updateGithub"
        use:enhance={({ formData }) => {
          gFormLoading = true;

          const targetId = keyOf(formData.get("id") ?? editingGithub?.id);
          const nextTitle = String(formData.get("title") ?? "").trim();
          const nextDesc = String(formData.get("desc") ?? "").trim();
          const nextTags = parseInputTags(formData.get("tags"));
          const nextDemo = String(formData.get("demo") ?? "").trim();

          return async ({ result, update }) => {
            await update({ reset: false });
            await invalidate('app:projects');

            gFormLoading = false;

            if (result.type === "success") {
              patchGithubProjectCustomisation(targetId, {
                title: nextTitle,
                desc: nextDesc,
                tags: nextTags,
                demo: nextDemo,
              });

              closeGithubEdit();
            }
          };
        }}
      >
        <input type="hidden" name="id" value={editingGithub.id} />

        <div class="field">
          <label class="field-label" for="g-title">TITLE</label>
          <input
            id="g-title"
            class="field-input"
            name="title"
            bind:value={gTitle}
            placeholder={editingGithub.title}
          />
          <div class="field-hint">Leave blank to use GitHub repo name.</div>
        </div>

        <div class="field">
          <label class="field-label" for="g-desc">DESCRIPTION</label>
          <textarea
            id="g-desc"
            class="field-textarea"
            name="desc"
            bind:value={gDesc}
            rows="4"
            placeholder={editingGithub.desc || "Add a description..."}
          ></textarea>
        </div>

        <div class="field">
          <label class="field-label" for="g-tags">TAGS</label>
          <input
            id="g-tags"
            class="field-input"
            name="tags"
            bind:value={gTags}
            placeholder={editingGithub.tags.join(", ")}
          />
          <div class="field-hint">
            Comma-separated. Overrides GitHub topics + language.
          </div>
        </div>

        <div class="field">
          <label class="field-label" for="g-demo">DEMO URL</label>
          <input
            id="g-demo"
            class="field-input"
            name="demo"
            bind:value={gDemo}
            placeholder="https://..."
          />
        </div>

        <div class="form-actions">
          <button type="button" class="btn-cancel" onclick={closeGithubEdit}
            >CANCEL</button
          >
          <button type="submit" class="btn-save" disabled={gFormLoading}>
            {gFormLoading ? "SAVING..." : "SAVE OVERRIDES"}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- ── Manual Project Panel ───────────────────────────────────────── -->
{#if showManualForm}
  <div
    class="form-overlay"
    role="presentation"
    onclick={(e) => {
      if (e.target === e.currentTarget) closeManualForm();
    }}
    onkeydown={(e) => {
      if (e.key === "Escape") closeManualForm();
    }}
  >
    <div class="form-panel">
      <div class="form-header">
        <h2 class="form-title">
          {editingManual ? "EDIT PROJECT" : "ADD PROJECT"}
        </h2>
        <button class="form-close" onclick={closeManualForm}>✕</button>
      </div>

      <form
        method="POST"
        action={editingManual ? "?/updateManual" : "?/createManual"}
        use:enhance={({ formData }) => {
          mFormLoading = true;

          const targetId = keyOf(formData.get("id") ?? editingManual?.id ?? "");
          const nextTitle = String(formData.get("title") ?? "").trim();
          const nextSubtitle = String(formData.get("subtitle") ?? "").trim();
          const nextDesc = String(formData.get("desc") ?? "").trim();
          const nextTags = parseInputTags(formData.get("tags"));
          const nextBadge = String(
            formData.get("badge") ?? "production",
          ).trim();
          const nextDemo = String(formData.get("demo") ?? "").trim();
          const nextCompany = String(formData.get("company") ?? "").trim();
          const nextSlug = (nextSubtitle || nextTitle)
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, "")
            .replace(/\s+/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "");

          return async ({ result, update }) => {
            await update({ reset: false });
            await invalidate('app:projects');

            mFormLoading = false;

            if (result.type === "success" && editingManual) {
              patchManualProject(targetId, {
                title: nextTitle,
                subtitle: nextSubtitle || null,
                slug: nextSlug,
                desc: nextDesc,
                tags: nextTags,
                badge: nextBadge,
                demo: nextDemo || null,
                company: nextCompany || null,
              });
            }

            if (result.type === "success") {
              closeManualForm();
            }
          };
        }}
      >
        {#if editingManual}
          <input type="hidden" name="id" value={editingManual.id} />
        {/if}

        <div class="form-grid">
          <div class="field">
            <label class="field-label" for="m-title">TITLE</label>
            <input
              id="m-title"
              class="field-input"
              name="title"
              bind:value={mTitle}
              placeholder="SECURE TRACK"
              required
            />
          </div>
          <div class="field">
            <label class="field-label" for="m-subtitle">SUBTITLE</label>
            <input
              id="m-subtitle"
              class="field-input field-input-readonly"
              name="subtitle"
              value={mSubtitle}
              readonly
              tabindex="-1"
            />
            <div class="field-hint">
              Auto-generated as the lowercase version of the title.
            </div>
          </div>
        </div>

        <div class="field">
          <p class="field-label slug-label">
            SLUG <span class="slug-note"
              >— auto-generated from subtitle or title</span
            >
          </p>
          <div class="slug-preview">{mSlugPreview || "—"}</div>
        </div>

        <div class="form-grid">
          <div class="field">
            <label class="field-label" for="m-badge">BADGE</label>
            <select
              id="m-badge"
              class="field-input field-select"
              name="badge"
              bind:value={mBadge}
            >
              {#each BADGE_KEYS as key}
                <option value={key}>{data.badges[key].label}</option>
              {/each}
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="m-company">COMPANY</label>
            <input
              id="m-company"
              class="field-input"
              name="company"
              bind:value={mCompany}
              placeholder="Ratio Solutions"
            />
          </div>
        </div>

        <div class="field">
          <label class="field-label" for="m-desc">DESCRIPTION</label>
          <textarea
            id="m-desc"
            class="field-textarea"
            name="desc"
            bind:value={mDesc}
            rows="4"
            required
            placeholder="Project description..."
          ></textarea>
        </div>

        <div class="field">
          <label class="field-label" for="m-tags">TAGS</label>
          <input
            id="m-tags"
            class="field-input"
            name="tags"
            bind:value={mTags}
            placeholder="ASP.NET Core, Angular, Docker"
          />
          <div class="field-hint">Comma-separated.</div>
        </div>

        <div class="field">
          <label class="field-label" for="m-demo">DEMO URL</label>
          <input
            id="m-demo"
            class="field-input"
            name="demo"
            bind:value={mDemo}
            placeholder="https://..."
          />
        </div>

        <div class="form-actions">
          <button type="button" class="btn-cancel" onclick={closeManualForm}
            >CANCEL</button
          >
          <button type="submit" class="btn-save" disabled={mFormLoading}>
            {mFormLoading ? "SAVING..." : editingManual ? "UPDATE" : "CREATE"}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  .page-header {
    margin-bottom: 2rem;
  }
  .page-title {
    font-family: "Orbitron", monospace;
    font-size: clamp(1.2rem, 3vw, 1.5rem);
    font-weight: 900;
    color: var(--text-hi);
    margin: 0.4rem 0;
  }

  .alert-error {
    background: rgba(255, 0, 120, 0.08);
    border: 1px solid rgba(255, 0, 120, 0.3);
    color: var(--magenta);
    padding: 0.75rem 1rem;
    margin-bottom: 1.5rem;
    font-size: 0.78rem;
  }
  .alert-success {
    background: rgba(0, 255, 136, 0.08);
    border: 1px solid rgba(0, 255, 136, 0.3);
    color: var(--green);
    padding: 0.75rem 1rem;
    margin-bottom: 1.5rem;
    font-size: 0.78rem;
  }

  .section {
    margin-bottom: 2.5rem;
  }
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1rem;
    gap: 1rem;
    flex-wrap: wrap;
  }
  .section-title {
    font-family: "Orbitron", monospace;
    font-size: 0.9rem;
    font-weight: 700;
    color: var(--text-hi);
    margin: 0 0 0.25rem;
  }
  .section-sub {
    font-size: 0.68rem;
    color: rgba(168, 184, 216, 0.4);
    margin: 0;
    line-height: 1.55;
  }

  .section-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
    margin-top: 0.75rem;
  }

  .legend-chip {
    font-size: 0.56rem;
    letter-spacing: 0.08em;
    padding: 0.22rem 0.45rem;
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: rgba(168, 184, 216, 0.5);
    background: rgba(255, 255, 255, 0.02);
  }

  .btn-add {
    font-family: inherit;
    font-size: 0.68rem;
    letter-spacing: 0.14em;
    padding: 0.5rem 1rem;
    border: 1px solid var(--cyan);
    color: var(--cyan);
    background: transparent;
    cursor: pointer;
    white-space: nowrap;
    min-height: 40px;
  }

  .entry-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .entry-row {
    border: 1px solid rgba(255, 255, 255, 0.08);
    padding: 0.95rem 1.1rem;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    background: rgba(6, 12, 26, 0.6);
    flex-wrap: wrap;
    transition: border-color 0.2s;
  }
  .entry-row.confirming {
    border-color: rgba(255, 0, 120, 0.3);
    background: rgba(255, 0, 120, 0.03);
  }

  .entry-info {
    flex: 1;
    min-width: 0;
  }
  .entry-title {
    font-size: 0.85rem;
    color: var(--text-hi);
    margin-bottom: 0.45rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .entry-meta-row {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    flex-wrap: wrap;
    margin-bottom: 0.75rem;
  }

  .meta-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.22rem 0.45rem;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.02);
    font-size: 0.6rem;
    color: rgba(168, 184, 216, 0.55);
    letter-spacing: 0.04em;
  }

  .meta-label {
    color: var(--cyan);
    font-size: 0.52rem;
    letter-spacing: 0.12em;
  }

  .entry-detail-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }

  .detail-block {
    border: 1px solid rgba(255, 255, 255, 0.06);
    background: rgba(255, 255, 255, 0.02);
    padding: 0.6rem 0.7rem;
  }

  .detail-label {
    font-size: 0.54rem;
    letter-spacing: 0.14em;
    color: var(--cyan);
    margin-bottom: 0.35rem;
  }

  .detail-value {
    font-size: 0.66rem;
    line-height: 1.55;
    color: rgba(168, 184, 216, 0.62);
    word-break: break-word;
  }

  .customised-badge {
    font-size: 0.5rem;
    letter-spacing: 0.1em;
    padding: 0.1rem 0.4rem;
    border: 1px solid rgba(0, 245, 255, 0.3);
    color: var(--cyan);
    background: rgba(0, 245, 255, 0.06);
  }

  .entry-actions {
    display: flex;
    gap: 0.4rem;
    flex-shrink: 0;
    align-items: center;
    flex-wrap: wrap;
  }

  .badge-select {
    font-family: inherit;
    font-size: 0.62rem;
    letter-spacing: 0.08em;
    padding: 0.3rem 1.6rem 0.3rem 0.5rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: var(--text-hi);
    cursor: pointer;
    appearance: none;
    -webkit-appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2300f5ff' stroke-width='1.5' fill='none'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 0.5rem center;
    min-height: 30px;
  }
  .badge-select option {
    background: #080f1e;
  }

  .btn-edit {
    font-family: inherit;
    font-size: 0.62rem;
    letter-spacing: 0.12em;
    padding: 0.3rem 0.65rem;
    border: 1px solid rgba(0, 245, 255, 0.3);
    color: var(--cyan);
    background: transparent;
    cursor: pointer;
    min-height: 30px;
  }
  .btn-reset {
    font-family: inherit;
    font-size: 0.62rem;
    letter-spacing: 0.1em;
    padding: 0.3rem 0.65rem;
    border: 1px solid rgba(168, 184, 216, 0.2);
    color: rgba(168, 184, 216, 0.5);
    background: transparent;
    cursor: pointer;
    min-height: 30px;
  }
  .btn-delete {
    font-family: inherit;
    font-size: 0.62rem;
    letter-spacing: 0.1em;
    padding: 0.3rem 0.65rem;
    border: 1px solid rgba(255, 0, 120, 0.25);
    color: rgba(255, 0, 120, 0.5);
    background: transparent;
    cursor: pointer;
    min-height: 30px;
    transition: all 0.2s;
  }
  .btn-delete:hover {
    color: var(--magenta);
    border-color: var(--magenta);
  }
  .delete-confirm-label {
    font-size: 0.65rem;
    color: var(--magenta);
    letter-spacing: 0.08em;
  }
  .btn-confirm-delete {
    font-family: inherit;
    font-size: 0.62rem;
    letter-spacing: 0.1em;
    padding: 0.3rem 0.6rem;
    border: 1px solid var(--magenta);
    color: var(--magenta);
    background: rgba(255, 0, 120, 0.08);
    cursor: pointer;
    min-height: 30px;
  }
  .btn-cancel-delete {
    font-family: inherit;
    font-size: 0.62rem;
    letter-spacing: 0.1em;
    padding: 0.3rem 0.6rem;
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: rgba(168, 184, 216, 0.5);
    background: transparent;
    cursor: pointer;
    min-height: 30px;
  }

  .empty-state {
    color: rgba(168, 184, 216, 0.3);
    font-size: 0.75rem;
    padding: 1.5rem;
    text-align: center;
    border: 1px dashed rgba(255, 255, 255, 0.05);
  }

  .form-overlay {
    position: fixed;
    inset: 0;
    background: rgba(2, 4, 10, 0.85);
    z-index: 100;
    display: flex;
    align-items: flex-start;
    justify-content: flex-end;
    overflow-y: auto;
  }
  .form-panel {
    width: min(560px, 100vw);
    min-height: 100vh;
    background: #080f1e;
    border-left: 1px solid rgba(0, 245, 255, 0.15);
    padding: 2rem;
    box-sizing: border-box;
  }
  .form-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 0.75rem;
    gap: 1rem;
  }
  .form-title {
    font-family: "Orbitron", monospace;
    font-size: 0.95rem;
    color: var(--text-hi);
    margin: 0;
  }
  .form-close {
    background: none;
    border: none;
    color: rgba(168, 184, 216, 0.5);
    font-size: 1rem;
    cursor: pointer;
    min-width: 36px;
    min-height: 36px;
    flex-shrink: 0;
  }
  .panel-note {
    font-size: 0.68rem;
    color: rgba(168, 184, 216, 0.4);
    margin: 0 0 1.25rem;
    line-height: 1.5;
  }

  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-bottom: 0.25rem;
  }

  .field {
    margin-bottom: 1rem;
  }
  .field-label {
    display: block;
    font-size: 0.62rem;
    letter-spacing: 0.15em;
    color: var(--cyan);
    margin-bottom: 0.4rem;
  }
  .field-hint {
    font-size: 0.6rem;
    color: rgba(168, 184, 216, 0.35);
    margin-top: 0.3rem;
  }
  .slug-label {
    margin: 0;
  }
  .slug-note {
    font-size: 0.56rem;
    color: rgba(168, 184, 216, 0.3);
    letter-spacing: 0.06em;
    margin-left: 0.4rem;
    text-transform: none;
    font-weight: normal;
  }

  .field-input,
  .field-textarea {
    width: 100%;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: var(--text-hi);
    font-family: "Share Tech Mono", monospace;
    font-size: 0.8rem;
    padding: 0.6rem 0.8rem;
    outline: none;
    transition: border-color 0.2s;
    box-sizing: border-box;
    min-height: 40px;
  }
  .field-input:focus,
  .field-textarea:focus {
    border-color: var(--cyan);
  }
  .field-input-readonly {
    color: rgba(168, 184, 216, 0.55);
    background: rgba(255, 255, 255, 0.015);
    cursor: default;
  }
  .field-textarea {
    resize: vertical;
    min-height: auto;
  }

  .field-select {
    appearance: none;
    -webkit-appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2300f5ff' stroke-width='1.5' fill='none'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 0.8rem center;
    padding-right: 2.2rem;
    cursor: pointer;
  }
  .field-select option {
    background: #080f1e;
    color: var(--text-hi);
  }

  .slug-preview {
    width: 100%;
    background: rgba(255, 255, 255, 0.01);
    border: 1px solid rgba(255, 255, 255, 0.05);
    color: rgba(168, 184, 216, 0.4);
    font-family: "Share Tech Mono", monospace;
    font-size: 0.8rem;
    padding: 0.6rem 0.8rem;
    box-sizing: border-box;
    min-height: 40px;
    display: flex;
    align-items: center;
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }
  .btn-cancel {
    font-family: inherit;
    font-size: 0.68rem;
    letter-spacing: 0.12em;
    padding: 0.6rem 1.2rem;
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: rgba(168, 184, 216, 0.5);
    background: transparent;
    cursor: pointer;
  }
  .btn-save {
    font-family: inherit;
    font-size: 0.68rem;
    letter-spacing: 0.12em;
    padding: 0.6rem 1.5rem;
    border: 1px solid var(--cyan);
    color: var(--cyan);
    background: rgba(0, 245, 255, 0.06);
    cursor: pointer;
  }
  .btn-save:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  @media (max-width: 760px) {
    .entry-detail-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 640px) {
    .section-header {
      flex-direction: column;
    }
    .form-grid {
      grid-template-columns: 1fr;
    }
    .form-panel {
      padding: 1.25rem;
    }
    .entry-row {
      padding: 0.75rem;
    }
    .entry-actions {
      width: 100%;
      justify-content: flex-end;
      margin-top: 0.5rem;
    }
  }
</style>
