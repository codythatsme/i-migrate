import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"

// Environment table - no password stored (passwords are kept in memory only)
export const environments = sqliteTable("environments", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  baseUrl: text("base_url").notNull(),
  username: text("username").notNull(),
  icon: text("icon"), // Base64 encoded favicon or null
  // Concurrency settings for migration jobs
  queryConcurrency: integer("query_concurrency").notNull().default(5),   // Max concurrent 500-row query batches
  insertConcurrency: integer("insert_concurrency").notNull().default(50), // Max concurrent single inserts
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
})

// Type inference helpers
export type Environment = typeof environments.$inferSelect
export type NewEnvironment = typeof environments.$inferInsert

// ---------------------
// Migration Job Tables
// ---------------------

// Job status type
export type JobStatus = "queued" | "running" | "completed" | "failed" | "partial" | "cancelled"
export type JobMode = "query" | "datasource"

// Jobs table - tracks migration jobs
export const jobs = sqliteTable("jobs", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),                         // User-provided job name
  status: text("status").notNull().$type<JobStatus>(),  // queued | running | completed | failed | partial | cancelled
  mode: text("mode").notNull().$type<JobMode>(),        // "query" | "datasource"

  // Source config
  sourceEnvironmentId: text("source_environment_id").notNull(),
  sourceQueryPath: text("source_query_path"),           // For query mode
  sourceEntityType: text("source_entity_type"),         // For datasource mode

  // Destination config
  destEnvironmentId: text("dest_environment_id").notNull(),
  destEntityType: text("dest_entity_type").notNull(),

  // Mapping (JSON stringified PropertyMapping[])
  mappings: text("mappings").notNull(),

  // Progress tracking
  totalRows: integer("total_rows"),
  processedRows: integer("processed_rows").notNull().default(0),
  successfulRows: integer("successful_rows").notNull().default(0),
  failedRowCount: integer("failed_row_count").notNull().default(0),

  // Error tracking for failed queries
  failedQueryOffsets: text("failed_query_offsets"),     // JSON array of offsets that failed

  // Timing
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
  createdAt: text("created_at").notNull(),
})

// Type inference helpers for jobs
export type Job = typeof jobs.$inferSelect
export type NewJob = typeof jobs.$inferInsert

// Failed row status type
export type FailedRowStatus = "pending" | "retrying" | "resolved"

// Failed rows table - stores failed inserts with encrypted payload for retry
export const failedRows = sqliteTable("failed_rows", {
  id: text("id").primaryKey(),
  jobId: text("job_id").notNull(),
  rowIndex: integer("row_index").notNull(),                     // Original row position in batch
  encryptedPayload: text("encrypted_payload").notNull(),        // AES-256-GCM encrypted JSON of row data
  errorMessage: text("error_message").notNull(),
  retryCount: integer("retry_count").notNull().default(0),
  status: text("status").notNull().$type<FailedRowStatus>(),    // pending | retrying | resolved
  createdAt: text("created_at").notNull(),
  resolvedAt: text("resolved_at"),
})

// Type inference helpers for failed rows
export type FailedRow = typeof failedRows.$inferSelect
export type NewFailedRow = typeof failedRows.$inferInsert

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

