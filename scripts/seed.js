// ╔═══════════════════════════════════════════════════════════════════╗
// ║  scripts/seed.js — Seed Database                                 ║
// ╚═══════════════════════════════════════════════════════════════════╝
//
// WHAT THIS FILE IS:
//   One-time bootstrap script. Seeds the database with the minimum
//   data needed for the portfolio to function before the owner
//   has entered anything via the owner interface.
//
// WHAT IS SEEDED:
//   1. skill_tabs — the 9 industry-standard category headings.
//      These are factual groupings that never change in meaning,
//      only the owner can add/rename additional tabs later.
//
//   2. skills (optional) — reads from skills.json
//      if the file exists. This is a temporary convenience for the
//      initial setup. Once the owner interface is working and the
//      owner has entered real skills, this file can be deleted
//      and skills will never be seeded from JSON again.
//
// WHAT IS NOT SEEDED:
//   experience  → entered manually via owner interface
//   projects    → auto-synced from GitHub when owner opens /owner/projects
//
// HOW TO RUN:
//   node --env-file=.env.development scripts/seed.js
//
// SAFE TO RE-RUN:
//   All inserts use INSERT OR IGNORE — existing rows are never
//   overwritten. Running this multiple times has no side effects.

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
      sql: `INSERT OR IGNORE INTO skill_tabs (id, label, sort_order) VALUES (?, ?, ?)`,
      args: [tab.id, tab.label, tab.sort_order],
    });
    console.log(`  ✓ ${tab.label}`);
  }
}

// ── Skills (optional) ─────────────────────────────────────────────
// Seeds from skills.json if it exists.
// If the file does not exist, this step is skipped silently.
async function seedSkills() {
  const skillsPath = resolve("skills.json");

  if (!existsSync(skillsPath)) {
    console.log("\nNo skills.json found — skipping skill seed.");
    console.log("  Add skills via /owner/skills after setup.");
    return;
  }

  const skillsData = JSON.parse(readFileSync(skillsPath, "utf-8"));
  console.log("\nSeeding skills from skills.json...");

  for (const tab of skillsData.tabs ?? []) {
    const tabSkills = skillsData.skills?.[tab.id] ?? [];

    for (const [j, skill] of tabSkills.entries()) {
      await db.execute({
        sql: `INSERT OR IGNORE INTO skills
                (tab_id, name, pct, primary_skill, exposure, sort_order)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: [
          tab.id,
          skill.name,
          skill.pct ?? 80,
          skill.primary ? 1 : 0,
          skill.exposure ? 1 : 0,
          j,
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
