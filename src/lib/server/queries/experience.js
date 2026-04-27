// ╔═══════════════════════════════════════════════════════════════════╗
// ║  src/lib/server/queries/experience.js                            ║
// ╚═══════════════════════════════════════════════════════════════════╝
//
// All database queries for the experience table.
// Imported by +layout.server.js to fetch experience data server-side.
//
// bullets and tags are stored as JSON arrays in TEXT columns.
// Every read function parses them back to arrays.
// Every write function serialises arrays to JSON strings.
//
// NEVER import this in .svelte components — server only.

import { db } from '$lib/server/db.js';

// ── Parse helpers ─────────────────────────────────────────────────
// Safely parse a JSON array column — returns [] if null or invalid.
function parseArray(val) {
  if (!val) return [];
  try { return JSON.parse(val); }
  catch { return []; }
}

// Convert a raw DB row into the shape components expect.
function rowToJob(row) {
  return {
    id:        row.id,
    role:      row.role,
    company:   row.company,
    location:  row.location,
    startDate: row.startDate,
    endDate:   row.endDate ?? null,
    current:   row.current === 1,
    bullets:   parseArray(row.bullets),
    desc:      row.desc,
    tags:      parseArray(row.tags),
  };
}


// ── READ ──────────────────────────────────────────────────────────

// Get all jobs ordered by sort_order (newest first = lowest sort_order).
export async function getAllExperience() {
  const result = await db.execute(
    'SELECT * FROM experience ORDER BY sort_order DESC'
  );
  return result.rows.map(rowToJob);
}

// Get a single job by id.
export async function getExperienceById(id) {
  const result = await db.execute({
    sql:  'SELECT * FROM experience WHERE id = ?',
    args: [id],
  });
  return result.rows[0] ? rowToJob(result.rows[0]) : null;
}


// ── CREATE ────────────────────────────────────────────────────────

export async function createExperience(job) {
  await db.execute({
    sql: `INSERT INTO experience
            (id, role, company, location, startDate, endDate, current,
             bullets, desc, tags, sort_order)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      job.id,
      job.role,
      job.company,
      job.location,
      job.startDate,
      job.endDate    ?? null,
      job.current    ?  1 : 0,
      JSON.stringify(job.bullets ?? []),
      job.desc       ?? '',
      JSON.stringify(job.tags    ?? []),
      job.sort_order ?? 0,
    ],
  });
}


// ── UPDATE ────────────────────────────────────────────────────────

export async function updateExperience(oldId, fields) {
  await db.execute({
    sql: `UPDATE experience SET
            id         = ?,
            role       = ?,
            company    = ?,
            location   = ?,
            startDate  = ?,
            endDate    = ?,
            current    = ?,
            bullets    = ?,
            desc       = ?,
            tags       = ?,
            updated_at = unixepoch()
          WHERE id = ?`,
    args: [
      fields.id,
      fields.role,
      fields.company,
      fields.location,
      fields.startDate,
      fields.endDate     ?? null,
      fields.current     ?  1 : 0,
      JSON.stringify(fields.bullets ?? []),
      fields.desc        ?? '',
      JSON.stringify(fields.tags    ?? []),
      oldId,
    ],
  });
}


// ── DELETE ────────────────────────────────────────────────────────

export async function deleteExperience(id) {
  await db.execute({
    sql:  'DELETE FROM experience WHERE id = ?',
    args: [id],
  });
}