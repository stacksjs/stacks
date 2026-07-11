import type { BrowserConfig } from './types';
import type { Faker } from '@stacksjs/ts-faker';
// Export types for external use
export type { BrowserModelInstance, BrowserModelQueryBuilder };
/**
 * Configure the browser query client
 */
export declare function configureBrowser(config: Partial<BrowserConfig>): void;
/**
 * Get the current browser configuration
 */
export declare function getBrowserConfig(): BrowserConfig;
/**
 * Check if we're in a browser environment
 */
export declare function isBrowser(): boolean;
/**
 * Create a browser query builder for a table
 */
export declare function browserQuery<T = any>(table: string): BrowserQueryBuilder<T>;
/**
 * Shorthand for common tables - creates a factory function
 */
export declare function createBrowserDb<Tables extends Record<string, any>>(): {
  [K in keyof Tables]: () => BrowserQueryBuilder<Tables[K]>
};
/**
 * Create a browser model from a definition with full type inference
 *
 * @example
 * ```ts
 * const roles = ['admin', 'user', 'moderator'] as const
 *
 * const User = createBrowserModel({
 *   name: 'User',
 *   table: 'users',
 *   traits: {
 *     useTimestamps: true,
 *     useApi: { uri: 'users' }
 *   },
 *   attributes: {
 *     name: { fillable: true, factory: () => 'John' },
 *     email: { fillable: true, factory: () => 'john@example.com' },
 *     role: { fillable: true, factory: (): typeof roles[number] => 'user' },
 *   }
 * } as const)
 *
 * // Full type inference:
 * const user = await User.find(1)
 * user?.get('role') // type: 'admin' | 'user' | 'moderator'
 *
 * const roles = await User.pluck('role')
 * // type: ('admin' | 'user' | 'moderator')[]
 * ```
 */
export declare function createBrowserModel<const TDef extends BrowserModelDefinition>(definition: TDef): void;
/**
 * Auth helpers for browser
 * @defaultValue
 * ```ts
 * {
 *   login: (credentials?: { email: string, password: string }): Promise<BrowserAuthResponse> {
 *     const response) => Promise<unknown>,
 *   register: (data?: { name: string, email: string, password: string }): Promise<BrowserAuthResponse> {
 *     const response) => Promise<unknown>,
 *   logout: () => unknown,
 *   user: () => unknown,
 *   check: () => unknown
 * }
 * ```
 */
export declare const browserAuth: {
  /**
   * Login and store token
   */
  login: (credentials: { email: string, password: string }) => Promise<BrowserAuthResponse>;
  /**
   * Register a new user
   */
  register: (data: { name: string, email: string, password: string }) => Promise<BrowserAuthResponse>;
  /**
   * Logout and clear token
   */
  logout: () => Promise<void>;
  /**
   * Get current authenticated user
   */
  user: () => Promise<Record<string, unknown> | null>;
  /**
   * Check if user is authenticated
   */
  check: () => Promise<boolean>;
  /**
   * Get the current token
   */
  getToken: unknown
};
// Attribute definition with explicit type
export declare interface BrowserTypedAttribute<T = unknown> {
  type?: T
  order?: number
  fillable?: boolean
  unique?: boolean
  hidden?: boolean
  guarded?: boolean
  nullable?: boolean
  default?: InferType<T>
  validation?: {
    rule: unknown
    message?: Record<string, string>
  }
  factory?: (faker: Faker) => InferType<T>
}
// Base model definition for browser
export declare interface BrowserModelDefinition {
  readonly name: string
  readonly table: string
  readonly primaryKey?: string
  readonly traits?: {
    readonly useUuid?: boolean
    readonly useTimestamps?: boolean | object
    readonly timestampable?: boolean | object
    readonly useSoftDeletes?: boolean | object
    readonly softDeletable?: boolean | object
    readonly useApi?: boolean | {
      readonly uri?: string
      readonly routes?: readonly string[]
      readonly middleware?: readonly string[]
    }
    readonly useAuth?: boolean | object
    readonly billable?: boolean | object
    readonly useSearch?: boolean | object
    readonly useSeeder?: boolean | object
    readonly seedable?: boolean | object
    readonly authenticatable?: boolean | object
    readonly observe?: boolean | readonly string[]
    readonly likeable?: boolean | object
    readonly taggable?: boolean
    readonly categorizable?: boolean
    readonly commentables?: boolean
    readonly useActivityLog?: boolean | object
    readonly useSocials?: readonly string[]
  }
  readonly belongsTo?: readonly string[] | Readonly<Record<string, string>>
  readonly hasMany?: readonly string[] | Readonly<Record<string, string>>
  readonly hasOne?: readonly string[] | Readonly<Record<string, string>>
  readonly belongsToMany?: readonly (string | object)[] | Readonly<Record<string, string | object>>
  readonly hasOneThrough?: readonly (string | object)[] | Readonly<Record<string, string | object>>
  readonly hasManyThrough?: readonly (string | object)[] | Readonly<Record<string, string | object>>
  readonly attributes: {
    readonly [key: string]: BrowserTypedAttribute<unknown>
  }
}
declare interface WhereClause {
  column: string
  operator: WhereOperator
  value: unknown
  boolean: 'and' | 'or'
}
declare interface OrderByClause {
  column: string
  direction: 'asc' | 'desc'
}
declare interface QueryState {
  table: string
  wheres: WhereClause[]
  orderBy: OrderByClause[]
  limitValue?: number
  offsetValue?: number
  selectColumns: string[]
  withRelations: string[]
}
/**
 * Response shape returned by `browserAuth.login` / `browserAuth.register`.
 * Lifted to a named type so the generated `.d.ts` doesn't carry a nested
 * inline object literal in the return position — bun-plugin-dtsx has a
 * bug where `Promise<{ ... }>` in that position emits as `Promise<;`,
 * breaking downstream typecheck for any consumer that imports from
 * `bun-query-builder/browser`.
 */
export declare interface BrowserAuthResponse {
  user: Record<string, unknown>
  token: string
}
// Primitive type mappings
declare type PrimitiveTypeMap = {
  string: string
  number: number
  boolean: boolean
  date: Date
  json: Record<string, unknown>
}
// Infer the actual TS type from attribute type definition
declare type InferType<T> = T extends keyof PrimitiveTypeMap ? PrimitiveTypeMap[T] :
  T extends readonly (infer U)[] ? U :
  T extends (infer U)[] ? U :
  unknown;
// Extract attribute keys from definition
declare type BrowserAttributeKeys<TDef extends BrowserModelDefinition> = keyof TDef['attributes'] & string;
// Infer single attribute type
declare type InferBrowserAttributeType<TAttr> = TAttr extends { type: infer T } ? InferType<T> :
  TAttr extends { factory: (faker: unknown) => infer R } ? R :
  unknown;
// Build the full attributes type from definition. Columns declared
// `nullable: true` admit null — mirrors InferAttributes in type-inference.ts.
declare type InferBrowserModelAttributes<TDef extends BrowserModelDefinition> = {
  [K in BrowserAttributeKeys<TDef>]: TDef['attributes'][K] extends { nullable: true }
    ? InferBrowserAttributeType<TDef['attributes'][K]> | null
    : InferBrowserAttributeType<TDef['attributes'][K]>
}
// System fields added by traits
declare type BrowserSystemFields<TDef extends BrowserModelDefinition> = { id: number } &
  (TDef['traits'] extends { useUuid: true } ? { uuid: string } : {}) &
  (TDef['traits'] extends { useTimestamps: true } ? { created_at: string; updated_at: string | null } : {}) &
  (TDef['traits'] extends { timestampable: true | object } ? { created_at: string; updated_at: string | null } : {}) &
  (TDef['traits'] extends { useSoftDeletes: true } ? { deleted_at: string | null } : {}) &
  (TDef['traits'] extends { softDeletable: true | object } ? { deleted_at: string | null } : {}) &
  (TDef['traits'] extends { useAuth: true | object } ? { two_factor_secret: string | null; public_key: string | null } : {}) &
  (TDef['traits'] extends { billable: true | object } ? { stripe_id: string | null } : {});
// Complete model type
declare type BrowserModelAttributes<TDef extends BrowserModelDefinition> = InferBrowserModelAttributes<TDef> & BrowserSystemFields<TDef>;
// All valid column names
declare type BrowserColumnName<TDef extends BrowserModelDefinition> = | BrowserAttributeKeys<TDef>
  | 'id'
  | (TDef['traits'] extends { useUuid: true } ? 'uuid' : never)
  | (TDef['traits'] extends { useTimestamps: true } ? 'created_at' | 'updated_at' : never)
  | (TDef['traits'] extends { timestampable: true | object } ? 'created_at' | 'updated_at' : never)
  | (TDef['traits'] extends { useSoftDeletes: true } ? 'deleted_at' : never)
  | (TDef['traits'] extends { softDeletable: true | object } ? 'deleted_at' : never)
  | (TDef['traits'] extends { useAuth: true | object } ? 'two_factor_secret' | 'public_key' : never)
  | (TDef['traits'] extends { billable: true | object } ? 'stripe_id' : never);
// Hidden fields
declare type BrowserHiddenKeys<TDef extends BrowserModelDefinition> = {
  [K in BrowserAttributeKeys<TDef>]: TDef['attributes'][K] extends { hidden: true } ? K : never
}[BrowserAttributeKeys<TDef>];
// Fillable fields
declare type BrowserFillableKeys<TDef extends BrowserModelDefinition> = {
  [K in BrowserAttributeKeys<TDef>]: TDef['attributes'][K] extends { fillable: true } ? K : never
}[BrowserAttributeKeys<TDef>];
// Numeric columns — constrains aggregate-like column parameters
declare type BrowserNumericColumns<TDef extends BrowserModelDefinition> = {
  [K in BrowserAttributeKeys<TDef>]: TDef['attributes'][K] extends { type: 'number' } ? K : never
}[BrowserAttributeKeys<TDef>];
// Relation name inference for browser models (supports both array and object syntax)
declare type BrowserBelongsToNames<TDef> = (TDef extends { belongsTo: readonly (infer R)[] }
    ? R extends string ? Lowercase<R> : never : never)
  | (TDef extends { belongsTo: Readonly<Record<infer K, unknown>> }
    ? K extends string ? K : never : never);
declare type BrowserHasManyNames<TDef> = (TDef extends { hasMany: readonly (infer R)[] }
    ? R extends string ? Lowercase<R> : never : never)
  | (TDef extends { hasMany: Readonly<Record<infer K, unknown>> }
    ? K extends string ? K : never : never);
declare type BrowserHasOneNames<TDef> = (TDef extends { hasOne: readonly (infer R)[] }
    ? R extends string ? Lowercase<R> : never : never)
  | (TDef extends { hasOne: Readonly<Record<infer K, unknown>> }
    ? K extends string ? K : never : never);
declare type BrowserBelongsToManyNames<TDef> = (TDef extends { belongsToMany: readonly (infer R)[] }
    ? R extends string ? Lowercase<R> : R extends { model: infer M extends string } ? Lowercase<M> : never : never)
  | (TDef extends { belongsToMany: Readonly<Record<infer K, unknown>> }
    ? K extends string ? K : never : never);
declare type BrowserHasOneThroughNames<TDef> = (TDef extends { hasOneThrough: readonly (infer R)[] }
    ? R extends string ? Lowercase<R> : R extends { model: infer M extends string } ? Lowercase<M> : never : never)
  | (TDef extends { hasOneThrough: Readonly<Record<infer K, unknown>> }
    ? K extends string ? K : never : never);
declare type BrowserHasManyThroughNames<TDef> = (TDef extends { hasManyThrough: readonly (infer R)[] }
    ? R extends string ? Lowercase<R> : R extends { model: infer M extends string } ? Lowercase<M> : never : never)
  | (TDef extends { hasManyThrough: Readonly<Record<infer K, unknown>> }
    ? K extends string ? K : never : never);
declare type BrowserRelationNames<TDef> = | BrowserBelongsToNames<TDef>
  | BrowserHasManyNames<TDef>
  | BrowserHasOneNames<TDef>
  | BrowserBelongsToManyNames<TDef>
  | BrowserHasOneThroughNames<TDef>
  | BrowserHasManyThroughNames<TDef>;
// Types for query building
export type WhereOperator = '=' | '!=' | '<' | '>' | '<=' | '>=' | 'like' | 'not like' | 'in' | 'not in' | 'is' | 'is not';
/**
 * Custom error class for browser query errors
 */
export declare class BrowserQueryError extends Error {
  status: number;
  constructor(message: string, status: number);
}
/**
 * Browser Query Builder
 * Fluent API that builds queries and executes them via fetch
 */
export declare class BrowserQueryBuilder<T = any> {
  constructor(table: string);
  select(...columns: string[]): this;
  where(column: string, operatorOrValue: WhereOperator | any, value?: any): this;
  orWhere(column: string, operatorOrValue: WhereOperator | any, value?: any): this;
  andWhere(column: string, operatorOrValue: WhereOperator | any, value?: any): this;
  whereNull(column: string): this;
  whereNotNull(column: string): this;
  whereIn(column: string, values: any[]): this;
  whereNotIn(column: string, values: any[]): this;
  orderBy(column: string, direction?: 'asc' | 'desc'): this;
  orderByDesc(column: string): this;
  latest(column?: string): this;
  oldest(column?: string): this;
  limit(count: number): this;
  offset(count: number): this;
  skip(count: number): this;
  take(count: number): this;
  with(...relations: string[]): this;
  get(): Promise<T[]>;
  first(): Promise<T | null>;
  firstOrFail(): Promise<T>;
  find(id: number | string): Promise<T | null>;
  findOrFail(id: number | string): Promise<T>;
  count(): Promise<number>;
  exists(): Promise<boolean>;
  create(data: Partial<T>): Promise<T>;
  insert(data: Partial<T>): Promise<T>;
  update(id: number | string, data: Partial<T>): Promise<T>;
  delete(id: number | string): Promise<boolean>;
  destroy(id: number | string): Promise<boolean>;
  paginate(page?: number, perPage?: number): Promise<{
    data: T[]
    total: number
    page: number
    perPage: number
    lastPage: number
  }>;
  toState(): QueryState;
}
/**
 * Browser Model Instance - represents a single record with type-safe access
 */
declare class BrowserModelInstance<TDef extends BrowserModelDefinition, TSelected extends BrowserColumnName<TDef> = BrowserColumnName<TDef>> {
  constructor(definition: TDef, attributes?: Partial<BrowserModelAttributes<TDef>>);
  get<K extends TSelected>(key: K): K extends keyof BrowserModelAttributes<TDef> ? BrowserModelAttributes<TDef>[K] : never;
  set<K extends BrowserAttributeKeys<TDef>>(key: K, value: BrowserModelAttributes<TDef>[K]): void;
  get attributes(): Pick<BrowserModelAttributes<TDef>, TSelected & keyof BrowserModelAttributes<TDef>>;
  get id(): number;
  toJSON(): Omit<Pick<BrowserModelAttributes<TDef>, TSelected & keyof BrowserModelAttributes<TDef>>, BrowserHiddenKeys<TDef>>;
}
/**
 * Typed Browser Query Builder with precise type narrowing
 */
declare class BrowserModelQueryBuilder<TDef extends BrowserModelDefinition, TSelected extends BrowserColumnName<TDef> = BrowserColumnName<TDef>> {
  constructor(definition: TDef);
  where<K extends BrowserColumnName<TDef>>(column: K, operatorOrValue: WhereOperator | (K extends keyof BrowserModelAttributes<TDef> ? BrowserModelAttributes<TDef>[K] : unknown), value?: K extends keyof BrowserModelAttributes<TDef> ? BrowserModelAttributes<TDef>[K] : unknown): BrowserModelQueryBuilder<TDef, TSelected>;
  orWhere<K extends BrowserColumnName<TDef>>(column: K, operatorOrValue: WhereOperator | (K extends keyof BrowserModelAttributes<TDef> ? BrowserModelAttributes<TDef>[K] : unknown), value?: K extends keyof BrowserModelAttributes<TDef> ? BrowserModelAttributes<TDef>[K] : unknown): BrowserModelQueryBuilder<TDef, TSelected>;
  whereIn<K extends BrowserColumnName<TDef>>(column: K, values: (K extends keyof BrowserModelAttributes<TDef> ? BrowserModelAttributes<TDef>[K] : unknown)[]): BrowserModelQueryBuilder<TDef, TSelected>;
  whereNotIn<K extends BrowserColumnName<TDef>>(column: K, values: (K extends keyof BrowserModelAttributes<TDef> ? BrowserModelAttributes<TDef>[K] : unknown)[]): BrowserModelQueryBuilder<TDef, TSelected>;
  whereNull<K extends BrowserColumnName<TDef>>(column: K): BrowserModelQueryBuilder<TDef, TSelected>;
  whereNotNull<K extends BrowserColumnName<TDef>>(column: K): BrowserModelQueryBuilder<TDef, TSelected>;
  whereLike<K extends BrowserColumnName<TDef>>(column: K, pattern: string): BrowserModelQueryBuilder<TDef, TSelected>;
  orderBy<K extends BrowserColumnName<TDef>>(column: K, direction?: 'asc' | 'desc'): BrowserModelQueryBuilder<TDef, TSelected>;
  orderByDesc<K extends BrowserColumnName<TDef>>(column: K): BrowserModelQueryBuilder<TDef, TSelected>;
  orderByAsc<K extends BrowserColumnName<TDef>>(column: K): BrowserModelQueryBuilder<TDef, TSelected>;
  limit(count: number): BrowserModelQueryBuilder<TDef, TSelected>;
  take(count: number): BrowserModelQueryBuilder<TDef, TSelected>;
  offset(count: number): BrowserModelQueryBuilder<TDef, TSelected>;
  skip(count: number): BrowserModelQueryBuilder<TDef, TSelected>;
  select<K extends BrowserColumnName<TDef>>(...columns: K[]): BrowserModelQueryBuilder<TDef, K>;
  with<R extends BrowserRelationNames<TDef> extends never ? string : BrowserRelationNames<TDef>>(...relations: R[]): BrowserModelQueryBuilder<TDef, TSelected>;
  latest(column?: BrowserColumnName<TDef>): BrowserModelQueryBuilder<TDef, TSelected>;
  oldest(column?: BrowserColumnName<TDef>): BrowserModelQueryBuilder<TDef, TSelected>;
  get(): Promise<BrowserModelInstance<TDef, TSelected>[]>;
  first(): Promise<BrowserModelInstance<TDef, TSelected> | null>;
  firstOrFail(): Promise<BrowserModelInstance<TDef, TSelected>>;
  find(id: number | string): Promise<BrowserModelInstance<TDef, TSelected> | null>;
  findOrFail(id: number | string): Promise<BrowserModelInstance<TDef, TSelected>>;
  count(): Promise<number>;
  exists(): Promise<boolean>;
  pluck<K extends BrowserColumnName<TDef>>(column: K): Promise<(K extends keyof BrowserModelAttributes<TDef> ? BrowserModelAttributes<TDef>[K] : unknown)[]>;
  paginate(page?: number, perPage?: number): Promise<{
    data: BrowserModelInstance<TDef, TSelected>[]
    total: number
    page: number
    perPage: number
    lastPage: number
  }>;
}
// Export for convenience
export default browserQuery;
