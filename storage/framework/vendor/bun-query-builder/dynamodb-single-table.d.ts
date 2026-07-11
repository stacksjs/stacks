import type { DynamoDBQueryBuilderOptions } from './dynamodb-client';
import type { DynamoDBTableDefinition } from './drivers/dynamodb';
/**
 * Create a single table manager
 */
export declare function createSingleTableManager(config: SingleTableConfig): SingleTableManager;
/**
 * Create a repository for an entity
 */
export declare function createRepository<T extends Record<string, any>>(manager: SingleTableManager, entityName: string, options: DynamoDBQueryBuilderOptions): SingleTableRepository<T>;
/**
 * @defaultValue
 * ```ts
 * {
 *   simpleEntity: (entityName: string, idField?: string) => SingleTableEntity,
 *   oneToMany: (parentEntity: string,
 *     childEntity: string,
 *     parentIdField?: string,
 *     childIdField?: string,) => OneToManyPattern,
 *   manyToMany: (entityName: string,
 *     relationName: string,
 *     idField?: string,
 *     relatedIdField?: string,) => ManyToManyPattern,
 *   hierarchical: (entityName: string, rootIdField?: string, pathField?: string) => SingleTableEntity
 * }
 * ```
 */
export declare const SingleTablePatterns: {
  /**
   * User with profile pattern
   * PK: USER#<userId>
   * SK: PROFILE for metadata, or related items like ORDER#<orderId>
   */
  simpleEntity: (entityName: string, idField?: string) => SingleTableEntity;
  /**
   * One-to-many relationship pattern
   * Parent: PK=PARENT#<parentId>, SK=METADATA
   * Child: PK=PARENT#<parentId>, SK=CHILD#<childId>
   */
  oneToMany: (parentEntity: string, childEntity: string, parentIdField?: string, childIdField?: string,) => OneToManyPattern;
  /**
   * Many-to-many relationship pattern using adjacency list
   * Entity: PK=ENTITY#<entityId>, SK=METADATA
   * Relationship: PK=ENTITY#<entityId>, SK=RELATED#<relatedId>
   * Inverse: PK=ENTITY#<relatedId>, SK=RELATED#<entityId> (via GSI)
   */
  manyToMany: (entityName: string, relationName: string, idField?: string, relatedIdField?: string,) => ManyToManyPattern;
  /**
   * Hierarchical data pattern (e.g., org chart, file system)
   * PK: ROOT#<rootId>
   * SK: PATH#<path> (e.g., PATH#/folder1/folder2/file)
   */
  hierarchical: (entityName: string, rootIdField?: string, pathField?: string) => SingleTableEntity
};
/**
 * Entity definition for single table design
 */
export declare interface SingleTableEntity {
  name: string
  pkPattern: string
  skPattern: string
  keyFields: string[]
  indexes?: {
    name: string
    pkPattern: string
    skPattern?: string
  }[]
  schema?: Record<string, {
    type: 'string' | 'number' | 'boolean' | 'list' | 'map' | 'set'
    required?: boolean
  }>
}
/**
 * Single table design configuration
 */
export declare interface SingleTableConfig {
  tableName: string
  pkAttribute?: string
  skAttribute?: string
  typeAttribute?: string
  indexes?: {
    name: string
    pkAttribute: string
    skAttribute?: string
  }[]
  entities: SingleTableEntity[]
}
export declare interface OneToManyPattern {
  parent: SingleTableEntity
  child: SingleTableEntity
}
export declare interface ManyToManyPattern {
  entity: SingleTableEntity
  relation: SingleTableEntity
}
/**
 * Common single table design patterns
 */
/**
 * Result shapes for relationship pattern helpers. Lifted to named
 * interfaces so the generated `.d.ts` doesn't carry an inline object
 * literal in the return position — bun-plugin-dtsx has a bug where
 * `(...) => { ... }` in that position emits as `=> ;`, breaking
 * downstream typecheck for any consumer importing from
 * `bun-query-builder/dynamodb-single-table`.
 */
export declare interface OneToManyPattern {
  parent: SingleTableEntity
  child: SingleTableEntity
}
export declare interface ManyToManyPattern {
  entity: SingleTableEntity
  relation: SingleTableEntity
}
/**
 * Single Table Design Manager
 *
 * Manages entity mappings and provides utilities for working with
 * single table design patterns.
 */
export declare class SingleTableManager {
  constructor(config: SingleTableConfig);
  getEntity(name: string): SingleTableEntity | undefined;
  registerEntity(entity: SingleTableEntity): void;
  buildKey(entityName: string, data: Record<string, any>): { pk: string, sk: string };
  buildGSIKey(entityName: string, indexName: string, data: Record<string, any>): { pk: string, sk?: string };
  createItem(entityName: string, data: Record<string, any>): Record<string, any>;
  parseEntityType(item: Record<string, any>): string | undefined;
  parseItem<T = any>(item: Record<string, any>): { type: string, data: T } | undefined;
  getEntityPrefix(entityName: string): string;
  generateTableDefinition(): DynamoDBTableDefinition;
}
/**
 * Single Table Entity Repository
 *
 * Provides CRUD operations for a specific entity type in a single table design.
 */
export declare class SingleTableRepository<T extends Record<string, any>> {
  constructor(manager: SingleTableManager, entityName: string, options: DynamoDBQueryBuilderOptions);
  create(data: T): Promise<T>;
  get(keyData: Partial<T>): Promise<T | undefined>;
  update(keyData: Partial<T>, updates: Partial<T>): Promise<T | undefined>;
  delete(keyData: Partial<T>): Promise<boolean>;
  query(): SingleTableQueryBuilder<T>;
  findAll(): Promise<T[]>;
}
/**
 * Query builder for single table entity queries
 */
export declare class SingleTableQueryBuilder<T> {
  constructor(manager: SingleTableManager, entityName: string, options: DynamoDBQueryBuilderOptions);
  wherePartitionKey(pkData: Record<string, any>): this;
  whereSortKey(skData: Record<string, any>): this;
  whereSortKeyBeginsWith(prefix: string): this;
  useIndex(indexName: string, pkData: Record<string, any>): this;
  where(attribute: string, operator: any, value?: any): this;
  select(...attributes: string[]): this;
  limit(count: number): this;
  descending(): this;
  execute(): Promise<T[]>;
  first(): Promise<T | undefined>;
}
