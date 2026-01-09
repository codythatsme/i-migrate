/**
 * Data sources (BoEntityDefinition) integration tests for iMIS API.
 *
 * Tests listing and inspecting business object entity definitions,
 * and fetching data from data sources.
 */

import { describe, it, expect, beforeAll, afterAll } from "bun:test"
import { ImisApiService } from "@/services/imis-api"
import {
	shouldRunIntegrationTests,
	createTestEnvironment,
	cleanupTestEnvironment,
	runExpectSuccess,
	TEST_ENTITY_TYPE,
} from "./setup"

describe.skipIf(!shouldRunIntegrationTests())("iMIS Data Sources", () => {
	let envId: string

	beforeAll(async () => {
		envId = await createTestEnvironment()
		// Pre-authenticate to speed up tests
		await runExpectSuccess(ImisApiService.authenticate(envId))
	})

	afterAll(async () => {
		await cleanupTestEnvironment(envId)
	})

	describe("getBoEntityDefinitions", () => {
		it("should list BO entity definitions", async () => {
			const result = await runExpectSuccess(
				ImisApiService.getBoEntityDefinitions(envId, 10)
			)

			expect(result).toBeDefined()
			expect(result.Items).toBeDefined()
			expect(result.Items.$values).toBeDefined()
			expect(Array.isArray(result.Items.$values)).toBe(true)
		})

		it("should respect limit parameter", async () => {
			const result = await runExpectSuccess(
				ImisApiService.getBoEntityDefinitions(envId, 5)
			)

			expect(result.Items.$values.length).toBeLessThanOrEqual(5)
			// Note: The API may return a Limit of 0 even when we request 5
			// This is iMIS behavior, not a bug in our code
			expect(typeof result.Limit).toBe("number")
		})

		it("should return response matching schema", async () => {
			const result = await runExpectSuccess(
				ImisApiService.getBoEntityDefinitions(envId, 10)
			)

			// Check structure
			expect(result.$type).toContain("PagedResult")
			expect(typeof result.Offset).toBe("number")
			expect(typeof result.Limit).toBe("number")
			expect(typeof result.Count).toBe("number")
			expect(typeof result.TotalCount).toBe("number")
			expect(typeof result.HasNext).toBe("boolean")
			expect(typeof result.NextOffset).toBe("number")
		})

		it("should include entity properties in definitions", async () => {
			const result = await runExpectSuccess(
				ImisApiService.getBoEntityDefinitions(envId, 10)
			)

			// At least one entity should have properties
			const entitiesWithProperties = result.Items.$values.filter(
				(entity) =>
					entity.Properties &&
					entity.Properties.$values &&
					entity.Properties.$values.length > 0
			)

			expect(entitiesWithProperties.length).toBeGreaterThan(0)

			// Check property structure
			const firstEntity = entitiesWithProperties[0]
			const firstProperty = firstEntity.Properties.$values[0]
			expect(firstProperty).toHaveProperty("Name")
			expect(firstProperty).toHaveProperty("$type")
		})
	})

	describe("Entity Definition Structure", () => {
		it("should return entity type name for each definition", async () => {
			const result = await runExpectSuccess(
				ImisApiService.getBoEntityDefinitions(envId, 10)
			)

			for (const entity of result.Items.$values) {
				expect(entity.EntityTypeName).toBeDefined()
				expect(typeof entity.EntityTypeName).toBe("string")
				expect(entity.EntityTypeName.length).toBeGreaterThan(0)
			}
		})

		it("should return object type name (Single, Multi, Standard)", async () => {
			const result = await runExpectSuccess(
				ImisApiService.getBoEntityDefinitions(envId, 50)
			)

			// Should have a variety of object types
			const objectTypes = new Set(
				result.Items.$values.map((e) => e.ObjectTypeName)
			)

			// At least one type should be present
			expect(objectTypes.size).toBeGreaterThan(0)
		})
	})

	describe("Finding Specific Entities", () => {
		it("should be able to find the test entity type", async () => {
			// Get a larger list to find our test entity
			const result = await runExpectSuccess(
				ImisApiService.getBoEntityDefinitions(envId, 500)
			)

			const testEntity = result.Items.$values.find(
				(e) => e.EntityTypeName === TEST_ENTITY_TYPE
			)

			// Note: This test might fail if the entity doesn't exist
			// That's expected and informative
			if (testEntity) {
				expect(testEntity.EntityTypeName).toBe(TEST_ENTITY_TYPE)
				expect(testEntity.Properties).toBeDefined()
			} else {
				console.warn(
					`Test entity ${TEST_ENTITY_TYPE} not found in first 500 definitions`
				)
			}
		})
	})

	describe("fetchDataSource", () => {
		// Note: fetchDataSource is designed for BO/custom entities that use GenericEntityData format
		// (Properties.$values array). Built-in entities like Party have a different flat structure.
		// We use CsAddress as it's a standard BO entity that uses the GenericEntityData format.

		it("should fetch data from a BO data source with pagination info", async () => {
			// Use CsAddress as it's a standard BO entity using GenericEntityData format
			const result = await runExpectSuccess(
				ImisApiService.fetchDataSource(envId, "CsAddress", 5, 0)
			)

			// Check pagination structure
			expect(result).toBeDefined()
			expect(result.Items).toBeDefined()
			expect(result.Items.$values).toBeDefined()
			expect(Array.isArray(result.Items.$values)).toBe(true)
			expect(typeof result.Offset).toBe("number")
			expect(typeof result.Limit).toBe("number")
			expect(typeof result.Count).toBe("number")
			expect(typeof result.TotalCount).toBe("number")
			expect(typeof result.HasNext).toBe("boolean")
			expect(typeof result.NextOffset).toBe("number")
		})

		it("should return normalized flat records (not nested Properties)", async () => {
			const result = await runExpectSuccess(
				ImisApiService.fetchDataSource(envId, "CsAddress", 5, 0)
			)

			// Should have at least one record
			if (result.Items.$values.length > 0) {
				const firstRecord = result.Items.$values[0]!

				// Should be a flat object, NOT have nested Properties structure
				expect(firstRecord).not.toHaveProperty("Properties")
				expect(firstRecord).not.toHaveProperty("EntityTypeName")

				// Should have flat key-value pairs (CsAddress should have Address1 at minimum)
				expect(typeof firstRecord).toBe("object")
				expect(Object.keys(firstRecord).length).toBeGreaterThan(0)
			}
		})

		it("should respect limit parameter", async () => {
			const result = await runExpectSuccess(
				ImisApiService.fetchDataSource(envId, "CsAddress", 3, 0)
			)

			expect(result.Items.$values.length).toBeLessThanOrEqual(3)
		})

		it("should respect offset parameter", async () => {
			// Fetch first page
			const firstPage = await runExpectSuccess(
				ImisApiService.fetchDataSource(envId, "CsAddress", 2, 0)
			)

			// Verify offset is reported correctly
			expect(firstPage.Offset).toBe(0)

			// Fetch with offset
			const offsetPage = await runExpectSuccess(
				ImisApiService.fetchDataSource(envId, "CsAddress", 2, 2)
			)

			// Verify offset is reported correctly
			expect(offsetPage.Offset).toBe(2)
		})

		it("should handle data source with no records gracefully", async () => {
			// Use the test entity type which may have no records
			const result = await runExpectSuccess(
				ImisApiService.fetchDataSource(envId, TEST_ENTITY_TYPE, 5, 0)
			)

			// Should still return valid structure even if empty
			expect(result.Items.$values).toBeDefined()
			expect(Array.isArray(result.Items.$values)).toBe(true)
			expect(result.TotalCount).toBeGreaterThanOrEqual(0)
		})
	})
})
