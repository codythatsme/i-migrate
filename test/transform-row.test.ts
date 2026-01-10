/**
 * Integration tests for row transformation and offset generation.
 * Tests runtime behaviors that types cannot verify:
 * - Property mapping with null destinations
 * - Non-primitive value filtering
 * - Batch offset generation edge cases
 */

import { describe, it, expect } from "bun:test"
import { transformRow, generateOffsets } from "../src/services/migration-job"
import { createPropertyMapping } from "./setup"

describe("transformRow", () => {
  describe("basic mapping", () => {
    it("should map source properties to destination properties", () => {
      const sourceRow = {
        firstName: "John",
        lastName: "Doe",
        age: 30,
      }
      const mappings = [
        createPropertyMapping("firstName", "FirstName"),
        createPropertyMapping("lastName", "LastName"),
        createPropertyMapping("age", "Age"),
      ]

      const result = transformRow(sourceRow, mappings)

      expect(result).toEqual({
        FirstName: "John",
        LastName: "Doe",
        Age: 30,
      })
    })

    it("should only include mappings with non-null destinationProperty", () => {
      const sourceRow = {
        firstName: "John",
        middleName: "Michael",
        lastName: "Doe",
      }
      const mappings = [
        createPropertyMapping("firstName", "FirstName"),
        createPropertyMapping("middleName", null), // Skip this one
        createPropertyMapping("lastName", "LastName"),
      ]

      const result = transformRow(sourceRow, mappings)

      expect(result).toEqual({
        FirstName: "John",
        LastName: "Doe",
      })
      expect(result).not.toHaveProperty("middleName")
      expect(result).not.toHaveProperty("MiddleName")
    })
  })

  describe("primitive value handling", () => {
    it("should include string values", () => {
      const sourceRow = { name: "John" }
      const mappings = [createPropertyMapping("name", "Name")]

      const result = transformRow(sourceRow, mappings)

      expect(result).toEqual({ Name: "John" })
    })

    it("should include number values", () => {
      const sourceRow = { age: 30, score: 99.5 }
      const mappings = [
        createPropertyMapping("age", "Age"),
        createPropertyMapping("score", "Score"),
      ]

      const result = transformRow(sourceRow, mappings)

      expect(result).toEqual({ Age: 30, Score: 99.5 })
    })

    it("should include boolean values", () => {
      const sourceRow = { active: true, verified: false }
      const mappings = [
        createPropertyMapping("active", "IsActive"),
        createPropertyMapping("verified", "IsVerified"),
      ]

      const result = transformRow(sourceRow, mappings)

      expect(result).toEqual({ IsActive: true, IsVerified: false })
    })

    it("should include null values", () => {
      const sourceRow = { email: null, phone: null }
      const mappings = [
        createPropertyMapping("email", "Email"),
        createPropertyMapping("phone", "Phone"),
      ]

      const result = transformRow(sourceRow, mappings)

      expect(result).toEqual({ Email: null, Phone: null })
    })
  })

  describe("non-primitive value filtering", () => {
    it("should filter out object values", () => {
      const sourceRow = {
        name: "John",
        address: { city: "NYC", zip: "10001" },
      }
      const mappings = [
        createPropertyMapping("name", "Name"),
        createPropertyMapping("address", "Address"),
      ]

      const result = transformRow(sourceRow, mappings)

      expect(result).toEqual({ Name: "John" })
      expect(result).not.toHaveProperty("Address")
    })

    it("should filter out array values", () => {
      const sourceRow = {
        name: "John",
        tags: ["admin", "user"],
      }
      const mappings = [
        createPropertyMapping("name", "Name"),
        createPropertyMapping("tags", "Tags"),
      ]

      const result = transformRow(sourceRow, mappings)

      expect(result).toEqual({ Name: "John" })
      expect(result).not.toHaveProperty("Tags")
    })

    it("should filter out undefined values", () => {
      const sourceRow = {
        name: "John",
        email: undefined,
      }
      const mappings = [
        createPropertyMapping("name", "Name"),
        createPropertyMapping("email", "Email"),
      ]

      const result = transformRow(sourceRow, mappings)

      expect(result).toEqual({ Name: "John" })
      expect(result).not.toHaveProperty("Email")
    })

    it("should filter out function values", () => {
      const sourceRow = {
        name: "John",
        callback: () => {},
      }
      const mappings = [
        createPropertyMapping("name", "Name"),
        createPropertyMapping("callback", "Callback"),
      ]

      const result = transformRow(sourceRow, mappings)

      expect(result).toEqual({ Name: "John" })
      expect(result).not.toHaveProperty("Callback")
    })
  })

  describe("binary blob handling", () => {
    it("should preserve binary blob structure", () => {
      const binaryBlob = {
        $type: "System.Byte[], mscorlib" as const,
        $value: "SGVsbG8gV29ybGQ=", // Base64 encoded "Hello World"
      }
      const sourceRow = {
        name: "Test",
        image: binaryBlob,
      }
      const mappings = [
        createPropertyMapping("name", "Name"),
        createPropertyMapping("image", "Image"),
      ]

      const result = transformRow(sourceRow, mappings)

      expect(result).toEqual({
        Name: "Test",
        Image: binaryBlob,
      })
      expect(result.Image).toHaveProperty("$type", "System.Byte[], mscorlib")
      expect(result.Image).toHaveProperty("$value", "SGVsbG8gV29ybGQ=")
    })

    it("should filter out objects that look like binary blobs but have wrong $type", () => {
      const notABlob = {
        $type: "System.String, mscorlib",
        $value: "some string",
      }
      const sourceRow = {
        name: "Test",
        data: notABlob,
      }
      const mappings = [
        createPropertyMapping("name", "Name"),
        createPropertyMapping("data", "Data"),
      ]

      const result = transformRow(sourceRow, mappings)

      expect(result).toEqual({ Name: "Test" })
      expect(result).not.toHaveProperty("Data")
    })

    it("should filter out objects missing $value property", () => {
      const notABlob = {
        $type: "System.Byte[], mscorlib",
        // Missing $value
      }
      const sourceRow = {
        name: "Test",
        data: notABlob,
      }
      const mappings = [
        createPropertyMapping("name", "Name"),
        createPropertyMapping("data", "Data"),
      ]

      const result = transformRow(sourceRow, mappings)

      expect(result).toEqual({ Name: "Test" })
      expect(result).not.toHaveProperty("Data")
    })

    it("should handle row with multiple binary blobs", () => {
      const blob1 = {
        $type: "System.Byte[], mscorlib" as const,
        $value: "YmxvYjE=", // "blob1"
      }
      const blob2 = {
        $type: "System.Byte[], mscorlib" as const,
        $value: "YmxvYjI=", // "blob2"
      }
      const sourceRow = {
        file1: blob1,
        file2: blob2,
        name: "Test",
      }
      const mappings = [
        createPropertyMapping("file1", "File1"),
        createPropertyMapping("file2", "File2"),
        createPropertyMapping("name", "Name"),
      ]

      const result = transformRow(sourceRow, mappings)

      expect(result).toEqual({
        File1: blob1,
        File2: blob2,
        Name: "Test",
      })
    })
  })

  describe("edge cases", () => {
    it("should return empty object when all mappings have null destination", () => {
      const sourceRow = { a: 1, b: 2 }
      const mappings = [
        createPropertyMapping("a", null),
        createPropertyMapping("b", null),
      ]

      const result = transformRow(sourceRow, mappings)

      expect(result).toEqual({})
    })

    it("should return empty object when mappings array is empty", () => {
      const sourceRow = { a: 1, b: 2 }
      const mappings: { sourceProperty: string; destinationProperty: string | null }[] = []

      const result = transformRow(sourceRow, mappings)

      expect(result).toEqual({})
    })

    it("should handle missing source properties gracefully", () => {
      const sourceRow = { name: "John" }
      const mappings = [
        createPropertyMapping("name", "Name"),
        createPropertyMapping("age", "Age"), // Not in source
      ]

      const result = transformRow(sourceRow, mappings)

      expect(result).toEqual({ Name: "John" })
      // age is undefined so it should be filtered out
      expect(result).not.toHaveProperty("Age")
    })

    it("should handle empty source row", () => {
      const sourceRow = {}
      const mappings = [
        createPropertyMapping("name", "Name"),
        createPropertyMapping("age", "Age"),
      ]

      const result = transformRow(sourceRow, mappings)

      expect(result).toEqual({})
    })
  })
})

describe("generateOffsets", () => {
  describe("basic offset generation", () => {
    it("should return [0] when total < batch size", () => {
      const offsets = generateOffsets(100, 500)

      expect(offsets).toEqual([0])
    })

    it("should return [0] when total equals 0", () => {
      const offsets = generateOffsets(0, 500)

      expect(offsets).toEqual([])
    })

    it("should return [0] when total equals 1", () => {
      const offsets = generateOffsets(1, 500)

      expect(offsets).toEqual([0])
    })
  })

  describe("multiple batches", () => {
    it("should generate correct offsets for total > batch size", () => {
      const offsets = generateOffsets(1250, 500)

      expect(offsets).toEqual([0, 500, 1000])
    })

    it("should generate correct offsets for exact multiple of batch size", () => {
      const offsets = generateOffsets(1000, 500)

      expect(offsets).toEqual([0, 500])
    })

    it("should generate correct offsets for one item over batch boundary", () => {
      const offsets = generateOffsets(501, 500)

      expect(offsets).toEqual([0, 500])
    })
  })

  describe("default batch size", () => {
    it("should use 500 as default batch size", () => {
      const offsets = generateOffsets(1001)

      expect(offsets).toEqual([0, 500, 1000])
    })
  })

  describe("custom batch sizes", () => {
    it("should work with small batch size", () => {
      const offsets = generateOffsets(25, 10)

      expect(offsets).toEqual([0, 10, 20])
    })

    it("should work with batch size of 1", () => {
      const offsets = generateOffsets(5, 1)

      expect(offsets).toEqual([0, 1, 2, 3, 4])
    })

    it("should work with large batch size", () => {
      const offsets = generateOffsets(10000, 5000)

      expect(offsets).toEqual([0, 5000])
    })
  })
})
