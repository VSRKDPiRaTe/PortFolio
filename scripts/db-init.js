import { createClient } from "@libsql/client";
import { readFileSync }  from "fs";
import { resolve }       from "path";

const db = createClient({
  url:       process.env.TURSO_DB_URL     ?? "file:local.db",
  authToken: process.env.TURSO_AUTH_TOKEN ?? "",
});

const schema = readFileSync(resolve("scripts/schema.sql"), "utf-8");

// Split on semicolons, then check if segment contains actual SQL
// by stripping comment lines first and seeing if anything remains.
// This fixes the bug where a CREATE TABLE preceded by a -- comment
// gets filtered out because the trimmed segment starts with "--".
const statements = schema
  .split(";")
  .map(s => s.trim())
  .filter(s => {
    // Strip comment lines, check if any real SQL remains
    const stripped = s
      .split("\n")
      .filter(line => !line.trim().startsWith("--"))
      .join("\n")
      .trim();
    return stripped.length > 0;
  });

async function main() {
  console.log("Initialising database...");
  console.log(`Database: ${process.env.TURSO_DB_URL ?? "file:local.db"}\n`);

  for (const sql of statements) {
    try {
      await db.execute(sql);
      const match = sql.match(/(?:TABLE|INDEX)(?:\s+IF NOT EXISTS)?\s+(\w+)/i);
      if (match) console.log(`  ✓ ${match[1]}`);
    } catch (err) {
      console.error(`  ✗ Failed: ${sql.slice(0, 60).replace(/\n/g, ' ')}...`);
      console.error(`    ${err.message}`);
    }
  }

  console.log("\n✓ Database ready.\n");
}

main();