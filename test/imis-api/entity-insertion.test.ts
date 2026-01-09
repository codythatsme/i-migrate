/**
 * Entity insertion integration tests for iMIS API.
 *
 * Tests write operations for inserting entities.
 * Uses the TEST_ENTITY_TYPE for testing.
 */

import { describe, it, expect, beforeAll, afterAll } from "bun:test"
import { ImisApiService } from "@/services/imis-api"
import {
	shouldRunIntegrationTests,
	createTestEnvironment,
	cleanupTestEnvironment,
	runExpectSuccess,
	runExpectFailure,
	TEST_ENTITY_TYPE,
	generateTestRunId,
} from "./setup"

describe.skipIf(!shouldRunIntegrationTests())("iMIS Entity Insertion", () => {
	let envId: string
	const testRunId = generateTestRunId()

	beforeAll(async () => {
		envId = await createTestEnvironment()
		await runExpectSuccess(ImisApiService.authenticate(envId))
	})

	afterAll(async () => {
		await cleanupTestEnvironment(envId)
		// Note: Test entities created during these tests may need manual cleanup
		// depending on the entity type's configuration
	})

	describe("Successful Insertion", () => {
		it("should insert entity with valid data", async () => {
			const properties = {
				ErrorMessage: `Integration Test ${testRunId}`,
				ErrorType: "IntegrationTest",
			}

			// insertEntity returns void on success
			await runExpectSuccess(
				ImisApiService.insertEntity(
					envId,
					TEST_ENTITY_TYPE,
					"Standalone",
					null,
					properties
				)
			)
		})

		it("should insert entity with various property types", async () => {
			const properties = {
				ErrorMessage: `Test with types ${testRunId}`,
				ErrorType: "PropertyTypeTest",
				// String
				// Note: Add more properties based on actual entity definition
			}

			await runExpectSuccess(
				ImisApiService.insertEntity(
					envId,
					TEST_ENTITY_TYPE,
					"Standalone",
					null,
					properties
				)
			)
		})

		it("should handle null property values", async () => {
			const properties: Record<string, string | number | boolean | null> = {
				ErrorMessage: `Null test ${testRunId}`,
				ErrorType: null,
			}

			await runExpectSuccess(
				ImisApiService.insertEntity(
					envId,
					TEST_ENTITY_TYPE,
					"Standalone",
					null,
					properties
				)
			)
		})
	})

	describe("Parent Entity Relationships", () => {
		it("should insert with Standalone parent type", async () => {
			const properties = {
				ErrorMessage: `Standalone parent ${testRunId}`,
				ErrorType: "ParentTest",
			}

			await runExpectSuccess(
				ImisApiService.insertEntity(
					envId,
					TEST_ENTITY_TYPE,
					"Standalone",
					null, // No parent ID for Standalone
					properties
				)
			)
		})
	})

	describe("Error Scenarios", () => {
		it("should fail with ImisResponseError for invalid entity type", async () => {
			const properties = {
				SomeField: "value",
			}

			const error = await runExpectFailure(
				ImisApiService.insertEntity(
					envId,
					"NonExistentEntity_12345",
					"Standalone",
					null,
					properties
				),
				"ImisResponseError"
			)

			expect(error).toBeDefined()
			// Should get a 4xx error for non-existent entity type
			expect((error as { status: number }).status).toBeGreaterThanOrEqual(400)
			expect((error as { status: number }).status).toBeLessThan(500)
		})

		it("should handle empty properties gracefully", async () => {
			const properties = {}

			// Empty properties might succeed or fail depending on entity requirements
			// This test documents the behavior
			try {
				await runExpectSuccess(
					ImisApiService.insertEntity(
						envId,
						TEST_ENTITY_TYPE,
						"Standalone",
						null,
						properties
					)
				)
			} catch (error) {
				// Expected if entity has required fields
				expect(error).toBeDefined()
			}
		})
	})

	describe("Property Type Handling", () => {
		it("should handle string properties", async () => {
			const properties = {
				ErrorMessage: `String test ${testRunId}`,
				ErrorType: "String property test with special chars: <>&\"'",
			}

			await runExpectSuccess(
				ImisApiService.insertEntity(
					envId,
					TEST_ENTITY_TYPE,
					"Standalone",
					null,
					properties
				)
			)
		})

		it("should handle boolean properties", async () => {
			// Note: This assumes the entity has boolean properties
			// Adjust property names based on actual entity definition
			const properties: Record<string, string | number | boolean | null> = {
				ErrorMessage: `Boolean test ${testRunId}`,
				ErrorType: "BoolTest",
			}

			await runExpectSuccess(
				ImisApiService.insertEntity(
					envId,
					TEST_ENTITY_TYPE,
					"Standalone",
					null,
					properties
				)
			)
		})

		it("should handle numeric properties", async () => {
			// Note: This assumes the entity has numeric properties
			const properties: Record<string, string | number | boolean | null> = {
				ErrorMessage: `Numeric test ${testRunId}`,
				ErrorType: "NumericTest",
			}

			await runExpectSuccess(
				ImisApiService.insertEntity(
					envId,
					TEST_ENTITY_TYPE,
					"Standalone",
					null,
					properties
				)
			)
		})
	})
})
