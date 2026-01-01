import { Schema } from "effect"

// ---------------------
// Common iMIS / SOA Schemas
// ---------------------

/**
 * Represents the standard collection wrapper used in iMIS / SOA contracts.
 */
export const SoaCollectionSchema = <S extends Schema.Schema.Any>(element: S) =>
  Schema.Struct({
    $type: Schema.String,
    $values: Schema.Array(element),
  })

/**
 * Standard value wrapper for polymorphic values.
 */
export const SoaValueSchema = Schema.Struct({
  $type: Schema.String,
  $value: Schema.Any,
})

/**
 * iMIS property values can be primitives or wrapped objects.
 */
export const SoaDefaultValueSchema = Schema.Union(
  Schema.String,
  Schema.Number,
  Schema.Boolean,
  SoaValueSchema,
  Schema.Null
)

// ---------------------
// Property Rules
// ---------------------

export const GenericPropertySchema = Schema.Struct({
  $type: Schema.String,
  Name: Schema.String,
  Value: Schema.Any,
})

/**
 * A rule that provides a fixed list of values (e.g., a dropdown).
 */
export const PropertyRuleValueListSchema = Schema.Struct({
  $type: Schema.Literal("Asi.Soa.Core.DataContracts.PropertyRuleValueListData, Asi.Contracts"),
  ValueList: SoaCollectionSchema(GenericPropertySchema),
})

/**
 * A rule that executes a query to get values (e.g., from an IQA).
 */
export const PropertyRuleQuerySchema = Schema.Struct({
  $type: Schema.Literal("Asi.Soa.Core.DataContracts.PropertyRuleQueryData, Asi.Contracts"),
  Query: Schema.Any, // Can be complex, but usually contains Criteria and EntityTypeName
  ValuePropertyName: Schema.optionalWith(Schema.String, { exact: true }),
  DescriptionPropertyName: Schema.optionalWith(Schema.String, { exact: true }),
})

export const PropertyRuleSchema = Schema.Union(PropertyRuleValueListSchema, PropertyRuleQuerySchema)

// ---------------------
// Property Components
// ---------------------

export const PropertyRenderingInformationSchema = Schema.Struct({
  $type: Schema.String,
  HelpText: Schema.String,
  ToolTip: Schema.String,
  WatermarkText: Schema.String,
  ControlType: Schema.Number,
})

export const ExtendedPropertyInformationSchema = Schema.Struct({
  $type: Schema.String,
  DatabaseColumnName: Schema.String,
  DbDataType: Schema.String,
  IsReadOnly: Schema.optionalWith(Schema.Boolean, { exact: true }),
  IsDbIdentity: Schema.optionalWith(Schema.Boolean, { exact: true }),
  IsNullable: Schema.optionalWith(Schema.Boolean, { exact: true }),
})

// ---------------------
// Business Object Properties
// ---------------------

const PropertyBaseFields = {
  PropertyTypeName: Schema.String,
  Name: Schema.String,
  Description: Schema.String,
  Caption: Schema.String,
  DefaultValue: Schema.optionalWith(SoaDefaultValueSchema, { exact: true }),
  DisplayMask: Schema.String,
  IsIdentity: Schema.optionalWith(Schema.Boolean, { exact: true }),
  Visible: Schema.Boolean,
  Required: Schema.optionalWith(Schema.Boolean, { exact: true }),
  Logged: Schema.optionalWith(Schema.Boolean, { exact: true }),
  RenderingInformation: PropertyRenderingInformationSchema,
  ExtendedPropertyInformation: ExtendedPropertyInformationSchema,
  Rule: Schema.optionalWith(PropertyRuleSchema, { exact: true }),
}

export const PropertyTypeStringSchema = Schema.Struct({
  ...PropertyBaseFields,
  $type: Schema.Literal("Asi.Soa.Core.DataContracts.PropertyTypeStringData, Asi.Contracts"),
  MaxLength: Schema.Number,
})

export const PropertyTypeIntegerSchema = Schema.Struct({
  ...PropertyBaseFields,
  $type: Schema.Literal("Asi.Soa.Core.DataContracts.PropertyTypeIntegerData, Asi.Contracts"),
})

export const PropertyTypeBooleanSchema = Schema.Struct({
  ...PropertyBaseFields,
  $type: Schema.Literal("Asi.Soa.Core.DataContracts.PropertyTypeBooleanData, Asi.Contracts"),
})

export const PropertyTypeDateTimeSchema = Schema.Struct({
  ...PropertyBaseFields,
  $type: Schema.Literal("Asi.Soa.Core.DataContracts.PropertyTypeDateTimeData, Asi.Contracts"),
  DateTimeDataType: Schema.Number,
})

export const PropertyTypeBinarySchema = Schema.Struct({
  ...PropertyBaseFields,
  $type: Schema.Literal("Asi.Soa.Core.DataContracts.PropertyTypeBinaryData, Asi.Contracts"),
})

export const PropertyTypeDecimalSchema = Schema.Struct({
  ...PropertyBaseFields,
  $type: Schema.Literal("Asi.Soa.Core.DataContracts.PropertyTypeDecimalData, Asi.Contracts"),
  Precision: Schema.Number,
  Scale: Schema.Number,
})

export const PropertyTypeMonetarySchema = Schema.Struct({
  ...PropertyBaseFields,
  $type: Schema.Literal("Asi.Soa.Core.DataContracts.PropertyTypeMonetaryData, Asi.Contracts"),
})

/**
 * Union of all supported property types.
 */
export const BoPropertySchema = Schema.Union(
  PropertyTypeStringSchema,
  PropertyTypeIntegerSchema,
  PropertyTypeBooleanSchema,
  PropertyTypeDateTimeSchema,
  PropertyTypeBinarySchema,
  PropertyTypeDecimalSchema,
  PropertyTypeMonetarySchema
)

// ---------------------
// Indexes
// ---------------------

export const IndexColumnSchema = Schema.Struct({
  $type: Schema.String,
  ColumnName: Schema.String,
  OrderBy: Schema.Number,
})

export const IndexSchema = Schema.Struct({
  $type: Schema.String,
  Name: Schema.String,
  IsPrimary: Schema.Boolean,
  IsUnique: Schema.Boolean,
  Columns: SoaCollectionSchema(IndexColumnSchema),
  IncludeColumns: SoaCollectionSchema(Schema.String),
})

// ---------------------
// Root Definition
// ---------------------

/**
 * Represents a Business Object Entity Definition in iMIS.
 */
export const BoEntityDefinitionSchema = Schema.Struct({
  $type: Schema.Literal("Asi.Soa.Core.DataContracts.BOEntityDefinitionData, Asi.Contracts"),
  ObjectTypeName: Schema.String,
  Description: Schema.String,
  EntityTypeName: Schema.String,
  PrimaryParentEntityTypeName: Schema.String,
  Properties: SoaCollectionSchema(BoPropertySchema),
  RelatedEntities: SoaCollectionSchema(Schema.Any),
  IsDesignable: Schema.Boolean,
  Indexes: SoaCollectionSchema(IndexSchema),
})

// ---------------------
// Inferred Types
// ---------------------

export type SoaCollection<T> = {
  $type: string
  $values: T[]
}

export type BoProperty = typeof BoPropertySchema.Type
export type BoIndex = typeof IndexSchema.Type
export type BoEntityDefinition = typeof BoEntityDefinitionSchema.Type

export type PropertyTypeString = typeof PropertyTypeStringSchema.Type
export type PropertyTypeInteger = typeof PropertyTypeIntegerSchema.Type
export type PropertyTypeBoolean = typeof PropertyTypeBooleanSchema.Type
export type PropertyTypeDateTime = typeof PropertyTypeDateTimeSchema.Type
export type PropertyTypeBinary = typeof PropertyTypeBinarySchema.Type
export type PropertyTypeDecimal = typeof PropertyTypeDecimalSchema.Type
export type PropertyTypeMonetary = typeof PropertyTypeMonetarySchema.Type
