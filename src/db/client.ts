import { Database } from "bun:sqlite"
import { drizzle } from "drizzle-orm/bun-sqlite"
import * as schema from "./schema"

// Ensure data directory exists
import { mkdirSync, existsSync } from "node:fs"
import { dirname, join, basename } from "node:path"

// Determine database path based on execution context
// - Compiled executable: store in .i-migrate folder next to the executable (portable)
// - Development (bun run): use project's data/ folder
function getDbPath(): string {
  const execName = basename(process.execPath)
  const isCompiled = execName === "i-migrate" || execName === "i-migrate.exe"

  if (isCompiled) {
    // Portable mode: create hidden data folder next to executable
    const execDir = dirname(process.execPath)
    return join(execDir, ".i-migrate", "i-migrate.db")
  } else {
    // Development mode: use project's data folder
    return join(import.meta.dir, "..", "..", "data", "i-migrate.db")
  }
}

const dbPath = getDbPath()
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

