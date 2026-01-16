import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

// iMIS version type - EMS (cloud) or 2017 (on-premise)
export type ImisVersion = "EMS" | "2017";

// Environment table - no password stored (passwords are kept in memory only)
export const environments = sqliteTable("environments", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  baseUrl: text("base_url").notNull(),
  username: text("username").notNull(),
  version: text("version").notNull().$type<ImisVersion>().default("EMS"), // iMIS version: EMS or 2017
  icon: text("icon"), // Base64 encoded favicon or null
  // Concurrency settings for migration jobs
  queryConcurrency: integer("query_concurrency").notNull().default(5), // Max concurrent 500-row query batches
  insertConcurrency: integer("insert_concurrency").notNull().default(50), // Max concurrent single inserts
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// Type inference helpers
export type Environment = typeof environments.$inferSelect;
export type NewEnvironment = typeof environments.$inferInsert;

// ---------------------
// Migration Job Tables
// ---------------------

// Job status type
export type JobStatus = "queued" | "running" | "completed" | "failed" | "partial" | "cancelled";
export type JobMode = "query" | "datasource";
export type DestinationType = "bo_entity" | "custom_endpoint";

// Jobs table - tracks migration jobs
export const jobs = sqliteTable("jobs", {
  id: text("id").primaryKey(),
  name: text("name").notNull(), // User-provided job name
  status: text("status").notNull().$type<JobStatus>(), // queued | running | completed | failed | partial | cancelled
  mode: text("mode").notNull().$type<JobMode>(), // "query" | "datasource"

  // Source config
  sourceEnvironmentId: text("source_environment_id").notNull(),
  sourceQueryPath: text("source_query_path"), // For query mode
  sourceEntityType: text("source_entity_type"), // For datasource mode

  // Destination config
  destEnvironmentId: text("dest_environment_id").notNull(),
  destEntityType: text("dest_entity_type").notNull(),
  destType: text("dest_type").$type<DestinationType>().notNull().default("bo_entity"),

  // Mapping (JSON stringified PropertyMapping[])
  mappings: text("mappings").notNull(),

  // Total expected rows (set after first query)
  totalRows: integer("total_rows"),

  // Error tracking for failed queries
  failedQueryOffsets: text("failed_query_offsets"), // JSON array of offsets that failed

  // Identity field names for the destination entity (JSON array of field names like ["ID", "Ordinal"])
  identityFieldNames: text("identity_field_names"),

  // Timing
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
  createdAt: text("created_at").notNull(),
});

// Type inference helpers for jobs
export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;

// ---------------------
// Row and Attempt Tables
// ---------------------

// Row status type - derived from whether any attempt succeeded
export type RowStatus = "success" | "failed";

// Rows table - unified table for all rows (replaces failedRows + successRows)
export const rows = sqliteTable(
  "rows",
  {
    id: text("id").primaryKey(),
    jobId: text("job_id").notNull(),
    rowIndex: integer("row_index").notNull(), // Original row position in source data

    // Encrypted source data for retry capability (always stored)
    encryptedPayload: text("encrypted_payload").notNull(),

    // Stored for query efficiency (denormalized from attempts)
    status: text("status").notNull().$type<RowStatus>(),

    // Identity elements from successful insert (null if failed)
    identityElements: text("identity_elements"),

    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("rows_job_id_idx").on(table.jobId),
    index("rows_job_status_idx").on(table.jobId, table.status),
  ],
);

// Type inference helpers for rows
export type Row = typeof rows.$inferSelect;
export type NewRow = typeof rows.$inferInsert;

// Attempt reason type
export type AttemptReason = "initial" | "auto_retry" | "manual_retry";

// Attempts table - individual insert attempt records
export const attempts = sqliteTable(
  "attempts",
  {
    id: text("id").primaryKey(),
    rowId: text("row_id").notNull(),

    // Why this attempt was made
    reason: text("reason").notNull().$type<AttemptReason>(),

    // Result
    success: integer("success", { mode: "boolean" }).notNull(),
    errorMessage: text("error_message"),

    // Identity elements if successful
    identityElements: text("identity_elements"),

    createdAt: text("created_at").notNull(),
  },
  (table) => [index("attempts_row_id_idx").on(table.rowId)],
);

// Type inference helpers for attempts
export type Attempt = typeof attempts.$inferSelect;
export type NewAttempt = typeof attempts.$inferInsert;

// ---------------------
// Observability Tables
// ---------------------

// Traces table - represents a complete trace (collection of spans)
export const traces = sqliteTable("traces", {
  id: text("id").primaryKey(), // trace ID (generated)
  name: text("name").notNull(), // root span name
  status: text("status").notNull(), // "ok" | "error" | "running"
  startTime: integer("start_time").notNull(), // Unix timestamp in ms
  endTime: integer("end_time"), // Unix timestamp in ms (null if running)
  durationMs: integer("duration_ms"), // Computed duration
  errorMessage: text("error_message"), // Top-level error message if any
  createdAt: text("created_at").notNull(), // ISO timestamp for display
});

// Spans table - individual operations within a trace
export const spans = sqliteTable("spans", {
  id: text("id").primaryKey(), // span ID (generated)
  traceId: text("trace_id").notNull(), // Foreign key to traces.id
  parentSpanId: text("parent_span_id"), // Parent span ID (null for root)
  name: text("name").notNull(), // Operation name (e.g., "imis.getBoEntityDefinitions")
  status: text("status").notNull(), // "ok" | "error" | "running"
  kind: text("kind").notNull(), // "internal" | "client" | "server"
  startTime: integer("start_time").notNull(), // Unix timestamp in ms
  endTime: integer("end_time"), // Unix timestamp in ms (null if running)
  durationMs: integer("duration_ms"), // Computed duration
  attributes: text("attributes"), // JSON string of span attributes
  events: text("events"), // JSON string of span events (logs)
  errorCause: text("error_cause"), // Pretty-printed error cause chain
});

// Type inference helpers for observability
export type Trace = typeof traces.$inferSelect;
export type NewTrace = typeof traces.$inferInsert;
export type Span = typeof spans.$inferSelect;
export type NewSpan = typeof spans.$inferInsert;
