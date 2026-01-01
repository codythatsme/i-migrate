import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"

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

// ---------------------
// Observability Tables
// ---------------------

// Traces table - represents a complete trace (collection of spans)
export const traces = sqliteTable("traces", {
  id: text("id").primaryKey(),              // trace ID (generated)
  name: text("name").notNull(),             // root span name
  status: text("status").notNull(),         // "ok" | "error" | "running"
  startTime: integer("start_time").notNull(), // Unix timestamp in ms
  endTime: integer("end_time"),             // Unix timestamp in ms (null if running)
  durationMs: integer("duration_ms"),       // Computed duration
  errorMessage: text("error_message"),      // Top-level error message if any
  createdAt: text("created_at").notNull(),  // ISO timestamp for display
})

// Spans table - individual operations within a trace
export const spans = sqliteTable("spans", {
  id: text("id").primaryKey(),              // span ID (generated)
  traceId: text("trace_id").notNull(),      // Foreign key to traces.id
  parentSpanId: text("parent_span_id"),     // Parent span ID (null for root)
  name: text("name").notNull(),             // Operation name (e.g., "imis.getBoEntityDefinitions")
  status: text("status").notNull(),         // "ok" | "error" | "running"
  kind: text("kind").notNull(),             // "internal" | "client" | "server"
  startTime: integer("start_time").notNull(), // Unix timestamp in ms
  endTime: integer("end_time"),             // Unix timestamp in ms (null if running)
  durationMs: integer("duration_ms"),       // Computed duration
  attributes: text("attributes"),           // JSON string of span attributes
  events: text("events"),                   // JSON string of span events (logs)
  errorCause: text("error_cause"),          // Pretty-printed error cause chain
})

// Type inference helpers for observability
export type Trace = typeof traces.$inferSelect
export type NewTrace = typeof traces.$inferInsert
export type Span = typeof spans.$inferSelect
export type NewSpan = typeof spans.$inferInsert

