import { Schema } from "effect";
import type { BoEntityDefinition, BoProperty } from "./imis-schemas";
import type { BinaryBlob } from "../services/migration-job";

// ---------------------
// Destination Type Schemas
// ---------------------

/**
 * Discriminator for destination types.
 * - bo_entity: Standard iMIS Business Object entity definition
 * - custom_endpoint: Custom API endpoint with hardcoded definition
 */
export const DestinationTypeSchema = Schema.Literal("bo_entity", "custom_endpoint");

export type DestinationType = typeof DestinationTypeSchema.Type;

/**
 * Property type names supported by destinations.
 * Matches iMIS BoProperty PropertyTypeName values.
 */
export const DestinationPropertyTypeNameSchema = Schema.Literal(
  "Binary",
  "Boolean",
  "Date",
  "Decimal",
  "Integer",
  "Monetary",
  "String",
);

export type DestinationPropertyTypeName = typeof DestinationPropertyTypeNameSchema.Type;

/**
 * Unified property definition for destination mapping.
 * Normalized from BoProperty to contain only fields needed for mapping.
 */
export const DestinationPropertySchema = Schema.Struct({
  name: Schema.String,
  propertyTypeName: DestinationPropertyTypeNameSchema,
  maxLength: Schema.optionalWith(Schema.Number, { exact: true }),
  isIdentity: Schema.optionalWith(Schema.Boolean, { exact: true }),
  required: Schema.optionalWith(Schema.Boolean, { exact: true }),
});

export type DestinationProperty = typeof DestinationPropertySchema.Type;

/**
 * Object type names for destinations (BO entities only).
 */
export const DestinationObjectTypeNameSchema = Schema.Literal(
  "Multi",
  "SINGLE",
  "Single",
  "Standard",
);

export type DestinationObjectTypeName = typeof DestinationObjectTypeNameSchema.Type;

/**
 * Common destination definition interface.
 * Supports both BO entity definitions and custom API endpoints.
 */
export const DestinationDefinitionSchema = Schema.Struct({
  destinationType: DestinationTypeSchema,
  entityTypeName: Schema.String,
  description: Schema.optionalWith(Schema.String, { exact: true }),
  objectTypeName: Schema.optionalWith(DestinationObjectTypeNameSchema, { exact: true }),
  primaryParentEntityTypeName: Schema.optionalWith(Schema.String, { exact: true }),
  properties: Schema.Array(DestinationPropertySchema),

  // Custom endpoint fields
  endpointPath: Schema.optionalWith(Schema.String, { exact: true }),
});

export type DestinationDefinition = typeof DestinationDefinitionSchema.Type;

// ---------------------
// Adapter Functions
// ---------------------

/**
 * Extracts the max length from a BoProperty if it's a String type.
 */
function getMaxLength(prop: BoProperty): number | undefined {
  if (prop.PropertyTypeName === "String" && "MaxLength" in prop) {
    return prop.MaxLength;
  }
  return undefined;
}

/**
 * Converts a BoProperty to a DestinationProperty.
 */
export function boPropertyToDestinationProperty(prop: BoProperty): DestinationProperty {
  return {
    name: prop.Name,
    propertyTypeName: prop.PropertyTypeName,
    maxLength: getMaxLength(prop),
    isIdentity: prop.IsIdentity,
    required: prop.Required,
  };
}

/**
 * Converts a DestinationProperty to a BoProperty-compatible shape.
 * Used by property mappers that expect PascalCase BoProperty interface.
 */
export function destinationPropertyToBoProperty(prop: DestinationProperty): BoProperty {
  const result: Record<string, unknown> = {
    Name: prop.name,
    PropertyTypeName: prop.propertyTypeName,
  };
  if (prop.maxLength !== undefined) result.MaxLength = prop.maxLength;
  if (prop.isIdentity !== undefined) result.IsIdentity = prop.isIdentity;
  if (prop.required !== undefined) result.Required = prop.required;
  return result as BoProperty;
}

/**
 * Converts a BoEntityDefinition to a DestinationDefinition.
 * Used to normalize BO entities for the unified destination interface.
 */
export function boEntityToDestination(bo: BoEntityDefinition): DestinationDefinition {
  const properties = bo.Properties?.$values ?? [];

  return {
    destinationType: "bo_entity",
    entityTypeName: bo.EntityTypeName,
    description: bo.Description,
    objectTypeName: bo.ObjectTypeName as DestinationObjectTypeName,
    primaryParentEntityTypeName: bo.PrimaryParentEntityTypeName,
    properties: properties.map(boPropertyToDestinationProperty),
  };
}

/**
 * Converts an array of BoEntityDefinitions to DestinationDefinitions.
 */
export function boEntitiesToDestinations(
  entities: readonly BoEntityDefinition[],
): DestinationDefinition[] {
  return entities.map(boEntityToDestination);
}

// ---------------------
// Custom Endpoint Support
// ---------------------

/**
 * Row data type used by custom endpoint builders.
 */
type RowData = Record<string, string | number | boolean | null | BinaryBlob>;

/**
 * Identity extractor function type for custom endpoint responses.
 * Takes the raw API response and extracts identity element strings.
 */
export type IdentityExtractor = (response: unknown) => string[];

/**
 * Full configuration for a custom API endpoint.
 * Contains all data needed to build requests and extract identity from responses.
 */
export interface CustomEndpointConfig {
  entityTypeName: string;
  description?: string;
  endpointPath: string;
  properties: DestinationProperty[];
  requestBodyBuilder: (row: RowData) => unknown;
  identityExtractor: IdentityExtractor;
}

/**
 * Single source of truth for all custom endpoint configurations.
 * Each entry defines the full endpoint behavior including request building and identity extraction.
 */
export const CUSTOM_ENDPOINTS: CustomEndpointConfig[] = [
  {
    entityTypeName: "PartyImage",
    description: "Member profile images",
    endpointPath: "api/PartyImage",
    properties: [
      { name: "PartyId", propertyTypeName: "String", isIdentity: true, required: true },
      { name: "IsPreferred", propertyTypeName: "Boolean" },
      { name: "Image", propertyTypeName: "Binary", required: true },
    ],
    requestBodyBuilder: (row: RowData) => ({
      $type: "Asi.Soa.Membership.DataContracts.PartyImageData, Asi.Contracts",
      PartyId: String(row.PartyId ?? ""),
      IsPreferred: row.IsPreferred ?? false,
      Image: row.Image,
    }),
    identityExtractor: (response: unknown): string[] => {
      const identityElements: string[] = [];
      if (response && typeof response === "object") {
        const data = response as Record<string, unknown>;
        if (data.PartyId) identityElements.push(String(data.PartyId));
        if (data.PartyImageId) identityElements.push(String(data.PartyImageId));
      }
      return identityElements;
    },
  },
];

/**
 * Convert a CustomEndpointConfig to a DestinationDefinition for schema compatibility.
 */
function customEndpointToDestination(config: CustomEndpointConfig): DestinationDefinition {
  return {
    destinationType: "custom_endpoint",
    entityTypeName: config.entityTypeName,
    description: config.description,
    endpointPath: config.endpointPath,
    properties: config.properties,
  };
}

/**
 * Destination definitions derived from CUSTOM_ENDPOINTS for UI/schema use.
 */
export const CUSTOM_ENDPOINT_DEFINITIONS: DestinationDefinition[] =
  CUSTOM_ENDPOINTS.map(customEndpointToDestination);

/**
 * Get all available destinations (BO entities + custom endpoints).
 */
export function getAllDestinations(
  boEntities: readonly BoEntityDefinition[],
): DestinationDefinition[] {
  return [...boEntitiesToDestinations(boEntities), ...CUSTOM_ENDPOINT_DEFINITIONS];
}
