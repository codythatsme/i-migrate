/**
 * Integration test setup and helpers for iMIS API tests.
 *
 * These tests require environment variables:
 *   IMIS_BASE_URL - Base URL of the iMIS instance
 *   IMIS_USERNAME - Username for authentication
 *   IMIS_PASSWORD - Password for authentication
 *   IMIS_VERSION  - Optional: "EMS" (default) or "2017"
 */

import { Effect, Cause, Option, Exit } from "effect"
import { ImisApiService } from "@/services/imis-api"
import { SessionService } from "@/services/session"
import { PersistenceService } from "@/services/persistence"
import { db } from "@/db/client"
import { environments } from "@/db/schema"
import { eq } from "drizzle-orm"
import type { ImisVersion } from "@/db/schema"

// ---------------------
// Test Constants
// ---------------------

export const TEST_QUERY_PATH = process.env.TEST_QUERY_PATH || "$/Test/Example"
export const TEST_ENTITY_TYPE = process.env.TEST_ENTITY_TYPE || "Test_Entity"

// ---------------------
// Environment Detection
// ---------------------

/**
 * Check if integration tests should run.
 * Tests will skip gracefully when credentials are not configured.
 */
export const shouldRunIntegrationTests = (): boolean => {
	return !!(
		process.env.IMIS_BASE_URL &&
		process.env.IMIS_USERNAME &&
		process.env.IMIS_PASSWORD
	)
}

/**
 * Get test configuration from environment variables.
 * Throws if called when credentials are not configured.
 */
export const getTestConfig = () => {
	if (!shouldRunIntegrationTests()) {
		throw new Error("Integration test credentials not configured")
	}
	return {
		baseUrl: process.env.IMIS_BASE_URL!,
		username: process.env.IMIS_USERNAME!,
		password: process.env.IMIS_PASSWORD!,
		version: (process.env.IMIS_VERSION || "EMS") as ImisVersion,
	}
}

// ---------------------
// Environment Management
// ---------------------

/**
 * Create a test environment in the database with credentials from env vars.
 * Returns the environment ID for use in tests.
 */
export const createTestEnvironment = async (
	overrides: Partial<{ version: ImisVersion }> = {}
): Promise<string> => {
	const config = getTestConfig()
	const envId = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
	const now = new Date().toISOString()

	db.insert(environments)
		.values({
			id: envId,
			name: `Test Environment ${envId}`,
			baseUrl: config.baseUrl,
			username: config.username,
			version: overrides.version || config.version,
			queryConcurrency: 5,
			insertConcurrency: 50,
			createdAt: now,
			updatedAt: now,
		})
		.run()

	// Store password in session
	await Effect.runPromise(
		SessionService.setPassword(envId, config.password).pipe(
			Effect.provide(SessionService.Default)
		)
	)

	return envId
}

/**
 * Clean up a test environment and its session data.
 */
export const cleanupTestEnvironment = async (envId: string): Promise<void> => {
	// Clear session first
	await Effect.runPromise(
		SessionService.clearSession(envId).pipe(
			Effect.provide(SessionService.Default)
		)
	)

	// Delete from database
	db.delete(environments).where(eq(environments.id, envId)).run()
}

// ---------------------
// Effect Execution Helpers
// ---------------------

/**
 * Run an Effect with all required iMIS services provided.
 */
export const runWithImisServices = <A, E>(
	effect: Effect.Effect<A, E, ImisApiService>
): Promise<A> => {
	return Effect.runPromise(
		effect.pipe(
			Effect.provide(ImisApiService.Default),
			Effect.provide(SessionService.Default),
			Effect.provide(PersistenceService.Default)
		)
	)
}

/**
 * Run an Effect with just SessionService provided.
 */
export const runWithSession = <A, E>(
	effect: Effect.Effect<A, E, SessionService>
): Promise<A> => {
	return Effect.runPromise(effect.pipe(Effect.provide(SessionService.Default)))
}

/**
 * Run an Effect and return the Exit for inspection.
 */
export const runWithImisServicesExit = <A, E>(
	effect: Effect.Effect<A, E, ImisApiService>
): Promise<Exit.Exit<A, E>> => {
	return Effect.runPromiseExit(
		effect.pipe(
			Effect.provide(ImisApiService.Default),
			Effect.provide(SessionService.Default),
			Effect.provide(PersistenceService.Default)
		)
	)
}

/**
 * Run an Effect expecting it to fail, returning the error.
 * Throws if the effect succeeds.
 */
export const runExpectFailure = async <A, E>(
	effect: Effect.Effect<A, E, ImisApiService>,
	expectedTag?: string
): Promise<E> => {
	const result = await runWithImisServicesExit(effect)

	if (Exit.isSuccess(result)) {
		throw new Error("Expected failure but got success")
	}

	const error = Cause.failureOption(result.cause)
	if (!Option.isSome(error)) {
		throw new Error("Expected failure cause but got defect or interruption")
	}

	if (expectedTag !== undefined) {
		const actualTag = (error.value as { _tag?: string })?._tag
		if (actualTag !== expectedTag) {
			throw new Error(`Expected error tag ${expectedTag} but got ${actualTag}`)
		}
	}

	return error.value
}

/**
 * Run an Effect expecting it to succeed, returning the result.
 * Throws with descriptive error if the effect fails.
 */
export const runExpectSuccess = async <A, E>(
	effect: Effect.Effect<A, E, ImisApiService>
): Promise<A> => {
	const result = await runWithImisServicesExit(effect)

	if (Exit.isFailure(result)) {
		const error = Cause.failureOption(result.cause)
		if (Option.isSome(error)) {
			const tag = (error.value as { _tag?: string })?._tag || "Unknown"
			const message = (error.value as { message?: string })?.message || String(error.value)
			throw new Error(`Expected success but got ${tag}: ${message}`)
		}
		throw new Error("Expected success but got unexpected failure")
	}

	return result.value
}

// ---------------------
// Test Data Helpers
// ---------------------

/**
 * Generate a unique test run ID for identifying test data.
 */
export const generateTestRunId = (): string => {
	return `test-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`
}
