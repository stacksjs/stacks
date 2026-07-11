import { DynamoDBItemBuilder, DynamoDBQueryBuilder } from './dynamodb-client';
import { SingleTableManager, SingleTableRepository } from './dynamodb-single-table';
import type { DynamoDBDriver } from './drivers/dynamodb';
/**
 * Resolve key pattern placeholders with actual values
 */
export declare function resolveKeyPattern(keyPatterns: KeyPatterns, data: Record<string, any>): Record<string, string>;
/**
 * Parse models from configuration (stub implementation)
 */
export declare function parseStacksModels(_config: any): Promise<{ models: Map<string, ParsedModel> }>;
/**
 * Convert model instance to DynamoDB item format (stub)
 */
export declare function toDynamoDBItem(item: Record<string, any>): Record<string, any>;
/**
 * Convert DynamoDB item to model instance (stub)
 */
export declare function toModelInstance<T>(item: Record<string, any>): T;
/**
 * Marshall a JavaScript object to DynamoDB attribute values (stub)
 */
export declare function marshallObject(obj: Record<string, any>): Record<string, any>;
/**
 * Unmarshall DynamoDB attribute values to a JavaScript object (stub)
 */
export declare function unmarshallItem(item: Record<string, any>): Record<string, any>;
/**
 * Create a DynamoDB Tooling Adapter instance
 */
export declare function createDynamoDBToolingAdapter(config: DynamoDBToolingConfig): DynamoDBToolingAdapter;
/**
 * Generate access patterns for a parsed model
 * Standalone function for use outside the adapter
 */
export declare function generateAccessPatterns(model: ParsedModel): AccessPattern[];
/**
 * Convert a Stacks model definition to a single-table entity pattern
 * Standalone function for creating entity patterns
 */
export declare function stacksModelToEntity(model: { name: string; primaryKey?: string }, delimiter?: string): { name: string; pkPattern: string; skPattern: string };
/**
 * Access pattern definition for DynamoDB single-table design
 */
export declare interface AccessPattern {
  name: string
  description: string
  entityType: string
  operation: 'get' | 'query' | 'scan'
  index: string | 'main' | 'scan' | 'GSI1' | 'GSI2' | 'GSI3' | 'GSI4' | 'GSI5'
  keyCondition: string
  examplePk: string
  exampleSk?: string
  efficient: boolean
}
/**
 * Parsed attribute definition
 */
export declare interface ParsedAttribute {
  name: string
  fillable: boolean
  required: boolean
  nullable: boolean
  unique: boolean
  hidden: boolean
  defaultValue?: any
  cast?: string
  dynamoDbType: 'S' | 'N' | 'B' | 'BOOL' | 'NULL' | 'M' | 'L' | 'SS' | 'NS' | 'BS'
}
/**
 * Parsed relationship definition
 */
export declare interface ParsedRelationship {
  type: 'hasOne' | 'hasMany' | 'belongsTo' | 'belongsToMany'
  relatedModel: string
  foreignKey: string
  localKey: string
  pivotEntity?: string
  requiresGsi: boolean
  gsiIndex?: number
}
/**
 * Key patterns for DynamoDB single-table design
 */
export declare interface KeyPatterns {
  pk: string
  sk: string
  gsi1pk?: string
  gsi1sk?: string
  gsi2pk?: string
  gsi2sk?: string
  gsi3pk?: string
  gsi3sk?: string
  gsi4pk?: string
  gsi4sk?: string
  gsi5pk?: string
  gsi5sk?: string
}
/**
 * Parsed model definition
 */
export declare interface ParsedModel {
  name: string
  entityType: string
  primaryKey: string
  attributes: ParsedAttribute[]
  relationships: ParsedRelationship[]
  keyPatterns: KeyPatterns
  accessPatterns: AccessPattern[]
  traits: Record<string, any>
  hasTimestamps: boolean
  hasSoftDeletes: boolean
  hasUuid: boolean
  hasTtl: boolean
  hasVersioning: boolean
  original: StacksModel
}
/**
 * Stacks model definition (input format)
 */
export declare interface StacksModel {
  name: string
  primaryKey?: string
  attributes?: Record<string, {
    fillable?: boolean
    required?: boolean
    nullable?: boolean
    unique?: boolean
    hidden?: boolean
    default?: any
    cast?: string
    validation?: { rule?: string }
  }>
  traits?: {
    useTimestamps?: boolean
    useSoftDeletes?: boolean
    useUuid?: boolean
    useTtl?: boolean
    useVersioning?: boolean
  }
  hasOne?: string[]
  hasMany?: string[]
  belongsTo?: string[]
  belongsToMany?: string[]
}
/**
 * Configuration for dynamodb-tooling integration
 */
export declare interface DynamoDBToolingConfig {
  region: string
  endpoint?: string
  credentials?: {
    accessKeyId: string
    secretAccessKey: string
    sessionToken?: string
  }
  tableName: string
  pkAttribute?: string
  skAttribute?: string
  entityTypeAttribute?: string
  keyDelimiter?: string
  modelsPath?: string
  gsiConfig?: {
    gsi1pk?: string
    gsi1sk?: string
    gsi2pk?: string
    gsi2sk?: string
    gsi3pk?: string
    gsi3sk?: string
  }
}
/**
 * DynamoDB Tooling Adapter
 *
 * Bridges dynamodb-tooling with bun-query-builder's fluent API.
 * All model parsing and transformation is delegated to dynamodb-tooling.
 */
export declare class DynamoDBToolingAdapter {
  constructor(config: DynamoDBToolingConfig);
  setClient(client: any): this;
  discoverModels(): Promise<ParsedModel[]>;
  registerModel(model: StacksModel): ParsedModel;
  registerParsedModel(parsed: ParsedModel): ParsedModel;
  registerModels(models: StacksModel[]): ParsedModel[];
  getModel(name: string): ParsedModel | undefined;
  getAllModels(): ParsedModel[];
  repository<T extends Record<string, any>>(modelName: string): SingleTableRepository<T>;
  query<T = any>(modelName: string): DynamoDBQueryBuilder<T>;
  item<T = any>(modelName: string): DynamoDBItemBuilder<T>;
  buildKey(modelName: string, data: Record<string, any>): { pk: string, sk: string };
  createItem(modelName: string, data: Record<string, any>): Record<string, any>;
  parseItem<T = any>(item: Record<string, any>): { type: string, data: T } | undefined;
  getDriver(): DynamoDBDriver;
  getSingleTableManager(): SingleTableManager;
  generateTableDefinition(): any;
  generateAccessPatterns(modelName: string): AccessPattern[];
}
