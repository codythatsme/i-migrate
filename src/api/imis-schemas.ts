import { Schema } from "effect";

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
  "String",
);

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
  "VarChar",
);

/**
 * Data type names used in IQA query properties.
 */
export const QueryDataTypeNameSchema = Schema.Literal(
  "Boolean",
  "Byte",
  "Byte[]",
  "DateTime",
  "Decimal",
  "Double",
  "Guid",
  "Int32",
  "Int64",
  "SByte",
  "String",
);

/**
 * Display format codes used in IQA query properties.
 */
export const DisplayFormatSchema = Schema.Literal(
  "D",
  "EMAIL",
  "F",
  "F0",
  "G",
  "G29",
  "N",
  "N0",
  "P0",
  "d",
  "g",
  "t",
  "", // Empty string is valid
);

/**
 * Relation types for query joins.
 */
export const RelationTypeSchema = Schema.Literal("Cross", "Equal", "Left", "NotExist");

/**
 * Query source types (1 = BusinessObject, 2 = IQA Query).
 */
export const QuerySourceTypeSchema = Schema.Literal(1, 2);

/**
 * Document status values.
 */
export const DocumentStatusSchema = Schema.Literal("Published", "Draft", "Archived");

/**
 * Business object type names.
 */
export const ObjectTypeNameSchema = Schema.Literal("Multi", "SINGLE", "Single", "Standard");

/**
 * Represents the standard collection wrapper used in iMIS / SOA contracts.
 */
export const SoaCollectionSchema = <S extends Schema.Schema.Any>(element: S) =>
  Schema.Struct({
    $type: Schema.String,
    $values: Schema.Array(element),
  });

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
    "System.SByte",
  ),
  $value: Schema.Union(Schema.String, Schema.Number, Schema.Boolean),
});

/**
 * iMIS property values can be primitives or wrapped objects.
 */
export const SoaDefaultValueSchema = Schema.Union(
  Schema.String,
  Schema.Number,
  Schema.Boolean,
  SoaValueSchema,
  Schema.Null,
);

// ---------------------
// Property Rules
// ---------------------

export const GenericPropertySchema = Schema.Struct({
  $type: Schema.Literal("Asi.Soa.Core.DataContracts.GenericPropertyData, Asi.Contracts"),
  Name: Schema.String,
  Value: Schema.Union(Schema.String, Schema.Number, Schema.Boolean, Schema.Null),
});

/**
 * A rule that provides a fixed list of values (e.g., a dropdown).
 */
export const PropertyRuleValueListSchema = Schema.Struct({
  $type: Schema.Literal("Asi.Soa.Core.DataContracts.PropertyRuleValueListData, Asi.Contracts"),
  ValueList: SoaCollectionSchema(GenericPropertySchema),
});

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
});

export const EntityUpdateInformationSchema = Schema.Struct({
  $type: Schema.Literal("Asi.Soa.Core.DataContracts.EntityUpdateInformationData, Asi.Contracts"),
  CreatedBy: Schema.optionalWith(Schema.String, { exact: true }),
  CreatedOn: Schema.optionalWith(Schema.String, { exact: true }),
  UpdatedBy: Schema.optionalWith(Schema.String, { exact: true }),
  UpdatedOn: Schema.optionalWith(Schema.String, { exact: true }),
});

/**
 * Document summary data for file browser navigation.
 */
export const DocumentSummaryDataSchema = Schema.Struct({
  $type: Schema.Literal("Asi.Soa.Core.DataContracts.DocumentSummaryData, Asi.Contracts"),
  Description: Schema.String,
  DocumentId: Schema.String,
  DocumentVersionId: Schema.String,
  DocumentTypeId: Schema.String, // "FOL" = folder, "IQD" = query
  Name: Schema.String,
  AlternateName: Schema.optionalWith(Schema.String, { exact: true }),
  Path: Schema.String,
  FolderPath: Schema.optionalWith(Schema.String, { exact: true }),
  Status: DocumentStatusSchema,
  IsSystem: Schema.optionalWith(Schema.Boolean, { exact: true }),
  IsFolder: Schema.optionalWith(Schema.Boolean, { exact: true }),
  UpdateInfo: Schema.optionalWith(EntityUpdateInformationSchema, { exact: true }),
});

export const DocumentDataSchema = Schema.Struct({
  $type: Schema.Literal("Asi.Soa.Core.DataContracts.DocumentData, Asi.Contracts"),
  Data: Schema.optionalWith(
    Schema.Struct({
      $type: Schema.String,
      $value: Schema.String,
    }),
    { exact: true },
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
  Status: DocumentStatusSchema,
  IsSystem: Schema.optionalWith(Schema.Boolean, { exact: true }),
  UpdateInfo: EntityUpdateInformationSchema,
});

export const QueryPropertyDataSchema = Schema.Struct({
  $type: Schema.Literal("Asi.Soa.Core.DataContracts.QueryPropertyData, Asi.Contracts"),
  QuerySourceId: Schema.optionalWith(Schema.String, { exact: true }),
  Name: Schema.String,
  PropertyName: Schema.String,
  Alias: Schema.String,
  Caption: Schema.String,
  DisplayFormat: DisplayFormatSchema,
  DisplayOrder: Schema.Number,
  Link: Schema.String,
  DataTypeName: QueryDataTypeNameSchema,
});

/**
 * 2017 environments may omit several fields from query properties.
 */
export const QueryPropertyData2017Schema = Schema.Struct({
  $type: Schema.Literal("Asi.Soa.Core.DataContracts.QueryPropertyData, Asi.Contracts"),
  QuerySourceId: Schema.optionalWith(Schema.String, { exact: true }),
  Name: Schema.String,
  PropertyName: Schema.optionalWith(Schema.String, { exact: true }),
  Alias: Schema.optionalWith(Schema.String, { exact: true }),
  Caption: Schema.optionalWith(Schema.String, { exact: true }),
  DisplayFormat: Schema.optionalWith(DisplayFormatSchema, { exact: true }),
  DisplayOrder: Schema.optionalWith(Schema.Number, { exact: true }),
  Link: Schema.optionalWith(Schema.String, { exact: true }),
  DataTypeName: QueryDataTypeNameSchema,
});

export const QueryRelationDataSchema = Schema.Struct({
  $type: Schema.Literal("Asi.Soa.Core.DataContracts.QueryRelationData, Asi.Contracts"),
  LeftQuerySourceId: Schema.String,
  LeftPropertyName: Schema.String,
  RightQuerySourceId: Schema.String,
  RightPropertyName: Schema.String,
  RelationType: RelationTypeSchema,
});

/**
 * 2017 environments may omit RelationType from query relations.
 */
export const QueryRelationData2017Schema = Schema.Struct({
  $type: Schema.Literal("Asi.Soa.Core.DataContracts.QueryRelationData, Asi.Contracts"),
  LeftQuerySourceId: Schema.String,
  LeftPropertyName: Schema.String,
  RightQuerySourceId: Schema.String,
  RightPropertyName: Schema.String,
  RelationType: Schema.optionalWith(RelationTypeSchema, { exact: true }),
});

export const QuerySourceDataSchema = Schema.Struct({
  $type: Schema.Literal("Asi.Soa.Core.DataContracts.QuerySourceData, Asi.Contracts"),
  QuerySourceId: Schema.String,
  QuerySourceType: QuerySourceTypeSchema,
  Name: Schema.String,
  Description: Schema.optionalWith(Schema.String, { exact: true }),
  BusinessControllerName: Schema.String,
});

/**
 * 2017 environments may omit BusinessControllerName from query sources.
 */
export const QuerySourceData2017Schema = Schema.Struct({
  $type: Schema.Literal("Asi.Soa.Core.DataContracts.QuerySourceData, Asi.Contracts"),
  QuerySourceId: Schema.String,
  QuerySourceType: QuerySourceTypeSchema,
  Name: Schema.String,
  Description: Schema.optionalWith(Schema.String, { exact: true }),
  BusinessControllerName: Schema.optionalWith(Schema.String, { exact: true }),
});

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
});

/**
 * 2017 environments return query definitions without the Document field
 * and with several optional fields in properties, relations, and sources.
 */
export const QueryDefinition2017Schema = Schema.Struct({
  $type: Schema.Literal("Asi.Soa.Core.DataContracts.IqaQueryDefinitionData, Asi.Contracts"),
  Parameters: SoaCollectionSchema(CriteriaDataSchema),
  Path: Schema.String,
  Properties: SoaCollectionSchema(QueryPropertyData2017Schema),
  Relations: SoaCollectionSchema(QueryRelationData2017Schema),
  Sources: SoaCollectionSchema(QuerySourceData2017Schema),
  QueryDefinitionId: Schema.String,
  LimitResultsCount: Schema.optionalWith(Schema.Number, { exact: true }),
});

export const QueryDataSchema = Schema.Struct({
  $type: Schema.Literal("Asi.Soa.Core.DataContracts.QueryData, Asi.Contracts"),
  Criteria: SoaCollectionSchema(CriteriaDataSchema),
  EntityTypeName: Schema.String,
});

/**
 * A rule that executes a query to get values (e.g., from an IQA).
 */
export const PropertyRuleQuerySchema = Schema.Struct({
  $type: Schema.Literal("Asi.Soa.Core.DataContracts.PropertyRuleQueryData, Asi.Contracts"),
  Query: QueryDataSchema,
  ValuePropertyName: Schema.optionalWith(Schema.String, { exact: true }),
  DescriptionPropertyName: Schema.optionalWith(Schema.String, { exact: true }),
});

export const PropertyRuleSchema = Schema.Union(
  PropertyRuleValueListSchema,
  PropertyRuleQuerySchema,
);

// ---------------------
// Property Components
// ---------------------

export const PropertyRenderingInformationSchema = Schema.Struct({
  $type: Schema.Literal(
    "Asi.Soa.Core.DataContracts.PropertyRenderingInformationData, Asi.Contracts",
  ),
  HelpText: Schema.String,
  ToolTip: Schema.String,
  WatermarkText: Schema.String,
  ControlType: Schema.Literal(1, 3, 4, 7, 8, 12, 14, 18),
});

export const ExtendedPropertyInformationSchema = Schema.Struct({
  $type: Schema.Literal(
    "Asi.Soa.Core.DataContracts.ExtendedPropertyInformationData, Asi.Contracts",
  ),
  DatabaseColumnName: Schema.String,
  DbDataType: DbDataTypeSchema,
  IsReadOnly: Schema.optionalWith(Schema.Boolean, { exact: true }),
  IsDbIdentity: Schema.optionalWith(Schema.Boolean, { exact: true }),
  IsNullable: Schema.optionalWith(Schema.Boolean, { exact: true }),
});

// ---------------------
// Business Object Properties
// ---------------------

const PropertyBaseFields = {
  PropertyTypeName: BoPropertyTypeNameSchema,
  Name: Schema.String,
  Description: Schema.optionalWith(Schema.String, { exact: true }),
  Caption: Schema.optionalWith(Schema.String, { exact: true }),
  DefaultValue: Schema.optionalWith(SoaDefaultValueSchema, { exact: true }),
  DisplayMask: Schema.optionalWith(Schema.String, { exact: true }),
  IsIdentity: Schema.optionalWith(Schema.Boolean, { exact: true }),
  Visible: Schema.optionalWith(Schema.Boolean, { exact: true }),
  Required: Schema.optionalWith(Schema.Boolean, { exact: true }),
  Logged: Schema.optionalWith(Schema.Boolean, { exact: true }),
  RenderingInformation: Schema.optionalWith(PropertyRenderingInformationSchema, { exact: true }),
  ExtendedPropertyInformation: Schema.optionalWith(ExtendedPropertyInformationSchema, {
    exact: true,
  }),
  Rule: Schema.optionalWith(PropertyRuleSchema, { exact: true }),
};

export const PropertyTypeStringSchema = Schema.Struct({
  ...PropertyBaseFields,
  $type: Schema.Literal("Asi.Soa.Core.DataContracts.PropertyTypeStringData, Asi.Contracts"),
  PropertyTypeName: Schema.Literal("String"),
  MaxLength: Schema.Number,
});

export const PropertyTypeIntegerSchema = Schema.Struct({
  ...PropertyBaseFields,
  $type: Schema.Literal("Asi.Soa.Core.DataContracts.PropertyTypeIntegerData, Asi.Contracts"),
  PropertyTypeName: Schema.Literal("Integer"),
});

export const PropertyTypeBooleanSchema = Schema.Struct({
  ...PropertyBaseFields,
  $type: Schema.Literal("Asi.Soa.Core.DataContracts.PropertyTypeBooleanData, Asi.Contracts"),
  PropertyTypeName: Schema.Literal("Boolean"),
});

export const PropertyTypeDateTimeSchema = Schema.Struct({
  ...PropertyBaseFields,
  $type: Schema.Literal("Asi.Soa.Core.DataContracts.PropertyTypeDateTimeData, Asi.Contracts"),
  PropertyTypeName: Schema.Literal("Date"),
  DateTimeDataType: Schema.Literal(0),
});

export const PropertyTypeBinarySchema = Schema.Struct({
  ...PropertyBaseFields,
  $type: Schema.Literal("Asi.Soa.Core.DataContracts.PropertyTypeBinaryData, Asi.Contracts"),
  PropertyTypeName: Schema.Literal("Binary"),
});

export const PropertyTypeDecimalSchema = Schema.Struct({
  ...PropertyBaseFields,
  $type: Schema.Literal("Asi.Soa.Core.DataContracts.PropertyTypeDecimalData, Asi.Contracts"),
  PropertyTypeName: Schema.Literal("Decimal"),
  Precision: Schema.optionalWith(Schema.Number, { exact: true }),
  Scale: Schema.optionalWith(Schema.Number, { exact: true }),
});

export const PropertyTypeMonetarySchema = Schema.Struct({
  ...PropertyBaseFields,
  $type: Schema.Literal("Asi.Soa.Core.DataContracts.PropertyTypeMonetaryData, Asi.Contracts"),
  PropertyTypeName: Schema.Literal("Monetary"),
});

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
  PropertyTypeMonetarySchema,
);

// ---------------------
// Indexes
// ---------------------

export const IndexColumnSchema = Schema.Struct({
  $type: Schema.Literal("Asi.Soa.Core.DataContracts.IndexColumnData, Asi.Contracts"),
  ColumnName: Schema.String,
  OrderBy: Schema.Literal(0),
});

export const IndexSchema = Schema.Struct({
  $type: Schema.Literal("Asi.Soa.Core.DataContracts.IndexData, Asi.Contracts"),
  Name: Schema.String,
  IsPrimary: Schema.Boolean,
  IsUnique: Schema.Boolean,
  Columns: SoaCollectionSchema(IndexColumnSchema),
  IncludeColumns: SoaCollectionSchema(Schema.String),
});

// ---------------------
// Related Entities
// ---------------------

export const RelatedEntityDataCollectionSchema = Schema.Struct({
  $type: Schema.Literal("Asi.Soa.Core.DataContracts.RelatedEntityDataCollection, Asi.Contracts"),
  $values: Schema.Array(Schema.Any),
});

// ---------------------
// Root Definition
// ---------------------

/**
 * Represents a Business Object Entity Definition in iMIS.
 */
export const BoEntityDefinitionSchema = Schema.Struct({
  $type: Schema.Literal("Asi.Soa.Core.DataContracts.BOEntityDefinitionData, Asi.Contracts"),
  ObjectTypeName: ObjectTypeNameSchema,
  Description: Schema.optionalWith(Schema.String, { exact: true }),
  EntityTypeName: Schema.String,
  PrimaryParentEntityTypeName: Schema.optionalWith(Schema.String, { exact: true }),
  Properties: Schema.optionalWith(SoaCollectionSchema(BoPropertySchema), { exact: true }),
  RelatedEntities: Schema.optionalWith(RelatedEntityDataCollectionSchema, { exact: true }),
  IsDesignable: Schema.optionalWith(Schema.Boolean, { exact: true }),
  Indexes: Schema.optionalWith(SoaCollectionSchema(IndexSchema), { exact: true }),
});

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
  });

/**
 * Schema for BoEntityDefinition query response.
 */
export const BoEntityDefinitionQueryResponseSchema = QueryResponseSchema(BoEntityDefinitionSchema);

// ---------------------
// Generic Execute Results
// ---------------------

/**
 * Generic execute result for single document operations.
 */
export const GenericExecuteResultSchema = <S extends Schema.Schema.Any>(element: S) =>
  Schema.Struct({
    $type: Schema.String,
    Result: Schema.NullOr(element),
  });

/**
 * Generic execute result for collection operations.
 */
export const GenericExecuteCollectionResultSchema = <S extends Schema.Schema.Any>(element: S) =>
  Schema.Struct({
    $type: Schema.String,
    Result: SoaCollectionSchema(element),
  });

/**
 * Schema for DocumentSummary single result (FindByPath).
 */
export const DocumentSummaryResultSchema = GenericExecuteResultSchema(DocumentSummaryDataSchema);

/**
 * Schema for DocumentSummary collection result (FindDocumentsInFolder).
 */
export const DocumentSummaryCollectionResultSchema =
  GenericExecuteCollectionResultSchema(DocumentSummaryDataSchema);

/**
 * Schema for QueryDefinition single result (FindByPath).
 */
export const QueryDefinitionResultSchema = GenericExecuteResultSchema(QueryDefinitionSchema);

// ---------------------
// IQA Query Results
// ---------------------

/**
 * Schema for IQA query result rows.
 * Query results return rows as Record<string, unknown> where keys are property aliases.
 */
export const IqaQueryRowSchema = Schema.Record({ key: Schema.String, value: Schema.Unknown });

/**
 * Schema for IQA query response.
 */
export const IqaQueryResponseSchema = QueryResponseSchema(IqaQueryRowSchema);

// ---------------------
// Generic Entity Data (for inserts)
// ---------------------

/**
 * Schema for generic property data used in entity inserts.
 */
export const GenericPropertyDataSchema = Schema.Struct({
  $type: Schema.Literal("Asi.Soa.Core.DataContracts.GenericPropertyData, Asi.Contracts"),
  Name: Schema.String,
  Value: Schema.Union(Schema.String, Schema.Number, Schema.Boolean, Schema.Null),
});

/**
 * Schema for identity data.
 */
export const IdentityDataSchema = Schema.Struct({
  $type: Schema.Literal("Asi.Soa.Core.DataContracts.IdentityData, Asi.Contracts"),
  EntityTypeName: Schema.String,
  IdentityElements: Schema.optionalWith(SoaCollectionSchema(Schema.String), { exact: true }),
});

/**
 * Schema for GenericEntityData response from insert operations.
 */
export const GenericEntityDataSchema = Schema.Struct({
  $type: Schema.Literal("Asi.Soa.Core.DataContracts.GenericEntityData, Asi.Contracts"),
  EntityTypeName: Schema.String,
  PrimaryParentEntityTypeName: Schema.String,
  Identity: IdentityDataSchema,
  PrimaryParentIdentity: IdentityDataSchema,
  Properties: SoaCollectionSchema(GenericPropertyDataSchema),
});

// ---------------------
// 2017 IQA Query Results (GenericEntityData format)
// ---------------------

/**
 * Schema for wrapped values in 2017 responses.
 * For example: { "$type": "System.Int32", "$value": 13280 }
 */
const WrappedValueSchema = Schema.Struct({
  $type: Schema.String,
  $value: Schema.Unknown,
});

/**
 * Schema for property data in 2017 IQA responses.
 * Values can be primitives, wrapped objects like { "$type": "System.Int32", "$value": 13280 },
 * or missing entirely (some properties may not have a value in 2017 environments).
 */
export const Iqa2017PropertyDataSchema = Schema.Struct({
  $type: Schema.Literal("Asi.Soa.Core.DataContracts.GenericPropertyData, Asi.Contracts"),
  Name: Schema.String,
  Value: Schema.optionalWith(
    Schema.Union(Schema.String, Schema.Number, Schema.Boolean, Schema.Null, WrappedValueSchema),
    { exact: true },
  ),
});

/**
 * Schema for 2017 IQA query result rows.
 * 2017 environments return GenericEntityData with Properties array instead of flat objects.
 */
export const Iqa2017RowSchema = Schema.Struct({
  $type: Schema.String,
  EntityTypeName: Schema.String,
  PrimaryParentEntityTypeName: Schema.String,
  PrimaryParentIdentity: Schema.optionalWith(Schema.Any, { exact: true }),
  Properties: SoaCollectionSchema(Iqa2017PropertyDataSchema),
});

/**
 * Schema for 2017 IQA query response.
 */
export const Iqa2017ResponseSchema = QueryResponseSchema(Iqa2017RowSchema);

// ---------------------
// Data Source Query Results (GenericEntityData format)
// ---------------------

/**
 * Schema for property data in data source responses.
 * Similar to Iqa2017PropertyDataSchema but Value is optional (some properties may not have a value).
 * Values can be primitives, wrapped objects, or missing entirely.
 */
export const DataSourcePropertyDataSchema = Schema.Struct({
  $type: Schema.Literal("Asi.Soa.Core.DataContracts.GenericPropertyData, Asi.Contracts"),
  Name: Schema.String,
  Value: Schema.optionalWith(
    Schema.Union(Schema.String, Schema.Number, Schema.Boolean, Schema.Null, WrappedValueSchema),
    { exact: true },
  ),
});

/**
 * Schema for data source query result rows.
 * Returns GenericEntityData with Properties array.
 */
export const DataSourceRowSchema = Schema.Struct({
  $type: Schema.String,
  EntityTypeName: Schema.String,
  PrimaryParentEntityTypeName: Schema.String,
  Identity: Schema.optionalWith(Schema.Any, { exact: true }),
  PrimaryParentIdentity: Schema.optionalWith(Schema.Any, { exact: true }),
  Properties: SoaCollectionSchema(DataSourcePropertyDataSchema),
});

/**
 * Schema for data source query response.
 */
export const DataSourceResponseSchema = QueryResponseSchema(DataSourceRowSchema);

// ---------------------
// User Role Schemas (for GetUserRoles)
// ---------------------

/**
 * Schema for user role data returned by GetUserRoles operation.
 */
export const UserRoleDataSchema = Schema.Struct({
  $type: Schema.Literal("Asi.Soa.Membership.DataContracts.User.RoleData, Asi.Contracts"),
  Description: Schema.String,
  RoleKey: Schema.String,
  RoleName: Schema.String,
});

/**
 * Schema for GetUserRoles response.
 * Returns a GenericExecuteResult with Result being a collection of UserRoleData.
 */
export const GetUserRolesResponseSchema = Schema.Struct({
  $type: Schema.String,
  Result: Schema.NullOr(SoaCollectionSchema(UserRoleDataSchema)),
  IsSuccessStatusCode: Schema.Boolean,
  Message: Schema.NullOr(Schema.String),
});

// ---------------------
// Inferred Types
// ---------------------

export type SoaCollection<T> = {
  readonly $type: string;
  readonly $values: readonly T[];
};

export type QueryResponse<T> = {
  readonly $type: string;
  readonly Items: SoaCollection<T>;
  readonly Offset: number;
  readonly Limit: number;
  readonly Count: number;
  readonly TotalCount: number;
  readonly NextPageLink: string | null;
  readonly HasNext: boolean;
  readonly NextOffset: number;
};

export type BoProperty = typeof BoPropertySchema.Type;
export type BoIndex = typeof IndexSchema.Type;
export type BoEntityDefinition = typeof BoEntityDefinitionSchema.Type;

export type GenericProperty = typeof GenericPropertySchema.Type;
export type QueryDefinition = typeof QueryDefinitionSchema.Type;
export type QueryDefinition2017 = typeof QueryDefinition2017Schema.Type;
export type QueryData = typeof QueryDataSchema.Type;
export type CriteriaData = typeof CriteriaDataSchema.Type;

export type PropertyTypeString = typeof PropertyTypeStringSchema.Type;
export type PropertyTypeInteger = typeof PropertyTypeIntegerSchema.Type;
export type PropertyTypeBoolean = typeof PropertyTypeBooleanSchema.Type;
export type PropertyTypeDateTime = typeof PropertyTypeDateTimeSchema.Type;
export type PropertyTypeBinary = typeof PropertyTypeBinarySchema.Type;
export type PropertyTypeDecimal = typeof PropertyTypeDecimalSchema.Type;
export type PropertyTypeMonetary = typeof PropertyTypeMonetarySchema.Type;

// Literal union types
export type QueryDataTypeName = typeof QueryDataTypeNameSchema.Type;
export type DisplayFormat = typeof DisplayFormatSchema.Type;
export type RelationType = typeof RelationTypeSchema.Type;
export type QuerySourceType = typeof QuerySourceTypeSchema.Type;
export type DocumentStatus = typeof DocumentStatusSchema.Type;
export type ObjectTypeName = typeof ObjectTypeNameSchema.Type;

// Document types
export type DocumentSummaryData = typeof DocumentSummaryDataSchema.Type;
export type DocumentSummaryResult = typeof DocumentSummaryResultSchema.Type;
export type DocumentSummaryCollectionResult = typeof DocumentSummaryCollectionResultSchema.Type;
export type QueryDefinitionResult = typeof QueryDefinitionResultSchema.Type;
export type QueryPropertyData = typeof QueryPropertyDataSchema.Type;

// IQA Query types
export type IqaQueryRow = typeof IqaQueryRowSchema.Type;
export type IqaQueryResponse = typeof IqaQueryResponseSchema.Type;

// 2017 IQA Query types
export type Iqa2017Row = typeof Iqa2017RowSchema.Type;
export type Iqa2017Response = typeof Iqa2017ResponseSchema.Type;

// Data Source Query types
export type DataSourcePropertyData = typeof DataSourcePropertyDataSchema.Type;
export type DataSourceRow = typeof DataSourceRowSchema.Type;
export type DataSourceResponse = typeof DataSourceResponseSchema.Type;

// Entity insert types
export type GenericPropertyData = typeof GenericPropertyDataSchema.Type;
export type IdentityData = typeof IdentityDataSchema.Type;
export type GenericEntityData = typeof GenericEntityDataSchema.Type;

// User role types
export type UserRoleData = typeof UserRoleDataSchema.Type;
export type GetUserRolesResponse = typeof GetUserRolesResponseSchema.Type;
