import { Effect, Layer, Data, Ref, Schedule, Duration } from "effect";
import { eq, sql, and } from "drizzle-orm";
import { db } from "../db/client";
import {
  jobs,
  rows,
  attempts,
  environments,
  type Job,
  type NewJob,
  type NewRow,
  type NewAttempt,
  type JobStatus,
  type JobMode,
  type RowStatus,
  type AttemptReason,
  type DestinationType,
} from "../db/schema";
import { ImisApiService, MissingCredentialsError, type ImisApiError } from "./imis-api";
import { SessionService } from "./session";
import { PersistenceService, DatabaseError, EnvironmentNotFoundError } from "./persistence";
import { encryptJson, decryptJson } from "../lib/encryption";
import type { PropertyMapping } from "../components/export/PropertyMapper";
import { CUSTOM_ENDPOINT_DEFINITIONS, CUSTOM_ENDPOINT_BUILDERS } from "../api/destinations";

// ---------------------
// Domain Errors
// ---------------------

export class JobNotFoundError extends Data.TaggedError("JobNotFoundError")<{
  readonly jobId: string;
}> {
  override get message() {
    return `Job not found: ${this.jobId}`;
  }
}

export class JobAlreadyRunningError extends Data.TaggedError("JobAlreadyRunningError")<{
  readonly jobId: string;
}> {
  override get message() {
    return `Job is already running: ${this.jobId}`;
  }
}

export class MigrationError extends Data.TaggedError("MigrationError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class InsertFailedError extends Data.TaggedError("InsertFailedError")<{
  readonly rowIndex: number;
  readonly message: string;
  readonly cause?: unknown;
}> {}

// ---------------------
// Types
// ---------------------

export type CreateJobConfig = {
  name: string;
  mode: JobMode;
  sourceEnvironmentId: string;
  sourceQueryPath?: string;
  sourceEntityType?: string;
  destEnvironmentId: string;
  destEntityType: string;
  destType?: DestinationType;
  mappings: PropertyMapping[];
};

export type JobProgress = {
  totalRows: number | null;
  processedRows: number;
  successfulRows: number;
  failedRowCount: number;
};

export type JobWithProgress = Job & {
  progress: number; // 0-100 percentage
};

// Binary blob type for iMIS binary property values
export type BinaryBlob = {
  $type: "System.Byte[], mscorlib";
  $value: string;
};

// Type guard to check if a value is a binary blob
export const isBinaryBlob = (value: unknown): value is BinaryBlob => {
  return (
    typeof value === "object" &&
    value !== null &&
    "$type" in value &&
    "$value" in value &&
    (value as { $type: string }).$type === "System.Byte[], mscorlib"
  );
};

// Row data type for transformations (includes binary blobs)
type RowData = Record<string, string | number | boolean | null | BinaryBlob>;

// ---------------------
// Retry Configuration
// ---------------------

// Query retry schedule: 3 retries with exponential backoff
// Note: Insert retries are handled internally by imisApi.insertEntity via executeWithAuth
const queryRetrySchedule = Schedule.exponential(Duration.millis(1000), 2).pipe(
  Schedule.intersect(Schedule.recurs(3)),
);

// ---------------------
// Helper Functions (Exported for testing)
// ---------------------

/**
 * Transform a source row to destination format using property mappings.
 * Filters out non-primitive values (except binary blobs) and only includes mappings with a destination.
 */
export const transformRow = (
  sourceRow: Record<string, unknown>,
  mappings: PropertyMapping[],
): RowData => {
  const result: RowData = {};
  for (const mapping of mappings) {
    if (mapping.destinationProperty !== null) {
      const value = sourceRow[mapping.sourceProperty];
      // Include binary blobs (preserving structure for iMIS API)
      if (isBinaryBlob(value)) {
        result[mapping.destinationProperty] = value;
      }
      // Include primitive values
      else if (
        value === null ||
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
        result[mapping.destinationProperty] = value;
      }
    }
  }
  return result;
};

/**
 * Generate offsets for paginated queries.
 * Returns array of offsets starting from 0 up to totalCount.
 */
export const generateOffsets = (totalCount: number, batchSize: number = 500): number[] => {
  const batches = Math.ceil(totalCount / batchSize);
  return Array.from({ length: batches }, (_, i) => i * batchSize);
};

// ---------------------
// Service Definition
// ---------------------

export class MigrationJobService extends Effect.Service<MigrationJobService>()(
  "app/MigrationJobService",
  {
    accessors: true,

    effect: Effect.gen(function* () {
      const imisApi = yield* ImisApiService;
      const sessionService = yield* SessionService;
      const _persistence = yield* PersistenceService;

      // ---------------------
      // Database Operations
      // ---------------------

      const getJobById = (jobId: string) =>
        Effect.gen(function* () {
          const results = yield* Effect.try({
            try: () => db.select().from(jobs).where(eq(jobs.id, jobId)).all(),
            catch: (cause) => new DatabaseError({ message: "Failed to fetch job", cause }),
          });
          const job = results[0];
          if (!job) {
            return yield* Effect.fail(new JobNotFoundError({ jobId }));
          }
          return job;
        });

      const updateJobStatus = (
        jobId: string,
        updates: Partial<{
          totalRows: number | null;
          status: JobStatus;
          startedAt: string;
          completedAt: string;
          failedQueryOffsets: string;
          identityFieldNames: string;
        }>,
      ) =>
        Effect.try({
          try: () => db.update(jobs).set(updates).where(eq(jobs.id, jobId)).run(),
          catch: (cause) => new DatabaseError({ message: "Failed to update job status", cause }),
        });

      // ---------------------
      // Row/Attempt Database Operations
      // ---------------------

      const insertRow = (row: NewRow) =>
        Effect.try({
          try: () => db.insert(rows).values(row).run(),
          catch: (cause) => new DatabaseError({ message: "Failed to insert row", cause }),
        });

      const insertAttempt = (attempt: NewAttempt) =>
        Effect.try({
          try: () => db.insert(attempts).values(attempt).run(),
          catch: (cause) => new DatabaseError({ message: "Failed to insert attempt", cause }),
        });

      const getRowById = (rowId: string) =>
        Effect.gen(function* () {
          const results = yield* Effect.try({
            try: () => db.select().from(rows).where(eq(rows.id, rowId)).all(),
            catch: (cause) => new DatabaseError({ message: "Failed to fetch row", cause }),
          });
          return results[0] ?? null;
        });

      const updateRow = (
        rowId: string,
        updates: Partial<{ status: RowStatus; identityElements: string; updatedAt: string }>,
      ) =>
        Effect.try({
          try: () => db.update(rows).set(updates).where(eq(rows.id, rowId)).run(),
          catch: (cause) => new DatabaseError({ message: "Failed to update row", cause }),
        });

      const getFailedRowsForJob = (jobId: string) =>
        Effect.try({
          try: () =>
            db
              .select()
              .from(rows)
              .where(and(eq(rows.jobId, jobId), eq(rows.status, "failed")))
              .all(),
          catch: (cause) => new DatabaseError({ message: "Failed to fetch failed rows", cause }),
        });

      const getAttemptsForRow = (rowId: string) =>
        Effect.try({
          try: () =>
            db
              .select()
              .from(attempts)
              .where(eq(attempts.rowId, rowId))
              .orderBy(attempts.createdAt)
              .all(),
          catch: (cause) => new DatabaseError({ message: "Failed to fetch attempts", cause }),
        });

      const deleteRowsForJob = (jobId: string) =>
        Effect.gen(function* () {
          // First get all row IDs for this job
          const jobRows = yield* Effect.try({
            try: () => db.select({ id: rows.id }).from(rows).where(eq(rows.jobId, jobId)).all(),
            catch: (cause) => new DatabaseError({ message: "Failed to fetch rows", cause }),
          });

          // Delete all attempts for these rows
          for (const row of jobRows) {
            yield* Effect.try({
              try: () => db.delete(attempts).where(eq(attempts.rowId, row.id)).run(),
              catch: (cause) => new DatabaseError({ message: "Failed to delete attempts", cause }),
            });
          }

          // Delete all rows for this job
          yield* Effect.try({
            try: () => db.delete(rows).where(eq(rows.jobId, jobId)).run(),
            catch: (cause) => new DatabaseError({ message: "Failed to delete rows", cause }),
          });
        });

      const getJobCounts = (jobId: string) =>
        Effect.try({
          try: () => {
            const result = db
              .select({
                processedRows: sql<number>`COUNT(*)`,
                successfulRows: sql<number>`SUM(CASE WHEN ${rows.status} = 'success' THEN 1 ELSE 0 END)`,
                failedRowCount: sql<number>`SUM(CASE WHEN ${rows.status} = 'failed' THEN 1 ELSE 0 END)`,
              })
              .from(rows)
              .where(eq(rows.jobId, jobId))
              .get();
            return {
              processedRows: result?.processedRows ?? 0,
              successfulRows: result?.successfulRows ?? 0,
              failedRowCount: result?.failedRowCount ?? 0,
            };
          },
          catch: (cause) => new DatabaseError({ message: "Failed to get job counts", cause }),
        });

      const getEnvironmentConcurrency = (envId: string) =>
        Effect.gen(function* () {
          const results = yield* Effect.try({
            try: () => db.select().from(environments).where(eq(environments.id, envId)).all(),
            catch: (cause) => new DatabaseError({ message: "Failed to fetch environment", cause }),
          });
          const env = results[0];
          if (!env) {
            return yield* Effect.fail(new EnvironmentNotFoundError({ id: envId }));
          }
          return {
            queryConcurrency: env.queryConcurrency,
            insertConcurrency: env.insertConcurrency,
          };
        });

      // ---------------------
      // Migration Logic
      // ---------------------

      const executeQueryWithRetry = (envId: string, queryPath: string, offset: number) =>
        imisApi.executeQuery(envId, queryPath, 500, offset).pipe(
          Effect.retry({
            schedule: queryRetrySchedule,
            while: (error: ImisApiError) => {
              // Retry on transient errors (5xx, network issues)
              if (error._tag === "ImisRequestError") return true;
              if (error._tag === "ImisResponseError" && error.status >= 500) return true;
              return false;
            },
          }),
          Effect.withSpan("migration.executeQueryBatch", {
            attributes: { queryPath, offset },
          }),
        );

      const executeDataSourceWithRetry = (envId: string, entityTypeName: string, offset: number) =>
        imisApi.fetchDataSource(envId, entityTypeName, 500, offset).pipe(
          Effect.retry({
            schedule: queryRetrySchedule,
            while: (error: ImisApiError) => {
              // Retry on transient errors (5xx, network issues)
              if (error._tag === "ImisRequestError") return true;
              if (error._tag === "ImisResponseError" && error.status >= 500) return true;
              return false;
            },
          }),
          Effect.withSpan("migration.executeDataSourceBatch", {
            attributes: { entityTypeName, offset },
          }),
        );

      // Execute insert via iMIS API - retry logic is handled internally by executeWithAuth (4 attempts)
      const executeInsert = (
        envId: string,
        entityTypeName: string,
        parentEntityTypeName: string,
        parentId: string | null,
        rowData: RowData,
        rowIndex: number,
      ) =>
        imisApi.insertEntity(envId, entityTypeName, parentEntityTypeName, parentId, rowData).pipe(
          Effect.map((result) => ({
            rowIndex,
            identityElements: result.identityElements,
          })),
          Effect.mapError(
            (error) =>
              new InsertFailedError({
                rowIndex,
                message: error.message,
                cause: error,
              }),
          ),
          Effect.withSpan("migration.executeInsert", {
            attributes: { entityTypeName, rowIndex },
          }),
        );

      // Execute insert with destType branching - handles both BO entity and custom endpoint
      const executeRowInsert = (
        envId: string,
        entityTypeName: string,
        destType: DestinationType,
        rowData: RowData,
        rowIndex: number,
      ) => {
        if (destType === "custom_endpoint") {
          const def = CUSTOM_ENDPOINT_DEFINITIONS.find((d) => d.entityTypeName === entityTypeName);
          if (!def?.endpointPath || !def?.requestBodyBuilder) {
            return Effect.fail(
              new InsertFailedError({
                rowIndex,
                message: `No endpoint definition found for custom endpoint: ${entityTypeName}`,
              }),
            );
          }
          const builder = CUSTOM_ENDPOINT_BUILDERS[def.requestBodyBuilder];
          if (!builder) {
            return Effect.fail(
              new InsertFailedError({
                rowIndex,
                message: `No builder found for custom endpoint: ${def.requestBodyBuilder}`,
              }),
            );
          }
          const body = builder(rowData);
          return imisApi.insertCustomEndpoint(envId, def.endpointPath, body).pipe(
            Effect.map((result) => ({
              rowIndex,
              identityElements: result.identityElements,
            })),
            Effect.mapError(
              (error) =>
                new InsertFailedError({
                  rowIndex,
                  message: error.message,
                  cause: error,
                }),
            ),
            Effect.withSpan("migration.executeCustomEndpointInsert", {
              attributes: { entityTypeName, rowIndex },
            }),
          );
        }
        return executeInsert(envId, entityTypeName, "Standalone", null, rowData, rowIndex);
      };

      const processBatchRows = (
        jobId: string,
        sourceRows: readonly Record<string, unknown>[],
        mappings: PropertyMapping[],
        destEnvId: string,
        destEntityType: string,
        destType: DestinationType,
        sourceEnvId: string,
        insertConcurrency: number,
        batchStartIndex: number,
      ) =>
        Effect.gen(function* () {
          // Get source password for encrypting row data
          const sourcePassword = yield* sessionService.getPassword(sourceEnvId);
          if (!sourcePassword) {
            return yield* Effect.fail(new MissingCredentialsError({ environmentId: sourceEnvId }));
          }

          // Transform rows
          const transformedRows = sourceRows.map((row, index) => ({
            original: row,
            transformed: transformRow(row, mappings),
            index: batchStartIndex + index,
          }));

          // Branch on destination type
          let failures: InsertFailedError[];
          let successes: { rowIndex: number; identityElements: string[] }[];

          if (destType === "custom_endpoint") {
            // Custom endpoint insertion
            const def = CUSTOM_ENDPOINT_DEFINITIONS.find(
              (d) => d.entityTypeName === destEntityType,
            );
            if (!def?.endpointPath || !def?.requestBodyBuilder) {
              return yield* Effect.fail(
                new MigrationError({
                  message: `No endpoint definition found for custom endpoint: ${destEntityType}`,
                }),
              );
            }

            const builder = CUSTOM_ENDPOINT_BUILDERS[def.requestBodyBuilder];
            if (!builder) {
              return yield* Effect.fail(
                new MigrationError({
                  message: `No builder found for custom endpoint: ${def.requestBodyBuilder}`,
                }),
              );
            }

            [failures, successes] = yield* Effect.partition(
              transformedRows,
              ({ transformed, index }) => {
                const body = builder(transformed);
                return imisApi.insertCustomEndpoint(destEnvId, def.endpointPath!, body).pipe(
                  Effect.map((result) => ({
                    rowIndex: index,
                    identityElements: result.identityElements,
                  })),
                  Effect.mapError(
                    (error) =>
                      new InsertFailedError({
                        rowIndex: index,
                        message: error.message,
                        cause: error,
                      }),
                  ),
                );
              },
              { concurrency: insertConcurrency },
            );
          } else {
            // Standard BO entity insertion
            // Note: Automatic retries (4 attempts) are handled inside imisApi.insertEntity via executeWithAuth
            [failures, successes] = yield* Effect.partition(
              transformedRows,
              ({ transformed, index }) =>
                executeInsert(
                  destEnvId,
                  destEntityType,
                  "Standalone", // Default to Standalone for now
                  null,
                  transformed,
                  index,
                ),
              { concurrency: insertConcurrency },
            );
          }

          const now = new Date().toISOString();

          // Store success rows with identity elements
          for (const success of successes) {
            const rowData = transformedRows.find((r) => r.index === success.rowIndex);
            if (!rowData) continue;

            // Encrypt the row data (always store for potential future retry)
            const encryptedPayload = yield* Effect.promise(() =>
              encryptJson(rowData.original, sourcePassword),
            );

            const rowId = crypto.randomUUID();

            // Create row record
            yield* insertRow({
              id: rowId,
              jobId,
              rowIndex: success.rowIndex,
              encryptedPayload,
              status: "success",
              identityElements: JSON.stringify(success.identityElements),
              createdAt: now,
              updatedAt: now,
            });

            // Create single successful attempt record
            yield* insertAttempt({
              id: crypto.randomUUID(),
              rowId,
              reason: "initial",
              success: true,
              errorMessage: null,
              identityElements: JSON.stringify(success.identityElements),
              createdAt: now,
            });
          }

          // Store failed rows with attempt records
          for (const failure of failures) {
            const rowData = transformedRows.find((r) => r.index === failure.rowIndex);
            if (!rowData) continue;

            // Encrypt the row data
            const encryptedPayload = yield* Effect.promise(() =>
              encryptJson(rowData.original, sourcePassword),
            );

            const rowId = crypto.randomUUID();

            // Create row record with failed status
            yield* insertRow({
              id: rowId,
              jobId,
              rowIndex: failure.rowIndex,
              encryptedPayload,
              status: "failed",
              identityElements: null,
              createdAt: now,
              updatedAt: now,
            });

            // Create attempt records for initial + auto_retries (4 total attempts)
            // First is "initial", remaining 3 are "auto_retry"
            const attemptReasons: AttemptReason[] = [
              "initial",
              "auto_retry",
              "auto_retry",
              "auto_retry",
            ];
            for (const reason of attemptReasons) {
              yield* insertAttempt({
                id: crypto.randomUUID(),
                rowId,
                reason,
                success: false,
                errorMessage: failure.message,
                identityElements: null,
                createdAt: now,
              });
            }
          }

          return { successCount: successes.length, failCount: failures.length };
        });

      // ---------------------
      // Public API
      // ---------------------

      return {
        /**
         * Create a new migration job and queue it for execution.
         */
        createJob: (config: CreateJobConfig) =>
          Effect.gen(function* () {
            const jobId = crypto.randomUUID();
            const now = new Date().toISOString();

            const newJob: NewJob = {
              id: jobId,
              name: config.name,
              status: "queued",
              mode: config.mode,
              sourceEnvironmentId: config.sourceEnvironmentId,
              sourceQueryPath: config.sourceQueryPath ?? null,
              sourceEntityType: config.sourceEntityType ?? null,
              destEnvironmentId: config.destEnvironmentId,
              destEntityType: config.destEntityType,
              destType: config.destType ?? "bo_entity",
              mappings: JSON.stringify(config.mappings),
              totalRows: null,
              failedQueryOffsets: null,
              startedAt: null,
              completedAt: null,
              createdAt: now,
            };

            yield* Effect.try({
              try: () => db.insert(jobs).values(newJob).run(),
              catch: (cause) => new DatabaseError({ message: "Failed to create job", cause }),
            });

            return { jobId };
          }).pipe(
            Effect.withSpan("migrationJob.createJob", {
              attributes: { name: config.name, mode: config.mode },
            }),
          ),

        /**
         * Run a queued migration job.
         * This is the main migration execution function.
         */
        runJob: (jobId: string) =>
          Effect.gen(function* () {
            // Get job
            const job = yield* getJobById(jobId);

            // Verify job is in queued state
            if (job.status !== "queued") {
              return yield* Effect.fail(new JobAlreadyRunningError({ jobId }));
            }

            // Parse mappings
            const mappings = JSON.parse(job.mappings) as PropertyMapping[];

            // Get concurrency settings from destination environment
            const { queryConcurrency, insertConcurrency } = yield* getEnvironmentConcurrency(
              job.destEnvironmentId,
            );

            // Fetch and store identity field names for the destination entity type
            const identityFieldNames = yield* imisApi.getIdentityFieldNames(
              job.destEnvironmentId,
              job.destEntityType,
            );
            yield* updateJobStatus(jobId, {
              identityFieldNames: JSON.stringify(identityFieldNames),
            });

            // Track failed query offsets
            const failedOffsetsRef = yield* Ref.make<number[]>([]);

            // Mark job as running
            yield* updateJobStatus(jobId, {
              status: "running",
              startedAt: new Date().toISOString(),
            });

            // Execute with status tracking
            const result = yield* Effect.gen(function* () {
              // Query mode execution
              if (job.mode === "query" && job.sourceQueryPath) {
                // First query to get total count
                const firstBatch = yield* executeQueryWithRetry(
                  job.sourceEnvironmentId,
                  job.sourceQueryPath,
                  0,
                );

                const totalRows = firstBatch.TotalCount;
                yield* updateJobStatus(jobId, { totalRows });

                // Process first batch
                if (firstBatch.Items.$values.length > 0) {
                  yield* processBatchRows(
                    jobId,
                    firstBatch.Items.$values,
                    mappings,
                    job.destEnvironmentId,
                    job.destEntityType,
                    job.destType,
                    job.sourceEnvironmentId,
                    insertConcurrency,
                    0, // First batch starts at index 0
                  );
                }

                // Generate remaining offsets
                const remainingOffsets = generateOffsets(totalRows).slice(1);

                // Execute remaining queries with concurrency control
                yield* Effect.forEach(
                  remainingOffsets,
                  (offset) =>
                    Effect.gen(function* () {
                      const batch = yield* executeQueryWithRetry(
                        job.sourceEnvironmentId,
                        job.sourceQueryPath!,
                        offset,
                      ).pipe(
                        Effect.catchAll((_error) => {
                          // Record failed offset for retry
                          return Effect.gen(function* () {
                            yield* Ref.update(failedOffsetsRef, (offsets) => [...offsets, offset]);
                            // Return empty result to continue with other batches
                            return {
                              $type: "",
                              Items: { $type: "", $values: [] as Record<string, unknown>[] },
                              Offset: offset,
                              Limit: 500,
                              Count: 0,
                              TotalCount: totalRows,
                              NextPageLink: null,
                              HasNext: false,
                              NextOffset: offset + 500,
                            };
                          });
                        }),
                      );

                      // Process the batch
                      if (batch.Items.$values.length > 0) {
                        yield* processBatchRows(
                          jobId,
                          batch.Items.$values,
                          mappings,
                          job.destEnvironmentId,
                          job.destEntityType,
                          job.destType,
                          job.sourceEnvironmentId,
                          insertConcurrency,
                          offset,
                        );
                      }
                    }),
                  { concurrency: queryConcurrency },
                );

                const failedOffsets = yield* Ref.get(failedOffsetsRef);
                return { failedOffsets, totalRows };
              }

              // Datasource mode execution
              if (job.mode === "datasource" && job.sourceEntityType) {
                // First fetch to get total count
                const firstBatch = yield* executeDataSourceWithRetry(
                  job.sourceEnvironmentId,
                  job.sourceEntityType,
                  0,
                );

                const totalRows = firstBatch.TotalCount;
                yield* updateJobStatus(jobId, { totalRows });

                // Process first batch
                if (firstBatch.Items.$values.length > 0) {
                  yield* processBatchRows(
                    jobId,
                    firstBatch.Items.$values,
                    mappings,
                    job.destEnvironmentId,
                    job.destEntityType,
                    job.destType,
                    job.sourceEnvironmentId,
                    insertConcurrency,
                    0,
                  );
                }

                // Generate remaining offsets
                const remainingOffsets = generateOffsets(totalRows).slice(1);

                // Execute remaining fetches with concurrency control
                yield* Effect.forEach(
                  remainingOffsets,
                  (offset) =>
                    Effect.gen(function* () {
                      const batch = yield* executeDataSourceWithRetry(
                        job.sourceEnvironmentId,
                        job.sourceEntityType!,
                        offset,
                      ).pipe(
                        Effect.catchAll((_error) => {
                          // Record failed offset for retry
                          return Effect.gen(function* () {
                            yield* Ref.update(failedOffsetsRef, (offsets) => [...offsets, offset]);
                            // Return empty result to continue with other batches
                            return {
                              $type: "",
                              Items: { $type: "", $values: [] as Record<string, unknown>[] },
                              Offset: offset,
                              Limit: 500,
                              Count: 0,
                              TotalCount: totalRows,
                              NextPageLink: null,
                              HasNext: false,
                              NextOffset: offset + 500,
                            };
                          });
                        }),
                      );

                      // Process the batch
                      if (batch.Items.$values.length > 0) {
                        yield* processBatchRows(
                          jobId,
                          batch.Items.$values,
                          mappings,
                          job.destEnvironmentId,
                          job.destEntityType,
                          job.destType,
                          job.sourceEnvironmentId,
                          insertConcurrency,
                          offset,
                        );
                      }
                    }),
                  { concurrency: queryConcurrency },
                );

                const failedOffsets = yield* Ref.get(failedOffsetsRef);
                return { failedOffsets, totalRows };
              }

              // Should not reach here - invalid mode configuration
              return yield* Effect.fail(
                new MigrationError({
                  message: `Invalid job configuration: mode=${job.mode}, sourceQueryPath=${job.sourceQueryPath}, sourceEntityType=${job.sourceEntityType}`,
                }),
              );
            }).pipe(
              Effect.tap(({ failedOffsets }) =>
                Effect.gen(function* () {
                  // Get final counts from the rows table
                  const counts = yield* getJobCounts(jobId);
                  const hasFailed = counts.failedRowCount > 0 || failedOffsets.length > 0;

                  yield* updateJobStatus(jobId, {
                    failedQueryOffsets:
                      failedOffsets.length > 0 ? JSON.stringify(failedOffsets) : undefined,
                    status: hasFailed ? "partial" : "completed",
                    completedAt: new Date().toISOString(),
                  });
                }),
              ),
              Effect.catchAll((error) =>
                Effect.gen(function* () {
                  yield* updateJobStatus(jobId, {
                    status: "failed",
                    completedAt: new Date().toISOString(),
                  });
                  return yield* Effect.fail(error);
                }),
              ),
            );

            return result;
          }).pipe(
            Effect.withSpan("migrationJob.runJob", {
              attributes: { jobId },
            }),
          ),

        /**
         * Retry failed rows for a job.
         */
        retryFailedRows: (jobId: string) =>
          Effect.gen(function* () {
            const job = yield* getJobById(jobId);
            const failedRowsList = yield* getFailedRowsForJob(jobId);

            if (failedRowsList.length === 0) {
              return { retriedCount: 0, successCount: 0, failCount: 0 };
            }

            // Get source password for decrypting
            const sourcePassword = yield* sessionService.getPassword(job.sourceEnvironmentId);
            if (!sourcePassword) {
              return yield* Effect.fail(
                new MissingCredentialsError({ environmentId: job.sourceEnvironmentId }),
              );
            }

            // Parse mappings
            const mappings = JSON.parse(job.mappings) as PropertyMapping[];

            // Get concurrency settings
            const { insertConcurrency } = yield* getEnvironmentConcurrency(job.destEnvironmentId);

            let successCount = 0;
            let failCount = 0;
            const now = new Date().toISOString();

            // Retry each failed row
            yield* Effect.forEach(
              failedRowsList,
              (row) =>
                Effect.gen(function* () {
                  // Decrypt the payload
                  const originalRow = yield* Effect.promise(() =>
                    decryptJson<Record<string, unknown>>(row.encryptedPayload, sourcePassword),
                  );

                  // Transform and insert
                  const transformed = transformRow(originalRow, mappings);

                  yield* executeRowInsert(
                    job.destEnvironmentId,
                    job.destEntityType,
                    job.destType,
                    transformed,
                    row.rowIndex,
                  ).pipe(
                    Effect.tap((result) =>
                      Effect.gen(function* () {
                        // Success - update row status and create success attempt
                        yield* updateRow(row.id, {
                          status: "success",
                          identityElements: JSON.stringify(result.identityElements),
                          updatedAt: now,
                        });
                        yield* insertAttempt({
                          id: crypto.randomUUID(),
                          rowId: row.id,
                          reason: "manual_retry",
                          success: true,
                          errorMessage: null,
                          identityElements: JSON.stringify(result.identityElements),
                          createdAt: now,
                        });
                        successCount++;
                      }),
                    ),
                    Effect.catchAll((error) =>
                      Effect.gen(function* () {
                        // Still failing - add failed attempt (row status stays "failed")
                        yield* updateRow(row.id, { updatedAt: now });
                        yield* insertAttempt({
                          id: crypto.randomUUID(),
                          rowId: row.id,
                          reason: "manual_retry",
                          success: false,
                          errorMessage: error.message,
                          identityElements: null,
                          createdAt: now,
                        });
                        failCount++;
                      }),
                    ),
                  );
                }),
              { concurrency: insertConcurrency },
            );

            // Check if job should be marked as completed
            const counts = yield* getJobCounts(jobId);
            const failedOffsets = job.failedQueryOffsets
              ? (JSON.parse(job.failedQueryOffsets) as number[])
              : [];
            const shouldMarkCompleted =
              counts.failedRowCount === 0 && failedOffsets.length === 0 && job.status === "partial";

            if (shouldMarkCompleted) {
              yield* updateJobStatus(jobId, { status: "completed" });
            }

            return {
              retriedCount: failedRowsList.length,
              successCount,
              failCount,
            };
          }).pipe(
            Effect.withSpan("migrationJob.retryFailedRows", {
              attributes: { jobId },
            }),
          ),

        /**
         * Retry a single failed row.
         * Returns the updated row with attempts info on failure, or null on success.
         */
        retrySingleRow: (rowId: string) =>
          Effect.gen(function* () {
            // Get the row
            const row = yield* getRowById(rowId);
            if (!row) {
              return yield* Effect.fail(new DatabaseError({ message: `Row not found: ${rowId}` }));
            }

            if (row.status !== "failed") {
              return yield* Effect.fail(
                new DatabaseError({ message: `Row is not in failed status: ${rowId}` }),
              );
            }

            // Get job for mappings and environment info
            const job = yield* getJobById(row.jobId);

            // Get source password for decrypting
            const sourcePassword = yield* sessionService.getPassword(job.sourceEnvironmentId);
            if (!sourcePassword) {
              return yield* Effect.fail(
                new MissingCredentialsError({ environmentId: job.sourceEnvironmentId }),
              );
            }

            // Parse mappings
            const mappings = JSON.parse(job.mappings) as PropertyMapping[];

            // Decrypt the payload
            const originalRow = yield* Effect.promise(() =>
              decryptJson<Record<string, unknown>>(row.encryptedPayload, sourcePassword),
            );

            // Transform and insert
            const transformed = transformRow(originalRow, mappings);
            const now = new Date().toISOString();

            const result = yield* executeRowInsert(
              job.destEnvironmentId,
              job.destEntityType,
              job.destType,
              transformed,
              row.rowIndex,
            ).pipe(
              Effect.map((insertResult) => ({
                success: true as const,
                identityElements: insertResult.identityElements,
              })),
              Effect.catchAll((error) =>
                Effect.succeed({
                  success: false as const,
                  error: error.message,
                }),
              ),
            );

            if (result.success) {
              // Update row to success status and add success attempt
              yield* updateRow(row.id, {
                status: "success",
                identityElements: JSON.stringify(result.identityElements),
                updatedAt: now,
              });
              yield* insertAttempt({
                id: crypto.randomUUID(),
                rowId: row.id,
                reason: "manual_retry",
                success: true,
                errorMessage: null,
                identityElements: JSON.stringify(result.identityElements),
                createdAt: now,
              });

              // Check if job should be marked as completed
              const counts = yield* getJobCounts(row.jobId);
              const failedOffsets = job.failedQueryOffsets
                ? (JSON.parse(job.failedQueryOffsets) as number[])
                : [];
              const shouldMarkCompleted =
                counts.failedRowCount === 0 &&
                failedOffsets.length === 0 &&
                job.status === "partial";

              if (shouldMarkCompleted) {
                yield* updateJobStatus(row.jobId, { status: "completed" });
              }

              return { success: true, row: null };
            } else {
              // Add failed attempt (row status stays "failed")
              yield* updateRow(row.id, { updatedAt: now });
              yield* insertAttempt({
                id: crypto.randomUUID(),
                rowId: row.id,
                reason: "manual_retry",
                success: false,
                errorMessage: result.error,
                identityElements: null,
                createdAt: now,
              });

              // Get the row with attempts info
              const rowWithInfo = yield* Effect.gen(function* () {
                const updatedRow = yield* getRowById(rowId);
                if (!updatedRow) return null;

                const rowAttempts = yield* getAttemptsForRow(rowId);
                const latestAttempt = rowAttempts[rowAttempts.length - 1];

                return {
                  ...updatedRow,
                  attemptCount: rowAttempts.length,
                  latestAttemptAt: latestAttempt?.createdAt ?? null,
                  latestError: latestAttempt?.errorMessage ?? null,
                };
              });

              return { success: false, row: rowWithInfo };
            }
          }).pipe(
            Effect.withSpan("migrationJob.retrySingleRow", {
              attributes: { rowId },
            }),
          ),

        /**
         * Get a job by ID (base fields only).
         */
        getJob: (jobId: string) => getJobById(jobId),

        /**
         * Get a job by ID with derived counts.
         */
        getJobWithCounts: (jobId: string) =>
          Effect.gen(function* () {
            const job = yield* getJobById(jobId);
            const counts = yield* getJobCounts(jobId);
            return { ...job, ...counts };
          }),

        /**
         * List all jobs (base fields only).
         */
        listJobs: () =>
          Effect.try({
            try: () => db.select().from(jobs).orderBy(jobs.createdAt).all().reverse(),
            catch: (cause) => new DatabaseError({ message: "Failed to list jobs", cause }),
          }),

        /**
         * List all jobs with derived counts.
         */
        listJobsWithCounts: () =>
          Effect.gen(function* () {
            const jobsList = yield* Effect.try({
              try: () => db.select().from(jobs).orderBy(jobs.createdAt).all().reverse(),
              catch: (cause) => new DatabaseError({ message: "Failed to list jobs", cause }),
            });

            const jobsWithCounts = yield* Effect.all(
              jobsList.map((job) =>
                Effect.gen(function* () {
                  const counts = yield* getJobCounts(job.id);
                  return { ...job, ...counts };
                }),
              ),
            );

            return jobsWithCounts;
          }),

        /**
         * Get rows for a job with attempt summary info.
         */
        getJobRows: (jobId: string, options?: { status?: RowStatus }) =>
          Effect.gen(function* () {
            // Build query with optional filters
            const statusFilter = options?.status
              ? and(eq(rows.jobId, jobId), eq(rows.status, options.status))
              : eq(rows.jobId, jobId);

            // Get total count
            const totalResult = yield* Effect.try({
              try: () =>
                db
                  .select({ count: sql<number>`COUNT(*)` })
                  .from(rows)
                  .where(statusFilter)
                  .get(),
              catch: (cause) => new DatabaseError({ message: "Failed to count rows", cause }),
            });
            const total = totalResult?.count ?? 0;

            // Get all rows
            const rowsList = yield* Effect.try({
              try: () => db.select().from(rows).where(statusFilter).orderBy(rows.rowIndex).all(),
              catch: (cause) => new DatabaseError({ message: "Failed to fetch rows", cause }),
            });

            // Add attempt info to each row
            const rowsWithInfo = yield* Effect.all(
              rowsList.map((row) =>
                Effect.gen(function* () {
                  const rowAttempts = yield* getAttemptsForRow(row.id);
                  const latestAttempt = rowAttempts[rowAttempts.length - 1];

                  return {
                    ...row,
                    attemptCount: rowAttempts.length,
                    latestAttemptAt: latestAttempt?.createdAt ?? null,
                    latestError: latestAttempt?.errorMessage ?? null,
                  };
                }),
              ),
            );

            return { rows: rowsWithInfo, total };
          }).pipe(
            Effect.withSpan("migrationJob.getJobRows", {
              attributes: { jobId },
            }),
          ),

        /**
         * Get all attempts for a specific row.
         */
        getRowAttempts: (rowId: string) =>
          getAttemptsForRow(rowId).pipe(
            Effect.withSpan("migrationJob.getRowAttempts", {
              attributes: { rowId },
            }),
          ),

        /**
         * Cancel a running job.
         */
        cancelJob: (jobId: string) =>
          Effect.gen(function* () {
            const job = yield* getJobById(jobId);
            if (job.status === "running") {
              yield* updateJobStatus(jobId, {
                status: "cancelled",
                completedAt: new Date().toISOString(),
              });
            }
          }),

        /**
         * Delete a job and all its associated rows and attempts.
         */
        deleteJob: (jobId: string) =>
          Effect.gen(function* () {
            // Verify job exists first
            yield* getJobById(jobId);

            // Delete all rows and attempts for this job
            yield* deleteRowsForJob(jobId);

            // Delete the job
            yield* Effect.try({
              try: () => db.delete(jobs).where(eq(jobs.id, jobId)).run(),
              catch: (cause) => new DatabaseError({ message: "Failed to delete job", cause }),
            });
          }).pipe(
            Effect.withSpan("migrationJob.deleteJob", {
              attributes: { jobId },
            }),
          ),
      };
    }),

    dependencies: [ImisApiService.Default, SessionService.Default, PersistenceService.Default],
  },
) {
  // Static Test layer for testing
  static Test = Layer.succeed(
    this,
    new MigrationJobService({
      createJob: () => Effect.succeed({ jobId: "00000000-0000-0000-0000-000000000000" }),
      runJob: () =>
        Effect.succeed({
          failedOffsets: [],
          totalRows: 0,
        }),
      retryFailedRows: () => Effect.succeed({ retriedCount: 0, successCount: 0, failCount: 0 }),
      retrySingleRow: () => Effect.succeed({ success: true, row: null }),
      getJob: (jobId) => Effect.fail(new JobNotFoundError({ jobId })),
      getJobWithCounts: (jobId) => Effect.fail(new JobNotFoundError({ jobId })),
      listJobs: () => Effect.succeed([]),
      listJobsWithCounts: () => Effect.succeed([]),
      getJobRows: () => Effect.succeed({ rows: [], total: 0 }),
      getRowAttempts: () => Effect.succeed([]),
      cancelJob: () => Effect.void,
      deleteJob: () => Effect.void,
    }),
  );
}

// ---------------------
// Convenience Alias
// ---------------------

export const MigrationJobServiceLive = MigrationJobService.Default;
