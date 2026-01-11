/**
 * Query execution integration tests for iMIS API.
 *
 * Tests IQA query definition retrieval and execution for both EMS and 2017 versions.
 */

import { describe, it, expect, beforeAll, afterAll } from "bun:test"
import { ImisApiService } from "@/services/imis-api"
import {
	shouldRunIntegrationTests,
	createTestEnvironment,
	cleanupTestEnvironment,
	runExpectSuccess,
	TEST_QUERY_PATH,
	getTestConfig,
} from "./setup"

describe.skipIf(!shouldRunIntegrationTests())("iMIS Query Execution", () => {
	let envId: string

	beforeAll(async () => {
		envId = await createTestEnvironment()
		await runExpectSuccess(ImisApiService.authenticate(envId))
	})

	afterAll(async () => {
		await cleanupTestEnvironment(envId)
	})

	describe("Query Definition", () => {
		it("should get query definition for test query", async () => {
			const result = await runExpectSuccess(
				ImisApiService.getQueryDefinition(envId, TEST_QUERY_PATH)
			)

			expect(result).toBeDefined()
			expect(result.$type).toBeDefined()
			// Response contains QueryDefinitionData
			expect(result.$type).toContain("QueryDefinition")

			if (result.Result) {
				// QueryDefinition has Path and Properties (Name is in Document)
				expect(result.Result).toHaveProperty("Path")
				expect(result.Result).toHaveProperty("Properties")
			}
		})

		it("should return query properties with names", async () => {
			const result = await runExpectSuccess(
				ImisApiService.getQueryDefinition(envId, TEST_QUERY_PATH)
			)

			if (result.Result && result.Result.Properties) {
				const properties = result.Result.Properties.$values
				expect(Array.isArray(properties)).toBe(true)

				if (properties.length > 0) {
					const firstProp = properties[0]
					expect(firstProp).toHaveProperty("Name")
					// Property may have different type info fields depending on iMIS version
					expect(typeof firstProp.Name).toBe("string")
				}
			}
		})

		it("should return null for non-existent query", async () => {
			const result = await runExpectSuccess(
				ImisApiService.getQueryDefinition(
					envId,
					"$/NonExistent/Query/Path/That/Does/Not/Exist"
				)
			)

			expect(result.Result).toBeNull()
		})
	})

	describe("Query Execution (EMS)", () => {
		it("should execute query and return results", async () => {
			const result = await runExpectSuccess(
				ImisApiService.executeQuery(envId, TEST_QUERY_PATH, 10, 0)
			)

			expect(result).toBeDefined()
			expect(result.Items).toBeDefined()
			expect(result.Items.$values).toBeDefined()
			expect(Array.isArray(result.Items.$values)).toBe(true)
		})

		it("should respect limit parameter", async () => {
			const result = await runExpectSuccess(
				ImisApiService.executeQuery(envId, TEST_QUERY_PATH, 5, 0)
			)

			expect(result.Items.$values.length).toBeLessThanOrEqual(5)
			expect(result.Limit).toBe(5)
		})

		it("should paginate with offset", async () => {
			// Get first page
			const page1 = await runExpectSuccess(
				ImisApiService.executeQuery(envId, TEST_QUERY_PATH, 5, 0)
			)

			// Get second page
			const page2 = await runExpectSuccess(
				ImisApiService.executeQuery(envId, TEST_QUERY_PATH, 5, 5)
			)

			expect(page1.Offset).toBe(0)
			expect(page2.Offset).toBe(5)

			// If there are enough rows, pages should have different data
			if (page1.TotalCount > 5 && page1.Items.$values.length > 0 && page2.Items.$values.length > 0) {
				// Items should be different (assuming deterministic ordering)
				const page1FirstItem = JSON.stringify(page1.Items.$values[0])
				const page2FirstItem = JSON.stringify(page2.Items.$values[0])
				expect(page1FirstItem).not.toBe(page2FirstItem)
			}
		})

		it("should return TotalCount for pagination planning", async () => {
			const result = await runExpectSuccess(
				ImisApiService.executeQuery(envId, TEST_QUERY_PATH, 10, 0)
			)

			expect(typeof result.TotalCount).toBe("number")
			expect(result.TotalCount).toBeGreaterThanOrEqual(0)
		})

		it("should return flat Record rows (not wrapped)", async () => {
			const result = await runExpectSuccess(
				ImisApiService.executeQuery(envId, TEST_QUERY_PATH, 10, 0)
			)

			if (result.Items.$values.length > 0) {
				const firstRow = result.Items.$values[0]
				expect(typeof firstRow).toBe("object")

				// Values should be primitives, not wrapped in $type/$value
				for (const value of Object.values(firstRow)) {
					if (value !== null && typeof value === "object") {
						// Binary data (blobs) may still have $type
						expect(value).not.toHaveProperty("$value")
					}
				}
			}
		})

		it("should return response matching schema", async () => {
			const result = await runExpectSuccess(
				ImisApiService.executeQuery(envId, TEST_QUERY_PATH, 10, 0)
			)

			expect(result.$type).toContain("PagedResult")
			expect(typeof result.Offset).toBe("number")
			expect(typeof result.Limit).toBe("number")
			expect(typeof result.Count).toBe("number")
			expect(typeof result.TotalCount).toBe("number")
			expect(typeof result.HasNext).toBe("boolean")
			expect(typeof result.NextOffset).toBe("number")
		})

		it("should handle HasNext correctly", async () => {
			const result = await runExpectSuccess(
				ImisApiService.executeQuery(envId, TEST_QUERY_PATH, 5, 0)
			)

			// HasNext should be true if there are more results
			const expectedHasNext = result.TotalCount > result.Offset + result.Count
			expect(result.HasNext).toBe(expectedHasNext)
		})
	})

	describe("Query Execution (2017)", () => {
		const config = getTestConfig()
		// Skip these tests if we're not testing 2017
		const is2017Available = config.version === "2017"

		describe.skipIf(!is2017Available)("2017 Environment", () => {
			let env2017Id: string

			beforeAll(async () => {
				env2017Id = await createTestEnvironment({ version: "2017" })
				await runExpectSuccess(ImisApiService.authenticate(env2017Id))
			})

			afterAll(async () => {
				await cleanupTestEnvironment(env2017Id)
			})

			it("should execute query on 2017 environment", async () => {
				const result = await runExpectSuccess(
					ImisApiService.executeQuery(env2017Id, TEST_QUERY_PATH, 10, 0)
				)

				expect(result).toBeDefined()
				expect(result.Items.$values).toBeDefined()
				expect(Array.isArray(result.Items.$values)).toBe(true)
			})

			it("should normalize 2017 response to flat format", async () => {
				const result = await runExpectSuccess(
					ImisApiService.executeQuery(env2017Id, TEST_QUERY_PATH, 10, 0)
				)

				if (result.Items.$values.length > 0) {
					const firstRow = result.Items.$values[0]

					// Values should be unwrapped (no $type/$value wrappers)
					for (const value of Object.values(firstRow)) {
						if (value !== null && typeof value === "object") {
							// Only blobs should have $type
							if ((value as Record<string, unknown>).$type) {
								expect((value as Record<string, string>).$type).toContain(
									"System.Byte[]"
								)
							}
						}
					}
				}
			})

			it("should return same structure as EMS queries", async () => {
				const result = await runExpectSuccess(
					ImisApiService.executeQuery(env2017Id, TEST_QUERY_PATH, 10, 0)
				)

				// Should have same structure as EMS
				expect(result.$type).toContain("PagedResult")
				expect(typeof result.Offset).toBe("number")
				expect(typeof result.Limit).toBe("number")
				expect(typeof result.Count).toBe("number")
				expect(typeof result.TotalCount).toBe("number")
			})
		})
	})
})
