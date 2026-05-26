// ╔═══════════════════════════════════════════════════════════════════╗
// ║  src/lib/server/queries/projects.js                               ║
// ╚═══════════════════════════════════════════════════════════════════╝
//
// ARCHITECTURE:
//   The projects table stores two project sources:
//
//   1. source='github'
//      Repos imported/synced from GitHub.
//      GitHub API is treated as an ingestion source.
//      The DB stores the latest synced GitHub fields.
//
//   2. source='manual'
//      Professional/client work without access to a GitHub repo or not.
//      Fully managed through the Owner Interface.
//
//
// IMPORTANT:
//   This file uses the DB client and is server-only.
//   All database queries for the projects table.
//   NEVER import this in .svelte components — server only.

import { db } from "$lib/server/db.js";

import { notifyProjectsChanged } from "$lib/server/sync-events.js";


// ── JSON helpers ──────────────────────────────────────────────────
// tags are stored as TEXT JSON in SQLite/libSQL.
// Components expect arrays.
function parseArray(val) {
  if (!val) return [];
  try {
    return JSON.parse(val);
  } catch {
    return [];
  }
}

function stringifyArray(val) {
  return JSON.stringify(Array.isArray(val) ? val : []);
}

// ── rowToProject ──────────────────────────────────────────────────
// Converts a raw DB row into the final public project shape.
//
// Synced GitHub metadata stored in DB:
//   language, stars, pushedAt, createdAt, archived
//
// manually_updated still matters:
//   0 = synced GitHub display fields are used
//   1 = owner override display fields are preserved during future syncs
//
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

    language: row.language ?? null,
    stars: Number(row.stars ?? 0),
    pushedAt: row.pushedAt ?? null,
    createdAt: row.createdAt ?? null,
    archived: row.archived === 1,
  };
}

// ── READ ──────────────────────────────────────────────────────────

export async function getAllProjects() {
  const result = await db.execute(
    `SELECT * FROM projects ORDER BY source ASC, sort_order ASC, updated_at DESC`,
  );

  return result.rows.map(rowToProject);
}

export async function getGithubProjects() {
  const result = await db.execute(
    `SELECT * FROM projects WHERE source = 'github' ORDER BY sort_order ASC, updated_at DESC`,
  );

  return result.rows.map(rowToProject);
}

export async function getManualProjects() {
  const result = await db.execute(
    `SELECT * FROM projects WHERE source = 'manual' ORDER BY sort_order ASC, updated_at DESC`,
  );

  return result.rows.map(rowToProject);
}

// ── SYNC GITHUB REPOS ─────────────────────────────────────────────
// Called from /owner/projects after GitHub API fetch.
//
// IMPORTANT:
//   This stores full synced GitHub data in DB.
//
// What gets updated every sync:
//   slug, subtitle, github URL, private flag,
//   language, stars, pushedAt, createdAt, archived
//
// Display fields:
//   title, desc, tags, demo are updated ONLY when manually_updated=0.
//   If manually_updated=1, owner overrides are preserved.
//
// Badge:
//   Badge can be edited without manually_updated.
//   So set the default badge for new repos.
//   Existing badge is preserved.
export async function syncGithubRepos(repos) {
  for (const repo of repos) {
    await db.execute({
      sql: `
        INSERT INTO projects (
          slug,
          github_id,
          source,
          group_id,
          manually_updated,
          title,
          subtitle,
          desc,
          tags,
          badge,
          github,
          demo,
          private,
          language,
          stars,
          pushedAt,
          createdAt,
          archived,
          updated_at
        )
        VALUES (
          ?, ?, 'github', 'personal', 0,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?, ?,
          unixepoch()
        )
        ON CONFLICT(github_id) DO UPDATE SET
          slug       = excluded.slug,
          subtitle   = excluded.subtitle,
          github     = excluded.github,
          private    = excluded.private,
          language   = excluded.language,
          stars      = excluded.stars,
          pushedAt   = excluded.pushedAt,
          createdAt  = excluded.createdAt,
          archived   = excluded.archived,

          title = CASE
            WHEN projects.manually_updated = 0 THEN excluded.title
            ELSE projects.title
          END,

          desc = CASE
            WHEN projects.manually_updated = 0 THEN excluded.desc
            ELSE projects.desc
          END,

          tags = CASE
            WHEN projects.manually_updated = 0 THEN excluded.tags
            ELSE projects.tags
          END,

          demo = CASE
            WHEN projects.manually_updated = 0 THEN excluded.demo
            ELSE projects.demo
          END,

          updated_at = unixepoch()
      `,
      args: [
        repo.slug,
        repo.github_id,

        repo.title ?? repo.name ?? repo.slug,
        repo.subtitle ?? repo.name ?? repo.slug,
        repo.description ?? '',
        stringifyArray(repo.tags ?? []),
        repo.badge ?? 'live',

        repo.github ?? null,
        repo.demo ?? null,
        repo.private ? 1 : 0,

        repo.language ?? null,
        Number(repo.stars ?? 0),
        repo.pushedAt ?? null,
        repo.createdAt ?? null,
        repo.archived ? 1 : 0,
      ],
    });
  }

  notifyProjectsChanged();
}


// ── UPDATE GITHUB REPO ────────────────────────────────────────────
// Owner customises a GitHub repo entry.
//
// This sets manually_updated=1, meaning:
//   - title/desc/tags/demo are now owner-controlled
//   - future GitHub sync will not overwrite those fields
//   - GitHub metadata like stars/language/pushedAt still updates
//   - Badge status updates do NOT set manually_updated — badge is a lightweight.
export async function updateGithubProject(id, fields) {
  await db.execute({
    sql: `
      UPDATE projects SET
        title            = ?,
        desc             = ?,
        tags             = ?,
        demo             = ?,
        manually_updated = 1,
        updated_at       = unixepoch()
      WHERE id = ? AND source = 'github'
    `,
    args: [
      fields.title,
      fields.desc,
      stringifyArray(fields.tags ?? []),
      fields.demo ?? null,
      id,
    ],
  });

  notifyProjectsChanged();
}


// Badge update is lightweight status toggle.
// It does NOT set manually_updated because badge is owner-controlled
// independently from title/description/tag overrides.
export async function updateProjectBadge(id, badge) {
  await db.execute({
    sql: `
      UPDATE projects SET
        badge      = ?,
        updated_at = unixepoch()
      WHERE id = ?
    `,
    args: [badge, id],
  });

  notifyProjectsChanged();
}

// Reset GitHub repo entry back to synced GitHub defaults.
//
// Instead:
//   1. Turn manually_updated off.
//   2. Clear owner override fields.
//   3. Next GitHub sync fills title/desc/tags/demo from GitHub again.
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
// Because /owner/projects performs GitHub sync on load,
// the next sync refreshes the DB-backed GitHub values again.
export async function resetGithubProject(id) {
  await db.execute({
    sql: `
      UPDATE projects SET
        title            = '',
        desc             = '',
        tags             = '[]',
        demo             = NULL,
        manually_updated = 0,
        updated_at       = unixepoch()
      WHERE id = ? AND source = 'github'
    `,
    args: [id],
  });

  notifyProjectsChanged();
}

// ── MANUAL PROJECTS ───────────────────────────────────────────────

export async function createManualProject(fields) {
  await db.execute({
    sql: `
      INSERT INTO projects (
        slug,
        source,
        group_id,
        title,
        subtitle,
        desc,
        tags,
        badge,
        demo,
        private,
        company,
        updated_at
      )
      VALUES (?, 'manual', 'professional', ?, ?, ?, ?, ?, ?, 1, ?, unixepoch())
    `,
    args: [
      fields.slug,
      fields.title,
      fields.subtitle ?? null,
      fields.desc,
      stringifyArray(fields.tags ?? []),
      fields.badge ?? 'production',
      fields.demo ?? null,
      fields.company ?? null,
    ],
  });

  notifyProjectsChanged();
}

export async function updateManualProject(id, fields) {
  await db.execute({
    sql: `
      UPDATE projects SET
        slug       = ?,
        title      = ?,
        subtitle   = ?,
        desc       = ?,
        tags       = ?,
        badge      = ?,
        demo       = ?,
        company    = ?,
        updated_at = unixepoch()
      WHERE id = ? AND source = 'manual'
    `,
    args: [
      fields.slug,
      fields.title,
      fields.subtitle ?? null,
      fields.desc,
      stringifyArray(fields.tags ?? []),
      fields.badge ?? 'production',
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
    sql: `DELETE FROM projects WHERE id = ?`,
    args: [id],
  });

  notifyProjectsChanged();
}
