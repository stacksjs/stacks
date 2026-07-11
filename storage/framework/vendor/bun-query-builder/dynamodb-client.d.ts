import type { DynamoDBComparisonOperator, DynamoDBConfig, DynamoDBDriver, DynamoDBQueryParams, DynamoDBScanParams, SingleTableEntityMapping } from './drivers/dynamodb';
/**
 * Create a DynamoDB query builder
 */
export declare function createDynamoDBQueryBuilder<T = any>(options: DynamoDBQueryBuilderOptions): DynamoDBQueryBuilder<T>;
/**
 * Create a DynamoDB item builder
 */
export declare function createDynamoDBItemBuilder<T = any>(options: DynamoDBQueryBuilderOptions): DynamoDBItemBuilder<T>;
/**
 * Create a DynamoDB client with fluent query builder methods
 */
export declare function createDynamoDBClient(options: DynamoDBQueryBuilderOptions): DynamoDBClientMethods;
/**
 * DynamoDB Query Builder Options
 */
export declare interface DynamoDBQueryBuilderOptions {
  config: DynamoDBConfig
  client?: any
}
/**
 * Result type for DynamoDB operations
 */
export declare interface DynamoDBResult<T = any> {
  items?: T[]
  item?: T
  count?: number
  scannedCount?: number
  lastEvaluatedKey?: Record<string, any>
  consumedCapacity?: any
}
/**
 * DynamoDB Client Factory
 *
 * Creates a complete DynamoDB client with query builder methods
 */
export declare interface DynamoDBClientMethods {
  query: <T = any>() => DynamoDBQueryBuilder<T>
  item: <T = any>() => DynamoDBItemBuilder<T>
  driver: DynamoDBDriver
  registerEntity: (mapping: SingleTableEntityMapping) => void
  buildKey: (entityType: string, values: Record<string, any>) => { pk: string, sk: string }
}
/**
 * DynamoDB Query Builder
 *
 * Fluent interface for building DynamoDB queries
 */
export declare class DynamoDBQueryBuilder<T = any> {
  constructor(options: DynamoDBQueryBuilderOptions);
  table(tableName: string): this;
  index(indexName: string): this;
  entity(entityType: string): this;
  whereKey(attribute: string, operator: DynamoDBComparisonOperator, value: any): this;
  wherePartitionKey(attribute: string, value: any): this;
  whereSortKey(attribute: string, value: any): this;
  whereSortKeyBeginsWith(attribute: string, prefix: string): this;
  whereSortKeyBetween(attribute: string, start: any, end: any): this;
  where(attribute: string, operator: DynamoDBComparisonOperator | 'contains' | 'attribute_exists' | 'attribute_not_exists' | 'IN', value?: any): this;
  whereEquals(attribute: string, value: any): this;
  whereLessThan(attribute: string, value: any): this;
  whereLessThanOrEqual(attribute: string, value: any): this;
  whereGreaterThan(attribute: string, value: any): this;
  whereGreaterThanOrEqual(attribute: string, value: any): this;
  whereBetween(attribute: string, start: any, end: any): this;
  whereBeginsWith(attribute: string, prefix: string): this;
  whereContains(attribute: string, value: any): this;
  whereExists(attribute: string): this;
  whereNotExists(attribute: string): this;
  whereIn(attribute: string, values: any[]): this;
  select(...attributes: string[]): this;
  limit(count: number): this;
  ascending(): this;
  descending(): this;
  consistentRead(value?: boolean): this;
  startFrom(key: Record<string, any>): this;
  buildQueryParams(): DynamoDBQueryParams;
  buildScanParams(): DynamoDBScanParams;
  toQueryRequest(): Record<string, any>;
  toScanRequest(): Record<string, any>;
  query(): Promise<DynamoDBResult<T>>;
  scan(): Promise<DynamoDBResult<T>>;
  getAll(): Promise<T[]>;
  first(): Promise<T | undefined>;
  count(): Promise<number>;
  reset(): this;
}
/**
 * DynamoDB Item Builder for Put/Update operations
 */
export declare class DynamoDBItemBuilder<T = any> {
  constructor(options: DynamoDBQueryBuilderOptions);
  table(tableName: string): this;
  key(key: Record<string, any>): this;
  item(data: Record<string, any>): this;
  set(attribute: string, value: any): this;
  setMany(values: Record<string, any>): this;
  remove(attribute: string): this;
  add(attribute: string, value: any): this;
  deleteFromSet(attribute: string, values: any): this;
  condition(expression: string): this;
  ifNotExists(attribute?: string): this;
  ifExists(attribute?: string): this;
  returnOld(): this;
  returnNew(): this;
  toPutRequest(): Record<string, any>;
  toUpdateRequest(): Record<string, any>;
  toDeleteRequest(): Record<string, any>;
  toGetRequest(): Record<string, any>;
  put(): Promise<T | undefined>;
  update(): Promise<T | undefined>;
  delete(): Promise<T | undefined>;
  get(): Promise<T | undefined>;
}
