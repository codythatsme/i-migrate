/**
 * Unit tests for DataSource schema parsing and normalization.
 *
 * Tests the DataSourceResponseSchema and normalization logic
 * without requiring a real iMIS connection.
 */

import { describe, it, expect } from "bun:test"
import { Schema } from "effect"
import {
	DataSourceResponseSchema,
	DataSourceRowSchema,
	DataSourcePropertyDataSchema,
} from "@/api/imis-schemas"

describe("DataSourceResponseSchema", () => {
	describe("DataSourcePropertyDataSchema", () => {
		it("should parse property with simple string value", () => {
			const input = {
				$type: "Asi.Soa.Core.DataContracts.GenericPropertyData, Asi.Contracts",
				Name: "ID",
				Value: "194",
			}

			const result = Schema.decodeUnknownSync(DataSourcePropertyDataSchema)(input)
			expect(result.Name).toBe("ID")
			expect(result.Value).toBe("194")
		})

		it("should parse property with wrapped integer value", () => {
			const input = {
				$type: "Asi.Soa.Core.DataContracts.GenericPropertyData, Asi.Contracts",
				Name: "Ordinal",
				Value: {
					$type: "System.Int32",
					$value: 2,
				},
			}

			const result = Schema.decodeUnknownSync(DataSourcePropertyDataSchema)(input)
			expect(result.Name).toBe("Ordinal")
			expect(result.Value).toEqual({ $type: "System.Int32", $value: 2 })
		})

		it("should parse property with null value", () => {
			const input = {
				$type: "Asi.Soa.Core.DataContracts.GenericPropertyData, Asi.Contracts",
				Name: "Description",
				Value: null,
			}

			const result = Schema.decodeUnknownSync(DataSourcePropertyDataSchema)(input)
			expect(result.Name).toBe("Description")
			expect(result.Value).toBeNull()
		})

		it("should parse property with missing value (optional)", () => {
			const input = {
				$type: "Asi.Soa.Core.DataContracts.GenericPropertyData, Asi.Contracts",
				Name: "BlogPostPreviewData",
				// No Value field
			}

			const result = Schema.decodeUnknownSync(DataSourcePropertyDataSchema)(input)
			expect(result.Name).toBe("BlogPostPreviewData")
			expect(result.Value).toBeUndefined()
		})

		it("should parse property with binary blob value", () => {
			const input = {
				$type: "Asi.Soa.Core.DataContracts.GenericPropertyData, Asi.Contracts",
				Name: "BlogPostData",
				Value: {
					$type: "System.Byte[], mscorlib",
					$value: "eyJjb250ZW50IjpbXX0=",
				},
			}

			const result = Schema.decodeUnknownSync(DataSourcePropertyDataSchema)(input)
			expect(result.Name).toBe("BlogPostData")
			expect(result.Value).toEqual({
				$type: "System.Byte[], mscorlib",
				$value: "eyJjb250ZW50IjpbXX0=",
			})
		})
	})

	describe("DataSourceRowSchema", () => {
		it("should parse a complete data source row", () => {
			const input = {
				$type: "Asi.Soa.Core.DataContracts.GenericEntityData, Asi.Contracts",
				EntityTypeName: "Smart_Blogs_Blog_Post",
				PrimaryParentEntityTypeName: "Party",
				Identity: {
					$type: "Asi.Soa.Core.DataContracts.IdentityData, Asi.Contracts",
					EntityTypeName: "Smart_Blogs_Blog_Post",
					IdentityElements: {
						$type: "System.Collections.ObjectModel.Collection`1[[System.String, mscorlib]], mscorlib",
						$values: ["194", "2"],
					},
				},
				PrimaryParentIdentity: {
					$type: "Asi.Soa.Core.DataContracts.IdentityData, Asi.Contracts",
					EntityTypeName: "Party",
					IdentityElements: {
						$type: "System.Collections.ObjectModel.Collection`1[[System.String, mscorlib]], mscorlib",
						$values: ["194"],
					},
				},
				Properties: {
					$type: "Asi.Soa.Core.DataContracts.GenericPropertyDataCollection, Asi.Contracts",
					$values: [
						{
							$type: "Asi.Soa.Core.DataContracts.GenericPropertyData, Asi.Contracts",
							Name: "ID",
							Value: "194",
						},
						{
							$type: "Asi.Soa.Core.DataContracts.GenericPropertyData, Asi.Contracts",
							Name: "Status",
							Value: "Draft",
						},
					],
				},
			}

			const result = Schema.decodeUnknownSync(DataSourceRowSchema)(input)
			expect(result.EntityTypeName).toBe("Smart_Blogs_Blog_Post")
			expect(result.PrimaryParentEntityTypeName).toBe("Party")
			expect(result.Properties.$values).toHaveLength(2)
			expect(result.Properties.$values[0]!.Name).toBe("ID")
		})
	})

	describe("DataSourceResponseSchema", () => {
		it("should parse a complete data source response", () => {
			const input = {
				$type: "Asi.Soa.Core.DataContracts.PagedResult`1[[Asi.Soa.Core.DataContracts.GenericEntityData, Asi.Contracts]], Asi.Contracts",
				Items: {
					$type: "System.Collections.Generic.List`1[[Asi.Soa.Core.DataContracts.GenericEntityData, Asi.Contracts]], mscorlib",
					$values: [
						{
							$type: "Asi.Soa.Core.DataContracts.GenericEntityData, Asi.Contracts",
							EntityTypeName: "Party",
							PrimaryParentEntityTypeName: "Standalone",
							Properties: {
								$type: "Asi.Soa.Core.DataContracts.GenericPropertyDataCollection, Asi.Contracts",
								$values: [
									{
										$type: "Asi.Soa.Core.DataContracts.GenericPropertyData, Asi.Contracts",
										Name: "ID",
										Value: "123",
									},
								],
							},
						},
					],
				},
				Offset: 0,
				Limit: 1,
				Count: 1,
				TotalCount: 100,
				NextPageLink: null,
				HasNext: true,
				NextOffset: 1,
			}

			const result = Schema.decodeUnknownSync(DataSourceResponseSchema)(input)
			expect(result.Items.$values).toHaveLength(1)
			expect(result.Offset).toBe(0)
			expect(result.Limit).toBe(1)
			expect(result.TotalCount).toBe(100)
			expect(result.HasNext).toBe(true)
			expect(result.NextOffset).toBe(1)
		})

		it("should parse empty data source response", () => {
			const input = {
				$type: "Asi.Soa.Core.DataContracts.PagedResult`1[[Asi.Soa.Core.DataContracts.GenericEntityData, Asi.Contracts]], Asi.Contracts",
				Items: {
					$type: "System.Collections.Generic.List`1[[Asi.Soa.Core.DataContracts.GenericEntityData, Asi.Contracts]], mscorlib",
					$values: [],
				},
				Offset: 0,
				Limit: 500,
				Count: 0,
				TotalCount: 0,
				NextPageLink: null,
				HasNext: false,
				NextOffset: 0,
			}

			const result = Schema.decodeUnknownSync(DataSourceResponseSchema)(input)
			expect(result.Items.$values).toHaveLength(0)
			expect(result.TotalCount).toBe(0)
			expect(result.HasNext).toBe(false)
		})
	})
})
