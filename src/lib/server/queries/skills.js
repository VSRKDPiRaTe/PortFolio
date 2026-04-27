// ╔═══════════════════════════════════════════════════════════════════╗
// ║  src/lib/server/queries/skills.js                                ║
// ╚═══════════════════════════════════════════════════════════════════╝
//
// All database queries for skill_tabs and skills tables.
// NEVER import this in .svelte components — server only.

import { db } from '$lib/server/db.js';


// ── Skill Tabs ────────────────────────────────────────────────────

export async function getAllTabs() {
  const result = await db.execute(
    'SELECT * FROM skill_tabs ORDER BY sort_order ASC'
  );
  return result.rows.map(r => ({
    id:    r.id,
    label: r.label,
  }));
}


// ── Skills ────────────────────────────────────────────────────────

// Returns all skills grouped by tab — same shape as skills.json
// so existing components work without changes.
// Shape: { languages: [...], frontend: [...], ... }
export async function getAllSkillsGrouped() {
  const tabs   = await getAllTabs();
  const result = await db.execute(
    'SELECT * FROM skills ORDER BY tab_id, sort_order ASC'
  );

  const grouped = {};
  for (const tab of tabs) {
    grouped[tab.id] = result.rows
      .filter(r => r.tab_id === tab.id)
      .map(r => ({
        id:       r.id,
        name:     r.name,
        pct:      r.pct,
        primary:  r.primary_skill === 1,
        exposure: r.exposure      === 1,
      }));
  }
  return grouped;
}

// Get all skills for a single tab.
export async function getSkillsByTab(tabId) {
  const result = await db.execute({
    sql:  'SELECT * FROM skills WHERE tab_id = ? ORDER BY sort_order ASC',
    args: [tabId],
  });
  return result.rows.map(r => ({
    id:       r.id,
    name:     r.name,
    pct:      r.pct,
    primary:  r.primary_skill === 1,
    exposure: r.exposure      === 1,
  }));
}


// ── CREATE ────────────────────────────────────────────────────────

export async function createSkill(skill) {
  await db.execute({
    sql: `INSERT INTO skills
            (tab_id, name, pct, primary_skill, exposure, sort_order)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [
      skill.tab_id,
      skill.name,
      skill.pct      ?? 80,
      skill.primary  ?  1 : 0,
      skill.exposure ?  1 : 0,
      skill.sort_order ?? 0,
    ],
  });
}


// ── UPDATE ────────────────────────────────────────────────────────

export async function updateSkill(id, fields) {
  await db.execute({
    sql: `UPDATE skills SET
            tab_id        = ?,
            name          = ?,
            pct           = ?,
            primary_skill = ?,
            exposure      = ?,
            updated_at    = unixepoch()
          WHERE id = ?`,
    args: [
      fields.tab_id,
      fields.name,
      fields.pct      ?? 80,
      fields.primary  ?  1 : 0,
      fields.exposure ?  1 : 0,
      id,
    ],
  });
}


// ── DELETE ────────────────────────────────────────────────────────

export async function deleteSkill(id) {
  await db.execute({
    sql:  'DELETE FROM skills WHERE id = ?',
    args: [id],
  });
}