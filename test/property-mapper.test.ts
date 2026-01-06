/**
 * Integration tests for property mapper logic.
 * Tests runtime behaviors that types cannot verify:
 * - Type compatibility checking
 * - MaxLength warning generation
 * - Auto-mapping algorithm
 * - Restricted property filtering
 */

import { describe, it, expect } from "bun:test"
import {
  checkCompatibility,
  findAutoMappings,
  getPropertyTypeName,
  getMaxLength,
  checkIsPrimaryRequired,
  RESTRICTED_DESTINATION_PROPERTIES,
} from "../src/components/export/PropertyMapper"
import {
  createStringProperty,
  createIntegerProperty,
  createBooleanProperty,
  createPropertyMapping,
} from "./setup"

describe("getPropertyTypeName", () => {
  it("should return String for string properties", () => {
    const prop = createStringProperty("Name")
    expect(getPropertyTypeName(prop)).toBe("String")
  })

  it("should return Integer for integer properties", () => {
    const prop = createIntegerProperty("Age")
    expect(getPropertyTypeName(prop)).toBe("Integer")
  })

  it("should return Boolean for boolean properties", () => {
    const prop = createBooleanProperty("Active")
    expect(getPropertyTypeName(prop)).toBe("Boolean")
  })
})

describe("getMaxLength", () => {
  it("should return MaxLength for string properties", () => {
    const prop = createStringProperty("Name", 100)
    expect(getMaxLength(prop)).toBe(100)
  })

  it("should return MaxLength for string properties with different lengths", () => {
    expect(getMaxLength(createStringProperty("A", 50))).toBe(50)
    expect(getMaxLength(createStringProperty("B", 500))).toBe(500)
    expect(getMaxLength(createStringProperty("C", 4000))).toBe(4000)
  })

  it("should return null for non-string properties", () => {
    expect(getMaxLength(createIntegerProperty("Age"))).toBeNull()
    expect(getMaxLength(createBooleanProperty("Active"))).toBeNull()
  })
})

describe("checkCompatibility", () => {
  describe("type matching", () => {
    it("should return compatible: true for matching String types", () => {
      const source = createStringProperty("Email", 100)
      const dest = createStringProperty("Email", 100)

      const result = checkCompatibility(source, dest)

      expect(result.compatible).toBe(true)
      expect(result.warnings).toEqual([])
    })

    it("should return compatible: true for matching Integer types", () => {
      const source = createIntegerProperty("Age")
      const dest = createIntegerProperty("Age")

      const result = checkCompatibility(source, dest)

      expect(result.compatible).toBe(true)
      expect(result.warnings).toEqual([])
    })

    it("should return compatible: true for matching Boolean types", () => {
      const source = createBooleanProperty("Active")
      const dest = createBooleanProperty("Active")

      const result = checkCompatibility(source, dest)

      expect(result.compatible).toBe(true)
      expect(result.warnings).toEqual([])
    })

    it("should return compatible: false for mismatched types", () => {
      const source = createStringProperty("Value")
      const dest = createIntegerProperty("Value")

      const result = checkCompatibility(source, dest)

      expect(result.compatible).toBe(false)
      expect(result.warnings).toHaveLength(1)
      expect(result.warnings[0].type).toBe("typeMismatch")
      expect(result.warnings[0].message).toContain("String")
      expect(result.warnings[0].message).toContain("Integer")
    })

    it("should return compatible: false for Boolean vs String", () => {
      const source = createBooleanProperty("Flag")
      const dest = createStringProperty("Flag")

      const result = checkCompatibility(source, dest)

      expect(result.compatible).toBe(false)
    })
  })

  describe("MaxLength warnings", () => {
    it("should warn when source MaxLength > dest MaxLength", () => {
      const source = createStringProperty("Description", 500)
      const dest = createStringProperty("Description", 100)

      const result = checkCompatibility(source, dest)

      expect(result.compatible).toBe(true)
      expect(result.warnings).toHaveLength(1)
      expect(result.warnings[0].type).toBe("maxLength")
      expect(result.warnings[0].message).toContain("500")
      expect(result.warnings[0].message).toContain("100")
      expect(result.warnings[0].message).toContain("truncated")
    })

    it("should not warn when source MaxLength <= dest MaxLength", () => {
      const source = createStringProperty("Name", 50)
      const dest = createStringProperty("Name", 100)

      const result = checkCompatibility(source, dest)

      expect(result.compatible).toBe(true)
      expect(result.warnings).toEqual([])
    })

    it("should not warn when source MaxLength equals dest MaxLength", () => {
      const source = createStringProperty("Code", 10)
      const dest = createStringProperty("Code", 10)

      const result = checkCompatibility(source, dest)

      expect(result.compatible).toBe(true)
      expect(result.warnings).toEqual([])
    })

    it("should not warn for non-string types even if they could have length", () => {
      const source = createIntegerProperty("Count")
      const dest = createIntegerProperty("Count")

      const result = checkCompatibility(source, dest)

      expect(result.compatible).toBe(true)
      expect(result.warnings).toEqual([])
    })
  })
})

describe("findAutoMappings", () => {
  describe("basic auto-mapping", () => {
    it("should auto-map properties with matching name and type", () => {
      const sourceProps = [
        createStringProperty("FirstName", 100),
        createStringProperty("LastName", 100),
      ]
      const destProps = [
        createStringProperty("FirstName", 100),
        createStringProperty("LastName", 100),
      ]

      const mappings = findAutoMappings(sourceProps, destProps, {})

      expect(mappings).toEqual([
        { sourceProperty: "FirstName", destinationProperty: "FirstName" },
        { sourceProperty: "LastName", destinationProperty: "LastName" },
      ])
    })

    it("should set destinationProperty to null when no match found", () => {
      const sourceProps = [createStringProperty("Email", 100)]
      const destProps = [createStringProperty("EmailAddress", 100)]

      const mappings = findAutoMappings(sourceProps, destProps, {})

      expect(mappings).toEqual([
        { sourceProperty: "Email", destinationProperty: null },
      ])
    })

    it("should create mapping entries for all source properties", () => {
      const sourceProps = [
        createStringProperty("A", 100),
        createStringProperty("B", 100),
        createStringProperty("C", 100),
      ]
      const destProps = [createStringProperty("A", 100)]

      const mappings = findAutoMappings(sourceProps, destProps, {})

      expect(mappings).toHaveLength(3)
      expect(mappings[0].destinationProperty).toBe("A")
      expect(mappings[1].destinationProperty).toBeNull()
      expect(mappings[2].destinationProperty).toBeNull()
    })
  })

  describe("type compatibility in auto-mapping", () => {
    it("should not auto-map when types differ", () => {
      const sourceProps = [createStringProperty("Age", 10)]
      const destProps = [createIntegerProperty("Age")]

      const mappings = findAutoMappings(sourceProps, destProps, {})

      expect(mappings).toEqual([
        { sourceProperty: "Age", destinationProperty: null },
      ])
    })

    it("should auto-map same types with different names only if names match", () => {
      const sourceProps = [createStringProperty("Name", 100)]
      const destProps = [
        createStringProperty("FullName", 100),
        createStringProperty("Name", 100),
      ]

      const mappings = findAutoMappings(sourceProps, destProps, {})

      expect(mappings).toEqual([
        { sourceProperty: "Name", destinationProperty: "Name" },
      ])
    })
  })

  describe("restricted properties", () => {
    it("should not auto-map to restricted destination properties", () => {
      const sourceProps = [
        createStringProperty("Ordinal", 100),
        createStringProperty("UpdatedBy", 100),
      ]
      const destProps = [
        createStringProperty("Ordinal", 100),
        createStringProperty("UpdatedBy", 100),
      ]

      const mappings = findAutoMappings(
        sourceProps,
        destProps,
        RESTRICTED_DESTINATION_PROPERTIES
      )

      expect(mappings).toEqual([
        { sourceProperty: "Ordinal", destinationProperty: null },
        { sourceProperty: "UpdatedBy", destinationProperty: null },
      ])
    })

    it("should exclude all default restricted properties", () => {
      const restrictedNames = Object.keys(RESTRICTED_DESTINATION_PROPERTIES)
      const sourceProps = restrictedNames.map((name) =>
        createStringProperty(name, 100)
      )
      const destProps = restrictedNames.map((name) =>
        createStringProperty(name, 100)
      )

      const mappings = findAutoMappings(sourceProps, destProps)

      for (const mapping of mappings) {
        expect(mapping.destinationProperty).toBeNull()
      }
    })

    it("should auto-map non-restricted properties even when restricted exist", () => {
      const sourceProps = [
        createStringProperty("Email", 100),
        createStringProperty("Ordinal", 100),
        createStringProperty("Name", 100),
      ]
      const destProps = [
        createStringProperty("Email", 100),
        createStringProperty("Ordinal", 100),
        createStringProperty("Name", 100),
      ]

      const mappings = findAutoMappings(sourceProps, destProps)

      expect(mappings).toEqual([
        { sourceProperty: "Email", destinationProperty: "Email" },
        { sourceProperty: "Ordinal", destinationProperty: null },
        { sourceProperty: "Name", destinationProperty: "Name" },
      ])
    })
  })

  describe("edge cases", () => {
    it("should handle empty source properties", () => {
      const sourceProps: ReturnType<typeof createStringProperty>[] = []
      const destProps = [createStringProperty("Name", 100)]

      const mappings = findAutoMappings(sourceProps, destProps, {})

      expect(mappings).toEqual([])
    })

    it("should handle empty destination properties", () => {
      const sourceProps = [createStringProperty("Name", 100)]
      const destProps: ReturnType<typeof createStringProperty>[] = []

      const mappings = findAutoMappings(sourceProps, destProps, {})

      expect(mappings).toEqual([
        { sourceProperty: "Name", destinationProperty: null },
      ])
    })

    it("should auto-map even with MaxLength warning", () => {
      const sourceProps = [createStringProperty("Description", 500)]
      const destProps = [createStringProperty("Description", 100)]

      const mappings = findAutoMappings(sourceProps, destProps, {})

      // Should still map even though there's a truncation warning
      expect(mappings).toEqual([
        { sourceProperty: "Description", destinationProperty: "Description" },
      ])
    })
  })
})

describe("checkIsPrimaryRequired", () => {
  describe("when destination is Party type", () => {
    it("should require IsPrimary mapping when destination has IsPrimary property", () => {
      const destProperties = [
        createStringProperty("Name"),
        createBooleanProperty("IsPrimary"),
      ]
      const mappings = [createPropertyMapping("SourceName", "Name")]

      const result = checkIsPrimaryRequired("Party", destProperties, mappings)

      expect(result.required).toBe(true)
      expect(result.isMapped).toBe(false)
      expect(result.error).toBe("IsPrimary must be mapped for Party destinations")
    })

    it("should pass validation when IsPrimary is mapped", () => {
      const destProperties = [
        createStringProperty("Name"),
        createBooleanProperty("IsPrimary"),
      ]
      const mappings = [
        createPropertyMapping("SourceName", "Name"),
        createPropertyMapping("SourcePrimary", "IsPrimary"),
      ]

      const result = checkIsPrimaryRequired("Party", destProperties, mappings)

      expect(result.required).toBe(true)
      expect(result.isMapped).toBe(true)
      expect(result.error).toBeNull()
    })

    it("should not require IsPrimary if destination doesn't have IsPrimary property", () => {
      const destProperties = [
        createStringProperty("Name"),
        createStringProperty("Email"),
      ]
      const mappings = [createPropertyMapping("SourceName", "Name")]

      const result = checkIsPrimaryRequired("Party", destProperties, mappings)

      expect(result.required).toBe(false)
      expect(result.isMapped).toBe(true)
      expect(result.error).toBeNull()
    })
  })

  describe("when destination is Standalone type", () => {
    it("should not require IsPrimary mapping", () => {
      const destProperties = [
        createStringProperty("Name"),
        createBooleanProperty("IsPrimary"),
      ]
      const mappings = [createPropertyMapping("SourceName", "Name")]

      const result = checkIsPrimaryRequired("Standalone", destProperties, mappings)

      expect(result.required).toBe(false)
      expect(result.isMapped).toBe(true)
      expect(result.error).toBeNull()
    })
  })

  describe("when destination is Event type", () => {
    it("should not require IsPrimary mapping", () => {
      const destProperties = [
        createStringProperty("Name"),
        createBooleanProperty("IsPrimary"),
      ]
      const mappings = [createPropertyMapping("SourceName", "Name")]

      const result = checkIsPrimaryRequired("Event", destProperties, mappings)

      expect(result.required).toBe(false)
      expect(result.isMapped).toBe(true)
      expect(result.error).toBeNull()
    })
  })

  describe("edge cases", () => {
    it("should handle null PrimaryParentEntityTypeName", () => {
      const destProperties = [createBooleanProperty("IsPrimary")]
      const mappings: ReturnType<typeof createPropertyMapping>[] = []

      const result = checkIsPrimaryRequired(null, destProperties, mappings)

      expect(result.required).toBe(false)
      expect(result.isMapped).toBe(true)
      expect(result.error).toBeNull()
    })

    it("should handle undefined PrimaryParentEntityTypeName", () => {
      const destProperties = [createBooleanProperty("IsPrimary")]
      const mappings: ReturnType<typeof createPropertyMapping>[] = []

      const result = checkIsPrimaryRequired(undefined, destProperties, mappings)

      expect(result.required).toBe(false)
      expect(result.isMapped).toBe(true)
      expect(result.error).toBeNull()
    })

    it("should handle empty destination properties", () => {
      const destProperties: ReturnType<typeof createBooleanProperty>[] = []
      const mappings = [createPropertyMapping("Source", "Dest")]

      const result = checkIsPrimaryRequired("Party", destProperties, mappings)

      expect(result.required).toBe(false)
      expect(result.isMapped).toBe(true)
      expect(result.error).toBeNull()
    })

    it("should handle empty mappings with Party destination that has IsPrimary", () => {
      const destProperties = [createBooleanProperty("IsPrimary")]
      const mappings: ReturnType<typeof createPropertyMapping>[] = []

      const result = checkIsPrimaryRequired("Party", destProperties, mappings)

      expect(result.required).toBe(true)
      expect(result.isMapped).toBe(false)
      expect(result.error).toBe("IsPrimary must be mapped for Party destinations")
    })
  })
})
