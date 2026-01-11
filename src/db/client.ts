import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";
import { migrations } from "./migrations";

// Ensure data directory exists
import { mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

// Determine database path based on execution context
// - Production builds: store in .i-migrate folder next to the executable (portable)
// - Development (bun dev): use project's data/ folder
function getDbPath(): string {
  // In development (bun dev), NODE_ENV is not set or is "development"
  // In production builds, NODE_ENV is inlined as "production" at compile time
  const isDev = process.env.NODE_ENV === "development" || !process.env.NODE_ENV;

  if (isDev) {
    // Development mode: use project's data folder
    return join(import.meta.dir, "..", "..", "data", "i-migrate.db");
  } else {
    // Production/compiled mode: create hidden data folder next to executable
    const execDir = dirname(process.execPath);
    return join(execDir, ".i-migrate", "i-migrate.db");
  }
}

const dbPath = getDbPath();
const dbDir = dirname(dbPath);

if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

// Initialize SQLite database with WAL mode for better concurrency
const sqlite = new Database(dbPath, { create: true });
sqlite.run("PRAGMA journal_mode = WAL;");

// Run embedded migrations (SQL files bundled at build time)
function runMigrations() {
  // Create migrations tracking table
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS __migrations (
      id TEXT PRIMARY KEY NOT NULL,
      applied_at TEXT NOT NULL
    )
  `);

  // Get already-applied migrations
  const applied = new Set(
    (sqlite.query("SELECT id FROM __migrations").all() as { id: string }[]).map((r) => r.id),
  );

  // Run pending migrations in order
  for (const { id, sql } of migrations) {
    if (applied.has(id)) continue;

    // Parse statements by delimiter
    const statements = sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    // Run in transaction
    sqlite.run("BEGIN");
    try {
      for (const stmt of statements) {
        sqlite.run(stmt);
      }
      sqlite.run(`INSERT INTO __migrations (id, applied_at) VALUES (?, ?)`, [
        id,
        new Date().toISOString(),
      ]);
      sqlite.run("COMMIT");
      console.log(`Applied migration: ${id}`);
    } catch (err) {
      sqlite.run("ROLLBACK");
      throw new Error(`Migration ${id} failed: ${err}`);
    }
  }
}

runMigrations();

// Create Drizzle instance with schema
export const db = drizzle(sqlite, { schema });

// Export the raw sqlite instance if needed for advanced operations
export { sqlite };
