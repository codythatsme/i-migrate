import { Effect, Layer, Data, Ref, Exit, Cause, Schedule, Duration } from "effect";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import {
  jobs,
  failedRows,
  successRows,
  environments,
  type Job,
  type NewJob,
  type NewFailedRow,
  type NewSuccessRow,
  type JobStatus,
  type JobMode,
} from "../db/schema";
import { ImisApiService, MissingCredentialsError } from "./imis-api";
import { SessionService } from "./session";
import { PersistenceService, DatabaseError, EnvironmentNotFoundError } from "./persistence";
import { encryptJson, decryptJson } from "../lib/encryption";
import type { PropertyMapping } from "../components/export/PropertyMapper";

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

// Row data type for transformations
type RowData = Record<string, string | number | boolean | null>;

// ---------------------
// Retry Configuration
// ---------------------

// Insert retry schedule: 3 retries with exponential backoff
const insertRetrySchedule = Schedule.exponential(Duration.millis(500), 2).pipe(
  Schedule.intersect(Schedule.recurs(3)),
);

// Query retry schedule: 3 retries with exponential backoff
const queryRetrySchedule = Schedule.exponential(Duration.millis(1000), 2).pipe(
  Schedule.intersect(Schedule.recurs(3)),
);

// ---------------------
// Helper Functions (Exported for testing)
// ---------------------

/**
 * Transform a source row to destination format using property mappings.
 * Filters out non-primitive values and only includes mappings with a destination.
 */
export const transformRow = (
  sourceRow: Record<string, unknown>,
  mappings: PropertyMapping[],
): RowData => {
  const result: RowData = {};
  for (const mapping of mappings) {
    if (mapping.destinationProperty !== null) {
      const value = sourceRow[mapping.sourceProperty];
      // Only include primitive values
      if (
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
      const persistence = yield* PersistenceService;

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

      const updateJobProgress = (
        jobId: string,
        progress: Partial<{
          totalRows: number | null;
          processedRows: number;
          successfulRows: number;
          failedRowCount: number;
          status: JobStatus;
          startedAt: string;
          completedAt: string;
          failedQueryOffsets: string;
          identityFieldNames: string;
        }>,
      ) =>
        Effect.try({
          try: () => db.update(jobs).set(progress).where(eq(jobs.id, jobId)).run(),
          catch: (cause) => new DatabaseError({ message: "Failed to update job progress", cause }),
        });

      const insertFailedRow = (row: NewFailedRow) =>
        Effect.try({
          try: () => db.insert(failedRows).values(row).run(),
          catch: (cause) => new DatabaseError({ message: "Failed to insert failed row", cause }),
        });

      const getFailedRowsForJob = (jobId: string) =>
        Effect.try({
          try: () => db.select().from(failedRows).where(eq(failedRows.jobId, jobId)).all(),
          catch: (cause) => new DatabaseError({ message: "Failed to fetch failed rows", cause }),
        });

      const updateFailedRowStatus = (
        rowId: string,
        status: "pending" | "retrying" | "resolved",
        resolvedAt?: string,
      ) =>
        Effect.try({
          try: () =>
            db.update(failedRows).set({ status, resolvedAt }).where(eq(failedRows.id, rowId)).run(),
          catch: (cause) => new DatabaseError({ message: "Failed to update failed row", cause }),
        });

      const deleteFailedRow = (rowId: string) =>
        Effect.try({
          try: () => db.delete(failedRows).where(eq(failedRows.id, rowId)).run(),
          catch: (cause) => new DatabaseError({ message: "Failed to delete failed row", cause }),
        });

      const insertSuccessRow = (row: NewSuccessRow) =>
        Effect.try({
          try: () => db.insert(successRows).values(row).run(),
          catch: (cause) => new DatabaseError({ message: "Failed to insert success row", cause }),
        });

      const getSuccessRowsForJob = (jobId: string) =>
        Effect.try({
          try: () => db.select().from(successRows).where(eq(successRows.jobId, jobId)).all(),
          catch: (cause) => new DatabaseError({ message: "Failed to fetch success rows", cause }),
        });

      const deleteSuccessRowsForJob = (jobId: string) =>
        Effect.try({
          try: () => db.delete(successRows).where(eq(successRows.jobId, jobId)).run(),
          catch: (cause) => new DatabaseError({ message: "Failed to delete success rows", cause }),
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
            while: (error) => {
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
            while: (error) => {
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

      const insertRowWithRetry = (
        envId: string,
        entityTypeName: string,
        parentEntityTypeName: string,
        parentId: string | null,
        rowData: RowData,
        rowIndex: number,
      ) =>
        imisApi.insertEntity(envId, entityTypeName, parentEntityTypeName, parentId, rowData).pipe(
          Effect.retry({
            schedule: insertRetrySchedule,
            while: (error) => {
              // Retry on transient errors (5xx, network issues, rate limit)
              if (error._tag === "ImisRequestError") return true;
              if (error._tag === "ImisResponseError") {
                return error.status >= 500 || error.status === 429;
              }
              return false;
            },
          }),
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
          Effect.withSpan("migration.insertRow", {
            attributes: { entityTypeName, rowIndex },
          }),
        );

      const processRows = (
        jobId: string,
        rows: readonly Record<string, unknown>[],
        mappings: PropertyMapping[],
        destEnvId: string,
        destEntityType: string,
        sourceEnvId: string,
        insertConcurrency: number,
        processedRef: Ref.Ref<number>,
        successRef: Ref.Ref<number>,
        failedRef: Ref.Ref<number>,
      ) =>
        Effect.gen(function* () {
          // Get source password for encrypting failed rows
          const sourcePassword = yield* sessionService.getPassword(sourceEnvId);
          if (!sourcePassword) {
            return yield* Effect.fail(new MissingCredentialsError({ environmentId: sourceEnvId }));
          }

          // Transform rows
          const transformedRows = rows.map((row, index) => ({
            original: row,
            transformed: transformRow(row, mappings),
            index,
          }));

          // Process with partition to collect successes and failures
          const [failures, successes] = yield* Effect.partition(
            transformedRows,
            ({ transformed, index }) =>
              insertRowWithRetry(
                destEnvId,
                destEntityType,
                "Standalone", // Default to Standalone for now
                null,
                transformed,
                index,
              ).pipe(
                Effect.tap(() => Ref.update(successRef, (n) => n + 1)),
                Effect.ensuring(Ref.update(processedRef, (n) => n + 1)),
              ),
            { concurrency: insertConcurrency },
          );

          // Store success rows with identity elements
          for (const success of successes) {
            yield* insertSuccessRow({
              id: crypto.randomUUID(),
              jobId,
              rowIndex: success.rowIndex,
              identityElements: JSON.stringify(success.identityElements),
              createdAt: new Date().toISOString(),
            });
          }

          // Store failed rows
          for (const failure of failures) {
            const rowData = transformedRows.find((r) => r.index === failure.rowIndex);
            if (rowData) {
              // Encrypt the row data
              const encryptedPayload = yield* Effect.promise(() =>
                encryptJson(rowData.original, sourcePassword),
              );

              yield* insertFailedRow({
                id: crypto.randomUUID(),
                jobId,
                rowIndex: failure.rowIndex,
                encryptedPayload,
                errorMessage: failure.message,
                retryCount: 0,
                status: "pending",
                createdAt: new Date().toISOString(),
              });

              yield* Ref.update(failedRef, (n) => n + 1);
            }
          }

          // Update job progress in database periodically
          const processed = yield* Ref.get(processedRef);
          const successful = yield* Ref.get(successRef);
          const failed = yield* Ref.get(failedRef);

          yield* updateJobProgress(jobId, {
            processedRows: processed,
            successfulRows: successful,
            failedRowCount: failed,
          });
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
              mappings: JSON.stringify(config.mappings),
              totalRows: null,
              processedRows: 0,
              successfulRows: 0,
              failedRowCount: 0,
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
            yield* updateJobProgress(jobId, {
              identityFieldNames: JSON.stringify(identityFieldNames),
            });

            // Initialize progress refs
            const processedRef = yield* Ref.make(0);
            const successRef = yield* Ref.make(0);
            const failedRef = yield* Ref.make(0);
            const failedOffsetsRef = yield* Ref.make<number[]>([]);

            // Mark job as running
            yield* updateJobProgress(jobId, {
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
                yield* updateJobProgress(jobId, { totalRows });

                // Process first batch
                if (firstBatch.Items.$values.length > 0) {
                  yield* processRows(
                    jobId,
                    firstBatch.Items.$values,
                    mappings,
                    job.destEnvironmentId,
                    job.destEntityType,
                    job.sourceEnvironmentId,
                    insertConcurrency,
                    processedRef,
                    successRef,
                    failedRef,
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
                        Effect.catchAll((error) => {
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
                        yield* processRows(
                          jobId,
                          batch.Items.$values,
                          mappings,
                          job.destEnvironmentId,
                          job.destEntityType,
                          job.sourceEnvironmentId,
                          insertConcurrency,
                          processedRef,
                          successRef,
                          failedRef,
                        );
                      }
                    }),
                  { concurrency: queryConcurrency },
                );

                // Get final counts
                const processed = yield* Ref.get(processedRef);
                const successful = yield* Ref.get(successRef);
                const failed = yield* Ref.get(failedRef);
                const failedOffsets = yield* Ref.get(failedOffsetsRef);

                return { processed, successful, failed, failedOffsets, totalRows };
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
                yield* updateJobProgress(jobId, { totalRows });

                // Process first batch
                if (firstBatch.Items.$values.length > 0) {
                  yield* processRows(
                    jobId,
                    firstBatch.Items.$values,
                    mappings,
                    job.destEnvironmentId,
                    job.destEntityType,
                    job.sourceEnvironmentId,
                    insertConcurrency,
                    processedRef,
                    successRef,
                    failedRef,
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
                        Effect.catchAll((error) => {
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
                        yield* processRows(
                          jobId,
                          batch.Items.$values,
                          mappings,
                          job.destEnvironmentId,
                          job.destEntityType,
                          job.sourceEnvironmentId,
                          insertConcurrency,
                          processedRef,
                          successRef,
                          failedRef,
                        );
                      }
                    }),
                  { concurrency: queryConcurrency },
                );

                // Get final counts
                const processed = yield* Ref.get(processedRef);
                const successful = yield* Ref.get(successRef);
                const failed = yield* Ref.get(failedRef);
                const failedOffsets = yield* Ref.get(failedOffsetsRef);

                return { processed, successful, failed, failedOffsets, totalRows };
              }

              // Should not reach here - invalid mode configuration
              return yield* Effect.fail(
                new MigrationError({
                  message: `Invalid job configuration: mode=${job.mode}, sourceQueryPath=${job.sourceQueryPath}, sourceEntityType=${job.sourceEntityType}`,
                }),
              );
            }).pipe(
              Effect.tap(({ processed, successful, failed, failedOffsets }) =>
                updateJobProgress(jobId, {
                  processedRows: processed,
                  successfulRows: successful,
                  failedRowCount: failed,
                  failedQueryOffsets:
                    failedOffsets.length > 0 ? JSON.stringify(failedOffsets) : undefined,
                  status: failed > 0 || failedOffsets.length > 0 ? "partial" : "completed",
                  completedAt: new Date().toISOString(),
                }),
              ),
              Effect.catchAll((error) =>
                Effect.gen(function* () {
                  yield* updateJobProgress(jobId, {
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
            const failed = yield* getFailedRowsForJob(jobId);

            if (failed.length === 0) {
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

            // Retry each failed row
            yield* Effect.forEach(
              failed.filter((r) => r.status === "pending"),
              (row) =>
                Effect.gen(function* () {
                  // Mark as retrying
                  yield* updateFailedRowStatus(row.id, "retrying");

                  // Decrypt the payload
                  const originalRow = yield* Effect.promise(() =>
                    decryptJson<Record<string, unknown>>(row.encryptedPayload, sourcePassword),
                  );

                  // Transform and retry insert
                  const transformed = transformRow(originalRow, mappings);

                  yield* insertRowWithRetry(
                    job.destEnvironmentId,
                    job.destEntityType,
                    "Standalone",
                    null,
                    transformed,
                    row.rowIndex,
                  ).pipe(
                    Effect.tap(() =>
                      Effect.gen(function* () {
                        // Success - delete the failed row record
                        yield* deleteFailedRow(row.id);
                        successCount++;
                      }),
                    ),
                    Effect.catchAll((_error) =>
                      Effect.gen(function* () {
                        // Still failing - update retry count and mark pending again
                        yield* Effect.try({
                          try: () =>
                            db
                              .update(failedRows)
                              .set({
                                status: "pending",
                                retryCount: row.retryCount + 1,
                              })
                              .where(eq(failedRows.id, row.id))
                              .run(),
                          catch: (cause) =>
                            new DatabaseError({ message: "Failed to update retry count", cause }),
                        });
                        failCount++;
                      }),
                    ),
                  );
                }),
              { concurrency: insertConcurrency },
            );

            // Update job's failed row count and status
            const remainingFailed = yield* getFailedRowsForJob(jobId);
            const pendingCount = remainingFailed.filter((r) => r.status === "pending").length;

            // Determine if job should be marked as completed
            // Job is completed if no pending failed rows and no failed query offsets
            const failedOffsets = job.failedQueryOffsets
              ? (JSON.parse(job.failedQueryOffsets) as number[])
              : [];
            const shouldMarkCompleted =
              pendingCount === 0 && failedOffsets.length === 0 && job.status === "partial";

            yield* updateJobProgress(jobId, {
              failedRowCount: pendingCount,
              successfulRows: job.successfulRows + successCount,
              ...(shouldMarkCompleted ? { status: "completed" as const } : {}),
            });

            return {
              retriedCount: failed.filter((r) => r.status === "pending").length,
              successCount,
              failCount,
            };
          }).pipe(
            Effect.withSpan("migrationJob.retryFailedRows", {
              attributes: { jobId },
            }),
          ),

        /**
         * Get a job by ID.
         */
        getJob: (jobId: string) => getJobById(jobId),

        /**
         * List all jobs.
         */
        listJobs: () =>
          Effect.try({
            try: () => db.select().from(jobs).orderBy(jobs.createdAt).all().reverse(),
            catch: (cause) => new DatabaseError({ message: "Failed to list jobs", cause }),
          }),

        /**
         * Get failed rows for a job.
         */
        getJobFailedRows: (jobId: string) => getFailedRowsForJob(jobId),

        /**
         * Cancel a running job (not fully implemented - jobs run synchronously for now).
         */
        cancelJob: (jobId: string) =>
          Effect.gen(function* () {
            const job = yield* getJobById(jobId);
            if (job.status === "running") {
              yield* updateJobProgress(jobId, {
                status: "cancelled",
                completedAt: new Date().toISOString(),
              });
            }
          }),

        /**
         * Delete a job and all its associated failed rows.
         */
        deleteJob: (jobId: string) =>
          Effect.gen(function* () {
            // Verify job exists first
            yield* getJobById(jobId);

            // Delete all failed rows for this job first
            yield* Effect.try({
              try: () => db.delete(failedRows).where(eq(failedRows.jobId, jobId)).run(),
              catch: (cause) =>
                new DatabaseError({ message: "Failed to delete failed rows", cause }),
            });

            // Delete all success rows for this job
            yield* deleteSuccessRowsForJob(jobId);

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

        /**
         * Get all success rows for a job.
         */
        getJobSuccessRows: (jobId: string) =>
          getSuccessRowsForJob(jobId).pipe(
            Effect.withSpan("migrationJob.getJobSuccessRows", {
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
          processed: 0,
          successful: 0,
          failed: 0,
          failedOffsets: [],
          totalRows: 0,
        }),
      retryFailedRows: () => Effect.succeed({ retriedCount: 0, successCount: 0, failCount: 0 }),
      getJob: (jobId) => Effect.fail(new JobNotFoundError({ jobId })),
      listJobs: () => Effect.succeed([]),
      getJobFailedRows: () => Effect.succeed([]),
      getJobSuccessRows: () => Effect.succeed([]),
      cancelJob: () => Effect.void,
      deleteJob: () => Effect.void,
    }),
  );
}

// ---------------------
// Convenience Alias
// ---------------------

export const MigrationJobServiceLive = MigrationJobService.Default;
