import { sqliteTable, text } from "drizzle-orm/sqlite-core"

// Environment table - no password stored (passwords are kept in memory only)
export const environments = sqliteTable("environments", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  baseUrl: text("base_url").notNull(),
  username: text("username").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
})

// Type inference helpers
export type Environment = typeof environments.$inferSelect
export type NewEnvironment = typeof environments.$inferInsert

