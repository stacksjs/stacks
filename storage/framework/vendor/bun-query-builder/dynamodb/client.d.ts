/**
 * Create a native DynamoDB client
 */
export declare function createClient(config: DynamoDBClientConfig): DynamoDBClient;
/**
 * Native DynamoDB HTTP Client
 *
 * Zero-dependency DynamoDB client using native fetch and AWS Signature V4.
 * Implements all core DynamoDB operations without requiring @aws-sdk.
 *
 * @example
 * ```typescript
 * const client = new DynamoDBClient({
 *   region: 'us-east-1',
 *   credentials: {
 *     accessKeyId: 'AKIA...',
 *     secretAccessKey: '...',
 *   },
 * })
 *
 * const result = await client.query({
 *   TableName: 'MyTable',
 *   KeyConditionExpression: 'pk = :pk',
 *   ExpressionAttributeValues: { ':pk': { S: 'USER#123' } },
 * })
 * ```
 */
// ============================================================================
// Types
// ============================================================================
export declare interface DynamoDBCredentials {
  accessKeyId: string
  secretAccessKey: string
  sessionToken?: string
}
export declare interface DynamoDBClientConfig {
  region: string
  endpoint?: string
  credentials?: DynamoDBCredentials
}
export declare interface DynamoDBQueryInput {
  TableName: string
  IndexName?: string
  KeyConditionExpression?: string
  FilterExpression?: string
  ProjectionExpression?: string
  ExpressionAttributeNames?: Record<string, string>
  ExpressionAttributeValues?: Record<string, any>
  Limit?: number
  ScanIndexForward?: boolean
  ConsistentRead?: boolean
  ExclusiveStartKey?: Record<string, any>
  Select?: 'ALL_ATTRIBUTES' | 'ALL_PROJECTED_ATTRIBUTES' | 'SPECIFIC_ATTRIBUTES' | 'COUNT'
}
export declare interface DynamoDBScanInput {
  TableName: string
  IndexName?: string
  FilterExpression?: string
  ProjectionExpression?: string
  ExpressionAttributeNames?: Record<string, string>
  ExpressionAttributeValues?: Record<string, any>
  Limit?: number
  ConsistentRead?: boolean
  ExclusiveStartKey?: Record<string, any>
  Segment?: number
  TotalSegments?: number
  Select?: 'ALL_ATTRIBUTES' | 'ALL_PROJECTED_ATTRIBUTES' | 'SPECIFIC_ATTRIBUTES' | 'COUNT'
}
export declare interface DynamoDBGetItemInput {
  TableName: string
  Key: Record<string, any>
  ProjectionExpression?: string
  ExpressionAttributeNames?: Record<string, string>
  ConsistentRead?: boolean
}
export declare interface DynamoDBPutItemInput {
  TableName: string
  Item: Record<string, any>
  ConditionExpression?: string
  ExpressionAttributeNames?: Record<string, string>
  ExpressionAttributeValues?: Record<string, any>
  ReturnValues?: 'NONE' | 'ALL_OLD'
}
export declare interface DynamoDBUpdateItemInput {
  TableName: string
  Key: Record<string, any>
  UpdateExpression?: string
  ConditionExpression?: string
  ExpressionAttributeNames?: Record<string, string>
  ExpressionAttributeValues?: Record<string, any>
  ReturnValues?: 'NONE' | 'ALL_OLD' | 'UPDATED_OLD' | 'ALL_NEW' | 'UPDATED_NEW'
}
export declare interface DynamoDBDeleteItemInput {
  TableName: string
  Key: Record<string, any>
  ConditionExpression?: string
  ExpressionAttributeNames?: Record<string, string>
  ExpressionAttributeValues?: Record<string, any>
  ReturnValues?: 'NONE' | 'ALL_OLD'
}
export declare interface DynamoDBBatchGetItemInput {
  RequestItems: {
    [tableName: string]: {
      Keys: Record<string, any>[]
      ProjectionExpression?: string
      ExpressionAttributeNames?: Record<string, string>
      ConsistentRead?: boolean
    }
  }
}
export declare interface DynamoDBBatchWriteItemInput {
  RequestItems: {
    [tableName: string]: (
      | { PutRequest: { Item: Record<string, any> } }
      | { DeleteRequest: { Key: Record<string, any> } }
    )[]
  }
}
export declare interface DynamoDBTransactWriteItemsInput {
  TransactItems: (
    | { Put: { TableName: string, Item: Record<string, any>, ConditionExpression?: string, ExpressionAttributeNames?: Record<string, string>, ExpressionAttributeValues?: Record<string, any> } }
    | { Update: { TableName: string, Key: Record<string, any>, UpdateExpression: string, ConditionExpression?: string, ExpressionAttributeNames?: Record<string, string>, ExpressionAttributeValues?: Record<string, any> } }
    | { Delete: { TableName: string, Key: Record<string, any>, ConditionExpression?: string, ExpressionAttributeNames?: Record<string, string>, ExpressionAttributeValues?: Record<string, any> } }
    | { ConditionCheck: { TableName: string, Key: Record<string, any>, ConditionExpression: string, ExpressionAttributeNames?: Record<string, string>, ExpressionAttributeValues?: Record<string, any> } }
  )[]
  ClientRequestToken?: string
}
export declare interface DynamoDBQueryOutput {
  Items?: Record<string, any>[]
  Count?: number
  ScannedCount?: number
  LastEvaluatedKey?: Record<string, any>
  ConsumedCapacity?: any
}
export declare interface DynamoDBGetItemOutput {
  Item?: Record<string, any>
  ConsumedCapacity?: any
}
export declare interface DynamoDBPutItemOutput {
  Attributes?: Record<string, any>
  ConsumedCapacity?: any
}
export declare interface DynamoDBUpdateItemOutput {
  Attributes?: Record<string, any>
  ConsumedCapacity?: any
}
export declare interface DynamoDBDeleteItemOutput {
  Attributes?: Record<string, any>
  ConsumedCapacity?: any
}
/**
 * Native DynamoDB HTTP Client
 *
 * Uses AWS Signature V4 and native fetch for zero-dependency DynamoDB access.
 */
export declare class DynamoDBClient {
  constructor(config: DynamoDBClientConfig);
  query(input: DynamoDBQueryInput): Promise<DynamoDBQueryOutput>;
  scan(input: DynamoDBScanInput): Promise<DynamoDBQueryOutput>;
  getItem(input: DynamoDBGetItemInput): Promise<DynamoDBGetItemOutput>;
  putItem(input: DynamoDBPutItemInput): Promise<DynamoDBPutItemOutput>;
  updateItem(input: DynamoDBUpdateItemInput): Promise<DynamoDBUpdateItemOutput>;
  deleteItem(input: DynamoDBDeleteItemInput): Promise<DynamoDBDeleteItemOutput>;
  batchGetItem(input: DynamoDBBatchGetItemInput): Promise<{ Responses?: Record<string, Record<string, any>[]>, UnprocessedKeys?: any }>;
  batchWriteItem(input: DynamoDBBatchWriteItemInput): Promise<{ UnprocessedItems?: any }>;
  transactWriteItems(input: DynamoDBTransactWriteItemsInput): Promise<{}>;
  describeTable(tableName: string): Promise<any>;
  createTable(input: any): Promise<any>;
  deleteTable(tableName: string): Promise<any>;
  listTables(input?: { ExclusiveStartTableName?: string, Limit?: number }): Promise<{ TableNames: string[], LastEvaluatedTableName?: string }>;
  updateTable(input: any): Promise<any>;
  updateTimeToLive(input: any): Promise<any>;
  describeTimeToLive(tableName: string): Promise<any>;
}
