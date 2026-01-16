import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";

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

// Auto-create tables if they don't exist (for portable executable)
// This embeds the schema directly since migration files aren't bundled
function initializeSchema() {
  // Check if tables exist
  const tables = sqlite.query("SELECT name FROM sqlite_master WHERE type='table'").all() as {
    name: string;
  }[];
  const tableNames = new Set(tables.map((t) => t.name));

  if (!tableNames.has("environments")) {
    sqlite.run(`
      CREATE TABLE environments (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        base_url TEXT NOT NULL,
        username TEXT NOT NULL,
        version TEXT NOT NULL DEFAULT 'EMS',
        icon TEXT,
        query_concurrency INTEGER NOT NULL DEFAULT 5,
        insert_concurrency INTEGER NOT NULL DEFAULT 50,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
  }

  if (!tableNames.has("jobs")) {
    sqlite.run(`
      CREATE TABLE jobs (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        status TEXT NOT NULL,
        mode TEXT NOT NULL,
        source_environment_id TEXT NOT NULL,
        source_query_path TEXT,
        source_entity_type TEXT,
        dest_environment_id TEXT NOT NULL,
        dest_entity_type TEXT NOT NULL,
        dest_type TEXT NOT NULL DEFAULT 'bo_entity',
        mappings TEXT NOT NULL,
        total_rows INTEGER,
        failed_query_offsets TEXT,
        identity_field_names TEXT,
        started_at TEXT,
        completed_at TEXT,
        created_at TEXT NOT NULL
      )
    `);
  }

  // Create rows table (unified success/failed rows)
  if (!tableNames.has("rows")) {
    sqlite.run(`
      CREATE TABLE rows (
        id TEXT PRIMARY KEY NOT NULL,
        job_id TEXT NOT NULL,
        row_index INTEGER NOT NULL,
        encrypted_payload TEXT NOT NULL,
        status TEXT NOT NULL,
        identity_elements TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
    sqlite.run(`CREATE INDEX rows_job_id_idx ON rows (job_id)`);
    sqlite.run(`CREATE INDEX rows_job_status_idx ON rows (job_id, status)`);
  }

  // Create attempts table for tracking individual insert attempts
  if (!tableNames.has("attempts")) {
    sqlite.run(`
      CREATE TABLE attempts (
        id TEXT PRIMARY KEY NOT NULL,
        row_id TEXT NOT NULL,
        reason TEXT NOT NULL,
        success INTEGER NOT NULL,
        error_message TEXT,
        identity_elements TEXT,
        created_at TEXT NOT NULL
      )
    `);
    sqlite.run(`CREATE INDEX attempts_row_id_idx ON attempts (row_id)`);
  }

  if (!tableNames.has("traces")) {
    sqlite.run(`
      CREATE TABLE traces (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        status TEXT NOT NULL,
        start_time INTEGER NOT NULL,
        end_time INTEGER,
        duration_ms INTEGER,
        error_message TEXT,
        created_at TEXT NOT NULL
      )
    `);
  }

  if (!tableNames.has("spans")) {
    sqlite.run(`
      CREATE TABLE spans (
        id TEXT PRIMARY KEY NOT NULL,
        trace_id TEXT NOT NULL,
        parent_span_id TEXT,
        name TEXT NOT NULL,
        status TEXT NOT NULL,
        kind TEXT NOT NULL,
        start_time INTEGER NOT NULL,
        end_time INTEGER,
        duration_ms INTEGER,
        attributes TEXT,
        events TEXT,
        error_cause TEXT
      )
    `);
  }
}

initializeSchema();

// Create Drizzle instance with schema
export const db = drizzle(sqlite, { schema });

// Export the raw sqlite instance if needed for advanced operations
export { sqlite };
