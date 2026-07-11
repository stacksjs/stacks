import type { DynamoDBTableDefinition, DynamoDBGlobalSecondaryIndex, DynamoDBAttributeDefinition } from '../drivers/dynamodb';
// ============================================================================
// Exports
// ============================================================================
export type {
  DynamoDBTableDefinition,
  DynamoDBGlobalSecondaryIndex,
  DynamoDBAttributeDefinition,
};
/**
 * Generate a hash of a table definition for comparison
 */
export declare function hashTableDefinition(definition: DynamoDBTableDefinition): string;
/**
 * Extract DynamoDB table definition from a Model class
 */
export declare function extractTableDefinition(model: any): DynamoDBTableDefinition;
/**
 * Extract model schema from a Model class
 */
export declare function extractModelSchema(ModelClass: any): DynamoDBModelSchema;
/**
 * Convert model schema to DynamoDB table definition
 */
export declare function convertSchemaToDefinition(schema: DynamoDBModelSchema): DynamoDBTableDefinition;
/**
 * Build a migration plan by comparing current and target table definitions
 */
export declare function buildMigrationPlan(current: DynamoDBTableDefinition | null, target: DynamoDBTableDefinition): DynamoDBMigrationPlan;
/**
 * Check if two table definitions are equivalent
 */
export declare function isDefinitionEqual(a: DynamoDBTableDefinition, b: DynamoDBTableDefinition): boolean;
/**
 * Individual migration operation
 */
export declare interface DynamoDBMigrationOperation {
  type: DynamoDBMigrationOperationType
  tableName: string
  details: Record<string, any>
}
/**
 * Migration plan containing all operations to execute
 */
export declare interface DynamoDBMigrationPlan {
  tableName: string
  operations: DynamoDBMigrationOperation[]
  timestamp: string
  hash: string
}
/**
 * State of a migrated table stored in the migrations table
 */
export declare interface DynamoDBMigrationState {
  tableName: string
  hash: string
  definition: DynamoDBTableDefinition
  appliedAt: string
  version: number
}
/**
 * Model definition for extracting DynamoDB schema
 */
export declare interface DynamoDBModelSchema {
  tableName: string
  pkAttribute: string
  skAttribute: string
  pkPrefix: string
  skPrefix: string
  entityTypeAttribute: string
  timestamps: boolean
  ttlAttribute?: string
  gsis?: DynamoDBGSIDefinition[]
  lsis?: DynamoDBLSIDefinition[]
  billingMode?: 'PAY_PER_REQUEST' | 'PROVISIONED'
  provisionedThroughput?: {
    readCapacityUnits: number
    writeCapacityUnits: number
  }
  streamEnabled?: boolean
  streamViewType?: 'KEYS_ONLY' | 'NEW_IMAGE' | 'OLD_IMAGE' | 'NEW_AND_OLD_IMAGES'
}
/**
 * GSI definition for model schema
 */
export declare interface DynamoDBGSIDefinition {
  indexName: string
  pkAttribute: string
  skAttribute?: string
  projection?: 'ALL' | 'KEYS_ONLY' | string[]
  provisionedThroughput?: {
    readCapacityUnits: number
    writeCapacityUnits: number
  }
}
/**
 * LSI definition for model schema
 */
export declare interface DynamoDBLSIDefinition {
  indexName: string
  skAttribute: string
  projection?: 'ALL' | 'KEYS_ONLY' | string[]
}
/**
 * Migration operation types
 */
export type DynamoDBMigrationOperationType = | 'CREATE_TABLE'
  | 'DELETE_TABLE'
  | 'ADD_GSI'
  | 'DELETE_GSI'
  | 'UPDATE_GSI_THROUGHPUT'
  | 'UPDATE_TTL'
  | 'UPDATE_BILLING_MODE'
  | 'UPDATE_THROUGHPUT'
  | 'ENABLE_STREAM'
  | 'DISABLE_STREAM';
