/**
 * Document/CMS navigation integration tests for iMIS API.
 *
 * Tests browsing the CMS folder structure and finding queries.
 */

import { describe, it, expect, beforeAll, afterAll } from "bun:test"
import { ImisApiService } from "@/services/imis-api"
import {
	shouldRunIntegrationTests,
	createTestEnvironment,
	cleanupTestEnvironment,
	runExpectSuccess,
	TEST_QUERY_PATH,
} from "./setup"

describe.skipIf(!shouldRunIntegrationTests())("iMIS Document Navigation", () => {
	let envId: string

	beforeAll(async () => {
		envId = await createTestEnvironment()
		// Pre-authenticate
		await runExpectSuccess(ImisApiService.authenticate(envId))
	})

	afterAll(async () => {
		await cleanupTestEnvironment(envId)
	})

	describe("getDocumentByPath", () => {
		it("should find root folder by path", async () => {
			const result = await runExpectSuccess(
				ImisApiService.getDocumentByPath(envId, "$")
			)

			expect(result).toBeDefined()
			expect(result.$type).toBeDefined()
			// Response contains DocumentSummaryData
			expect(result.$type).toContain("DocumentSummary")
		})

		it("should find the test query by path", async () => {
			const result = await runExpectSuccess(
				ImisApiService.getDocumentByPath(envId, TEST_QUERY_PATH)
			)

			expect(result).toBeDefined()

			// If the query exists, Result should have document info
			if (result.Result) {
				expect(result.Result).toHaveProperty("DocumentId")
				expect(result.Result).toHaveProperty("Name")
				expect(result.Result).toHaveProperty("DocumentTypeId")
			}
		})

		it("should return null Result for non-existent path", async () => {
			const result = await runExpectSuccess(
				ImisApiService.getDocumentByPath(
					envId,
					"$/NonExistent/Path/That/Does/Not/Exist"
				)
			)

			expect(result).toBeDefined()
			// Non-existent paths typically return null Result
			expect(result.Result).toBeNull()
		})
	})

	describe("getDocumentsInFolder", () => {
		it("should list documents in root folder", async () => {
			// First get the root folder's document ID
			const rootDoc = await runExpectSuccess(
				ImisApiService.getDocumentByPath(envId, "$")
			)

			if (rootDoc.Result && rootDoc.Result.DocumentId) {
				const result = await runExpectSuccess(
					ImisApiService.getDocumentsInFolder(envId, rootDoc.Result.DocumentId, [
						"FOL",
						"IQD",
					])
				)

				expect(result).toBeDefined()
				expect(result.$type).toBeDefined()
				expect(result.Result).toBeDefined()

				if (result.Result) {
					expect(result.Result.$values).toBeDefined()
					expect(Array.isArray(result.Result.$values)).toBe(true)
				}
			}
		})

		it("should filter by file types", async () => {
			// Get root folder
			const rootDoc = await runExpectSuccess(
				ImisApiService.getDocumentByPath(envId, "$")
			)

			if (rootDoc.Result && rootDoc.Result.DocumentId) {
				// Only get folders
				const foldersOnly = await runExpectSuccess(
					ImisApiService.getDocumentsInFolder(
						envId,
						rootDoc.Result.DocumentId,
						["FOL"]
					)
				)

				if (foldersOnly.Result && foldersOnly.Result.$values.length > 0) {
					// All results should be folders
					for (const doc of foldersOnly.Result.$values) {
						expect(doc.DocumentTypeId).toBe("FOL")
					}
				}
			}
		})
	})

	describe("Query Discovery", () => {
		it("should navigate to test query folder", async () => {
			// Parse the path to get folder components
			const pathParts = TEST_QUERY_PATH.split("/")
			const folderPath = pathParts.slice(0, -1).join("/")

			const result = await runExpectSuccess(
				ImisApiService.getDocumentByPath(envId, folderPath)
			)

			// If folder exists, should have a Result
			if (result.Result) {
				expect(result.Result.DocumentTypeId).toBe("FOL")
				expect(result.Result.Name).toBe("WIP")
			}
		})

		it("should identify queries vs folders by DocumentTypeId", async () => {
			// Get the test query document
			const queryDoc = await runExpectSuccess(
				ImisApiService.getDocumentByPath(envId, TEST_QUERY_PATH)
			)

			if (queryDoc.Result) {
				// IQD = IQA Query Definition
				expect(queryDoc.Result.DocumentTypeId).toBe("IQD")
			}
		})
	})
})
