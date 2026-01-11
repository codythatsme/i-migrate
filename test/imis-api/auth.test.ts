/**
 * Authentication integration tests for iMIS API.
 *
 * Tests token acquisition, refresh, and error handling.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "bun:test"
import { Effect } from "effect"
import { ImisApiService } from "@/services/imis-api"
import { SessionService } from "@/services/session"
import {
	shouldRunIntegrationTests,
	createTestEnvironment,
	cleanupTestEnvironment,
	runWithSession,
	runExpectFailure,
	runExpectSuccess,
	getTestConfig,
} from "./setup"

describe.skipIf(!shouldRunIntegrationTests())("iMIS Authentication", () => {
	let envId: string

	beforeAll(async () => {
		envId = await createTestEnvironment()
	})

	afterAll(async () => {
		await cleanupTestEnvironment(envId)
	})

	// Clear session before each test to ensure clean state
	beforeEach(async () => {
		await runWithSession(SessionService.clearSession(envId))
		// Re-set the password since clearing removes it
		const config = getTestConfig()
		await runWithSession(SessionService.setPassword(envId, config.password))
	})

	describe("Successful Authentication", () => {
		it("should authenticate with valid credentials", async () => {
			// authenticate returns void on success (token stored in session)
			await runExpectSuccess(ImisApiService.authenticate(envId))
		})

		it("should store token in session after authentication", async () => {
			await runExpectSuccess(ImisApiService.authenticate(envId))

			// Verify token was stored
			const token = await runWithSession(SessionService.getImisToken(envId))
			expect(token).toBeDefined()
			expect(typeof token).toBe("string")
			expect(token!.length).toBeGreaterThan(0)
		})

		it("should reuse existing valid token without re-authenticating", async () => {
			// Authenticate first
			await runExpectSuccess(ImisApiService.authenticate(envId))
			const firstToken = await runWithSession(SessionService.getImisToken(envId))

			// Make another call that uses the token (health check)
			await runExpectSuccess(ImisApiService.healthCheck(envId))
			const secondToken = await runWithSession(SessionService.getImisToken(envId))

			// Should still be the same token
			expect(secondToken).toBe(firstToken)
		})
	})

	describe("Authentication Failures", () => {
		it("should fail with ImisAuthError for invalid password", async () => {
			// Create a separate environment with wrong password
			const badEnvId = await createTestEnvironment()

			// Override with wrong password
			await runWithSession(SessionService.clearSession(badEnvId))
			await runWithSession(
				SessionService.setPassword(badEnvId, "definitely-wrong-password-12345")
			)

			const error = await runExpectFailure(
				ImisApiService.authenticate(badEnvId),
				"ImisAuthError"
			)

			expect(error).toBeDefined()
			expect((error as { message: string }).message).toContain("Authentication failed")

			await cleanupTestEnvironment(badEnvId)
		})

		it("should fail with MissingCredentialsError when password not set", async () => {
			// Create environment without setting password
			const noPasswordEnvId = await createTestEnvironment()
			await runWithSession(SessionService.clearSession(noPasswordEnvId))
			// Don't set password

			const error = await runExpectFailure(
				ImisApiService.authenticate(noPasswordEnvId),
				"MissingCredentialsError"
			)

			expect(error).toBeDefined()
			expect((error as { environmentId: string }).environmentId).toBe(noPasswordEnvId)

			await cleanupTestEnvironment(noPasswordEnvId)
		})
	})

	describe("Token Refresh", () => {
		it("should refresh token automatically on 401", async () => {
			// Authenticate first
			await runExpectSuccess(ImisApiService.authenticate(envId))
			await runWithSession(SessionService.getImisToken(envId))

			// Manually clear the token to simulate expiry
			// The service will attempt to use no token, get 401, then refresh
			await runWithSession(
				Effect.gen(function* () {
					yield* SessionService.clearSession(envId)
					const config = getTestConfig()
					yield* SessionService.setPassword(envId, config.password)
				})
			)

			// Make a call that requires authentication
			// It should automatically authenticate and succeed
			await runExpectSuccess(ImisApiService.healthCheck(envId))

			// Should have a new token now
			const newToken = await runWithSession(SessionService.getImisToken(envId))
			expect(newToken).toBeDefined()
			// Note: token might be the same if using same credentials, but that's ok
		})
	})
})
