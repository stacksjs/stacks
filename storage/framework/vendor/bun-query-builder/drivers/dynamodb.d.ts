/**
 * Create a new DynamoDB driver instance
 */
export declare function createDynamoDBDriver(config: DynamoDBConfig): DynamoDBDriver;
/**
 * DynamoDB Driver for bun-query-builder
 *
 * This driver supports DynamoDB's unique data model including:
 * - Single table design patterns
 * - Partition key (PK) and sort key (SK) based access
 * - Global Secondary Indexes (GSI) and Local Secondary Indexes (LSI)
 * - DynamoDB-specific operations (Query, Scan, GetItem, PutItem, etc.)
 */
/**
 * DynamoDB key schema definition
 */
export declare interface DynamoDBKeySchema {
  partitionKey: string
  sortKey?: string
}
/**
 * DynamoDB attribute definition for table/index creation
 */
export declare interface DynamoDBAttributeDefinition {
  name: string
  type: 'S' | 'N' | 'B'
}
/**
 * Global Secondary Index definition
 */
export declare interface DynamoDBGlobalSecondaryIndex {
  indexName: string
  keySchema: DynamoDBKeySchema
  projection: {
    type: 'ALL' | 'KEYS_ONLY' | 'INCLUDE'
    nonKeyAttributes?: string[]
  }
  provisionedThroughput?: {
    readCapacityUnits: number
    writeCapacityUnits: number
  }
}
/**
 * Local Secondary Index definition
 */
export declare interface DynamoDBLocalSecondaryIndex {
  indexName: string
  sortKey: string
  projection: {
    type: 'ALL' | 'KEYS_ONLY' | 'INCLUDE'
    nonKeyAttributes?: string[]
  }
}
/**
 * DynamoDB table definition for single table design
 */
export declare interface DynamoDBTableDefinition {
  tableName: string
  keySchema: DynamoDBKeySchema
  attributeDefinitions: DynamoDBAttributeDefinition[]
  globalSecondaryIndexes?: DynamoDBGlobalSecondaryIndex[]
  localSecondaryIndexes?: DynamoDBLocalSecondaryIndex[]
  billingMode?: 'PROVISIONED' | 'PAY_PER_REQUEST'
  provisionedThroughput?: {
    readCapacityUnits: number
    writeCapacityUnits: number
  }
  ttlAttribute?: string
  streamSpecification?: {
    enabled: boolean
    viewType?: 'KEYS_ONLY' | 'NEW_IMAGE' | 'OLD_IMAGE' | 'NEW_AND_OLD_IMAGES'
  }
}
/**
 * Single table design entity mapping
 * Maps model entities to PK/SK patterns
 */
export declare interface SingleTableEntityMapping {
  entityType: string
  pkPattern: string
  skPattern: string
  gsiMappings?: {
    indexName: string
    pkPattern: string
    skPattern?: string
  }[]
  attributes?: Record<string, DynamoDBAttributeType>
}
/**
 * DynamoDB filter condition for Query/Scan operations
 */
export declare interface DynamoDBCondition {
  attribute: string
  operator: DynamoDBComparisonOperator | 'contains' | 'attribute_exists' | 'attribute_not_exists' | 'attribute_type' | 'IN'
  value?: any
  values?: any[]
}
/**
 * DynamoDB Query parameters
 */
export declare interface DynamoDBQueryParams {
  tableName: string
  indexName?: string
  keyConditions: DynamoDBCondition[]
  filterConditions?: DynamoDBCondition[]
  projectionAttributes?: string[]
  limit?: number
  scanIndexForward?: boolean
  exclusiveStartKey?: Record<string, any>
  consistentRead?: boolean
}
/**
 * DynamoDB Scan parameters
 */
export declare interface DynamoDBScanParams {
  tableName: string
  indexName?: string
  filterConditions?: DynamoDBCondition[]
  projectionAttributes?: string[]
  limit?: number
  exclusiveStartKey?: Record<string, any>
  segment?: number
  totalSegments?: number
  consistentRead?: boolean
}
/**
 * DynamoDB GetItem parameters
 */
export declare interface DynamoDBGetItemParams {
  tableName: string
  key: Record<string, any>
  projectionAttributes?: string[]
  consistentRead?: boolean
}
/**
 * DynamoDB PutItem parameters
 */
export declare interface DynamoDBPutItemParams {
  tableName: string
  item: Record<string, any>
  conditionExpression?: string
  returnValues?: 'NONE' | 'ALL_OLD'
}
/**
 * DynamoDB UpdateItem parameters
 */
export declare interface DynamoDBUpdateItemParams {
  tableName: string
  key: Record<string, any>
  updateExpressions: {
    set?: Record<string, any>
    remove?: string[]
    add?: Record<string, any>
    delete?: Record<string, any>
  }
  conditionExpression?: string
  returnValues?: 'NONE' | 'ALL_OLD' | 'UPDATED_OLD' | 'ALL_NEW' | 'UPDATED_NEW'
}
/**
 * DynamoDB DeleteItem parameters
 */
export declare interface DynamoDBDeleteItemParams {
  tableName: string
  key: Record<string, any>
  conditionExpression?: string
  returnValues?: 'NONE' | 'ALL_OLD'
}
/**
 * DynamoDB BatchGetItem parameters
 */
export declare interface DynamoDBBatchGetItemParams {
  requestItems: {
    [tableName: string]: {
      keys: Record<string, any>[]
      projectionAttributes?: string[]
      consistentRead?: boolean
    }
  }
}
/**
 * DynamoDB BatchWriteItem parameters
 */
export declare interface DynamoDBBatchWriteItemParams {
  requestItems: {
    [tableName: string]: (
      | { putRequest: { item: Record<string, any> } }
      | { deleteRequest: { key: Record<string, any> } }
    )[]
  }
}
/**
 * DynamoDB TransactWriteItems parameters
 */
export declare interface DynamoDBTransactWriteParams {
  transactItems: (
    | { put: DynamoDBPutItemParams }
    | { update: DynamoDBUpdateItemParams }
    | { delete: DynamoDBDeleteItemParams }
    | { conditionCheck: { tableName: string, key: Record<string, any>, conditionExpression: string } }
  )[]
  clientRequestToken?: string
}
/**
 * DynamoDB Driver Interface
 *
 * Unlike SQL drivers, DynamoDB operations are API-based rather than SQL-based.
 * This interface provides methods to build DynamoDB API request parameters.
 */
export declare interface DynamoDBDriver {
  createTable: (definition: DynamoDBTableDefinition) => DynamoDBTableDefinition
  deleteTable: (tableName: string) => { tableName: string }
  registerEntity: (mapping: SingleTableEntityMapping) => void
  getEntityMapping: (entityType: string) => SingleTableEntityMapping | undefined
  buildPrimaryKey: (entityType: string, values: Record<string, any>) => { pk: string, sk: string }
  parseEntityFromItem: (item: Record<string, any>) => { entityType: string, data: Record<string, any> } | null
  buildQueryParams: (params: Partial<DynamoDBQueryParams>) => DynamoDBQueryParams
  buildScanParams: (params: Partial<DynamoDBScanParams>) => DynamoDBScanParams
  buildGetItemParams: (params: Partial<DynamoDBGetItemParams>) => DynamoDBGetItemParams
  buildPutItemParams: (params: Partial<DynamoDBPutItemParams>) => DynamoDBPutItemParams
  buildUpdateItemParams: (params: Partial<DynamoDBUpdateItemParams>) => DynamoDBUpdateItemParams
  buildDeleteItemParams: (params: Partial<DynamoDBDeleteItemParams>) => DynamoDBDeleteItemParams
  buildBatchGetItemParams: (params: Partial<DynamoDBBatchGetItemParams>) => DynamoDBBatchGetItemParams
  buildBatchWriteItemParams: (params: Partial<DynamoDBBatchWriteItemParams>) => DynamoDBBatchWriteItemParams
  buildTransactWriteParams: (params: Partial<DynamoDBTransactWriteParams>) => DynamoDBTransactWriteParams
  buildKeyConditionExpression: (conditions: DynamoDBCondition[]) => {
    expression: string
    expressionAttributeNames: Record<string, string>
    expressionAttributeValues: Record<string, any>
  }
  buildFilterExpression: (conditions: DynamoDBCondition[]) => {
    expression: string
    expressionAttributeNames: Record<string, string>
    expressionAttributeValues: Record<string, any>
  }
  buildUpdateExpression: (updates: DynamoDBUpdateItemParams['updateExpressions']) => {
    expression: string
    expressionAttributeNames: Record<string, string>
    expressionAttributeValues: Record<string, any>
  }
  buildProjectionExpression: (attributes: string[]) => {
    expression: string
    expressionAttributeNames: Record<string, string>
  }
  marshall: (item: Record<string, any>) => Record<string, any>
  unmarshall: (item: Record<string, any>) => Record<string, any>
}
/**
 * Single table design configuration
 */
export declare interface SingleTableConfig {
  enabled: boolean
  pkAttribute?: string
  skAttribute?: string
  entityTypeAttribute?: string
  keyDelimiter?: string
}
/**
 * DynamoDB configuration options
 */
export declare interface DynamoDBConfig {
  region: string
  endpoint?: string
  credentials?: {
    accessKeyId: string
    secretAccessKey: string
    sessionToken?: string
  }
  tableName?: string
  entityMappings?: SingleTableEntityMapping[]
  defaultBillingMode?: 'PROVISIONED' | 'PAY_PER_REQUEST'
  singleTable?: SingleTableConfig
}
/**
 * DynamoDB attribute type mapping
 */
export type DynamoDBAttributeType = 'S' | 'N' | 'B' | 'SS' | 'NS' | 'BS' | 'M' | 'L' | 'BOOL' | 'NULL';
/**
 * DynamoDB query condition operators
 */
export type DynamoDBComparisonOperator = | '='
  | '<'
  | '<='
  | '>'
  | '>='
  | 'BETWEEN'
  | 'begins_with';
/**
 * DynamoDB Driver Implementation
 */
export declare class DynamoDBDriverImpl implements DynamoDBDriver {
  constructor(config: DynamoDBConfig);
  createTable(definition: DynamoDBTableDefinition): DynamoDBTableDefinition;
  deleteTable(tableName: string): { tableName: string };
  registerEntity(mapping: SingleTableEntityMapping): void;
  getEntityMapping(entityType: string): SingleTableEntityMapping | undefined;
  buildPrimaryKey(entityType: string, values: Record<string, any>): { pk: string, sk: string };
  parseEntityFromItem(item: Record<string, any>): { entityType: string, data: Record<string, any> } | null;
  buildQueryParams(params: Partial<DynamoDBQueryParams>): DynamoDBQueryParams;
  buildScanParams(params: Partial<DynamoDBScanParams>): DynamoDBScanParams;
  buildGetItemParams(params: Partial<DynamoDBGetItemParams>): DynamoDBGetItemParams;
  buildPutItemParams(params: Partial<DynamoDBPutItemParams>): DynamoDBPutItemParams;
  buildUpdateItemParams(params: Partial<DynamoDBUpdateItemParams>): DynamoDBUpdateItemParams;
  buildDeleteItemParams(params: Partial<DynamoDBDeleteItemParams>): DynamoDBDeleteItemParams;
  buildBatchGetItemParams(params: Partial<DynamoDBBatchGetItemParams>): DynamoDBBatchGetItemParams;
  buildBatchWriteItemParams(params: Partial<DynamoDBBatchWriteItemParams>): DynamoDBBatchWriteItemParams;
  buildTransactWriteParams(params: Partial<DynamoDBTransactWriteParams>): DynamoDBTransactWriteParams;
  buildKeyConditionExpression(conditions: DynamoDBCondition[]): {
    expression: string
    expressionAttributeNames: Record<string, string>
    expressionAttributeValues: Record<string, any>
  };
  buildFilterExpression(conditions: DynamoDBCondition[]): {
    expression: string
    expressionAttributeNames: Record<string, string>
    expressionAttributeValues: Record<string, any>
  };
  buildUpdateExpression(updates: DynamoDBUpdateItemParams['updateExpressions']): {
    expression: string
    expressionAttributeNames: Record<string, string>
    expressionAttributeValues: Record<string, any>
  };
  buildProjectionExpression(attributes: string[]): {
    expression: string
    expressionAttributeNames: Record<string, string>
  };
  marshall(item: Record<string, any>): Record<string, any>;
  unmarshall(item: Record<string, any>): Record<string, any>;
}
