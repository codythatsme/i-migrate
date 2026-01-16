import { Schema } from "effect";
import type { BoEntityDefinition, BoProperty } from "./imis-schemas";

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

  // Custom endpoint fields (for Phase 2 implementation)
  endpointPath: Schema.optionalWith(Schema.String, { exact: true }),
  requestBodyBuilder: Schema.optionalWith(Schema.String, { exact: true }),
  identityExtractor: Schema.optionalWith(Schema.String, { exact: true }),
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
