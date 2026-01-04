/**
 * Test setup and factories for i-migrate tests.
 */

import type { PropertyMapping } from "../src/components/export/PropertyMapper"
import type {
  PropertyTypeString,
  PropertyTypeInteger,
  PropertyTypeBoolean,
  BoProperty,
} from "../src/api/imis-schemas"

// ---------------------
// Property Factories
// ---------------------

const basePropertyFields = {
  Description: "",
  Caption: "",
  DisplayMask: "",
  Visible: true,
  RenderingInformation: {
    $type: "Asi.Soa.Core.DataContracts.PropertyRenderingInformationData, Asi.Contracts" as const,
    HelpText: "",
    ToolTip: "",
    WatermarkText: "",
    ControlType: 1 as const,
  },
  ExtendedPropertyInformation: {
    $type: "Asi.Soa.Core.DataContracts.ExtendedPropertyInformationData, Asi.Contracts" as const,
    DatabaseColumnName: "Column",
    DbDataType: "NVarChar" as const,
  },
}

export function createStringProperty(
  name: string,
  maxLength: number = 100
): PropertyTypeString {
  return {
    ...basePropertyFields,
    $type: "Asi.Soa.Core.DataContracts.PropertyTypeStringData, Asi.Contracts",
    PropertyTypeName: "String",
    Name: name,
    MaxLength: maxLength,
  }
}

export function createIntegerProperty(name: string): PropertyTypeInteger {
  return {
    ...basePropertyFields,
    $type: "Asi.Soa.Core.DataContracts.PropertyTypeIntegerData, Asi.Contracts",
    PropertyTypeName: "Integer",
    Name: name,
    ExtendedPropertyInformation: {
      ...basePropertyFields.ExtendedPropertyInformation,
      DbDataType: "Int",
    },
  }
}

export function createBooleanProperty(name: string): PropertyTypeBoolean {
  return {
    ...basePropertyFields,
    $type: "Asi.Soa.Core.DataContracts.PropertyTypeBooleanData, Asi.Contracts",
    PropertyTypeName: "Boolean",
    Name: name,
    ExtendedPropertyInformation: {
      ...basePropertyFields.ExtendedPropertyInformation,
      DbDataType: "Bit",
    },
  }
}

// ---------------------
// Mapping Factories
// ---------------------

export function createPropertyMapping(
  sourceProperty: string,
  destinationProperty: string | null
): PropertyMapping {
  return {
    sourceProperty,
    destinationProperty,
  }
}

// ---------------------
// Environment Factories
// ---------------------

export function createEnvironment(overrides?: {
  id?: string
  name?: string
  baseUrl?: string
  username?: string
  queryConcurrency?: number
  insertConcurrency?: number
}) {
  return {
    id: overrides?.id ?? crypto.randomUUID(),
    name: overrides?.name ?? "Test Environment",
    baseUrl: overrides?.baseUrl ?? "https://test.imis.com",
    username: overrides?.username ?? "testuser",
    queryConcurrency: overrides?.queryConcurrency ?? 5,
    insertConcurrency: overrides?.insertConcurrency ?? 50,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

// ---------------------
// Job Factories
// ---------------------

export function createJob(overrides?: {
  id?: string
  name?: string
  status?: "queued" | "running" | "completed" | "failed" | "partial" | "cancelled"
  mode?: "query" | "datasource"
  sourceEnvironmentId?: string
  destEnvironmentId?: string
  destEntityType?: string
  mappings?: PropertyMapping[]
}) {
  return {
    id: overrides?.id ?? crypto.randomUUID(),
    name: overrides?.name ?? "Test Migration Job",
    status: overrides?.status ?? "queued",
    mode: overrides?.mode ?? "query",
    sourceEnvironmentId: overrides?.sourceEnvironmentId ?? crypto.randomUUID(),
    sourceQueryPath: "$/Test/Query",
    sourceEntityType: null,
    destEnvironmentId: overrides?.destEnvironmentId ?? crypto.randomUUID(),
    destEntityType: overrides?.destEntityType ?? "TestEntity",
    mappings: JSON.stringify(overrides?.mappings ?? []),
    totalRows: null,
    processedRows: 0,
    successfulRows: 0,
    failedRowCount: 0,
    failedQueryOffsets: null,
    startedAt: null,
    completedAt: null,
    createdAt: new Date().toISOString(),
  }
}
