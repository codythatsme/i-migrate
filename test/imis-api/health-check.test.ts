/**
 * Health check integration tests for iMIS API.
 *
 * Tests the health check endpoint that verifies credentials.
 */

import { describe, it, expect, beforeAll, afterAll } from "bun:test"
import { ImisApiService } from "@/services/imis-api"
import {
	shouldRunIntegrationTests,
	createTestEnvironment,
	cleanupTestEnvironment,
	runExpectSuccess,
	runExpectFailure,
	runWithSession,
} from "./setup"
import { SessionService } from "@/services/session"

describe.skipIf(!shouldRunIntegrationTests())("iMIS Health Check", () => {
	let envId: string

	beforeAll(async () => {
		envId = await createTestEnvironment()
	})

	afterAll(async () => {
		await cleanupTestEnvironment(envId)
	})

	describe("Successful Health Check", () => {
		it("should pass health check with valid environment", async () => {
			const result = await runExpectSuccess(ImisApiService.healthCheck(envId))
			expect(result).toBeDefined()
			expect(result.success).toBe(true)
		})

		it("should auto-authenticate if no token exists", async () => {
			// Clear any existing token
			await runWithSession(SessionService.clearSession(envId))
			// Re-set password
			const config = await import("./setup").then((m) => m.getTestConfig())
			await runWithSession(SessionService.setPassword(envId, config.password))

			// Health check should still succeed (auto-authenticates)
			const result = await runExpectSuccess(ImisApiService.healthCheck(envId))
			expect(result.success).toBe(true)
		})
	})

	describe("Health Check Failures", () => {
		it("should fail with MissingCredentialsError when password not set", async () => {
			// Create environment without password
			const noPasswordEnvId = await createTestEnvironment()
			await runWithSession(SessionService.clearSession(noPasswordEnvId))

			const error = await runExpectFailure(
				ImisApiService.healthCheck(noPasswordEnvId),
				"MissingCredentialsError"
			)

			expect(error).toBeDefined()

			await cleanupTestEnvironment(noPasswordEnvId)
		})
	})
})
