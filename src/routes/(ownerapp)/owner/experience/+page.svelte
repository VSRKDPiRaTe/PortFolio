<!--
  src/routes/owner/experience/+page.svelte — Manage Experience
  ─────────────────────────────────────────────────────────────
  SLUG ON EDIT:
    Slug auto-generates from company on both CREATE and EDIT.
    On EDIT, the form sends hidden field old_id (original DB key)
    + new id (updated slug). The server does:
      UPDATE experience SET id=new_id, ... WHERE id=old_id
    SQLite allows updating primary key values — no schema change needed.
    If company name changes, slug changes. That's the correct UX.

  BULLETS TEXTAREA:
    Single textarea. Pasting text with bullet prefixes (•, -, *, etc.)
    auto-normalises them to our "• " format. Enter adds a new bullet line.
    On submit the "• " prefix is stripped and stored as a clean string array.
-->
<script>
  import { enhance } from "$app/forms";
  import {
    generateExperienceDesc,
    extractExperienceTags
  } from '$lib/ownerapp/api/client.js';

  let { data, form } = $props();

  let editing = $state(null);
  let showForm = $state(false);
  let aiLoading = $state("");
  let formLoading = $state(false);

  // Form fields
  let fOldId = $state(""); // original slug — used as WHERE clause on update
  let fId = $state(""); // current slug  — auto-generated from company
  let fRole = $state("");
  let fCompany = $state("");
  let fLocation = $state("");
  let fStartDate = $state("");
  let fEndDate = $state("");
  let fCurrent = $state(false);
  let fBulletsRaw = $state("• "); // textarea content — each line prefixed with "• "
  let fDesc = $state("");
  let fTags = $state("");

  // ── Slug auto-generation ──────────────────────────────────────
  // Updates whenever company changes — both on CREATE and EDIT.
  // On EDIT, fOldId holds the original slug for the WHERE clause.
  // Allowed: a-z, 0-9, hyphens. Everything else stripped.
  function toSlug(str) {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "") // keep alphanumeric, spaces, hyphens
      .replace(/\s+/g, "-") // spaces → hyphens
      .replace(/-+/g, "-") // collapse multiple hyphens
      .replace(/^-|-$/g, ""); // trim leading/trailing hyphens
  }

  // $effect re-runs whenever fCompany changes
  $effect(() => {
    fId = toSlug(fCompany);
  });

  // ── Date format helpers ───────────────────────────────────────
  // Restricts input to YYYY-MM. Auto-inserts "-" after 4th digit.
  function handleDateInput(e, setter) {
    let v = e.target.value.replace(/\D/g, ""); // digits only
    if (v.length > 6) v = v.slice(0, 6);
    if (v.length > 4) v = v.slice(0, 4) + "-" + v.slice(4);
    setter(v);
    // Update the input value directly so cursor stays correct
    e.target.value = v;
  }

  // ── Bullet textarea helpers ───────────────────────────────────
  // The textarea shows "• " at the start of each line.
  // On Enter: inserts a new "• " prefixed line.
  // On Paste: detects common bullet prefixes and normalises them.
  // On Submit: strips "• " prefix before sending to server.

  // Bullet prefixes to detect and strip on paste:
  // •  ‣  ◦  ▸  ▶  -  *  · (and numbered lists 1. 2. etc.)
  const BULLET_RE =
    /^[\s\u2022\u2023\u25E6\u25B8\u25BA\-\*\·]+ ?(\d+[\.\)]?\s*)?/;

  function handleBulletKeydown(e) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const el = e.target;
    const pos = el.selectionStart;
    const val = el.value;
    const newVal = val.slice(0, pos) + "\n• " + val.slice(el.selectionEnd);
    el.value = newVal;
    fBulletsRaw = newVal;
    // Move cursor past the new "• "
    const next = pos + 3;
    el.setSelectionRange(next, next);
  }

  function handleBulletPaste(e) {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    const el = e.target;
    const pos = el.selectionStart;
    const end = el.selectionEnd;
    const before = el.value.slice(0, pos);
    const after = el.value.slice(end);

    // Normalise pasted lines — strip any existing bullet prefix, re-add "• "
    const lines = text
      .split("\n")
      .map((l) => l.replace(BULLET_RE, "").trim())
      .filter(Boolean)
      .map((l) => "• " + l)
      .join("\n");

    const newVal = before + lines + after;
    el.value = newVal;
    fBulletsRaw = newVal;
  }

  // Ensure the textarea always starts with "• " when the user clears it
  function handleBulletInput(e) {
    fBulletsRaw = e.target.value;
    if (!fBulletsRaw.trimStart().startsWith("•")) {
      const v = "• " + fBulletsRaw.trimStart();
      e.target.value = v;
      fBulletsRaw = v;
    }
  }

  // Parse textarea back to a clean string[] for the server
  // Strips "• " prefix and filters empty lines
  function parseBullets() {
    return fBulletsRaw
      .split("\n")
      .map((l) => l.replace(/^•\s*/, "").trim())
      .filter(Boolean);
  }

  // ── Open forms ────────────────────────────────────────────────
  function openAdd() {
    editing = null;
    fOldId = ""; // explicitly clear — prevents stale old_id on add
    fId =
      fRole =
      fCompany =
      fLocation =
      fStartDate =
      fEndDate =
      fDesc =
      fTags =
        "";
    fCurrent = false;
    fBulletsRaw = "• ";
    showForm = true;
  }

  function openEdit(job) {
    editing = job;
    fOldId = job.id; // remember original slug for WHERE clause
    fId = job.id; // current slug (may auto-update if company changes)
    fRole = job.role;
    fCompany = job.company;
    fLocation = job.location;
    fStartDate = job.startDate;
    fEndDate = job.endDate ?? "";
    fCurrent = job.current;
    fDesc = job.desc;
    fTags = (job.tags ?? []).join(", ");
    // Convert stored bullet array to "• " prefixed textarea content
    const stored = job.bullets ?? [];
    fBulletsRaw = stored.length ? stored.map((b) => "• " + b).join("\n") : "• ";
    showForm = true;
  }

  function closeForm() {
    showForm = false;
    editing = null;
  }

  // ── AI helpers ────────────────────────────────────────────────
  async function generateDesc() {
    const clean = parseBullets();
    if (!clean.length) return;
    aiLoading = "desc";
    try {
      const json = await generateExperienceDesc({
        role: fRole,
        company: fCompany,
        bullets: clean,
      });

      if (json.desc) fDesc = json.desc;
    } finally {
      aiLoading = "";
    }
  }

  async function extractTags() {
    const clean = parseBullets();
    if (!clean.length) return;
    aiLoading = "tags";
    try {
      const json = await extractExperienceTags({
        bullets: clean,
      });
      if (json.tags) fTags = json.tags.join(", ");
    } finally {
      aiLoading = "";
    }
  }

  // ── Delete confirmation ───────────────────────────────────────
  let deletingId = $state(null);
</script>

<svelte:head><title>Experience — Owner</title></svelte:head>

<div class="page-header">
  <div class="section-label">OWNER.INTERFACE</div>
  <div class="header-row">
    <h1 class="page-title">EXPERIENCE</h1>
    <button class="btn-add" onclick={openAdd}>+ ADD JOB</button>
  </div>
</div>

{#if form?.error}
  <div class="alert-error">{form.error}</div>
{/if}
{#if form?.success}
  <div class="alert-success">{form.success}</div>
{/if}

<!-- ── Job list ──────────────────────────────────────────────────── -->
<div class="entry-list">
  {#each data.experience as job}
    <div class="entry-row" class:confirming={deletingId === job.id}>
      <div class="entry-info">
        <div class="entry-title">{job.role}</div>
        <div class="entry-sub">{job.company} · {job.location}</div>
        <div class="entry-date">
          {job.startDate} → {job.endDate ?? "PRESENT"}
        </div>
        <div class="entry-meta">
          {job.bullets?.length ?? 0} bullets · {job.tags?.length ?? 0} tags
        </div>
      </div>
      <div class="entry-actions">
        {#if deletingId === job.id}
          <span class="delete-confirm-label">Delete?</span>
          <form method="POST" action="?/delete" use:enhance>
            <input type="hidden" name="id" value={job.id} />
            <button type="submit" class="btn-confirm-delete">YES</button>
          </form>
          <button
            type="button"
            class="btn-cancel-delete"
            onclick={() => (deletingId = null)}>NO</button
          >
        {:else}
          <button class="btn-edit" onclick={() => openEdit(job)}>EDIT</button>
          <button
            type="button"
            class="btn-delete"
            onclick={() => (deletingId = job.id)}>DELETE</button
          >
        {/if}
      </div>
    </div>
  {:else}
    <div class="empty-state">
      No experience entries yet. Add your first job.
    </div>
  {/each}
</div>

<!-- ── Slide-in panel ───────────────────────────────────────────── -->
{#if showForm}
  <div
    class="form-overlay"
    class:ai-active={!!aiLoading}
    role="presentation"
    onclick={(e) => {
      if (e.target === e.currentTarget && !aiLoading) closeForm();
    }}
    onkeydown={(e) => {
      if (e.key === "Escape") closeForm();
    }}
  >
    <div class="form-panel">
      <div class="form-header">
        <h2 class="form-title">{editing ? "EDIT JOB" : "ADD JOB"}</h2>
        <button
          class="form-close"
          onclick={() => {
            if (!aiLoading) closeForm();
          }}
          disabled={!!aiLoading}
        >
          ✕
        </button>
      </div>

      <form
        method="POST"
        action={editing ? "?/update" : "?/create"}
        use:enhance={() => {
          formLoading = true;
          return async ({ update }) => {
            formLoading = false;
            closeForm(); // close panel immediately — feels instant
            await update(); // data refreshes in background, no jarring reload
          };
        }}
      >
        <!--
          old_id — original slug, used as WHERE clause in update.
          id     — new slug (may differ if company changed on edit).
          bullets hidden — join parsed bullets as \n-separated string.
        -->
        {#if editing}
          <input type="hidden" name="old_id" value={fOldId} />
        {/if}
        <input type="hidden" name="id" value={fId} />
        <input type="hidden" name="bullets" value={parseBullets().join("\n")} />

        <!-- ── Row 1: Role + Company ───────────────────────────── -->
        <div class="form-grid">
          <div class="field">
            <label class="field-label" for="e-role">ROLE</label>
            <input
              id="e-role"
              class="field-input"
              name="role"
              bind:value={fRole}
              placeholder="Software Engineer"
              required
            />
          </div>
          <div class="field">
            <label class="field-label" for="e-company">COMPANY</label>
            <input
              id="e-company"
              class="field-input"
              name="company"
              bind:value={fCompany}
              placeholder="Ratio Solutions (NZ) Ltd"
              required
            />
          </div>
        </div>

        <!-- ── Location full width ─────────────────────────────── -->
        <div class="field">
          <label class="field-label" for="e-location">LOCATION</label>
          <input
            id="e-location"
            class="field-input"
            name="location"
            bind:value={fLocation}
            placeholder="Auckland, New Zealand"
            required
          />
        </div>

        <!-- ── Dates on same row ───────────────────────────────── -->
        <div class="form-grid">
          <div class="field">
            <label class="field-label" for="e-start">START DATE</label>
            <input
              id="e-start"
              class="field-input date-input"
              name="startDate"
              bind:value={fStartDate}
              oninput={(e) => handleDateInput(e, (v) => (fStartDate = v))}
              placeholder="YYYY-MM"
              maxlength="7"
              required
            />
            <div class="field-hint">Numbers only — hyphen auto-inserted.</div>
          </div>

          <div class="field">
            <label class="field-label" for="e-end">END DATE</label>
            {#if fCurrent}
              <div class="present-badge">PRESENT</div>
              <input type="hidden" name="endDate" value="" />
            {:else}
              <input
                id="e-end"
                class="field-input date-input"
                name="endDate"
                bind:value={fEndDate}
                oninput={(e) => handleDateInput(e, (v) => (fEndDate = v))}
                placeholder="YYYY-MM"
                maxlength="7"
              />
            {/if}
            <label class="checkbox-label">
              <input type="checkbox" name="current" bind:checked={fCurrent} />
              Currently working here
            </label>
          </div>
        </div>

        <!-- ── Slug — auto-generated, read-only display ────────── -->
        <!-- Always auto-generated from company — editable on both
             create and edit. Old slug sent separately for WHERE clause. -->
        <div class="field">
          <p class="field-label slug-label">
            ID (SLUG)
            <span class="slug-note">— auto-generated from company name</span>
          </p>
          <div class="slug-preview">{fId || "—"}</div>
          <div class="field-hint">
            Updates automatically as you type the company name. Only a-z, 0-9,
            and hyphens allowed.
          </div>
        </div>

        <!-- ── Bullet points textarea ──────────────────────────────
          Each line is a bullet. "• " prefix added automatically.
          Enter → new bullet. Paste → auto-detects and normalises
          common bullet formats (•, -, *, numbered lists, etc.).
          On submit: "• " prefix stripped, clean array sent to server.
        ──────────────────────────────────────────────────────────── -->
        <div class="field">
          <div class="field-label-row">
            <label class="field-label" for="e-bullets">BULLET POINTS</label>
            <div class="ai-buttons">
              <button
                type="button"
                class="btn-ai"
                onclick={generateDesc}
                disabled={!!aiLoading}
              >
                {aiLoading === "desc" ? "GENERATING..." : "AI → GENERATE DESC"}
              </button>
              <button
                type="button"
                class="btn-ai"
                onclick={extractTags}
                disabled={!!aiLoading}
              >
                {aiLoading === "tags" ? "EXTRACTING..." : "AI → EXTRACT TAGS"}
              </button>
            </div>
          </div>

          <textarea
            id="e-bullets"
            class="field-textarea bullet-textarea"
            bind:value={fBulletsRaw}
            onkeydown={handleBulletKeydown}
            onpaste={handleBulletPaste}
            oninput={handleBulletInput}
            rows="8"
            placeholder="• Type a bullet point here&#10;• Press Enter for a new bullet&#10;• Paste from anywhere — formats auto-detected"
          ></textarea>
          <div class="field-hint">
            Enter → new bullet. Paste text from anywhere — •, -, *, numbered
            lists all converted automatically.
          </div>
        </div>

        <!-- ── Description ──────────────────────────────────────── -->
        <div class="field">
          <label class="field-label" for="e-desc">DESCRIPTION</label>
          <textarea
            id="e-desc"
            class="field-textarea"
            name="desc"
            bind:value={fDesc}
            rows="4"
            placeholder="Professional summary — use AI → GENERATE DESC or write manually"
          ></textarea>
        </div>

        <!-- ── Tags ─────────────────────────────────────────────── -->
        <div class="field">
          <label class="field-label" for="e-tags">TAGS</label>
          <input
            id="e-tags"
            class="field-input"
            name="tags"
            bind:value={fTags}
            placeholder="TypeScript, Go, Azure, Docker"
          />
          <div class="field-hint">
            Comma-separated. Use AI → EXTRACT TAGS or type manually.
          </div>
        </div>

        <div class="form-actions">
          <button
            type="button"
            class="btn-cancel"
            onclick={() => {
              if (!aiLoading) closeForm();
            }}
            disabled={!!aiLoading}
          >
            CANCEL
          </button>
          <button
            type="submit"
            class="btn-save"
            disabled={!!aiLoading || formLoading}
          >
            {formLoading ? "SAVING..." : editing ? "UPDATE" : "CREATE"}
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
  .header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
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

  .btn-add {
    font-family: inherit;
    font-size: 0.68rem;
    letter-spacing: 0.14em;
    padding: 0.5rem 1rem;
    border: 1px solid var(--cyan);
    color: var(--cyan);
    background: transparent;
    cursor: pointer;
    transition: all 0.2s;
    min-height: 40px;
  }
  .btn-add:hover {
    background: rgba(0, 245, 255, 0.08);
  }

  /* ── Job list ─────────────────────────────────────────────────── */
  .entry-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 2rem;
  }
  .entry-row {
    border: 1px solid rgba(255, 255, 255, 0.08);
    padding: 1rem 1.25rem;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    background: rgba(6, 12, 26, 0.6);
    transition: border-color 0.2s;
    flex-wrap: wrap;
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
    font-size: 0.9rem;
    color: var(--text-hi);
    font-weight: 600;
    margin-bottom: 0.2rem;
  }
  .entry-sub {
    font-size: 0.75rem;
    color: var(--cyan);
    margin-bottom: 0.2rem;
  }
  .entry-date {
    font-size: 0.68rem;
    color: rgba(168, 184, 216, 0.5);
    margin-bottom: 0.2rem;
  }
  .entry-meta {
    font-size: 0.65rem;
    color: rgba(168, 184, 216, 0.35);
  }

  .entry-actions {
    display: flex;
    gap: 0.5rem;
    flex-shrink: 0;
    align-items: center;
    flex-wrap: wrap;
  }
  .btn-edit {
    font-family: inherit;
    font-size: 0.62rem;
    letter-spacing: 0.12em;
    padding: 0.35rem 0.75rem;
    border: 1px solid rgba(0, 245, 255, 0.3);
    color: var(--cyan);
    background: transparent;
    cursor: pointer;
    min-height: 32px;
  }
  .btn-delete {
    font-family: inherit;
    font-size: 0.62rem;
    letter-spacing: 0.12em;
    padding: 0.35rem 0.75rem;
    border: 1px solid rgba(255, 0, 120, 0.3);
    color: rgba(255, 0, 120, 0.6);
    background: transparent;
    cursor: pointer;
    min-height: 32px;
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
    min-height: 32px;
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
    min-height: 32px;
  }
  .empty-state {
    color: rgba(168, 184, 216, 0.35);
    font-size: 0.78rem;
    padding: 2rem;
    text-align: center;
    border: 1px dashed rgba(255, 255, 255, 0.06);
  }

  /* ── Slide-in panel ──────────────────────────────────────────── */
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
    width: min(640px, 100vw);
    min-height: 100vh;
    background: #080f1e;
    border-left: 1px solid rgba(0, 245, 255, 0.15);
    padding: 2rem;
    box-sizing: border-box;
  }
  .form-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }
  .form-title {
    font-family: "Orbitron", monospace;
    font-size: 1rem;
    color: var(--text-hi);
  }
  .form-close {
    background: none;
    border: none;
    color: rgba(168, 184, 216, 0.5);
    font-size: 1rem;
    cursor: pointer;
    min-width: 36px;
    min-height: 36px;
  }

  /* 2-column grid — used for Role/Company and Start/End dates */
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
  .field-label-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.4rem;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .field-hint {
    font-size: 0.6rem;
    color: rgba(168, 184, 216, 0.35);
    margin-top: 0.3rem;
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
  .field-textarea {
    resize: vertical;
    min-height: auto;
  }

  /* Date inputs — monospace for clear YYYY-MM display */
  .date-input {
    letter-spacing: 0.1em;
    font-size: 0.85rem;
  }

  /* PRESENT badge — replaces end date input when current is checked */
  .present-badge {
    width: 100%;
    background: rgba(0, 245, 255, 0.04);
    border: 1px solid rgba(0, 245, 255, 0.2);
    color: var(--cyan);
    font-family: "Share Tech Mono", monospace;
    font-size: 0.85rem;
    padding: 0.6rem 0.8rem;
    letter-spacing: 0.2em;
    box-sizing: border-box;
    min-height: 40px;
    display: flex;
    align-items: center;
  }

  .slug-label {
    margin: 0;
  } /* <p> has default margins, reset them */

  /* Slug preview — not a real input, just a display div */
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
  .slug-note {
    font-size: 0.56rem;
    color: rgba(168, 184, 216, 0.3);
    letter-spacing: 0.06em;
    margin-left: 0.4rem;
    text-transform: none;
    font-weight: normal;
  }

  /* Checkbox */
  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.7rem;
    color: rgba(168, 184, 216, 0.6);
    margin-top: 0.5rem;
    cursor: pointer;
  }
  .checkbox-label input {
    accent-color: var(--cyan);
  }

  /* Bullet textarea — larger line height to make bullet lines distinct */
  .bullet-textarea {
    line-height: 1.9;
    font-size: 0.82rem;
  }

  /* AI buttons */
  .ai-buttons {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .btn-ai {
    font-family: inherit;
    font-size: 0.6rem;
    letter-spacing: 0.1em;
    padding: 0.3rem 0.6rem;
    border: 1px solid rgba(0, 245, 255, 0.25);
    color: var(--cyan);
    background: rgba(0, 245, 255, 0.04);
    cursor: pointer;
    transition: all 0.2s;
    min-height: 32px;
  }
  .btn-ai:hover:not(:disabled) {
    background: rgba(0, 245, 255, 0.1);
  }
  .btn-ai:disabled {
    opacity: 0.4;
    cursor: not-allowed;
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
    transition: all 0.2s;
  }
  .btn-save:hover:not(:disabled) {
    background: rgba(0, 245, 255, 0.12);
  }
  .btn-save:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* When AI is loading, the close and cancel buttons show as blocked */
  .form-close:disabled,
  .btn-cancel:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  /* When AI is running, clicking the overlay background shows blocked cursor */
  .form-overlay.ai-active {
    cursor: not-allowed;
  }

  /* But the panel itself still has normal cursor */
  .form-overlay.ai-active .form-panel {
    cursor: default;
  }

  /* ── Mobile ──────────────────────────────────────────────────── */
  @media (max-width: 640px) {
    /* Dates stay side-by-side on mobile — important for UX.
       Role/Company also stays 2-col since labels are short. */
    .form-panel {
      padding: 1.25rem;
    }

    .field-label-row {
      flex-direction: column;
      align-items: flex-start;
    }
    .ai-buttons {
      width: 100%;
    }
    .btn-ai {
      flex: 1;
      text-align: center;
    }

    .entry-row {
      padding: 0.75rem 1rem;
    }
    .entry-actions {
      width: 100%;
      justify-content: flex-end;
      margin-top: 0.5rem;
    }
  }

  @media (max-width: 480px) {
    /* On very small screens, stack the date grid too */
    .form-grid {
      grid-template-columns: 1fr;
    }
    .btn-save,
    .btn-cancel {
      padding: 0.5rem 0.8rem;
    }
  }
</style>
