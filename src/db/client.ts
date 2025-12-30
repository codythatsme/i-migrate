import { Database } from "bun:sqlite"
import { drizzle } from "drizzle-orm/bun-sqlite"
import * as schema from "./schema"

// Ensure data directory exists
import { mkdirSync, existsSync } from "node:fs"
import { dirname } from "node:path"

const dbPath = "data/i-migrate.db"
const dbDir = dirname(dbPath)

if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true })
}

// Initialize SQLite database with WAL mode for better concurrency
const sqlite = new Database(dbPath, { create: true })
sqlite.run("PRAGMA journal_mode = WAL;")

// Create Drizzle instance with schema
export const db = drizzle(sqlite, { schema })

// Export the raw sqlite instance if needed for advanced operations
export { sqlite }

