import type { Faker } from '@stacksjs/ts-faker';
import type { ValidationType } from './schema';
// Local mirror of the runtime PivotColumnAttribute shape (kept structural so we
// don't take a hard dep on schema.ts at the type-inference layer).
declare interface InferablePivotColumnAttribute {
  default?: unknown
  nullable?: boolean
  validation?: { rule: ValidationType; message?: Record<string, string> }
}
/** Minimal attribute definition for type inference */
declare interface InferableAttribute<T = unknown> {
  type?: T
  fillable?: boolean
  unique?: boolean
  hidden?: boolean
  guarded?: boolean
  nullable?: boolean
  default?: InferType<T>
  factory?: (faker: Faker) => InferType<T>
}
/** Minimal model definition shape for type inference */
declare interface InferableModelDefinition {
  readonly name: string
  readonly table: string
  readonly primaryKey?: string
  readonly traits?: {
    readonly useUuid?: boolean
    readonly useTimestamps?: boolean | object
    readonly timestampable?: boolean | object
    readonly useSoftDeletes?: boolean | object
    readonly softDeletable?: boolean | object
    readonly useAuth?: boolean | object
    readonly billable?: boolean | object
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
    readonly [key: string]: InferableAttribute<unknown>
  }
}
// ============================================================================
// Primitive type mappings (shared with orm.ts and browser.ts)
// ============================================================================
declare type PrimitiveTypeMap = {
  string: string
  number: number
  boolean: boolean
  date: Date
  json: Record<string, unknown>
}
declare type InferType<T> = T extends keyof PrimitiveTypeMap ? PrimitiveTypeMap[T] :
    T extends readonly (infer U)[] ? U :
      T extends (infer U)[] ? U :
        unknown;
/**
 * Resolves TModel to the underlying definition type.
 * Handles both raw definitions and wrapped models (from defineModel / createModel / createBrowserModel)
 * that expose a `getDefinition()` method or `definition` property.
 */
declare type ResolveDefinition<TModel> = TModel extends { getDefinition: () => infer D } ? D :
    TModel extends { definition: infer D } ? D :
      TModel extends InferableModelDefinition ? TModel :
        never;
/** Extract user-defined attribute keys from a model definition */
declare type DefinitionAttributeKeys<TDef extends InferableModelDefinition> = keyof TDef['attributes'] & string;
// ============================================================================
// Single attribute type inference
// ============================================================================
declare type InferSingleAttributeType<TAttr> = TAttr extends { type: infer T } ? InferType<T> :
    TAttr extends { factory: (faker: Faker) => infer R } ? R :
      unknown;
/**
 * Infer the full attributes type from a model definition or wrapped model.
 * Includes user-defined attributes plus system fields (id, uuid, timestamps, soft deletes).
 *
 * @example
 * ```ts
 * type UserAttrs = InferAttributes<typeof UserModel>
 * // { name: string; email: string; age: number } & { id: number; created_at: string; updated_at: string }
 * ```
 */
export type InferAttributes<TModel> = ResolveDefinition<TModel> extends infer TDef extends InferableModelDefinition
    ? {
        [K in DefinitionAttributeKeys<TDef>]: TDef['attributes'][K] extends { nullable: true }
          ? InferSingleAttributeType<TDef['attributes'][K]> | null
          : InferSingleAttributeType<TDef['attributes'][K]>
      } & { [K in TDef extends { primaryKey: infer PK extends string } ? PK : 'id']: number }
      & (TDef['traits'] extends { useUuid: true } ? { uuid: string } : {})
      & (TDef['traits'] extends { useTimestamps: true } ? { created_at: string; updated_at: string | null } : {})
      & (TDef['traits'] extends { timestampable: true | object } ? { created_at: string; updated_at: string | null } : {})
      & (TDef['traits'] extends { useSoftDeletes: true } ? { deleted_at: string | null } : {})
      & (TDef['traits'] extends { softDeletable: true | object } ? { deleted_at: string | null } : {})
      & (TDef['traits'] extends { useAuth: true | object } ? { two_factor_secret: string | null; public_key: string | null } : {})
      & (TDef['traits'] extends { billable: true | object } ? { stripe_id: string | null } : {})
    : never;
/**
 * The full row type for a model, including an index signature for trait-added
 * or dynamic fields that cannot be statically inferred. Use this as the type
 * for function parameters that receive a model instance or row object.
 *
 * Replaces hand-written interfaces like `UserModel` or `OrderModel`.
 *
 * @example
 * ```ts
 * import type { ModelRow } from 'bun-query-builder'
 * type UserModel = ModelRow<typeof User>
 * function greet(user: UserModel) { console.log(user.name) }
 * ```
 */
export type ModelRow<TModel> = InferAttributes<TModel>;
/**
 * Loose variant of ModelRow that includes an index signature for dynamic fields.
 * Use when consumers may access trait-added or dynamic fields that cannot be statically inferred.
 */
export type ModelRowLoose<TModel> = InferAttributes<TModel> & { [key: string]: unknown }
/**
 * The create/update data type for a model — only fillable attributes.
 * Use this for function parameters that accept new record data.
 *
 * Replaces hand-written interfaces like `NewUser`.
 *
 * @example
 * ```ts
 * import type { ModelCreateData } from 'bun-query-builder'
 * type NewUser = ModelCreateData<typeof User>
 * ```
 */
export type ModelCreateData<TModel> = InferFillableAttributes<TModel>;
/**
 * Loose variant of ModelCreateData that includes an index signature for dynamic fields.
 * Use when consumers may pass trait-added or dynamic fields that cannot be statically inferred.
 */
export type ModelCreateDataLoose<TModel> = InferFillableAttributes<TModel> & { [key: string]: unknown }
/**
 * Infer only the fillable fields from a model definition or wrapped model.
 * This is the type accepted by `create()`, `update()`, and `fill()`.
 *
 * @example
 * ```ts
 * type UserFillable = InferFillableAttributes<typeof UserModel>
 * // { name: string; email: string; age: number; role: 'admin' | 'user' }
 * ```
 */
export type InferFillableAttributes<TModel> = ResolveDefinition<TModel> extends infer TDef extends InferableModelDefinition
    ? {
        [K in DefinitionAttributeKeys<TDef> as TDef['attributes'][K] extends { fillable: true } ? K : never]:
        InferSingleAttributeType<TDef['attributes'][K]>
      }
    : never;
/**
 * Infer the primary key type from a model definition or wrapped model.
 * Returns the literal string type of the primary key column name.
 *
 * @example
 * ```ts
 * type UserPK = InferPrimaryKey<typeof UserModel>
 * // 'id' (or whatever the model's primaryKey is set to)
 * ```
 */
export type InferPrimaryKey<TModel> = ResolveDefinition<TModel> extends infer TDef extends InferableModelDefinition
    ? TDef extends { primaryKey: infer PK extends string } ? PK : 'id'
    : never;
/**
 * Infer the table name literal from a model definition or wrapped model.
 *
 * @example
 * ```ts
 * type UserTable = InferTableName<typeof UserModel>
 * // 'users'
 * ```
 */
export type InferTableName<TModel> = ResolveDefinition<TModel> extends infer TDef extends InferableModelDefinition
    ? TDef['table']
    : never;
/**
 * Infer all valid relation names from a model definition or wrapped model.
 * Combines belongsTo, hasMany, hasOne, belongsToMany, hasOneThrough, and hasManyThrough.
 *
 * @example
 * ```ts
 * type UserRelations = InferRelationNames<typeof UserModel>
 * // 'team' | 'post' (lowercased from belongsTo: ['Team'], hasMany: ['Post'])
 * ```
 */
export type InferRelationNames<TModel> = ResolveDefinition<TModel> extends infer TDef
    ? InferBelongsToNames<TDef>
    | InferHasManyNames<TDef>
    | InferHasOneNames<TDef>
    | InferBelongsToManyNames<TDef>
    | InferHasOneThroughNames<TDef>
    | InferHasManyThroughNames<TDef>
    : never;
/**
 * Infer column names that have numeric types from a model definition or wrapped model.
 * Useful for constraining aggregate methods (sum, avg, etc.) to numeric columns only.
 *
 * @example
 * ```ts
 * type UserNumeric = InferNumericColumns<typeof UserModel>
 * // 'age'
 * ```
 */
export type InferNumericColumns<TModel> = ResolveDefinition<TModel> extends infer TDef extends InferableModelDefinition
    ? {
        [K in DefinitionAttributeKeys<TDef>]:
        TDef['attributes'][K] extends { type: 'number' } ? K : never
      }[DefinitionAttributeKeys<TDef>]
    : never;
/**
 * Infer all valid column names (attributes + system fields) from a model definition.
 *
 * @example
 * ```ts
 * type UserCols = InferColumnNames<typeof UserModel>
 * // 'name' | 'email' | 'age' | 'role' | 'id' | 'uuid' | 'created_at' | 'updated_at'
 * ```
 */
export type InferColumnNames<TModel> = ResolveDefinition<TModel> extends infer TDef extends InferableModelDefinition
    ? DefinitionAttributeKeys<TDef>
    | 'id'
    | (TDef['traits'] extends { useUuid: true } ? 'uuid' : never)
    | (TDef['traits'] extends { useTimestamps: true } ? 'created_at' | 'updated_at' : never)
    | (TDef['traits'] extends { timestampable: true | object } ? 'created_at' | 'updated_at' : never)
    | (TDef['traits'] extends { useSoftDeletes: true } ? 'deleted_at' : never)
    | (TDef['traits'] extends { softDeletable: true | object } ? 'deleted_at' : never)
    | (TDef['traits'] extends { useAuth: true | object } ? 'two_factor_secret' | 'public_key' : never)
    | (TDef['traits'] extends { billable: true | object } ? 'stripe_id' : never)
    : never;
/**
 * Infer hidden field keys from a model definition or wrapped model.
 *
 * @example
 * ```ts
 * type UserHidden = InferHiddenKeys<typeof UserModel>
 * // 'password'
 * ```
 */
export type InferHiddenKeys<TModel> = ResolveDefinition<TModel> extends infer TDef extends InferableModelDefinition
    ? {
        [K in DefinitionAttributeKeys<TDef>]: TDef['attributes'][K] extends { hidden: true } ? K : never
      }[DefinitionAttributeKeys<TDef>]
    : never;
/**
 * Infer guarded field keys from a model definition or wrapped model.
 *
 * @example
 * ```ts
 * type UserGuarded = InferGuardedKeys<typeof UserModel>
 * // 'bio'
 * ```
 */
export type InferGuardedKeys<TModel> = ResolveDefinition<TModel> extends infer TDef extends InferableModelDefinition
    ? {
        [K in DefinitionAttributeKeys<TDef>]: TDef['attributes'][K] extends { guarded: true } ? K : never
      }[DefinitionAttributeKeys<TDef>]
    : never;
// ============================================================================
// Pivot column inference (Option A)
// ============================================================================
declare type ExtractPivotRuleInput<R> = R extends { validate: (value: infer T) => any }
  ? T
  : R extends { test: (value: infer T) => any }
    ? T
    : R extends { getRules: () => Array<{ test: (value: infer T) => any }> }
      ? T
      : unknown;
declare type InferPivotColumnType<TCol> = TCol extends { validation: { rule: infer R } }
    ? ExtractPivotRuleInput<R>
    : TCol extends { default: infer D }
      ? D
      : unknown;
/**
 * Given a model definition with `belongsToMany: { <R>: { pivot: { columns } } }`
 * (Option A), infer the typed shape of `.pivot.<col>` on related rows.
 *
 * Falls back to `Record<string, unknown>` when:
 * - The relation uses `through:` (Option B — sibling-model lookup is unsafe at
 *   the inference layer; runtime hydration still works.)
 * - No `pivot.columns` is declared.
 *
 * @example
 * ```ts
 * type T = InferPivotColumns<typeof Coach, 'athletes'>
 * // { role: string; status: string; ... }  (when role/status declared inline)
 * ```
 */
export type InferPivotColumns<TModel, R extends string> = ResolveDefinition<TModel> extends infer TDef
    ? TDef extends { belongsToMany: infer BTM }
      ? R extends keyof BTM
        ? BTM[R] extends { pivot: { columns: infer Cols extends Record<string, InferablePivotColumnAttribute> } }
          ? { [K in keyof Cols]: InferPivotColumnType<Cols[K]> }
          : Record<string, unknown>
        : Record<string, unknown>
      : Record<string, unknown>
    : Record<string, unknown>;
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
/**
 * Determine the cardinality of a relation on a model.
 * hasMany / belongsToMany / hasManyThrough / morphMany / morphToMany /
 * morphedByMany → 'many'; hasOne / belongsTo / hasOneThrough / morphOne →
 * 'one'. Both array and record declaration forms are supported via
 * `RelationKeyOf` (array-first, so tuple keys never leak in).
 */
export type RelationCardinality<TModel, R extends string> = ResolveDefinition<TModel> extends infer TDef
    ? (TDef extends { hasMany: infer V } ? (R extends RelationKeyOf<V> ? 'many' : never) : never)
    | (TDef extends { hasOne: infer V } ? (R extends RelationKeyOf<V> ? 'one' : never) : never)
    | (TDef extends { belongsTo: infer V } ? (R extends RelationKeyOf<V> ? 'one' : never) : never)
    | (TDef extends { belongsToMany: infer V } ? (R extends RelationKeyOf<V> ? 'many' : never) : never)
    | (TDef extends { hasOneThrough: infer V } ? (R extends RelationKeyOf<V> ? 'one' : never) : never)
    | (TDef extends { hasManyThrough: infer V } ? (R extends RelationKeyOf<V> ? 'many' : never) : never)
    | (TDef extends { morphOne: infer V } ? (R extends RelationKeyOf<V> ? 'one' : never) : never)
    | (TDef extends { morphMany: infer V } ? (R extends RelationKeyOf<V> ? 'many' : never) : never)
    | (TDef extends { morphToMany: infer V } ? (R extends RelationKeyOf<V> ? 'many' : never) : never)
    | (TDef extends { morphedByMany: infer V } ? (R extends RelationKeyOf<V> ? 'many' : never) : never)
    : never;
