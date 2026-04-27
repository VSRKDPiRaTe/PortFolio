<!--
  src/routes/owner/skills/+page.svelte — Manage Skills
  ─────────────────────────────────────────────────────
  FEATURES:
  - Left tab list with skill counts + badge legend
  - AI LOAD ALL → world skills as pill cards, click + to add with pct slider
  - + ADD SKILL → slide-in panel
  - Mutual exclusive skill type: CORE → SUPPORTING → EXPOSURE
  - Duplicate name check before submit
  - Custom inline delete confirmation
  - Stays on active tab via URL ?tab= param after form actions

  BADGE HIERARCHY (strongest → lightest):
    CORE       → primary=true,  exposure=false
                 Green badge + animated bar. Production-depth.
    SUPPORTING → primary=false, exposure=false
                 Muted cyan badge + solid bar + pct shown.
                 Solid knowledge, not primary focus.
    EXPOSURE   → exposure=true (overrides primary)
                 Yellow badge + dashed bar. Pct hidden.
                 Briefly touched, can't fully quantify.

  DELETE NOTE:
    getAllSkillsGrouped() in Skills.js must include id: r.id in the map.
    Without it, skill.id is undefined for every row — clicking DELETE
    sets deletingSkillId=undefined and ALL rows match the confirming check.
-->
<script>
  import { enhance } from "$app/forms";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { fetchSkillsForTab, fetchClassifySkill } from "$lib/ownerapp/api/client.js";

  let { data, form } = $props();

  // ── Active Tab — driven by URL ?tab= param ────────────────────
  // URL param persists across form action reloads so we land back
  // on the same tab instead of the first one every time.
  let activeTab = $state("");

  $effect(() => {
    const urlTab = $page.url.searchParams.get("tab");
    const first = data.tabs[0]?.id ?? "";
    activeTab =
      urlTab && data.tabs.find((t) => t.id === urlTab) ? urlTab : first;
  });

  function switchTab(id) {
    activeTab = id;
    goto(`?tab=${id}`, { replaceState: true, keepFocus: true, noScroll: true });
  }

  let tabSkills = $derived(data.skills[activeTab] ?? []);
  let currentTabLabel = $derived(
    data.tabs.find((t) => t.id === activeTab)?.label ?? "",
  );

  // ── Add Skill form ────────────────────────────────────────────
  let showAddForm = $state(false);
  let fName = $state("");
  let fPct = $state(80);
  let fPrimary = $state(true);
  let fExposure = $state(false);
  let fTabId = $state("");
  let formLoading = $state(false);
  let nameError = $state("");

  $effect(() => {
    fTabId = activeTab;
  });

  // CORE and EXPOSURE are mutually exclusive.
  // SUPPORTING = neither checked (fPrimary=false, fExposure=false).
  function setPrimary(val) {
    fPrimary = val;
    if (val) fExposure = false;
  }
  function setExposure(val) {
    fExposure = val;
    if (val) fPrimary = false;
  }

  function checkDuplicate() {
    const existing = tabSkills.map((s) => s.name.toLowerCase());
    nameError = existing.includes(fName.trim().toLowerCase())
      ? `"${fName.trim()}" already exists in this tab.`
      : "";
  }

  function openAdd() {
    fName = "";
    fPct = 80;
    fPrimary = true;
    fExposure = false;
    fTabId = activeTab;
    nameError = "";
    showAddForm = true;
  }

  // ── AI state ──────────────────────────────────────────────────
  // aiLoading being non-empty disables ALL AI buttons simultaneously.
  // It also blocks closing the add skill panel while AI is running.
  let aiLoading = $state("");
  let aiSuggestions = $state([]);
  let suggestionPct = $state({});
  let addingSkill = $state("");

  async function loadTabSkills() {
    const tab = data.tabs.find((t) => t.id === activeTab);
    if (!tab) return;
    aiLoading = "load";
    try {
      const json = await fetchSkillsForTab({ tabLabel: tab.label });

      if (json.skills) {
        const existing = tabSkills.map((s) => s.name.toLowerCase());
        aiSuggestions = json.skills.filter(
          (n) => !existing.includes(n.toLowerCase()),
        );
        const pcts = {};
        aiSuggestions.forEach((n) => {
          pcts[n] = 80;
        });
        suggestionPct = pcts;
      }
    } finally {
      aiLoading = "";
    }
  }

  async function classifySkill() {
    if (!fName.trim()) return;
    aiLoading = "classify";
    try {
      const json = await fetchClassifySkill({ skillName: fName, tabs: data.tabs });
      if (json.tabId) fTabId = json.tabId;
    } finally {
      aiLoading = "";
    }
  }

  // ── Close add form ────────────────────────────────────────────
  // Blocked while AI is loading — user must wait for classification.
  function tryCloseAddForm() {
    if (aiLoading) return; // blocked — AI is running
    showAddForm = false;
  }

  // ── Custom delete confirmation ────────────────────────────────
  // deletingSkillId holds the id of the ONE skill pending confirmation.
  // skill.id must be included in the server query (see Skills.js fix).
  // Without id in the data, every skill.id is undefined and ALL rows match.
  let deletingSkillId = $state(null);
  function requestDelete(id) {
    deletingSkillId = id;
  }
  function cancelDelete() {
    deletingSkillId = null;
  }
</script>

<svelte:head><title>Skills — Owner</title></svelte:head>

<div class="page-header">
  <div class="section-label">OWNER.INTERFACE</div>
  <h1 class="page-title">SKILLS</h1>
</div>

{#if form?.error}
  <div class="alert-error">{form.error}</div>
{/if}
{#if form?.success}
  <div class="alert-success">{form.success}</div>
{/if}

<div class="skills-layout">
  <!-- ── Left column: tabs + badge legend ──────────────────────── -->
  <div class="tab-column">
    <div class="tab-list">
      {#each data.tabs as tab}
        <button
          class="tab-btn"
          class:active={activeTab === tab.id}
          onclick={() => switchTab(tab.id)}
          title={tab.label}
        >
          <span class="tab-btn-label">{tab.label}</span>
          <span class="tab-count">{(data.skills[tab.id] ?? []).length}</span>
        </button>
      {/each}
    </div>

    <!-- Badge legend — always visible under tabs.
         Order: CORE → SUPPORTING → EXPOSURE (strongest → lightest).
         Uses same badge classes as skill rows for visual consistency. -->
    <div class="badge-legend">
      <div class="legend-title">BADGE GUIDE</div>
      <div class="legend-item">
        <span class="badge-core legend-badge">CORE</span>
        <span class="legend-desc">Production-depth skill</span>
      </div>
      <div class="legend-item">
        <span class="badge-supporting legend-badge">SUPPORTING</span>
        <span class="legend-desc">Used it, know it, not your main thing</span>
      </div>
      <div class="legend-item">
        <span class="badge-exposure legend-badge">EXPOSURE</span>
        <span class="legend-desc">Briefly touched, can't fully quantify</span>
      </div>
    </div>
  </div>

  <!-- ── Tab content ───────────────────────────────────────────── -->
  <div class="tab-content">
    <div class="tab-toolbar">
      <div class="tab-title neon-c">{currentTabLabel}</div>
      <div class="toolbar-actions">
        <button class="btn-ai" onclick={loadTabSkills} disabled={!!aiLoading}>
          {aiLoading === "load" ? "LOADING..." : "AI LOAD ALL"}
        </button>
        <button class="btn-add" onclick={openAdd}>+ ADD SKILL</button>
      </div>
    </div>

    <!-- ── AI Suggestions ────────────────────────────────────────── -->
    {#if aiSuggestions.length > 0}
      <div class="suggestions-box">
        <div class="suggestions-header">
          <span class="suggestions-label neon-c">
            SKILLS IN THIS CATEGORY — click + to add
          </span>
          <button
            type="button"
            class="btn-text"
            onclick={() => (aiSuggestions = [])}
          >
            DISMISS
          </button>
        </div>
        <div class="suggestions-grid">
          {#each aiSuggestions as name}
            {@const isAdding = addingSkill === name}
            <div class="suggestion-pill" class:expanding={isAdding}>
              <span class="pill-name">{name}</span>
              {#if isAdding}
                <div class="pill-add-form">
                  <div class="pill-pct-row">
                    <input
                      type="range"
                      class="pill-slider"
                      min="0"
                      max="100"
                      bind:value={suggestionPct[name]}
                    />
                    <span class="pill-pct-val neon-c"
                      >{suggestionPct[name]}%</span
                    >
                  </div>
                  <div class="pill-actions">
                    <form
                      method="POST"
                      action="?/create"
                      use:enhance={() =>
                        async ({ update }) => {
                          closeForm();
                          await update();
                          addingSkill = "";
                          aiSuggestions = aiSuggestions.filter(
                            (s) => s !== name,
                          );
                        }}
                    >
                      <input type="hidden" name="tabId" value={activeTab} />
                      <input type="hidden" name="name" value={name} />
                      <input
                        type="hidden"
                        name="pct"
                        value={suggestionPct[name]}
                      />
                      <input type="hidden" name="primary" value="on" />
                      <button type="submit" class="pill-confirm">SAVE</button>
                    </form>
                    <button
                      type="button"
                      class="pill-cancel"
                      onclick={() => (addingSkill = "")}>CANCEL</button
                    >
                  </div>
                </div>
              {:else}
                <button
                  type="button"
                  class="pill-add-btn"
                  onclick={() => {
                    addingSkill = name;
                    suggestionPct[name] = suggestionPct[name] ?? 80;
                  }}
                  title="Add {name}">+</button
                >
              {/if}
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- ── Skill list ─────────────────────────────────────────────
      WHY NO EDIT BUTTON:
      A skill name is a fact — editing it creates a different skill.
      If wrong: delete and re-add. Pct and type may be editable in future.

      DELETE NOTE:
      deletingSkillId is compared to skill.id to show confirm UI for
      exactly one skill. This requires skill.id to be present in the data.
      Fix is in getAllSkillsGrouped() in Skills.js — add id: r.id to the map.
    ──────────────────────────────────────────────────────────────── -->
    <div class="skill-list-header">
      <span class="skill-count">{tabSkills.length} skills</span>
      <span class="no-edit-note">No edit — delete and re-add to correct.</span>
    </div>

    <div class="skill-list">
      {#each tabSkills as skill}
        <div class="skill-row" class:confirming={deletingSkillId === skill.id}>
          <div class="skill-info">
            <span class="skill-name">{skill.name}</span>
            {#if skill.primary && !skill.exposure}
              <span class="badge-core">CORE</span>
            {:else if !skill.primary && !skill.exposure}
              <span class="badge-supporting">SUPPORTING</span>
            {:else if skill.exposure}
              <span class="badge-exposure">EXPOSURE</span>
            {/if}
          </div>
          <div class="skill-meta">
            {#if !skill.exposure}<span class="skill-pct">{skill.pct}%</span
              >{/if}
          </div>
          <div class="skill-actions">
            {#if deletingSkillId === skill.id}
              <span class="delete-confirm-label">Delete?</span>
              <form
                method="POST"
                action="?/delete"
                use:enhance={() =>
                  async ({ update }) => {
                    deletingSkillId = null;
                    await update();
                  }}
              >
                <input type="hidden" name="id" value={skill.id} />
                <input type="hidden" name="tabId" value={activeTab} />
                <button type="submit" class="btn-confirm-delete">YES</button>
              </form>
              <button
                type="button"
                class="btn-cancel-delete"
                onclick={cancelDelete}>NO</button
              >
            {:else}
              <button
                type="button"
                class="btn-delete-skill"
                onclick={() => requestDelete(skill.id)}>DELETE</button
              >
            {/if}
          </div>
        </div>
      {:else}
        <div class="empty-state">
          No skills yet. Use <strong>AI LOAD ALL</strong> to see available
          skills, or <strong>+ ADD SKILL</strong> to add manually.
        </div>
      {/each}
    </div>
  </div>
</div>

<!-- ── Add Skill Slide-in Panel ─────────────────────────────────── -->
{#if showAddForm}
  <!-- Overlay dismisses on click-outside UNLESS AI is loading.
       class:ai-active changes cursor to not-allowed while blocked. -->
  <div
    class="form-overlay"
    class:ai-active={!!aiLoading}
    role="presentation"
    onclick={(e) => {
      if (e.target === e.currentTarget) tryCloseAddForm();
    }}
    onkeydown={(e) => {
      if (e.key === "Escape") tryCloseAddForm();
    }}
  >
    <div class="form-panel">
      <div class="form-header">
        <h2 class="form-title">ADD SKILL</h2>
        <!-- ✕ blocked while AI classifying — guard in tryCloseAddForm() -->
        <button
          class="form-close"
          onclick={tryCloseAddForm}
          disabled={!!aiLoading}
          title={aiLoading ? "Wait for AI to finish" : "Close"}>✕</button
        >
      </div>

      <form
        method="POST"
        action="?/create"
        use:enhance={() => {
          formLoading = true;
          return async ({ update }) => {
            formLoading = false;
            showAddForm = false; // close immediately
            await update(); // data refreshes in background
          };
        }}
      >
        <input type="hidden" name="tabId" value={fTabId} />

        <!-- Skill name + AI classify tab -->
        <div class="field">
          <div class="field-label-row">
            <label class="field-label" for="skill-name">SKILL NAME</label>
            <!-- AI CLASSIFY TAB disabled while any AI op is loading -->
            <button
              type="button"
              class="btn-ai sm"
              onclick={classifySkill}
              disabled={!!aiLoading}
            >
              {aiLoading === "classify" ? "CLASSIFYING..." : "AI CLASSIFY TAB"}
            </button>
          </div>
          <input
            id="skill-name"
            class="field-input"
            name="name"
            bind:value={fName}
            oninput={checkDuplicate}
            placeholder="e.g. Prisma ORM"
            required
          />
          {#if nameError}
            <div class="field-error">{nameError}</div>
          {:else}
            <div class="field-hint">
              Type name, then AI CLASSIFY TAB to auto-select the correct tab.
            </div>
          {/if}
        </div>

        <!-- Tab select — themed dark, custom cyan arrow -->
        <div class="field">
          <label class="field-label" for="skill-tab">TAB</label>
          <select
            id="skill-tab"
            class="field-input field-select"
            name="tabId"
            bind:value={fTabId}
          >
            {#each data.tabs as tab}
              <option value={tab.id}>{tab.label}</option>
            {/each}
          </select>
        </div>

        <!-- Proficiency — range slider + number input in sync -->
        <div class="field">
          <label class="field-label" for="skill-pct">
            PROFICIENCY — <span class="neon-c">{fPct}%</span>
          </label>
          <div class="pct-row">
            <input
              type="range"
              class="pct-slider"
              min="0"
              max="100"
              bind:value={fPct}
            />
            <input
              id="skill-pct"
              type="number"
              class="field-input pct-number"
              name="pct"
              bind:value={fPct}
              min="0"
              max="100"
            />
          </div>
          <div class="field-hint">Not shown for exposure skills.</div>
        </div>

        <!-- Skill type — CORE → SUPPORTING → EXPOSURE (strongest → lightest).
             Mutually exclusive via setPrimary / setExposure functions. -->
        <div class="field">
          <div class="field-label">SKILL TYPE</div>
          <div class="type-options">
            <label class="type-option" class:selected={fPrimary && !fExposure}>
              <input
                type="checkbox"
                name="primary"
                checked={fPrimary}
                onchange={(e) => setPrimary(e.target.checked)}
              />
              <div class="type-option-content">
                <span class="type-badge core-badge">CORE</span>
                <span class="type-desc"
                  >Production-depth. Green badge + animated bar.</span
                >
              </div>
            </label>

            <label class="type-option" class:selected={!fPrimary && !fExposure}>
              <input
                type="checkbox"
                checked={!fPrimary && !fExposure}
                onchange={() => {
                  fPrimary = false;
                  fExposure = false;
                }}
              />
              <div class="type-option-content">
                <span class="type-badge supporting-badge">SUPPORTING</span>
                <span class="type-desc"
                  >Solid knowledge, not primary focus. Muted cyan badge + solid
                  bar.</span
                >
              </div>
            </label>

            <label class="type-option" class:selected={fExposure}>
              <input
                type="checkbox"
                name="exposure"
                checked={fExposure}
                onchange={(e) => setExposure(e.target.checked)}
              />
              <div class="type-option-content">
                <span class="type-badge exposure-badge">EXPOSURE</span>
                <span class="type-desc"
                  >Briefly touched — can't fully quantify. Yellow badge + dashed
                  bar, pct hidden.</span
                >
              </div>
            </label>
          </div>
        </div>

        <div class="form-actions">
          <!-- CANCEL blocked while AI is loading — tryCloseAddForm handles guard -->
          <button
            type="button"
            class="btn-cancel"
            onclick={tryCloseAddForm}
            disabled={!!aiLoading}>CANCEL</button
          >
          <button
            type="submit"
            class="btn-save"
            disabled={!!aiLoading || formLoading || !!nameError}
          >
            {formLoading ? "SAVING..." : "ADD SKILL"}
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

  /* ── Layout ──────────────────────────────────────────────────── */
  .skills-layout {
    display: grid;
    grid-template-columns: 200px 1fr;
    gap: 1.5rem;
    min-width: 0;
    overflow: hidden;
  }

  /* ── Left column ─────────────────────────────────────────────── */
  .tab-column {
    display: flex;
    flex-direction: column;
    border-right: 1px solid rgba(255, 255, 255, 0.06);
    padding-right: 1rem;
    min-width: 0;
  }

  .tab-list {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .tab-btn {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: 0.6rem 0.75rem;
    background: none;
    border: none;
    border-left: 2px solid transparent;
    color: rgba(168, 184, 216, 0.55);
    font-family: inherit;
    font-size: 0.66rem;
    letter-spacing: 0.12em;
    cursor: pointer;
    text-align: left;
    transition: all 0.2s;
  }
  .tab-btn:hover {
    color: var(--cyan);
  }
  .tab-btn.active {
    color: var(--cyan);
    border-left-color: var(--cyan);
    background: rgba(0, 245, 255, 0.04);
  }
  .tab-btn-label {
    flex: 1;
    text-align: left;
  }
  .tab-count {
    font-size: 0.6rem;
    color: rgba(168, 184, 216, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.08);
    padding: 0.1rem 0.3rem;
    flex-shrink: 0;
  }

  /* ── Badge legend ────────────────────────────────────────────── */
  .badge-legend {
    margin-top: 1.25rem;
    padding-top: 1rem;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .legend-title {
    font-size: 0.58rem;
    letter-spacing: 0.15em;
    color: rgba(168, 184, 216, 0.3);
    margin-bottom: 0.15rem;
  }
  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .legend-desc {
    font-size: 0.58rem;
    color: rgba(168, 184, 216, 0.35);
    line-height: 1.3;
  }
  .legend-badge {
    font-size: 0.5rem !important;
    padding: 0.1rem 0.35rem !important;
    flex-shrink: 0;
  }

  /* ── Tab content ─────────────────────────────────────────────── */
  .tab-content {
    min-height: 400px;
    min-width: 0;
  }

  .tab-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    gap: 0.5rem;
  }
  .tab-title {
    font-size: 0.8rem;
    letter-spacing: 0.14em;
    white-space: nowrap;
  }
  .toolbar-actions {
    display: flex;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .btn-add {
    font-family: inherit;
    font-size: 0.65rem;
    letter-spacing: 0.12em;
    padding: 0.4rem 0.9rem;
    border: 1px solid var(--cyan);
    color: var(--cyan);
    background: transparent;
    cursor: pointer;
    min-height: 36px;
  }
  .btn-ai {
    font-family: inherit;
    font-size: 0.65rem;
    letter-spacing: 0.1em;
    padding: 0.4rem 0.9rem;
    border: 1px solid rgba(0, 245, 255, 0.25);
    color: var(--cyan);
    background: rgba(0, 245, 255, 0.04);
    cursor: pointer;
    min-height: 36px;
  }
  .btn-ai.sm {
    font-size: 0.58rem;
    padding: 0.25rem 0.6rem;
    min-height: auto;
  }
  .btn-ai:disabled,
  .btn-add:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .btn-text {
    background: none;
    border: none;
    font-family: inherit;
    font-size: 0.62rem;
    letter-spacing: 0.1em;
    color: rgba(168, 184, 216, 0.5);
    cursor: pointer;
    padding: 0;
  }
  .btn-text:hover {
    color: var(--cyan);
  }

  /* ── AI Suggestions ──────────────────────────────────────────── */
  .suggestions-box {
    border: 1px solid rgba(0, 245, 255, 0.15);
    background: rgba(0, 245, 255, 0.02);
    padding: 1rem;
    margin-bottom: 1.25rem;
  }
  .suggestions-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .suggestions-label {
    font-size: 0.68rem;
    letter-spacing: 0.1em;
  }
  .suggestions-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 0.5rem;
  }

  .suggestion-pill {
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(6, 12, 26, 0.6);
    padding: 0.5rem 0.75rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    transition: all 0.2s;
    min-height: 40px;
  }
  .suggestion-pill.expanding {
    flex-direction: column;
    align-items: stretch;
    border-color: rgba(0, 245, 255, 0.25);
    background: rgba(0, 245, 255, 0.03);
  }

  .pill-name {
    font-size: 0.75rem;
    color: var(--text-hi);
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .pill-add-btn {
    background: none;
    border: 1px solid rgba(0, 245, 255, 0.3);
    color: var(--cyan);
    font-size: 1rem;
    width: 26px;
    height: 26px;
    cursor: pointer;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }
  .pill-add-btn:hover {
    background: rgba(0, 245, 255, 0.1);
    box-shadow: var(--glow-c);
  }
  .pill-add-form {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .pill-pct-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .pill-slider {
    flex: 1;
    accent-color: var(--cyan);
    cursor: pointer;
  }
  .pill-pct-val {
    font-size: 0.72rem;
    font-family: "Orbitron", monospace;
    min-width: 2.5rem;
    text-align: right;
    flex-shrink: 0;
  }
  .pill-actions {
    display: flex;
    gap: 0.4rem;
  }
  .pill-confirm {
    font-family: inherit;
    font-size: 0.62rem;
    letter-spacing: 0.1em;
    padding: 0.3rem 0.7rem;
    border: 1px solid var(--cyan);
    color: var(--cyan);
    background: rgba(0, 245, 255, 0.06);
    cursor: pointer;
    flex: 1;
  }
  .pill-cancel {
    font-family: inherit;
    font-size: 0.62rem;
    letter-spacing: 0.1em;
    padding: 0.3rem 0.7rem;
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: rgba(168, 184, 216, 0.5);
    background: transparent;
    cursor: pointer;
  }

  /* ── Skill list ───────────────────────────────────────────────── */
  .skill-list-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.6rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .skill-count {
    font-size: 0.65rem;
    color: rgba(168, 184, 216, 0.4);
    letter-spacing: 0.1em;
  }
  .no-edit-note {
    font-size: 0.6rem;
    color: rgba(168, 184, 216, 0.3);
    font-style: italic;
  }
  .skill-list {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .skill-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.6rem 0.9rem;
    border: 1px solid rgba(255, 255, 255, 0.06);
    background: rgba(6, 12, 26, 0.5);
    transition: border-color 0.2s;
    flex-wrap: wrap;
  }
  .skill-row.confirming {
    border-color: rgba(255, 0, 120, 0.3);
    background: rgba(255, 0, 120, 0.03);
  }
  .skill-info {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
  }
  .skill-name {
    font-size: 0.82rem;
    color: var(--text-hi);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .skill-meta {
    font-size: 0.7rem;
    color: rgba(168, 184, 216, 0.4);
    flex-shrink: 0;
  }
  .skill-pct {
    font-family: "Orbitron", monospace;
  }
  .skill-actions {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-shrink: 0;
  }

  /* ── Badges ──────────────────────────────────────────────────── */
  .badge-core {
    font-size: 0.52rem;
    letter-spacing: 0.1em;
    padding: 0.1rem 0.4rem;
    border: 1px solid rgba(0, 255, 136, 0.3);
    color: var(--green);
    background: rgba(0, 255, 136, 0.06);
    flex-shrink: 0;
  }
  .badge-supporting {
    font-size: 0.52rem;
    letter-spacing: 0.1em;
    padding: 0.1rem 0.4rem;
    border: 1px solid rgba(0, 245, 255, 0.2);
    color: rgba(0, 245, 255, 0.55);
    background: rgba(0, 245, 255, 0.04);
    flex-shrink: 0;
  }
  .badge-exposure {
    font-size: 0.52rem;
    letter-spacing: 0.1em;
    padding: 0.1rem 0.4rem;
    border: 1px solid rgba(255, 230, 0, 0.3);
    color: var(--yellow);
    background: rgba(255, 230, 0, 0.06);
    flex-shrink: 0;
  }

  /* Delete button */
  .btn-delete-skill {
    font-family: inherit;
    font-size: 0.6rem;
    letter-spacing: 0.1em;
    padding: 0.25rem 0.6rem;
    border: 1px solid rgba(255, 0, 120, 0.25);
    color: rgba(255, 0, 120, 0.5);
    background: transparent;
    cursor: pointer;
    transition: all 0.2s;
    min-height: 30px;
  }
  .btn-delete-skill:hover {
    color: var(--magenta);
    border-color: var(--magenta);
    background: rgba(255, 0, 120, 0.06);
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
    padding: 0.25rem 0.6rem;
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
    padding: 0.25rem 0.6rem;
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: rgba(168, 184, 216, 0.5);
    background: transparent;
    cursor: pointer;
    min-height: 30px;
  }

  .empty-state {
    color: rgba(168, 184, 216, 0.3);
    font-size: 0.75rem;
    padding: 2rem;
    text-align: center;
    border: 1px dashed rgba(255, 255, 255, 0.05);
    line-height: 1.7;
  }
  .empty-state strong {
    color: var(--cyan);
  }

  /* ── Slide-in form panel ─────────────────────────────────────── */
  .form-overlay {
    position: fixed;
    inset: 0;
    background: rgba(2, 4, 10, 0.85);
    z-index: 100;
    display: flex;
    align-items: flex-start;
    justify-content: flex-end;
  }
  /* When AI is loading, overlay background shows not-allowed cursor
     so user understands they must wait before dismissing */
  .form-overlay.ai-active {
    cursor: not-allowed;
  }
  .form-overlay.ai-active .form-panel {
    cursor: default;
  }

  .form-panel {
    width: min(480px, 100vw);
    min-height: 100vh;
    background: #080f1e;
    border-left: 1px solid rgba(0, 245, 255, 0.15);
    padding: 2rem;
    overflow-y: auto;
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

  /* form-close disabled state — visually greyed, cursor blocked */
  .form-close {
    background: none;
    border: none;
    color: rgba(168, 184, 216, 0.5);
    font-size: 1rem;
    cursor: pointer;
    min-width: 36px;
    min-height: 36px;
    transition:
      opacity 0.2s,
      cursor 0.2s;
  }
  .form-close:disabled {
    opacity: 0.25;
    cursor: not-allowed;
  }

  .field {
    margin-bottom: 1.25rem;
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
    gap: 0.5rem;
  }
  .field-hint {
    font-size: 0.6rem;
    color: rgba(168, 184, 216, 0.35);
    margin-top: 0.3rem;
  }
  .field-error {
    font-size: 0.62rem;
    color: var(--magenta);
    margin-top: 0.3rem;
  }

  .field-input {
    width: 100%;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: var(--text-hi);
    font-family: "Share Tech Mono", monospace;
    font-size: 0.8rem;
    padding: 0.6rem 0.8rem;
    outline: none;
    box-sizing: border-box;
    transition: border-color 0.2s;
  }
  .field-input:focus {
    border-color: var(--cyan);
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

  .pct-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .pct-slider {
    flex: 1;
    accent-color: var(--cyan);
    cursor: pointer;
    height: 4px;
  }
  .pct-number {
    width: 64px;
    flex-shrink: 0;
    text-align: center;
    padding: 0.4rem 0.5rem;
  }

  .type-options {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .type-option {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.75rem;
    border: 1px solid rgba(255, 255, 255, 0.08);
    cursor: pointer;
    transition: all 0.2s;
    background: rgba(255, 255, 255, 0.01);
  }
  .type-option.selected {
    border-color: rgba(0, 245, 255, 0.3);
    background: rgba(0, 245, 255, 0.04);
  }
  .type-option input {
    accent-color: var(--cyan);
    margin-top: 2px;
    flex-shrink: 0;
  }
  .type-option-content {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .type-badge {
    font-size: 0.55rem;
    letter-spacing: 0.12em;
    padding: 0.1rem 0.45rem;
    display: inline-block;
  }
  .core-badge {
    border: 1px solid rgba(0, 255, 136, 0.4);
    color: var(--green);
    background: rgba(0, 255, 136, 0.08);
  }
  .supporting-badge {
    border: 1px solid rgba(0, 245, 255, 0.2);
    color: rgba(0, 245, 255, 0.55);
    background: rgba(0, 245, 255, 0.04);
  }
  .exposure-badge {
    border: 1px solid rgba(255, 230, 0, 0.4);
    color: var(--yellow);
    background: rgba(255, 230, 0, 0.08);
  }
  .type-desc {
    font-size: 0.65rem;
    color: rgba(168, 184, 216, 0.45);
    line-height: 1.4;
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
    transition: opacity 0.2s;
  }
  .btn-cancel:disabled {
    opacity: 0.25;
    cursor: not-allowed;
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

  /* ── Mobile ──────────────────────────────────────────────────── */
  @media (max-width: 640px) {
    .skills-layout {
      grid-template-columns: 1fr;
      overflow: visible;
    }
    .tab-column {
      border-right: none;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      padding-right: 0;
      padding-bottom: 0.75rem;
    }
    .tab-list {
      flex-direction: row;
      overflow-x: auto;
      gap: 0.25rem;
      padding-bottom: 4px;
      scrollbar-width: thin;
      scrollbar-color: rgba(0, 245, 255, 0.2) transparent;
    }
    .tab-btn {
      flex-direction: column;
      align-items: center;
      white-space: nowrap;
      border-left: none;
      border-bottom: 2px solid transparent;
      padding: 0.4rem 0.6rem;
      font-size: 0.6rem;
      gap: 0.15rem;
      min-width: 56px;
      max-width: 72px;
      flex-shrink: 0;
    }
    .tab-btn.active {
      border-left-color: transparent;
      border-bottom-color: var(--cyan);
    }
    .tab-btn-label {
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .tab-count {
      display: none;
    }
    .badge-legend {
      margin-top: 0.75rem;
      padding-top: 0.75rem;
      gap: 0.4rem;
    }
    .legend-item {
      flex-direction: row;
      align-items: center;
    }
    .tab-toolbar {
      flex-direction: column;
      align-items: stretch;
    }
    .toolbar-actions {
      width: 100%;
    }
    .btn-ai,
    .btn-add {
      flex: 1;
      text-align: center;
      justify-content: center;
    }
    .suggestions-grid {
      grid-template-columns: repeat(2, 1fr);
    }
    .form-panel {
      padding: 1.25rem;
    }
    .skill-row {
      padding: 0.75rem;
    }
  }

  @media (max-width: 400px) {
    .suggestions-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
