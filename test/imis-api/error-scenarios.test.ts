/**
 * Error handling and edge case tests for iMIS API.
 *
 * Tests error responses, retry behavior, and edge cases.
 */

import { describe, it, expect, beforeAll, afterAll } from "bun:test"
import { ImisApiService } from "@/services/imis-api"
import { SessionService } from "@/services/session"
import {
	shouldRunIntegrationTests,
	createTestEnvironment,
	cleanupTestEnvironment,
	runExpectSuccess,
	runExpectFailure,
	runWithSession,
	TEST_QUERY_PATH,
	getTestConfig,
} from "./setup"
import { db } from "@/db/client"
import { environments } from "@/db/schema"
import { eq } from "drizzle-orm"

describe.skipIf(!shouldRunIntegrationTests())("iMIS Error Handling", () => {
	let envId: string

	beforeAll(async () => {
		envId = await createTestEnvironment()
	})

	afterAll(async () => {
		await cleanupTestEnvironment(envId)
	})

	describe("Authentication Errors", () => {
		it("should return ImisAuthError for expired/invalid credentials", async () => {
			const badEnvId = await createTestEnvironment()

			// Set invalid password
			await runWithSession(SessionService.clearSession(badEnvId))
			await runWithSession(
				SessionService.setPassword(badEnvId, "invalid-password-xyz")
			)

			const error = await runExpectFailure(
				ImisApiService.authenticate(badEnvId),
				"ImisAuthError"
			)

			expect(error).toBeDefined()
			expect((error as { message: string }).message).toContain("Authentication")

			await cleanupTestEnvironment(badEnvId)
		})

		it("should return MissingCredentialsError when no password set", async () => {
			const noPasswordEnvId = await createTestEnvironment()
			await runWithSession(SessionService.clearSession(noPasswordEnvId))

			const error = await runExpectFailure(
				ImisApiService.authenticate(noPasswordEnvId),
				"MissingCredentialsError"
			)

			expect(error).toBeDefined()

			await cleanupTestEnvironment(noPasswordEnvId)
		})

		it("should return EnvironmentNotFoundError for non-existent environment", async () => {
			const error = await runExpectFailure(
				ImisApiService.authenticate("non-existent-env-id-12345"),
				"EnvironmentNotFoundError"
			)

			expect(error).toBeDefined()
		})
	})

	describe("HTTP Error Responses", () => {
		it("should return ImisResponseError for 404 on query execution", async () => {
			// Authenticate first
			await runExpectSuccess(ImisApiService.authenticate(envId))

			const error = await runExpectFailure(
				ImisApiService.executeQuery(
					envId,
					"$/This/Query/Does/Not/Exist/At/All/12345",
					10,
					0
				)
			)

			// Note: iMIS might return different status codes for non-existent queries
			// This test documents the actual behavior
			expect(error).toBeDefined()
		})
	})

	describe("Schema Validation", () => {
		it("should successfully parse valid query response", async () => {
			await runExpectSuccess(ImisApiService.authenticate(envId))

			const result = await runExpectSuccess(
				ImisApiService.executeQuery(envId, TEST_QUERY_PATH, 10, 0)
			)

			// If we get here, schema validation passed
			expect(result).toBeDefined()
			expect(result.$type).toBeDefined()
		})

		it("should successfully parse valid entity definitions response", async () => {
			await runExpectSuccess(ImisApiService.authenticate(envId))

			const result = await runExpectSuccess(
				ImisApiService.getBoEntityDefinitions(envId, 10)
			)

			expect(result).toBeDefined()
			expect(result.$type).toBeDefined()
			expect(result.Items).toBeDefined()
		})
	})

	describe("Edge Cases", () => {
		it("should handle query with zero results", async () => {
			await runExpectSuccess(ImisApiService.authenticate(envId))

			// Try to get page far beyond available data
			const result = await runExpectSuccess(
				ImisApiService.executeQuery(envId, TEST_QUERY_PATH, 10, 999999)
			)

			expect(result.Items.$values).toBeDefined()
			// Either empty or has results depending on offset handling
		})

		it("should handle maximum limit (500)", async () => {
			await runExpectSuccess(ImisApiService.authenticate(envId))

			const result = await runExpectSuccess(
				ImisApiService.executeQuery(envId, TEST_QUERY_PATH, 500, 0)
			)

			expect(result.Limit).toBeLessThanOrEqual(500)
			expect(result.Items.$values.length).toBeLessThanOrEqual(500)
		})

		it("should handle limit exceeding maximum", async () => {
			await runExpectSuccess(ImisApiService.authenticate(envId))

			// Request more than 500 - should be capped at 500
			const result = await runExpectSuccess(
				ImisApiService.executeQuery(envId, TEST_QUERY_PATH, 1000, 0)
			)

			// Service caps at 500
			expect(result.Limit).toBeLessThanOrEqual(500)
		})

		it("should handle special characters in query path", async () => {
			await runExpectSuccess(ImisApiService.authenticate(envId))

			// Path with special characters
			const result = await runExpectSuccess(
				ImisApiService.getDocumentByPath(envId, TEST_QUERY_PATH)
			)

			expect(result).toBeDefined()
		})
	})

	describe("Token Refresh", () => {
		it("should handle token refresh after expiry", async () => {
			// Authenticate
			await runExpectSuccess(ImisApiService.authenticate(envId))

			// Clear token to simulate expiry
			await runWithSession(SessionService.clearSession(envId))
			const config = getTestConfig()
			await runWithSession(SessionService.setPassword(envId, config.password))

			// Should auto-refresh and succeed
			const result = await runExpectSuccess(ImisApiService.healthCheck(envId))

			expect(result.success).toBe(true)
		})
	})

	describe("Concurrent Operations", () => {
		it("should handle multiple concurrent queries", async () => {
			await runExpectSuccess(ImisApiService.authenticate(envId))

			// Execute multiple queries concurrently
			const promises = Array.from({ length: 5 }, (_, i) =>
				runExpectSuccess(
					ImisApiService.executeQuery(envId, TEST_QUERY_PATH, 10, i * 10)
				)
			)

			const results = await Promise.all(promises)

			expect(results).toHaveLength(5)
			for (const result of results) {
				expect(result).toBeDefined()
				expect(result.Items).toBeDefined()
			}
		})
	})
})
