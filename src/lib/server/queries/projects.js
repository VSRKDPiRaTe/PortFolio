// ╔═══════════════════════════════════════════════════════════════════╗
// ║  src/lib/server/queries/projects.js                              ║
// ╚═══════════════════════════════════════════════════════════════════╝
//
// All database queries for the projects table.
// Manual projects only — GitHub repos come from the API, not the DB.
// NEVER import this in .svelte components — server only.

import { db } from "$lib/server/db.js";

import { notifyProjectsChanged } from "$lib/server/sync-events.js";

function parseArray(val) {
  if (!val) return [];
  try {
    return JSON.parse(val);
  } catch {
    return [];
  }
}

function rowToProject(row) {
  return {
    id: row.id,
    slug: row.slug,
    github_id: row.github_id ?? null,
    source: row.source,
    manually_updated: row.manually_updated === 1,
    group: row.group_id,
    title: row.title,
    subtitle: row.subtitle ?? null,
    desc: row.desc,
    tags: parseArray(row.tags),
    badge: row.badge,
    github: row.github ?? null,
    demo: row.demo ?? null,
    private: row.private === 1,
    company: row.company ?? null,
  };
}

// ── READ ──────────────────────────────────────────────────────────

export async function getAllProjects() {
  const result = await db.execute(
    `SELECT * FROM projects ORDER BY source ASC, sort_order ASC`,
  );
  return result.rows.map(rowToProject);
}

export async function getGithubProjects() {
  const result = await db.execute(
    `SELECT * FROM projects WHERE source = 'github' ORDER BY sort_order ASC`,
  );
  return result.rows.map(rowToProject);
}

export async function getManualProjects() {
  const result = await db.execute(
    `SELECT * FROM projects WHERE source = 'manual' ORDER BY sort_order ASC`,
  );
  return result.rows.map(rowToProject);
}

// Returns only projects where manually_updated=1 (DB data overrides GitHub).
export async function getCustomisedGithubProjects() {
  const result = await db.execute(
    `SELECT * FROM projects WHERE source = 'github' AND manually_updated = 1`,
  );
  return result.rows.map(rowToProject);
}

// ── SYNC ──────────────────────────────────────────────────────────
// Called on every /owner/projects page load with the current GitHub repos.
//
// For each repo:
//   If github_id not in DB → INSERT minimal row (slug + github_id only)
//   If github_id exists AND slug changed → UPDATE slug (repo was renamed)
//   If github_id exists AND slug unchanged → no-op
//
// This means repo renames on GitHub are handled automatically —
// the slug in DB stays in sync without any owner action.
export async function syncGithubRepos(repos) {
  const existing = await db.execute(
    `SELECT github_id, slug FROM projects WHERE source = 'github'`,
  );
  const existingMap = new Map(existing.rows.map((r) => [r.github_id, r.slug]));

  let changed = false;

  for (const repo of repos) {
    const existingSlug = existingMap.get(repo.github_id);

    if (existingSlug === undefined) {
      // New repo — insert minimal row. All display fields left empty.
      // Main site uses live GitHub data until manually_updated=1.
      await db.execute({
        sql: `INSERT OR IGNORE INTO projects
                (slug, github_id, source, group_id, private, badge, tags)
              VALUES (?, ?, 'github', 'personal', ?, ?, ?)`,
        args: [
          repo.slug,
          repo.github_id,
          repo.private ? 1 : 0,
          repo.badge,
          JSON.stringify(repo.tags ?? []),
        ],
      });

      changed = true;
    } else if (existingSlug !== repo.slug) {
      // Repo was renamed on GitHub — update slug in DB.
      // All other fields (manual customisations) stay untouched.
      await db.execute({
        sql: `UPDATE projects SET slug = ?, updated_at = unixepoch()
               WHERE github_id = ?`,
        args: [repo.slug, repo.github_id],
      });

      changed = true;
    }
    // Else: slug unchanged — nothing to do.
  }

  if (changed) {
    notifyProjectsChanged();
  }
}

// ── UPDATE GITHUB REPO ────────────────────────────────────────────
// Called when owner edits a GitHub repo entry in the owner interface.
// Sets manually_updated=1 so main site uses DB data instead of GitHub.
// Badge updates do NOT set manually_updated — badge is a lightweight
// status toggle managed separately.
export async function updateGithubProject(id, fields) {
  await db.execute({
    sql: `UPDATE projects SET
            title            = ?,
            desc             = ?,
            tags             = ?,
            demo             = ?,
            manually_updated = 1,
            updated_at       = unixepoch()
          WHERE id = ? AND source = 'github'`,
    args: [
      fields.title,
      fields.desc,
      JSON.stringify(fields.tags ?? []),
      fields.demo ?? null,
      id,
    ],
  });

  notifyProjectsChanged();
}

// Update badge only — does NOT set manually_updated.
// Badge is a lightweight status toggle, not a full customisation.
export async function updateProjectBadge(id, badge) {
  await db.execute({
    sql: `UPDATE projects SET badge = ?, updated_at = unixepoch() WHERE id = ?`,
    args: [badge, id],
  });
  notifyProjectsChanged();
}

// Reset a GitHub repo entry back to defaults.
// Clears all manual overrides and sets manually_updated=0.
// Main site will use live GitHub data again after this.
//
// WHY THIS QUERY USES SINGLE QUOTES:
//   SQLite treats double quotes as identifier quotes (column / table names).
//   So title = "" is not a safe string assignment here.
//
//   We want actual string literals:
//     ''   → empty string
//     '[]' → empty JSON array for tags
//
// After this reset:
//   title            → cleared
//   desc             → cleared
//   tags             → cleared to empty JSON array
//   demo             → removed
//   manually_updated → turned off
//
// Result:
//   Owner interface + main site fall back to live GitHub data again.
export async function resetGithubProject(id) {
  await db.execute({
    sql: `UPDATE projects SET
            title            = '',
            desc             = '',
            tags             = '[]',
            demo             = NULL,
            manually_updated = 0,
            updated_at       = unixepoch()
          WHERE id = ? AND source = 'github'`,
    args: [id],
  });
  notifyProjectsChanged();
}

// ── MANUAL PROJECTS ───────────────────────────────────────────────

export async function createManualProject(fields) {
  await db.execute({
    sql: `INSERT INTO projects
            (slug, source, group_id, title, subtitle, desc, tags,
             badge, demo, private, company)
          VALUES (?, 'manual', 'professional', ?, ?, ?, ?, ?, ?, 1, ?)`,
    args: [
      fields.slug,
      fields.title,
      fields.subtitle ?? null,
      fields.desc,
      JSON.stringify(fields.tags ?? []),
      fields.badge ?? "production",
      fields.demo ?? null,
      fields.company ?? null,
    ],
  });
  notifyProjectsChanged();
}

export async function updateManualProject(id, fields) {
  await db.execute({
    sql: `UPDATE projects SET
            slug       = ?,
            title      = ?,
            subtitle   = ?,
            desc       = ?,
            tags       = ?,
            badge      = ?,
            demo       = ?,
            company    = ?,
            updated_at = unixepoch()
          WHERE id = ? AND source = 'manual'`,
    args: [
      fields.slug,
      fields.title,
      fields.subtitle ?? null,
      fields.desc,
      JSON.stringify(fields.tags ?? []),
      fields.badge ?? "production",
      fields.demo ?? null,
      fields.company ?? null,
      id,
    ],
  });
  notifyProjectsChanged();
}

// ── DELETE ────────────────────────────────────────────────────────

export async function deleteProject(id) {
  await db.execute({
    sql: "DELETE FROM projects WHERE id = ?",
    args: [id],
  });
  notifyProjectsChanged();
}
