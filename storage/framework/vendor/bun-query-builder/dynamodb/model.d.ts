import { DynamoDBClient, createClient } from './client';
/**
 * Configure the global DynamoDB connection for all models
 */
export declare function configureModels(config: ModelConfig): void;
// ============================================================================
// Types
// ============================================================================
export declare interface ModelConfig {
  region?: string
  endpoint?: string
  credentials?: {
    accessKeyId: string
    secretAccessKey: string
    sessionToken?: string
  }
}
export declare interface ModelQueryBuilder<T extends Model> {
  where(attribute: string, value: any): ModelQueryBuilder<T>
  where(attribute: string, operator: string, value: any): ModelQueryBuilder<T>
  whereIn(attribute: string, values: any[]): ModelQueryBuilder<T>
  whereBetween(attribute: string, start: any, end: any): ModelQueryBuilder<T>
  whereBeginsWith(attribute: string, prefix: string): ModelQueryBuilder<T>
  whereExists(attribute: string): ModelQueryBuilder<T>
  whereNotExists(attribute: string): ModelQueryBuilder<T>
  orderBy(direction: 'asc' | 'desc'): ModelQueryBuilder<T>
  limit(count: number): ModelQueryBuilder<T>
  select(...attributes: string[]): ModelQueryBuilder<T>
  index(indexName: string): ModelQueryBuilder<T>
  consistentRead(): ModelQueryBuilder<T>
  startFrom(key: Record<string, any>): ModelQueryBuilder<T>
  get(): Promise<T[]>
  first(): Promise<T | null>
  count(): Promise<number>
  paginate(pageSize: number, lastKey?: Record<string, any>): Promise<{ items: T[], lastKey?: Record<string, any> }>
}
/**
 * Abstract base class for DynamoDB models
 *
 * Extend this class to create type-safe DynamoDB entities with
 * Laravel Eloquent-like CRUD operations.
 */
export declare abstract class Model {
  static tableName: string;
  static pkAttribute: string;
  static skAttribute: string;
  static pkPrefix: string;
  static skPrefix: string;
  static entityTypeAttribute: string;
  static keyDelimiter: string;
  static primaryKey: string;
  static timestamps: boolean;
  static createdAtField: string;
  static updatedAtField: string;
  protected _attributes: Record<string, any>;
  protected _original: Record<string, any>;
  protected _exists: boolean;
  constructor(attributes?: Record<string, any>);
  static query<T extends Model>(this: new (...args: any[]) => T): ModelQueryBuilderImpl<T>;
  static find<T extends Model>(this: new (...args: any[]) => T, id: string): Promise<T | null>;
  static findOrFail<T extends Model>(this: new (...args: any[]) => T, id: string): Promise<T>;
  static all<T extends Model>(this: new (...args: any[]) => T): Promise<T[]>;
  static create<T extends Model>(this: new (...args: any[]) => T, attributes: Record<string, any>): Promise<T>;
  static updateOrCreate<T extends Model>(this: new (...args: any[]) => T, attributes: Record<string, any>, values: Record<string, any>): Promise<T>;
  static where<T extends Model>(this: new (...args: any[]) => T, attribute: string, operatorOrValue: any, value?: any): ModelQueryBuilderImpl<T>;
  static wherePk<T extends Model>(this: new (...args: any[]) => T, value: string): ModelQueryBuilderImpl<T>;
  getKey(): string;
  getAttribute(key: string): any;
  setAttribute(key: string, value: any): this;
  getAttributes(): Record<string, any>;
  isDirty(attribute?: string): boolean;
  getDirty(): Record<string, any>;
  save(): Promise<this>;
  update(values: Record<string, any>): Promise<this>;
  delete(): Promise<boolean>;
  refresh(): Promise<this>;
  toObject(): Record<string, any>;
  toJSON(): Record<string, any>;
}
// ============================================================================
// Query Builder Implementation
// ============================================================================
declare class ModelQueryBuilderImpl<T extends Model> implements ModelQueryBuilder<T> {
  constructor(ModelClass: typeof Model);
  wherePk(value: string): this;
  where(attribute: string, operatorOrValue: any, value?: any): this;
  whereIn(attribute: string, values: any[]): this;
  whereBetween(attribute: string, start: any, end: any): this;
  whereBeginsWith(attribute: string, prefix: string): this;
  whereExists(attribute: string): this;
  whereNotExists(attribute: string): this;
  orderBy(direction: 'asc' | 'desc'): this;
  limit(count: number): this;
  select(...attributes: string[]): this;
  index(indexName: string): this;
  consistentRead(): this;
  startFrom(key: Record<string, any>): this;
  get(): Promise<T[]>;
  first(): Promise<T | null>;
  count(): Promise<number>;
  paginate(pageSize: number, lastKey?: Record<string, any>): Promise<{ items: T[], lastKey?: Record<string, any> }>;
}
// ============================================================================
// Re-exports for convenience
// ============================================================================
export { DynamoDBClient, createClient } from './client';
