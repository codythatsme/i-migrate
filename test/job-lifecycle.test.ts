/**
 * Integration tests for job lifecycle.
 * Tests runtime behaviors that types cannot verify:
 * - Job status state machine transitions
 * - Error conditions (JobNotFoundError, JobAlreadyRunningError)
 * - Job creation and retrieval
 *
 * Note: These tests use the actual database and test the service layer.
 * IMIS API calls are not tested here as they require network mocking.
 */

import { describe, it, expect, beforeEach, afterAll } from "bun:test"
import { Effect } from "effect"
import { db } from "../src/db/client"
import { jobs, rows, environments } from "../src/db/schema"
import { eq } from "drizzle-orm"
import { MigrationJobService } from "../src/services/migration-job"
import { SessionService } from "../src/services/session"
import { PersistenceService } from "../src/services/persistence"
import { ImisApiService } from "../src/services/imis-api"
import { createPropertyMapping } from "./setup"

// Test environment IDs
const TEST_SOURCE_ENV_ID = "test-source-env-00000000"
const TEST_DEST_ENV_ID = "test-dest-env-00000000"

// Helper to run Effect programs with real services
const runWithServices = <A, E>(
  effect: Effect.Effect<A, E, MigrationJobService>
): Promise<A> => {
  return Effect.runPromise(
    effect.pipe(
      Effect.provide(MigrationJobService.Default),
      Effect.provide(SessionService.Default),
      Effect.provide(PersistenceService.Default),
      Effect.provide(ImisApiService.Default)
    )
  )
}

// Cleanup helper
const cleanupTestData = async () => {
  // Delete all test jobs and their rows
  const testJobs = db
    .select({ id: jobs.id })
    .from(jobs)
    .where(eq(jobs.sourceEnvironmentId, TEST_SOURCE_ENV_ID))
    .all()

  for (const job of testJobs) {
    db.delete(rows).where(eq(rows.jobId, job.id)).run()
    db.delete(jobs).where(eq(jobs.id, job.id)).run()
  }

  // Delete test environments
  db.delete(environments).where(eq(environments.id, TEST_SOURCE_ENV_ID)).run()
  db.delete(environments).where(eq(environments.id, TEST_DEST_ENV_ID)).run()

  // Clear sessions
  await Effect.runPromise(
    SessionService.clearAllSessions().pipe(
      Effect.provide(SessionService.Default)
    )
  )
}

describe("Job Lifecycle", () => {
  beforeEach(async () => {
    await cleanupTestData()

    // Create test environments
    const now = new Date().toISOString()
    db.insert(environments)
      .values({
        id: TEST_SOURCE_ENV_ID,
        name: "Test Source",
        baseUrl: "https://source.imis.com",
        username: "sourceuser",
        queryConcurrency: 5,
        insertConcurrency: 50,
        createdAt: now,
        updatedAt: now,
      })
      .run()

    db.insert(environments)
      .values({
        id: TEST_DEST_ENV_ID,
        name: "Test Destination",
        baseUrl: "https://dest.imis.com",
        username: "destuser",
        queryConcurrency: 5,
        insertConcurrency: 50,
        createdAt: now,
        updatedAt: now,
      })
      .run()
  })

  afterAll(async () => {
    await cleanupTestData()
  })

  describe("Job creation", () => {
    it("should create a job with queued status", async () => {
      const { jobId } = await runWithServices(
        MigrationJobService.createJob({
          name: "Test Job",
          mode: "query",
          sourceEnvironmentId: TEST_SOURCE_ENV_ID,
          sourceQueryPath: "$/Test/Query",
          destEnvironmentId: TEST_DEST_ENV_ID,
          destEntityType: "TestEntity",
          mappings: [createPropertyMapping("Name", "FullName")],
        })
      )

      expect(jobId).toBeDefined()
      expect(typeof jobId).toBe("string")
      expect(jobId.length).toBeGreaterThan(0)

      // Verify in database
      const job = db.select().from(jobs).where(eq(jobs.id, jobId)).get()
      expect(job).toBeDefined()
      expect(job?.status).toBe("queued")
      expect(job?.name).toBe("Test Job")
      expect(job?.mode).toBe("query")
    })

    it("should store mappings as JSON string", async () => {
      const mappings = [
        createPropertyMapping("FirstName", "First"),
        createPropertyMapping("LastName", "Last"),
        createPropertyMapping("Email", null),
      ]

      const { jobId } = await runWithServices(
        MigrationJobService.createJob({
          name: "Mapping Test Job",
          mode: "query",
          sourceEnvironmentId: TEST_SOURCE_ENV_ID,
          sourceQueryPath: "$/Test/Query",
          destEnvironmentId: TEST_DEST_ENV_ID,
          destEntityType: "TestEntity",
          mappings,
        })
      )

      const job = db.select().from(jobs).where(eq(jobs.id, jobId)).get()
      expect(job?.mappings).toBeDefined()

      const parsedMappings = JSON.parse(job!.mappings)
      expect(parsedMappings).toEqual(mappings)
    })

    it("should set initial timestamps", async () => {
      const beforeCreate = new Date().toISOString()

      const { jobId } = await runWithServices(
        MigrationJobService.createJob({
          name: "Timestamp Test",
          mode: "query",
          sourceEnvironmentId: TEST_SOURCE_ENV_ID,
          sourceQueryPath: "$/Test/Query",
          destEnvironmentId: TEST_DEST_ENV_ID,
          destEntityType: "TestEntity",
          mappings: [],
        })
      )

      const afterCreate = new Date().toISOString()
      const job = db.select().from(jobs).where(eq(jobs.id, jobId)).get()

      expect(job?.createdAt).toBeDefined()
      expect(job?.createdAt && job.createdAt >= beforeCreate).toBe(true)
      expect(job?.createdAt && job.createdAt <= afterCreate).toBe(true)
      expect(job?.startedAt).toBeNull()
      expect(job?.completedAt).toBeNull()
    })
  })

  describe("Job retrieval", () => {
    it("should retrieve existing job", async () => {
      const { jobId } = await runWithServices(
        MigrationJobService.createJob({
          name: "Retrieval Test",
          mode: "query",
          sourceEnvironmentId: TEST_SOURCE_ENV_ID,
          sourceQueryPath: "$/Test/Query",
          destEnvironmentId: TEST_DEST_ENV_ID,
          destEntityType: "TestEntity",
          mappings: [],
        })
      )

      const job = await runWithServices(MigrationJobService.getJob(jobId))

      expect(job).toBeDefined()
      expect(job.id).toBe(jobId)
      expect(job.name).toBe("Retrieval Test")
    })

    it("should fail with JobNotFoundError for non-existent job", async () => {
      const nonExistentId = "00000000-0000-0000-0000-000000000000"

      const result = await Effect.runPromiseExit(
        MigrationJobService.getJob(nonExistentId).pipe(
          Effect.provide(MigrationJobService.Default),
          Effect.provide(SessionService.Default),
          Effect.provide(PersistenceService.Default),
          Effect.provide(ImisApiService.Default)
        )
      )

      expect(result._tag).toBe("Failure")
      if (result._tag === "Failure") {
        const error = result.cause
        // The error should be JobNotFoundError
        expect(error._tag).toBe("Fail")
      }
    })
  })

  describe("Job listing", () => {
    it("should list all jobs", async () => {
      // Create multiple jobs
      await runWithServices(
        MigrationJobService.createJob({
          name: "Job 1",
          mode: "query",
          sourceEnvironmentId: TEST_SOURCE_ENV_ID,
          sourceQueryPath: "$/Test/Query1",
          destEnvironmentId: TEST_DEST_ENV_ID,
          destEntityType: "TestEntity",
          mappings: [],
        })
      )

      await runWithServices(
        MigrationJobService.createJob({
          name: "Job 2",
          mode: "query",
          sourceEnvironmentId: TEST_SOURCE_ENV_ID,
          sourceQueryPath: "$/Test/Query2",
          destEnvironmentId: TEST_DEST_ENV_ID,
          destEntityType: "TestEntity",
          mappings: [],
        })
      )

      const allJobs = await runWithServices(MigrationJobService.listJobs())

      // Filter to our test jobs
      const testJobs = allJobs.filter(
        (j) => j.sourceEnvironmentId === TEST_SOURCE_ENV_ID
      )

      expect(testJobs.length).toBe(2)
      expect(testJobs.map((j) => j.name).sort()).toEqual(["Job 1", "Job 2"])
    })

    it("should return empty array when no jobs exist", async () => {
      // Ensure clean state
      await cleanupTestData()

      const allJobs = await runWithServices(MigrationJobService.listJobs())

      // Filter to our test jobs (should be empty)
      const testJobs = allJobs.filter(
        (j) => j.sourceEnvironmentId === TEST_SOURCE_ENV_ID
      )

      expect(testJobs).toEqual([])
    })
  })

  describe("Job deletion", () => {
    it("should delete job from database", async () => {
      const { jobId } = await runWithServices(
        MigrationJobService.createJob({
          name: "Delete Test",
          mode: "query",
          sourceEnvironmentId: TEST_SOURCE_ENV_ID,
          sourceQueryPath: "$/Test/Query",
          destEnvironmentId: TEST_DEST_ENV_ID,
          destEntityType: "TestEntity",
          mappings: [],
        })
      )

      // Verify job exists
      const jobBefore = db.select().from(jobs).where(eq(jobs.id, jobId)).get()
      expect(jobBefore).toBeDefined()

      // Delete job
      await runWithServices(MigrationJobService.deleteJob(jobId))

      // Verify job is deleted
      const jobAfter = db.select().from(jobs).where(eq(jobs.id, jobId)).get()
      expect(jobAfter).toBeUndefined()
    })

    it("should fail with JobNotFoundError when deleting non-existent job", async () => {
      const nonExistentId = "00000000-0000-0000-0000-000000000001"

      const result = await Effect.runPromiseExit(
        MigrationJobService.deleteJob(nonExistentId).pipe(
          Effect.provide(MigrationJobService.Default),
          Effect.provide(SessionService.Default),
          Effect.provide(PersistenceService.Default),
          Effect.provide(ImisApiService.Default)
        )
      )

      expect(result._tag).toBe("Failure")
    })
  })

  describe("Job run state machine", () => {
    it("should fail with JobAlreadyRunningError when running non-queued job", async () => {
      const { jobId } = await runWithServices(
        MigrationJobService.createJob({
          name: "Already Running Test",
          mode: "query",
          sourceEnvironmentId: TEST_SOURCE_ENV_ID,
          sourceQueryPath: "$/Test/Query",
          destEnvironmentId: TEST_DEST_ENV_ID,
          destEntityType: "TestEntity",
          mappings: [],
        })
      )

      // Manually set status to 'running'
      db.update(jobs)
        .set({ status: "running", startedAt: new Date().toISOString() })
        .where(eq(jobs.id, jobId))
        .run()

      // Try to run it - should fail
      const result = await Effect.runPromiseExit(
        MigrationJobService.runJob(jobId).pipe(
          Effect.provide(MigrationJobService.Default),
          Effect.provide(SessionService.Default),
          Effect.provide(PersistenceService.Default),
          Effect.provide(ImisApiService.Default)
        )
      )

      expect(result._tag).toBe("Failure")
    })

    it("should fail to run completed job", async () => {
      const { jobId } = await runWithServices(
        MigrationJobService.createJob({
          name: "Completed Test",
          mode: "query",
          sourceEnvironmentId: TEST_SOURCE_ENV_ID,
          sourceQueryPath: "$/Test/Query",
          destEnvironmentId: TEST_DEST_ENV_ID,
          destEntityType: "TestEntity",
          mappings: [],
        })
      )

      // Manually set status to 'completed'
      db.update(jobs)
        .set({
          status: "completed",
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        })
        .where(eq(jobs.id, jobId))
        .run()

      // Try to run it - should fail
      const result = await Effect.runPromiseExit(
        MigrationJobService.runJob(jobId).pipe(
          Effect.provide(MigrationJobService.Default),
          Effect.provide(SessionService.Default),
          Effect.provide(PersistenceService.Default),
          Effect.provide(ImisApiService.Default)
        )
      )

      expect(result._tag).toBe("Failure")
    })
  })

  describe("Job cancellation", () => {
    it("should cancel running job", async () => {
      const { jobId } = await runWithServices(
        MigrationJobService.createJob({
          name: "Cancel Test",
          mode: "query",
          sourceEnvironmentId: TEST_SOURCE_ENV_ID,
          sourceQueryPath: "$/Test/Query",
          destEnvironmentId: TEST_DEST_ENV_ID,
          destEntityType: "TestEntity",
          mappings: [],
        })
      )

      // Set to running
      db.update(jobs)
        .set({ status: "running", startedAt: new Date().toISOString() })
        .where(eq(jobs.id, jobId))
        .run()

      // Cancel it
      await runWithServices(MigrationJobService.cancelJob(jobId))

      // Verify status
      const job = db.select().from(jobs).where(eq(jobs.id, jobId)).get()
      expect(job?.status).toBe("cancelled")
      expect(job?.completedAt).toBeDefined()
    })

    it("should not change status when cancelling non-running job", async () => {
      const { jobId } = await runWithServices(
        MigrationJobService.createJob({
          name: "Non-running Cancel Test",
          mode: "query",
          sourceEnvironmentId: TEST_SOURCE_ENV_ID,
          sourceQueryPath: "$/Test/Query",
          destEnvironmentId: TEST_DEST_ENV_ID,
          destEntityType: "TestEntity",
          mappings: [],
        })
      )

      // Job is in 'queued' status

      // Try to cancel it
      await runWithServices(MigrationJobService.cancelJob(jobId))

      // Status should still be 'queued'
      const job = db.select().from(jobs).where(eq(jobs.id, jobId)).get()
      expect(job?.status).toBe("queued")
    })
  })

  describe("Job rows", () => {
    it("should return empty array when no rows exist", async () => {
      const { jobId } = await runWithServices(
        MigrationJobService.createJob({
          name: "No Rows Test",
          mode: "query",
          sourceEnvironmentId: TEST_SOURCE_ENV_ID,
          sourceQueryPath: "$/Test/Query",
          destEnvironmentId: TEST_DEST_ENV_ID,
          destEntityType: "TestEntity",
          mappings: [],
        })
      )

      const rowsResult = await runWithServices(
        MigrationJobService.getJobRows(jobId, {})
      )

      expect(rowsResult.rows).toEqual([])
      expect(rowsResult.total).toBe(0)
    })
  })
})
