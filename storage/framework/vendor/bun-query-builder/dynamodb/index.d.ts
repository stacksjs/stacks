import type { DynamoDBConfig, DynamoDBDriver, SingleTableEntityMapping } from '../drivers/dynamodb';
// Re-export types from driver
export type {
  DynamoDBConfig,
  DynamoDBDriver,
  SingleTableEntityMapping,
} from '../drivers/dynamodb';
export type { DynamoDBClientConfig, DynamoDBCredentials } from './client';
export type { ModelConfig, ModelQueryBuilder } from './model';
export type { MigrationDriverConfig, MigrationResult } from './migration-driver';
export type {
  DynamoDBMigrationPlan,
  DynamoDBMigrationOperation,
  DynamoDBMigrationOperationType,
  DynamoDBMigrationState,
  DynamoDBModelSchema,
  DynamoDBGSIDefinition,
  DynamoDBLSIDefinition,
} from './migrations';
/**
 * Create a new DynamoDB client instance
 */
export declare function createDynamo(): DynamoClient;
/**
 * DynamoDB client singleton
 */
export declare const dynamo: DynamoClient;
/**
 * DynamoDB connection configuration
 */
export declare interface DynamoConnectionConfig {
  region: string
  table: string
  endpoint?: string
  credentials?: {
    accessKeyId: string
    secretAccessKey: string
    sessionToken?: string
  }
  pkAttribute?: string
  skAttribute?: string
  entityTypeAttribute?: string
  keyDelimiter?: string
}
/**
 * Sort key builder for fluent API
 */
export declare interface SortKeyBuilder {
  equals(value: string): EntityQueryBuilder
  beginsWith(prefix: string): EntityQueryBuilder
  between(start: string, end: string): EntityQueryBuilder
  lt(value: string): EntityQueryBuilder
  lte(value: string): EntityQueryBuilder
  gt(value: string): EntityQueryBuilder
  gte(value: string): EntityQueryBuilder
}
/**
 * Batch write operation
 */
export declare interface BatchWriteOperation {
  put?: { entity: string, item: Record<string, any> }
  delete?: { entity: string, pk: string, sk: string }
}
/**
 * Transact write operation
 */
export declare interface TransactWriteOperation {
  put?: { entity: string, item: Record<string, any>, condition?: string }
  update?: { entity: string, pk: string, sk?: string, set?: Record<string, any>, add?: Record<string, number>, remove?: string[] }
  delete?: { entity: string, pk: string, sk: string, condition?: string }
  conditionCheck?: { entity: string, pk: string, sk: string, condition: string }
}
/**
 * DynamoDB query result
 */
export declare interface DynamoDBQueryResult<T = any> {
  items: T[]
  count: number
  scannedCount?: number
  lastKey?: Record<string, any>
}
/**
 * Entity-centric query builder for DynamoDB
 */
export declare class EntityQueryBuilder<T = any> {
  constructor(driver: DynamoDBDriver, client: any, tableName: string, config: { pkAttribute: string, skAttribute: string, entityTypeAttribute: string, keyDelimiter: string });
  entity(entityType: string): this;
  pk(value: string): this;
  get sk(): SortKeyBuilder;
  index(indexName: string): this;
  project(...attributes: string[]): this;
  filter(attribute: string, operator: string, value?: any): this;
  where(attribute: string, value: any): this;
  whereIn(attribute: string, values: any[]): this;
  limit(count: number): this;
  asc(): this;
  desc(): this;
  consistent(): this;
  startFrom(key: Record<string, any>): this;
  toRequest(): Record<string, any>;
  get(): Promise<T[]>;
  first(): Promise<T | undefined>;
  getAll(): Promise<T[]>;
  count(): Promise<number>;
}
/**
 * DynamoDB client with entity-centric API
 */
declare class DynamoClient {
  connection(config: DynamoConnectionConfig): this;
  setClient(client: any): this;
  registerEntity(mapping: SingleTableEntityMapping): this;
  entity<T = any>(entityType: string): EntityQueryBuilder<T>;
  batchWrite(operations: BatchWriteOperation[]): Promise<void>;
  transactWrite(operations: TransactWriteOperation[]): Promise<void>;
  getDriver(): DynamoDBDriver | undefined;
}
// Re-export Model and client
export { Model, configureModels } from './model';
export { DynamoDBClient, createClient } from './client';
// Re-export migrations
export {
  DynamoDBMigrationDriver,
  createMigrationDriver,
  migrateModels,
} from './migration-driver';
export {
  buildMigrationPlan as buildDynamoDBMigrationPlan,
  extractTableDefinition,
  extractModelSchema,
  convertSchemaToDefinition,
  hashTableDefinition,
  isDefinitionEqual,
} from './migrations';
export { DynamoDBMigrationTracker, MIGRATIONS_TABLE } from './migration-tracker';
