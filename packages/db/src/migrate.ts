import dotenv from "dotenv";
import { readFileSync, readdirSync } from "fs";
import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";
dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env") });
import { getDb } from "./client.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function migrate() {
  const db = getDb();
  await db.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const { rows: applied } = await db.query<{ filename: string }>(
    "SELECT filename FROM _migrations ORDER BY filename"
  );
  const appliedSet = new Set(applied.map((r) => r.filename));

  const migrationsDir = join(__dirname, "../migrations");
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();

  for (const file of files) {
    if (appliedSet.has(file)) continue;
    const sql = readFileSync(join(migrationsDir, file), "utf-8");
    console.log(`Applying migration: ${file}`);
    await db.query(sql);
    await db.query("INSERT INTO _migrations (filename) VALUES ($1)", [file]);
  }

  console.log("Migrations complete.");
  await db.end();
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
