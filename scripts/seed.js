// ╔═══════════════════════════════════════════════════════════════════╗
// ║  scripts/seed.js — Seed Database                                 ║
// ╚═══════════════════════════════════════════════════════════════════╝
//
// WHAT THIS FILE IS:
//   Bootstrap seed script for reusable starter data.
//
// WHAT IS SEEDED:
//   1. skill_tabs
//      Standard skill category headings.
//
//   2. skills.json
//      Skill starter data.
//      Re-running seed adds new skills and updates existing skill values.
//
// WHAT IS NOT SEEDED:
//   experience → entered via Owner Interface
//   projects   → GitHub repos sync when owner opens /owner/projects
//   analytics  → production traffic creates this

import { createClient } from "@libsql/client";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const db = createClient({
  url: process.env.TURSO_DB_URL ?? "file:local.db",
  authToken: process.env.TURSO_AUTH_TOKEN ?? "",
});

// ── Skill tabs ────────────────────────────────────────────────────
// Industry-standard classification headings.
// These IDs must match what the owner interface and AI classification
const STANDARD_TABS = [
  { id: "languages", label: "LANGUAGES", sort_order: 0 },
  { id: "frontend", label: "FRONTEND", sort_order: 1 },
  { id: "mobile", label: "MOBILE", sort_order: 2 },
  { id: "backend", label: "BACKEND & APIS", sort_order: 3 },
  { id: "databases", label: "DATABASES", sort_order: 4 },
  { id: "data", label: "DATA ENGINEERING", sort_order: 5 },
  { id: "cloud", label: "CLOUD & DEVOPS", sort_order: 6 },
  { id: "security", label: "SECURITY", sort_order: 7 },
  { id: "testing", label: "TESTING", sort_order: 8 },
];

async function seedTabs() {
  console.log("\nSeeding skill tabs...");
  for (const tab of STANDARD_TABS) {
    await db.execute({
      sql: `
        INSERT INTO skill_tabs (id, label, sort_order)
        VALUES (?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          label = excluded.label,
          sort_order = excluded.sort_order
      `,
      args: [tab.id, tab.label, tab.sort_order],
    });

    console.log(`  ✓ ${tab.label}`);
  }
}

// ── Skills (optional) ─────────────────────────────────────────────
// Seeds from skills.json if it exists.
// If the file does not exist, this step is skipped silently.
async function seedSkills() {
  const skillsPath = resolve("scripts/skills.json");

  if (!existsSync(skillsPath)) {
    console.log("\nNo skills.json found — skipping skill seed.");
    console.log("  Add skills via /owner/skills after setup.");
    return;
  }

  const skillsData = JSON.parse(readFileSync(skillsPath, 'utf-8'));
  const skillsByTab = skillsData.skills ?? {};

  console.log('\nSeeding skills from skills.json...');

  for (const tab of STANDARD_TABS) {
    const tabSkills = skillsByTab[tab.id] ?? [];

    for (const [index, skill] of tabSkills.entries()) {
      await db.execute({
        sql: `
          INSERT INTO skills (
            tab_id,
            name,
            pct,
            primary_skill,
            exposure,
            sort_order,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, unixepoch())
          ON CONFLICT(tab_id, name) DO UPDATE SET
            pct = excluded.pct,
            primary_skill = excluded.primary_skill,
            exposure = excluded.exposure,
            sort_order = excluded.sort_order,
            updated_at = unixepoch()
        `,
        args: [
          tab.id,
          skill.name,
          skill.pct ?? 80,
          skill.primary === false ? 0 : 1,
          skill.exposure ? 1 : 0,
          index,
        ],
      });
    }

    console.log(`  ✓ ${tab.id} — ${tabSkills.length} skills`);
  }
}

// ── Run ───────────────────────────────────────────────────────────
async function main() {
  console.log("Starting seed...");
  console.log(`Database: ${process.env.TURSO_DB_URL ?? "file:local.db"}`);

  try {
    await seedTabs();
    await seedSkills();
    console.log("\n✓ Seed complete.\n");
  } catch (err) {
    console.error("\n✗ Seed failed:", err.message);
    process.exit(1);
  }
}

main();
