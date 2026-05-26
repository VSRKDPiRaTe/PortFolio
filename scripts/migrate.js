// ╔═══════════════════════════════════════════════════════════════════╗
// ║  scripts/migrate.js — Database Migration Runner                  ║
// ╚═══════════════════════════════════════════════════════════════════╝
//
// WHAT THIS FILE DOES:
//   Applies SQL migration files from scripts/migrations in order.
//
// WHY:
//   migrations are for changing an existing production database safely.
//
// HOW TRACKING WORKS:
//   Applied migration filenames are stored in schema_migrations.
//   If a migration filename already exists there, it is skipped.
//
// FILE NAMING:
//   scripts/migrations/001_add_example.sql
//   scripts/migrations/002_add_indexes.sql
//
// SAFE FLOW:
//   migrate.js  → applies only new changes
//   seed.js     → inserts/updates starter content

import { createClient } from "@libsql/client";
import { existsSync, readdirSync, readFileSync } from "fs";
import { resolve } from "path";

const db = createClient({
  url: process.env.TURSO_DB_URL ?? "file:local.db",
  authToken: process.env.TURSO_AUTH_TOKEN ?? "",
});

const migrationsDir = resolve("scripts/migrations");

function splitSql(sql) {
  return sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => {
      const stripped = s
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim();

      return stripped.length > 0;
    });
}

async function ensureMigrationTable() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      filename   TEXT NOT NULL UNIQUE,
      applied_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);
}

async function hasMigration(filename) {
  const result = await db.execute({
    sql: `SELECT filename FROM schema_migrations WHERE filename = ? LIMIT 1`,
    args: [filename],
  });

  return result.rows.length > 0;
}

async function recordMigration(filename) {
  await db.execute({
    sql: `INSERT INTO schema_migrations (filename) VALUES (?)`,
    args: [filename],
  });
}

async function main() {
  console.log("Checking migrations...");
  console.log(`Database: ${process.env.TURSO_DB_URL ?? "file:local.db"}\n`);

  await ensureMigrationTable();

  if (!existsSync(migrationsDir)) {
    console.log("No scripts/migrations directory found — skipping.\n");
    return;
  }

  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  if (!files.length) {
    console.log("No migration files found — skipping.\n");
    return;
  }

  for (const file of files) {
    if (await hasMigration(file)) {
      console.log(`  ↷ skipped ${file}`);
      continue;
    }

    console.log(`  → applying ${file}`);

    const sql = readFileSync(resolve(migrationsDir, file), "utf-8");
    const statements = splitSql(sql);

    try {
      for (const statement of statements) {
        await db.execute(statement);
      }

      await recordMigration(file);
      console.log(`  ✓ applied ${file}`);
    } catch (err) {
      console.error(`  ✗ migration failed: ${file}`);
      console.error(`    ${err.message}`);
      process.exit(1);
    }
  }

  console.log("\n✓ Migrations complete.\n");
}

main();