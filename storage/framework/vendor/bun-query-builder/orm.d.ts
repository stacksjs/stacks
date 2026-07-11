import { Database, type SQLQueryBindings } from 'bun:sqlite';
import type { Faker } from '@stacksjs/ts-faker';
import type { RelationCardinality } from './type-inference';
import type { SupportedDialect } from './types';
export type {
  ModelInstance,
  ModelQueryBuilder,
  ModelAttributes,
  InferModelAttributes,
  InferAttributeType,
  SystemFields,
  ColumnName,
  AttributeKeys,
  FillableKeys,
  HiddenKeys,
};
/**
 * Extract an affected-row count from a Bun SQL driver result.
 *
 * Verified against live Postgres (Bun 1.3): a non-RETURNING `UPDATE`/`DELETE`
 * returns an empty array carrying `{ count: <affected>, affectedRows: null,
 * command: 'UPDATE' }`. So `count` must be checked BEFORE the `Array.length`
 * fallback (which would be 0) — see stacksjs/bun-query-builder#1032. MySQL
 * surfaces `affectedRows` instead.
 */
export declare function extractChanges(res: any): number;
/** Extract a generated primary key from a Bun SQL driver result. */
export declare function extractInsertId(res: any): number | bigint | null;
export declare function configureOrm(options: { database?: string | Database; verbose?: boolean }): void;
/**
 * Return the underlying `bun:sqlite` Database backing the model layer.
 *
 * Only meaningful when the active dialect is sqlite (or a sqlite Database was
 * supplied via `configureOrm`). For mysql/postgres there is no `Database`
 * object — use the async model API instead. Retained for backwards
 * compatibility with callers that reach for the raw sqlite handle (tests,
 * low-level table setup).
 */
export declare function getDatabase(): Database;
/** Create a model class from a definition with full type inference. */
export declare function createModel<const TDef extends ModelDefinition>(definition: TDef): ModelStatic<TDef>;
export declare function createTableFromModel(definition: ModelDefinition): Promise<void>;
export declare function seedModel(definition: ModelDefinition, count?: number, faker?: Record<string, unknown>): Promise<void>;
// Attribute definition with explicit type
export declare interface TypedAttribute<T = unknown> {
  type?: T
  order?: number
  fillable?: boolean
  unique?: boolean
  hidden?: boolean
  guarded?: boolean
  nullable?: boolean
  default?: InferType<T>
  foreignKey?: boolean | import('./schema').ForeignKeyConfig
  validation?: {
    rule: unknown
    message?: Record<string, string>
  }
  factory?: (faker: Faker) => InferType<T>
}
/** Structural type for model instances passed to lifecycle hooks. */
// eslint-disable-next-line ts/no-empty-object-type
export declare interface ModelHookInstance extends Record<string, unknown> {
  get(key: string): unknown
  getAttribute?(key: string): unknown
  getAttributes?(): Record<string, unknown>
  only?(keys: ReadonlyArray<string>): Record<string, unknown>
  except?(keys: ReadonlyArray<string>): Record<string, unknown>
  toArray?(): Record<string, unknown>
}
// Base model definition
export declare interface ModelDefinition {
  readonly name: string
  readonly table: string
  readonly primaryKey?: string
  readonly autoIncrement?: boolean
  readonly connection?: string
  readonly traits?: {
    readonly useUuid?: boolean
    readonly useTimestamps?: boolean | object
    readonly timestampable?: boolean | object
    readonly useSoftDeletes?: boolean | object
    readonly softDeletable?: boolean | object
    readonly useSearch?: boolean | {
      readonly displayable?: readonly string[]
      readonly searchable?: readonly string[]
      readonly sortable?: readonly string[]
      readonly filterable?: readonly string[]
    }
    readonly useSeeder?: boolean | {
      readonly count: number
    }
    readonly seedable?: boolean | {
      readonly count: number
    }
    readonly useApi?: boolean | {
      readonly uri?: string
      readonly routes?: readonly string[]
      readonly middleware?: readonly string[]
    }
    readonly useAuth?: boolean | {
      readonly usePasskey?: boolean
      readonly useTwoFactor?: boolean
    }
    readonly authenticatable?: boolean | object
    readonly observe?: boolean | readonly string[]
    readonly billable?: boolean
    readonly likeable?: boolean | object
    readonly taggable?: boolean
    readonly categorizable?: boolean
    readonly commentables?: boolean
    readonly commentable?: boolean
    readonly useActivityLog?: boolean | object
    readonly useSocials?: readonly string[]
  }
  readonly belongsTo?: readonly string[] | Readonly<Record<string, string>>
  readonly hasMany?: readonly string[] | Readonly<Record<string, string>>
  readonly hasOne?: readonly string[] | Readonly<Record<string, string>>
  readonly belongsToMany?: readonly (string | object)[] | Readonly<Record<string, string | object>>
  readonly hasOneThrough?: readonly (string | object)[] | Readonly<Record<string, string | object>>
  readonly hasManyThrough?: readonly (string | object)[] | Readonly<Record<string, string | object>>
  readonly morphOne?: string | object | Readonly<Record<string, string>>
  readonly morphMany?: readonly (string | object)[] | Readonly<Record<string, string | object>>
  readonly morphTo?: object
  readonly morphToMany?: readonly string[]
  readonly morphedByMany?: readonly string[]
  readonly attributes: {
    readonly [key: string]: TypedAttribute<unknown>
  }
  readonly get?: Record<string, (attributes: any) => unknown>
  readonly set?: Record<string, (attributes: any) => unknown>
  readonly scopes?: Record<string, (value: unknown) => unknown>
  readonly indexes?: readonly object[]
  readonly dashboard?: { readonly enabled?: boolean; readonly highlight?: boolean | number }
  readonly hooks?: {
    readonly beforeCreate?: (data: Record<string, unknown>) => void | Promise<void>
    readonly afterCreate?: (model: ModelHookInstance) => void | Promise<void>
    readonly beforeUpdate?: (model: ModelHookInstance, data: Record<string, unknown>) => void | Promise<void>
    readonly afterUpdate?: (model: ModelHookInstance) => void | Promise<void>
    readonly beforeDelete?: (model: ModelHookInstance) => void | Promise<void>
    readonly afterDelete?: (model: ModelHookInstance) => void | Promise<void>
  }
}
declare interface OrmExecutor {
  readonly dialect: SupportedDialect
  all: (sql: string, params: unknown[]) => Promise<Record<string, unknown>[]>
  get: (sql: string, params: unknown[]) => Promise<Record<string, unknown> | undefined>
  run: (sql: string, params: unknown[]) => Promise<RunResult>
  insert: (sql: string, params: unknown[], primaryKey: string) => Promise<RunResult>
  readonly sqliteDb?: Database
}
/**
 * Resolve a relation from its name and the parent model's definition.
 * Uses the model registry to find the related model's definition.
 *
 * Supports both syntaxes:
 *   Array syntax:  hasMany: ['Order']        → relation name is 'order', model is 'Order'
 *   Object syntax: hasMany: { orders: 'Order' } → relation name is 'orders', model is 'Order'
 */
/**
 * Resolved-relation shape returned by `resolveRelation`. Pivot fields are
 * populated only for `belongsToMany` relations.
 */
declare interface ResolvedRelation {
  type: 'hasMany' | 'hasOne' | 'belongsTo' | 'belongsToMany' | 'hasManyThrough' | 'hasOneThrough'
  relatedModelName: string
  relatedTable: string
  foreignKey: string
  localKey: string
  throughTable?: string
  throughForeignKey?: string
  throughLocalKey?: string
  targetForeignKey?: string
  pivotTable?: string
  pivotFkParent?: string
  pivotFkRelated?: string
  pivotColumns?: string[]
  pivotModelName?: string
  pivotTimestamps?: boolean
}
/**
 * Overloaded where/orWhere signatures for static model methods.
 * Object literals cannot have overloaded methods, so we express them as an interface
 * and intersect with the concrete model object via a type assertion.
 */
declare interface StaticWhereOverloads<TDef extends ModelDefinition> {
  where<K extends ColumnName<TDef>>(
    column: K,
    value: K extends keyof ModelAttributes<TDef> ? ModelAttributes<TDef>[K] : unknown
  ): ModelQueryBuilder<TDef>
  where<K extends ColumnName<TDef>>(
    column: K,
    operator: WhereOperator,
    value: K extends keyof ModelAttributes<TDef> ? ModelAttributes<TDef>[K] : unknown
  ): ModelQueryBuilder<TDef>
  orWhere<K extends ColumnName<TDef>>(
    column: K,
    value: K extends keyof ModelAttributes<TDef> ? ModelAttributes<TDef>[K] : unknown
  ): ModelQueryBuilder<TDef>
  orWhere<K extends ColumnName<TDef>>(
    column: K,
    operator: WhereOperator,
    value: K extends keyof ModelAttributes<TDef> ? ModelAttributes<TDef>[K] : unknown
  ): ModelQueryBuilder<TDef>
}
// Binding helper type for SQL queries
declare type Bindings = SQLQueryBindings[];
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
  T extends { validate: (value: infer U) => any } ? U :
  unknown;
// Extract attribute keys from definition
declare type AttributeKeys<TDef extends ModelDefinition> = keyof TDef['attributes'] & string;
// Infer single attribute type
declare type InferAttributeType<TAttr> = TAttr extends { type: infer T } ? InferType<T> :
  TAttr extends { factory: (faker: Faker) => infer R }
    ? [Exclude<R, null | undefined>] extends [never]
      ? TAttr extends { validation: { rule: infer V } } ? InferType<V> | Extract<R, null | undefined> : R
      : R
    : TAttr extends { validation: { rule: infer R } } ? InferType<R> :
  unknown;
// Build the full attributes type from definition. Columns declared
// `nullable: true` admit null — mirrors InferAttributes in type-inference.ts.
declare type InferModelAttributes<TDef extends ModelDefinition> = {
  [K in AttributeKeys<TDef>]: TDef['attributes'][K] extends { nullable: true }
    ? InferAttributeType<TDef['attributes'][K]> | null
    : InferAttributeType<TDef['attributes'][K]>
}
declare type SnakeCase<S extends string> = S extends `${infer C}${infer Rest}`
  ? C extends Lowercase<C>
    ? `${C}${SnakeCase<Rest>}`
    : `_${Lowercase<C>}${SnakeCase<Rest>}`
  : S;
declare type SnakeCaseAttributes<TDef extends ModelDefinition> = {
  [K in keyof InferModelAttributes<TDef> & string as SnakeCase<K>]: InferModelAttributes<TDef>[K]
}
// System fields added by traits. The primary-key column honors the model's
// declared `primaryKey` (default 'id') — a custom-pk model exposes THAT
// column, not a phantom 'id'. Mirrors InferAttributes in type-inference.ts.
declare type SystemFields<TDef extends ModelDefinition> = { [K in TDef extends { primaryKey: infer PK extends string } ? PK : 'id']: number } &
  (TDef['traits'] extends { useUuid: true } ? { uuid: string } : {}) &
  (TDef['traits'] extends { useTimestamps: true } ? { created_at: string; updated_at: string | null } : {}) &
  (TDef['traits'] extends { timestampable: true | object } ? { created_at: string; updated_at: string | null } : {}) &
  (TDef['traits'] extends { useSoftDeletes: true } ? { deleted_at: string | null } : {}) &
  (TDef['traits'] extends { softDeletable: true | object } ? { deleted_at: string | null } : {}) &
  (TDef['traits'] extends { useAuth: true | object } ? { two_factor_secret: string | null; public_key: string | null } : {}) &
  (TDef['traits'] extends { billable: true | object } ? { stripe_id: string | null } : {});
// Complete model type
declare type ModelAttributes<TDef extends ModelDefinition> = InferModelAttributes<TDef> & SnakeCaseAttributes<TDef> & SystemFields<TDef>;
// All valid column names
declare type ColumnName<TDef extends ModelDefinition> = | AttributeKeys<TDef>
  | SnakeCase<AttributeKeys<TDef>>
  | (TDef extends { primaryKey: infer PK extends string } ? PK : 'id')
  | (TDef['traits'] extends { useUuid: true } ? 'uuid' : never)
  | (TDef['traits'] extends { useTimestamps: true } ? 'created_at' | 'updated_at' : never)
  | (TDef['traits'] extends { timestampable: true | object } ? 'created_at' | 'updated_at' : never)
  | (TDef['traits'] extends { useSoftDeletes: true } ? 'deleted_at' : never)
  | (TDef['traits'] extends { softDeletable: true | object } ? 'deleted_at' : never)
  | (TDef['traits'] extends { useAuth: true | object } ? 'two_factor_secret' | 'public_key' : never)
  | (TDef['traits'] extends { billable: true | object } ? 'stripe_id' : never);
// Hidden fields
declare type HiddenKeys<TDef extends ModelDefinition> = {
  [K in AttributeKeys<TDef>]: TDef['attributes'][K] extends { hidden: true } ? K : never
}[AttributeKeys<TDef>];
// Fillable fields
declare type FillableKeys<TDef extends ModelDefinition> = {
  [K in AttributeKeys<TDef>]: TDef['attributes'][K] extends { fillable: true } ? K : never
}[AttributeKeys<TDef>];
declare type FillableAttributes<TDef extends ModelDefinition> = Partial<Pick<
  ModelAttributes<TDef>,
  FillableKeys<TDef> | SnakeCase<FillableKeys<TDef>>
>>;
// Numeric attribute columns — constrains aggregate methods (sum, avg, etc.)
declare type NumericColumns<TDef extends ModelDefinition> = {
  [K in AttributeKeys<TDef>]: TDef['attributes'][K] extends { type: 'number' } ? K : never
}[AttributeKeys<TDef>];
/**
 * Relation names of one relation declaration. Array form lowercases the
 * (unwrapped) model name; record form uses the keys. The array case MUST be
 * checked first: a tuple also structurally matches `Readonly<Record<...>>`
 * and would otherwise leak its own keys ('length', indices, ...) into the
 * relation-name union.
 */
declare type RelationKeyOf<V> = V extends readonly (infer E)[]
    ? E extends string ? Lowercase<E>
      : E extends { model: infer M extends string } ? Lowercase<M>
        : never
    : V extends Readonly<Record<infer K, unknown>>
      ? K & string
      : never;
declare type InferBelongsToNames<TDef> = TDef extends { belongsTo: infer V } ? RelationKeyOf<V> : never;
declare type InferHasManyNames<TDef> = TDef extends { hasMany: infer V } ? RelationKeyOf<V> : never;
declare type InferHasOneNames<TDef> = TDef extends { hasOne: infer V } ? RelationKeyOf<V> : never;
declare type InferBelongsToManyNames<TDef> = TDef extends { belongsToMany: infer V } ? RelationKeyOf<V> : never;
declare type InferHasOneThroughNames<TDef> = TDef extends { hasOneThrough: infer V } ? RelationKeyOf<V> : never;
declare type InferHasManyThroughNames<TDef> = TDef extends { hasManyThrough: infer V } ? RelationKeyOf<V> : never;
export type InferRelationNames<TDef> = | InferBelongsToNames<TDef>
  | InferHasManyNames<TDef>
  | InferHasOneNames<TDef>
  | InferBelongsToManyNames<TDef>
  | InferHasOneThroughNames<TDef>
  | InferHasManyThroughNames<TDef>;
/**
 * Cardinality-aware value of a loaded relation as returned by
 * `ModelInstance.getRelation()`. Relations declared as to-many (hasMany,
 * belongsToMany, hasManyThrough) yield arrays; to-one relations (hasOne,
 * belongsTo, hasOneThrough) yield a single instance or null. `undefined`
 * means the relation was not eager-loaded.
 */
declare type LoadedRelationValue<TDef, R extends string> = 'one' extends RelationCardinality<TDef, R>
    ? ModelInstance<any, any> | null | undefined
    : 'many' extends RelationCardinality<TDef, R>
      ? ModelInstance<any, any>[] | undefined
      : ModelInstance<any, any>[] | ModelInstance<any, any> | null | undefined;
/** A hydrated model instance with its selected columns exposed as proxy properties. */
export type ModelRecord<TDef extends ModelDefinition, TSelected extends ColumnName<TDef> = ColumnName<TDef>,> = ModelInstance<TDef, TSelected>
  & Pick<ModelAttributes<TDef>, Extract<TSelected, keyof ModelAttributes<TDef>>>
  & { [R in InferRelationNames<TDef>]?: LoadedRelationValue<TDef, R> }
declare type WhereOperator = '=' | '!=' | '<' | '>' | '<=' | '>=' | 'like' | 'not like' | 'in' | 'not in';
// --- Dialect-aware execution layer -------------------------------------------
//
// The model API historically ran every query through a hardcoded in-memory
// `bun:sqlite` Database, so projects configured for MySQL/Postgres had their
// model calls silently routed to a fresh, empty SQLite database — every query
// returned "no such table" (stacksjs/bun-query-builder#1021).
//
// All model queries now go through an `OrmExecutor` chosen from the configured
// dialect. SQLite keeps its synchronous `bun:sqlite` engine (wrapped in
// resolved Promises); MySQL/Postgres route through Bun's async `SQL` driver via
// the shared `getOrCreateBunSql()` connection — the same path the direct
// `selectFrom(...)` builder already uses. Because the network drivers are
// async-only, every model read/write method now returns a Promise.
declare type RunResult = { changes: number, lastInsertId: number | bigint | null }
/** The fully inferred static model API produced from a model definition. */
export type ModelStatic<TDef extends ModelDefinition> = StaticWhereOverloads<TDef> & {
  query: () => ModelQueryBuilder<TDef>
  whereIn: <K extends ColumnName<TDef>>(column: K, values: (K extends keyof ModelAttributes<TDef> ? ModelAttributes<TDef>[K] : unknown)[]) => ModelQueryBuilder<TDef>
  whereNotIn: <K extends ColumnName<TDef>>(column: K, values: (K extends keyof ModelAttributes<TDef> ? ModelAttributes<TDef>[K] : unknown)[]) => ModelQueryBuilder<TDef>
  whereNull: <K extends ColumnName<TDef>>(column: K) => ModelQueryBuilder<TDef>
  whereNotNull: <K extends ColumnName<TDef>>(column: K) => ModelQueryBuilder<TDef>
  whereLike: <K extends ColumnName<TDef>>(column: K, pattern: string) => ModelQueryBuilder<TDef>
  orderBy: <K extends ColumnName<TDef>>(column: K, direction?: 'asc' | 'desc') => ModelQueryBuilder<TDef>
  orderByDesc: <K extends ColumnName<TDef>>(column: K) => ModelQueryBuilder<TDef>
  select: <K extends ColumnName<TDef>>(...columns: K[]) => ModelQueryBuilder<TDef, K>
  with: <R extends InferRelationNames<TDef>>(...relations: R[]) => ModelQueryBuilder<TDef>
  limit: (count: number) => ModelQueryBuilder<TDef>
  take: (count: number) => ModelQueryBuilder<TDef>
  skip: (count: number) => ModelQueryBuilder<TDef>
  withTrashed: () => ModelQueryBuilder<TDef>
  onlyTrashed: () => ModelQueryBuilder<TDef>
  find: (id: number | string) => Promise<ModelRecord<TDef> | undefined>
  findOrFail: (id: number | string) => Promise<ModelRecord<TDef>>
  findMany: (ids: (number | string)[]) => Promise<ModelRecord<TDef>[]>
  all: () => Promise<ModelRecord<TDef>[]>
  first: () => Promise<ModelRecord<TDef> | undefined>
  firstOrFail: () => Promise<ModelRecord<TDef>>
  last: () => Promise<ModelRecord<TDef> | undefined>
  count: () => Promise<number>
  exists: () => Promise<boolean>
  doesntExist: () => Promise<boolean>
  paginate: (page?: number, perPage?: number) => Promise<{
    data: ModelRecord<TDef>[]
    total: number
    page: number
    perPage: number
    lastPage: number
    hasMorePages: boolean
    isEmpty: boolean
    from: number | null
    to: number | null
  }>
  whereBetween: <K extends ColumnName<TDef>>(column: K, range: [min: K extends keyof ModelAttributes<TDef> ? ModelAttributes<TDef>[K] : unknown, max: K extends keyof ModelAttributes<TDef> ? ModelAttributes<TDef>[K] : unknown]) => ModelQueryBuilder<TDef>
  whereNotBetween: <K extends ColumnName<TDef>>(column: K, range: [min: K extends keyof ModelAttributes<TDef> ? ModelAttributes<TDef>[K] : unknown, max: K extends keyof ModelAttributes<TDef> ? ModelAttributes<TDef>[K] : unknown]) => ModelQueryBuilder<TDef>
  create: (data: FillableAttributes<TDef>) => Promise<ModelRecord<TDef>>
  createMany: (items: FillableAttributes<TDef>[]) => Promise<ModelRecord<TDef>[]>
  updateOrCreate: (search: Partial<ModelAttributes<TDef>>, data: FillableAttributes<TDef>) => Promise<ModelRecord<TDef>>
  firstOrCreate: (search: Partial<ModelAttributes<TDef>>, data?: FillableAttributes<TDef>) => Promise<ModelRecord<TDef>>
  destroy: (id: number | string) => Promise<boolean>
  remove: (id: number | string) => Promise<boolean>
  truncate: () => Promise<void>
  getDefinition: () => TDef
  getTable: () => string
  make: (data?: Partial<ModelAttributes<TDef>>) => ModelInstance<TDef>
  latest: (column?: ColumnName<TDef>) => ModelQueryBuilder<TDef>
  oldest: (column?: ColumnName<TDef>) => ModelQueryBuilder<TDef>
  max: <K extends ColumnName<TDef>>(column: K) => Promise<(K extends keyof ModelAttributes<TDef> ? ModelAttributes<TDef>[K] : unknown) | null>
  min: <K extends ColumnName<TDef>>(column: K) => Promise<(K extends keyof ModelAttributes<TDef> ? ModelAttributes<TDef>[K] : unknown) | null>
  avg: <K extends NumericColumns<TDef>>(column: K) => Promise<number>
  sum: <K extends NumericColumns<TDef>>(column: K) => Promise<number>
  pluck: <K extends ColumnName<TDef>>(column: K) => Promise<(K extends keyof ModelAttributes<TDef> ? ModelAttributes<TDef>[K] : unknown)[]>
} & {
  [K in AttributeKeys<TDef> as `where${Capitalize<K>}`]: (value: K extends keyof ModelAttributes<TDef> ? ModelAttributes<TDef>[K] : unknown) => ModelQueryBuilder<TDef>
}
declare class SqliteExecutor implements OrmExecutor {
  readonly dialect: unknown;
  public readonly sqliteDb: Database;
  constructor(sqliteDb: Database);
  all(sql: string, params: unknown[]): Promise<Record<string, unknown>[]>;
  get(sql: string, params: unknown[]): Promise<Record<string, unknown> | undefined>;
  run(sql: string, params: unknown[]): Promise<RunResult>;
  insert(sql: string, params: unknown[]): Promise<RunResult>;
}
declare class DriverExecutor implements OrmExecutor {
  public readonly dialect: SupportedDialect;
  constructor(dialect: SupportedDialect);
  all(sql: string, params: unknown[]): Promise<Record<string, unknown>[]>;
  get(sql: string, params: unknown[]): Promise<Record<string, unknown> | undefined>;
  run(sql: string, params: unknown[]): Promise<RunResult>;
  insert(sql: string, params: unknown[], primaryKey: string): Promise<RunResult>;
}
/**
 * Model instance - represents a single database record
 */
declare class ModelInstance<TDef extends ModelDefinition, TSelected extends ColumnName<TDef> = ColumnName<TDef>> {
  constructor(definition: TDef, attributes?: Partial<ModelAttributes<TDef>>);
  get<K extends TSelected>(key: K): K extends keyof ModelAttributes<TDef> ? ModelAttributes<TDef>[K] : never;
  getAttribute<K extends TSelected>(key: K): K extends keyof ModelAttributes<TDef> ? ModelAttributes<TDef>[K] : unknown;
  getAttributes(): Pick<ModelAttributes<TDef>, TSelected & keyof ModelAttributes<TDef>>;
  set<K extends ColumnName<TDef>>(key: K, value: K extends keyof ModelAttributes<TDef> ? ModelAttributes<TDef>[K] : unknown): void;
  only<K extends TSelected>(keys: ReadonlyArray<K>): Pick<ModelAttributes<TDef>, K & keyof ModelAttributes<TDef>>;
  except<K extends TSelected>(keys: ReadonlyArray<K>): Omit<Pick<ModelAttributes<TDef>, TSelected & keyof ModelAttributes<TDef>>, K>;
  getRelation<R extends InferRelationNames<TDef> & string>(name: R): LoadedRelationValue<TDef, R>;
  setRelation(name: string, data: ModelInstance<any, any>[] | ModelInstance<any, any> | null): void;
  getLoadedRelations(): Record<string, ModelInstance<any, any>[] | ModelInstance<any, any> | null>;
  get attributes(): Pick<ModelAttributes<TDef>, TSelected & keyof ModelAttributes<TDef>>;
  get id(): number;
  isDirty(column?: ColumnName<TDef>): boolean;
  isClean(column?: ColumnName<TDef>): boolean;
  getOriginal<K extends ColumnName<TDef>>(column: K): K extends keyof ModelAttributes<TDef> ? ModelAttributes<TDef>[K] : unknown;
  getChanges(): Partial<InferModelAttributes<TDef>>;
  fill(data: FillableAttributes<TDef>): this;
  forceFill(data: Partial<InferModelAttributes<TDef>>): this;
  save(): Promise<this>;
  update(data: FillableAttributes<TDef>): Promise<this>;
  fresh(): Promise<ModelInstance<TDef, TSelected> | null>;
  delete(): Promise<boolean>;
  restore(): Promise<this>;
  trashed(): boolean;
  refresh(): Promise<this | null>;
  replicate(): ModelInstance<TDef, TSelected>;
  toArray(): Record<string, unknown>;
  toJSON(): Omit<Pick<ModelAttributes<TDef>, TSelected & keyof ModelAttributes<TDef>>, HiddenKeys<TDef>>;
}
/**
 * # `BelongsToManyRelationBuilder`
 *
 * Per-instance relation builder returned by callable accessors on a
 * `ModelInstance`. Combines a query side (read pivot-joined related rows,
 * filter by pivot columns) with a mutation side (attach/detach/sync/
 * updateExistingPivot/toggle).
 *
 * Constructed lazily — `coach.athletes` returns a function that, when called,
 * returns a fresh builder; chained methods return `this` so a single builder
 * is reused per call.
 */
export declare class BelongsToManyRelationBuilder<TRel extends ModelDefinition> {
  constructor(parent: ModelInstance<any, any>, parentDef: ModelDefinition, resolved: ResolvedRelation, relatedDef: TRel);
  where(column: string, opOrValue: unknown, value?: unknown): this;
  wherePivot(column: string, opOrValue: unknown, value?: unknown): this;
  wherePivotIn(column: string, values: unknown[]): this;
  wherePivotNotIn(column: string, values: unknown[]): this;
  wherePivotNull(column: string): this;
  wherePivotNotNull(column: string): this;
  orderBy(column: string, direction?: 'asc' | 'desc'): this;
  limit(n: number): this;
  offset(n: number): this;
  get(): Promise<ModelInstance<TRel, any>[]>;
  first(): Promise<ModelInstance<TRel, any> | undefined>;
  count(): Promise<number>;
  exists(): Promise<boolean>;
  attach(idOrIds: unknown | unknown[], extras?: Record<string, unknown>): Promise<number>;
  detach(idOrIds?: unknown | unknown[]): Promise<number>;
  updateExistingPivot(relatedId: unknown, extras: Record<string, unknown>): Promise<number>;
  sync(items: Array<unknown | { id: unknown, [key: string]: unknown }>): Promise<{ attached: unknown[], detached: unknown[], updated: unknown[] }>;
  toggle(idOrIds: unknown | unknown[]): Promise<{ attached: unknown[], detached: unknown[] }>;
}
/**
 * Query builder with precise type narrowing
 */
declare class ModelQueryBuilder<TDef extends ModelDefinition, TSelected extends ColumnName<TDef> = ColumnName<TDef>> {
  constructor(definition: TDef);
  withTrashed(): ModelQueryBuilder<TDef, TSelected>;
  onlyTrashed(): ModelQueryBuilder<TDef, TSelected>;
  where<K extends ColumnName<TDef>>(column: K, value: K extends keyof ModelAttributes<TDef> ? ModelAttributes<TDef>[K] : unknown): ModelQueryBuilder<TDef, TSelected>;
  where<K extends ColumnName<TDef>>(column: K, operator: WhereOperator, value: K extends keyof ModelAttributes<TDef> ? ModelAttributes<TDef>[K] : unknown): ModelQueryBuilder<TDef, TSelected>;
  where<K extends ColumnName<TDef>>(column: K, operatorOrValue: WhereOperator | unknown, value?: unknown): ModelQueryBuilder<TDef, TSelected>;
  orWhere<K extends ColumnName<TDef>>(column: K, value: K extends keyof ModelAttributes<TDef> ? ModelAttributes<TDef>[K] : unknown): ModelQueryBuilder<TDef, TSelected>;
  orWhere<K extends ColumnName<TDef>>(column: K, operator: WhereOperator, value: K extends keyof ModelAttributes<TDef> ? ModelAttributes<TDef>[K] : unknown): ModelQueryBuilder<TDef, TSelected>;
  orWhere<K extends ColumnName<TDef>>(column: K, operatorOrValue: WhereOperator | unknown, value?: unknown): ModelQueryBuilder<TDef, TSelected>;
  whereIn<K extends ColumnName<TDef>>(column: K, values: (K extends keyof ModelAttributes<TDef> ? ModelAttributes<TDef>[K] : unknown)[]): ModelQueryBuilder<TDef, TSelected>;
  orWhereIn<K extends ColumnName<TDef>>(column: K, values: (K extends keyof ModelAttributes<TDef> ? ModelAttributes<TDef>[K] : unknown)[]): ModelQueryBuilder<TDef, TSelected>;
  whereNotIn<K extends ColumnName<TDef>>(column: K, values: (K extends keyof ModelAttributes<TDef> ? ModelAttributes<TDef>[K] : unknown)[]): ModelQueryBuilder<TDef, TSelected>;
  orWhereNotIn<K extends ColumnName<TDef>>(column: K, values: (K extends keyof ModelAttributes<TDef> ? ModelAttributes<TDef>[K] : unknown)[]): ModelQueryBuilder<TDef, TSelected>;
  whereNull<K extends ColumnName<TDef>>(column: K): ModelQueryBuilder<TDef, TSelected>;
  orWhereNull<K extends ColumnName<TDef>>(column: K): ModelQueryBuilder<TDef, TSelected>;
  whereNotNull<K extends ColumnName<TDef>>(column: K): ModelQueryBuilder<TDef, TSelected>;
  orWhereNotNull<K extends ColumnName<TDef>>(column: K): ModelQueryBuilder<TDef, TSelected>;
  whereLike<K extends ColumnName<TDef>>(column: K, pattern: string): ModelQueryBuilder<TDef, TSelected>;
  orWhereLike<K extends ColumnName<TDef>>(column: K, pattern: string): ModelQueryBuilder<TDef, TSelected>;
  whereNotLike<K extends ColumnName<TDef>>(column: K, pattern: string): ModelQueryBuilder<TDef, TSelected>;
  orWhereNotLike<K extends ColumnName<TDef>>(column: K, pattern: string): ModelQueryBuilder<TDef, TSelected>;
  whereRaw(fragment: string, ...params: unknown[]): ModelQueryBuilder<TDef, TSelected>;
  orWhereRaw(fragment: string, ...params: unknown[]): ModelQueryBuilder<TDef, TSelected>;
  whereGroup(callback: (builder: ModelQueryBuilder<TDef, TSelected>) => unknown): ModelQueryBuilder<TDef, TSelected>;
  orWhereGroup(callback: (builder: ModelQueryBuilder<TDef, TSelected>) => unknown): ModelQueryBuilder<TDef, TSelected>;
  whereBetween<K extends ColumnName<TDef>>(column: K, range: [min: K extends keyof ModelAttributes<TDef> ? ModelAttributes<TDef>[K] : unknown, max: K extends keyof ModelAttributes<TDef> ? ModelAttributes<TDef>[K] : unknown]): ModelQueryBuilder<TDef, TSelected>;
  whereNotBetween<K extends ColumnName<TDef>>(column: K, range: [min: K extends keyof ModelAttributes<TDef> ? ModelAttributes<TDef>[K] : unknown, max: K extends keyof ModelAttributes<TDef> ? ModelAttributes<TDef>[K] : unknown]): ModelQueryBuilder<TDef, TSelected>;
  when(condition: unknown, callback: (builder: ModelQueryBuilder<TDef, TSelected>) => ModelQueryBuilder<TDef, TSelected>): ModelQueryBuilder<TDef, TSelected>;
  orderBy<K extends ColumnName<TDef>>(column: K, direction?: 'asc' | 'desc'): ModelQueryBuilder<TDef, TSelected>;
  orderByDesc<K extends ColumnName<TDef>>(column: K): ModelQueryBuilder<TDef, TSelected>;
  orderByAsc<K extends ColumnName<TDef>>(column: K): ModelQueryBuilder<TDef, TSelected>;
  limit(count: number): ModelQueryBuilder<TDef, TSelected>;
  take(count: number): ModelQueryBuilder<TDef, TSelected>;
  offset(count: number): ModelQueryBuilder<TDef, TSelected>;
  skip(count: number): ModelQueryBuilder<TDef, TSelected>;
  select<K extends ColumnName<TDef>>(...columns: K[]): ModelQueryBuilder<TDef, K>;
  with<R extends InferRelationNames<TDef>>(...relations: R[]): ModelQueryBuilder<TDef, TSelected>;
  getWithRelations(): string[];
  toSql(): { sql: string; params: unknown[] };
  get(): Promise<ModelRecord<TDef, TSelected>[]>;
  first(): Promise<ModelRecord<TDef, TSelected> | undefined>;
  firstOrFail(): Promise<ModelRecord<TDef, TSelected>>;
  last(): Promise<ModelRecord<TDef, TSelected> | undefined>;
  count(): Promise<number>;
  exists(): Promise<boolean>;
  doesntExist(): Promise<boolean>;
  sole(): Promise<ModelRecord<TDef, TSelected>>;
  increment<K extends NumericColumns<TDef>>(column: K, amount?: number): Promise<number>;
  decrement<K extends NumericColumns<TDef>>(column: K, amount?: number): Promise<number>;
  chunk(size: number, callback: (items: ModelInstance<TDef, TSelected>[]) => void | false | Promise<void | false>): Promise<void>;
  paginate(page?: number, perPage?: number): Promise<{
    data: ModelInstance<TDef, TSelected>[]
    total: number
    page: number
    perPage: number
    lastPage: number
    hasMorePages: boolean
    isEmpty: boolean
    from: number | null
    to: number | null
  }>;
  pluck<K extends ColumnName<TDef>>(column: K): Promise<(K extends keyof ModelAttributes<TDef> ? ModelAttributes<TDef>[K] : unknown)[]>;
  max<K extends ColumnName<TDef>>(column: K): Promise<(K extends keyof ModelAttributes<TDef> ? ModelAttributes<TDef>[K] : number) | null>;
  min<K extends ColumnName<TDef>>(column: K): Promise<(K extends keyof ModelAttributes<TDef> ? ModelAttributes<TDef>[K] : number) | null>;
  avg<K extends NumericColumns<TDef>>(column: K): Promise<number>;
  sum<K extends NumericColumns<TDef>>(column: K): Promise<number>;
  delete(): Promise<number>;
  update(data: Partial<Pick<InferModelAttributes<TDef>, FillableKeys<TDef>>>): Promise<number>;
}
