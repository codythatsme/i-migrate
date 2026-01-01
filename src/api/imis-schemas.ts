import { Schema } from "effect"

// ---------------------
// Common iMIS / SOA Schemas
// ---------------------

export const BoPropertyTypeNameSchema = Schema.Literal(
  "Binary",
  "Boolean",
  "Date",
  "Decimal",
  "Integer",
  "Monetary",
  "String"
)

export const DbDataTypeSchema = Schema.Literal(
  "Bit",
  "DateTime",
  "Decimal",
  "Int",
  "Money",
  "NVarChar",
  "Text",
  "TinyInt",
  "UniqueIdentifier",
  "VarBinary",
  "VarChar"
)

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
  $type: Schema.Literal(
    "System.Boolean",
    "System.Byte",
    "System.Decimal",
    "System.Guid",
    "System.Int32",
    "System.SByte"
  ),
  $value: Schema.Union(Schema.String, Schema.Number, Schema.Boolean),
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
  $type: Schema.Literal("Asi.Soa.Core.DataContracts.GenericPropertyData, Asi.Contracts"),
  Name: Schema.String,
  Value: Schema.Union(Schema.String, Schema.Number, Schema.Boolean, Schema.Null),
})

/**
 * A rule that provides a fixed list of values (e.g., a dropdown).
 */
export const PropertyRuleValueListSchema = Schema.Struct({
  $type: Schema.Literal("Asi.Soa.Core.DataContracts.PropertyRuleValueListData, Asi.Contracts"),
  ValueList: SoaCollectionSchema(GenericPropertySchema),
})

// ---------------------
// Query Schemas
// ---------------------

export const CriteriaDataSchema = Schema.Struct({
  $type: Schema.Literal("Asi.Soa.Core.DataContracts.CriteriaData, Asi.Contracts"),
  Operation: Schema.optionalWith(Schema.Number, { exact: true }),
  PropertyName: Schema.String,
  Prompt: Schema.optionalWith(Schema.String, { exact: true }),
  AllowMultiple: Schema.optionalWith(Schema.Boolean, { exact: true }),
  Values: Schema.Union(SoaCollectionSchema(Schema.String), Schema.Any),
})

export const EntityUpdateInformationSchema = Schema.Struct({
  $type: Schema.Literal("Asi.Soa.Core.DataContracts.EntityUpdateInformationData, Asi.Contracts"),
  CreatedBy: Schema.String,
  CreatedOn: Schema.String,
  UpdatedBy: Schema.String,
  UpdatedOn: Schema.String,
})

export const DocumentDataSchema = Schema.Struct({
  $type: Schema.Literal("Asi.Soa.Core.DataContracts.DocumentData, Asi.Contracts"),
  Data: Schema.optionalWith(
    Schema.Struct({
      $type: Schema.String,
      $value: Schema.String,
    }),
    { exact: true }
  ),
  AccessId: Schema.String,
  DocumentCode: Schema.optionalWith(Schema.String, { exact: true }),
  StatusUpdatedByUserId: Schema.String,
  StatusUpdatedOn: Schema.String,
  Description: Schema.optionalWith(Schema.String, { exact: true }),
  DocumentId: Schema.String,
  DocumentVersionId: Schema.String,
  DocumentTypeId: Schema.String,
  Name: Schema.String,
  AlternateName: Schema.optionalWith(Schema.String, { exact: true }),
  Path: Schema.String,
  FolderPath: Schema.String,
  Status: Schema.String,
  IsSystem: Schema.optionalWith(Schema.Boolean, { exact: true }),
  UpdateInfo: EntityUpdateInformationSchema,
})

export const QueryPropertyDataSchema = Schema.Struct({
  $type: Schema.Literal("Asi.Soa.Core.DataContracts.QueryPropertyData, Asi.Contracts"),
  QuerySourceId: Schema.optionalWith(Schema.String, { exact: true }),
  Name: Schema.String,
  PropertyName: Schema.String,
  Alias: Schema.String,
  Caption: Schema.String,
  DisplayFormat: Schema.String,
  DisplayOrder: Schema.Number,
  Link: Schema.String,
  DataTypeName: Schema.optionalWith(Schema.String, { exact: true }),
})

export const QueryRelationDataSchema = Schema.Struct({
  $type: Schema.Literal("Asi.Soa.Core.DataContracts.QueryRelationData, Asi.Contracts"),
  LeftQuerySourceId: Schema.String,
  LeftPropertyName: Schema.String,
  RightQuerySourceId: Schema.String,
  RightPropertyName: Schema.String,
  RelationType: Schema.String,
})

export const QuerySourceDataSchema = Schema.Struct({
  $type: Schema.Literal("Asi.Soa.Core.DataContracts.QuerySourceData, Asi.Contracts"),
  QuerySourceId: Schema.String,
  QuerySourceType: Schema.Number,
  Name: Schema.String,
  Description: Schema.optionalWith(Schema.String, { exact: true }),
  BusinessControllerName: Schema.String,
})

export const QueryDefinitionSchema = Schema.Struct({
  $type: Schema.Literal("Asi.Soa.Core.DataContracts.IqaQueryDefinitionData, Asi.Contracts"),
  Document: DocumentDataSchema,
  Parameters: SoaCollectionSchema(CriteriaDataSchema),
  Path: Schema.String,
  Properties: SoaCollectionSchema(QueryPropertyDataSchema),
  Relations: SoaCollectionSchema(QueryRelationDataSchema),
  Sources: SoaCollectionSchema(QuerySourceDataSchema),
  QueryDefinitionId: Schema.String,
  LimitResultsCount: Schema.optionalWith(Schema.Number, { exact: true }),
})

export const QueryDataSchema = Schema.Struct({
  $type: Schema.Literal("Asi.Soa.Core.DataContracts.QueryData, Asi.Contracts"),
  Criteria: SoaCollectionSchema(CriteriaDataSchema),
  EntityTypeName: Schema.String,
})

/**
 * A rule that executes a query to get values (e.g., from an IQA).
 */
export const PropertyRuleQuerySchema = Schema.Struct({
  $type: Schema.Literal("Asi.Soa.Core.DataContracts.PropertyRuleQueryData, Asi.Contracts"),
  Query: QueryDataSchema,
  ValuePropertyName: Schema.optionalWith(Schema.String, { exact: true }),
  DescriptionPropertyName: Schema.optionalWith(Schema.String, { exact: true }),
})

export const PropertyRuleSchema = Schema.Union(PropertyRuleValueListSchema, PropertyRuleQuerySchema)

// ---------------------
// Property Components
// ---------------------

export const PropertyRenderingInformationSchema = Schema.Struct({
  $type: Schema.Literal("Asi.Soa.Core.DataContracts.PropertyRenderingInformationData, Asi.Contracts"),
  HelpText: Schema.String,
  ToolTip: Schema.String,
  WatermarkText: Schema.String,
  ControlType: Schema.Literal(1, 3, 4, 7, 8, 12, 14, 18),
})

export const ExtendedPropertyInformationSchema = Schema.Struct({
  $type: Schema.Literal("Asi.Soa.Core.DataContracts.ExtendedPropertyInformationData, Asi.Contracts"),
  DatabaseColumnName: Schema.String,
  DbDataType: DbDataTypeSchema,
  IsReadOnly: Schema.optionalWith(Schema.Boolean, { exact: true }),
  IsDbIdentity: Schema.optionalWith(Schema.Boolean, { exact: true }),
  IsNullable: Schema.optionalWith(Schema.Boolean, { exact: true }),
})

// ---------------------
// Business Object Properties
// ---------------------

const PropertyBaseFields = {
  PropertyTypeName: BoPropertyTypeNameSchema,
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
  PropertyTypeName: Schema.Literal("String"),
  MaxLength: Schema.Number,
})

export const PropertyTypeIntegerSchema = Schema.Struct({
  ...PropertyBaseFields,
  $type: Schema.Literal("Asi.Soa.Core.DataContracts.PropertyTypeIntegerData, Asi.Contracts"),
  PropertyTypeName: Schema.Literal("Integer"),
})

export const PropertyTypeBooleanSchema = Schema.Struct({
  ...PropertyBaseFields,
  $type: Schema.Literal("Asi.Soa.Core.DataContracts.PropertyTypeBooleanData, Asi.Contracts"),
  PropertyTypeName: Schema.Literal("Boolean"),
})

export const PropertyTypeDateTimeSchema = Schema.Struct({
  ...PropertyBaseFields,
  $type: Schema.Literal("Asi.Soa.Core.DataContracts.PropertyTypeDateTimeData, Asi.Contracts"),
  PropertyTypeName: Schema.Literal("Date"),
  DateTimeDataType: Schema.Literal(0),
})

export const PropertyTypeBinarySchema = Schema.Struct({
  ...PropertyBaseFields,
  $type: Schema.Literal("Asi.Soa.Core.DataContracts.PropertyTypeBinaryData, Asi.Contracts"),
  PropertyTypeName: Schema.Literal("Binary"),
})

export const PropertyTypeDecimalSchema = Schema.Struct({
  ...PropertyBaseFields,
  $type: Schema.Literal("Asi.Soa.Core.DataContracts.PropertyTypeDecimalData, Asi.Contracts"),
  PropertyTypeName: Schema.Literal("Decimal"),
  Precision: Schema.optionalWith(Schema.Number, { exact: true }),
  Scale: Schema.optionalWith(Schema.Number, { exact: true }),
})

export const PropertyTypeMonetarySchema = Schema.Struct({
  ...PropertyBaseFields,
  $type: Schema.Literal("Asi.Soa.Core.DataContracts.PropertyTypeMonetaryData, Asi.Contracts"),
  PropertyTypeName: Schema.Literal("Monetary"),
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
  $type: Schema.Literal("Asi.Soa.Core.DataContracts.IndexColumnData, Asi.Contracts"),
  ColumnName: Schema.String,
  OrderBy: Schema.Literal(0),
})

export const IndexSchema = Schema.Struct({
  $type: Schema.Literal("Asi.Soa.Core.DataContracts.IndexData, Asi.Contracts"),
  Name: Schema.String,
  IsPrimary: Schema.Boolean,
  IsUnique: Schema.Boolean,
  Columns: SoaCollectionSchema(IndexColumnSchema),
  IncludeColumns: SoaCollectionSchema(Schema.String),
})

// ---------------------
// Related Entities
// ---------------------

export const RelatedEntityDataCollectionSchema = Schema.Struct({
  $type: Schema.Literal("Asi.Soa.Core.DataContracts.RelatedEntityDataCollection, Asi.Contracts"),
  $values: Schema.Array(Schema.Any),
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
  RelatedEntities: RelatedEntityDataCollectionSchema,
  IsDesignable: Schema.optionalWith(Schema.Boolean, { exact: true }),
  Indexes: SoaCollectionSchema(IndexSchema),
})

// ---------------------
// Query Response (Paged Results)
// ---------------------

/**
 * Creates a schema for iMIS paged query responses.
 */
export const QueryResponseSchema = <S extends Schema.Schema.Any>(element: S) =>
  Schema.Struct({
    $type: Schema.String,
    Items: SoaCollectionSchema(element),
    Offset: Schema.Number,
    Limit: Schema.Number,
    Count: Schema.Number,
    TotalCount: Schema.Number,
    NextPageLink: Schema.NullOr(Schema.String),
    HasNext: Schema.Boolean,
    NextOffset: Schema.Number,
  })

/**
 * Schema for BoEntityDefinition query response.
 */
export const BoEntityDefinitionQueryResponseSchema = QueryResponseSchema(BoEntityDefinitionSchema)

// ---------------------
// Inferred Types
// ---------------------

export type SoaCollection<T> = {
  $type: string
  $values: T[]
}

export type QueryResponse<T> = {
  $type: string
  Items: SoaCollection<T>
  Offset: number
  Limit: number
  Count: number
  TotalCount: number
  NextPageLink: string | null
  HasNext: boolean
  NextOffset: number
}

export type BoProperty = typeof BoPropertySchema.Type
export type BoIndex = typeof IndexSchema.Type
export type BoEntityDefinition = typeof BoEntityDefinitionSchema.Type

export type GenericProperty = typeof GenericPropertySchema.Type
export type QueryDefinition = typeof QueryDefinitionSchema.Type
export type QueryData = typeof QueryDataSchema.Type
export type CriteriaData = typeof CriteriaDataSchema.Type

export type PropertyTypeString = typeof PropertyTypeStringSchema.Type
export type PropertyTypeInteger = typeof PropertyTypeIntegerSchema.Type
export type PropertyTypeBoolean = typeof PropertyTypeBooleanSchema.Type
export type PropertyTypeDateTime = typeof PropertyTypeDateTimeSchema.Type
export type PropertyTypeBinary = typeof PropertyTypeBinarySchema.Type
export type PropertyTypeDecimal = typeof PropertyTypeDecimalSchema.Type
export type PropertyTypeMonetary = typeof PropertyTypeMonetarySchema.Type
