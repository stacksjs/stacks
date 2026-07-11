import type { Faker } from '@stacksjs/ts-faker';
/**
 * # `defineModel(model)`
 *
 * Freezes and returns a model definition with strong inference for attributes
 * and options.
 *
 * @example
 * ```ts
 * const Post = defineModel({
 *   name: 'Post',
 *   attributes: {
 *     title: { validation: { rule: {} // isLength({ min: 1 }) } },
 *   },
 * })
 * ```
 */
export declare function defineModel<const T extends ModelDefinition>(model: T): T;
/**
 * # `defineModels(models)`
 *
 * Freezes and returns a record of model definitions, preserving literal keys so
 * downstream types (like `DatabaseSchema`) can map model names to table names.
 *
 * @example
 * ```ts
 * const models = defineModels({ User, Post })
 * ```
 */
export declare function defineModels<const T extends ModelRecord>(models: T): T;
export declare interface ForeignKeyConfig {
  table: string
  column?: string
  onDelete?: OnForeignKeyAction
  onUpdate?: OnForeignKeyAction
  nullable?: boolean
}
/**
 * # `Attribute`
 *
 * Describes a model column and its validation/meta options.
 *
 * @example
 * ```ts
 * const User = defineModel({
 *   name: 'User',
 *   attributes: {
 *     email: { validation: { rule: {} // isEmail() }, unique: true },
 *     age: { validation: { rule: {} // isInt({ min: 0 }) }, default: 0 },
 *   }
 * })
 * ```
 */
export declare interface Attribute {
  default?: string | number | boolean | Date
  unique?: boolean
  order?: number
  hidden?: boolean
  fillable?: boolean
  guarded?: boolean
  foreignKey?: boolean | ForeignKeyConfig
  factory?: (faker: Faker) => any
  validation: {
    rule: ValidationType
    message?: ValidatorMessage
  }
}
export declare interface AttributesElements {
  [key: string]: Attribute
}
/**
 * # `CompositeIndex`
 *
 * Describes a named multi-column index.
 *
 * @example
 * ```ts
 * { name: 'user_email_unique', columns: ['email'], unique: true }
 * { name: 'one_primary_per_athlete', columns: ['athlete_id'], unique: true, where: "role = 'primary'" }
 * ```
 */
export declare interface CompositeIndex {
  name: string
  columns: string[]
  unique?: boolean
  where?: string
}
export declare interface Base {}
/**
 * # `PivotColumnAttribute`
 *
 * Inline declaration of an extra column on the pivot table (Option A). When the
 * pivot is declared via a `through` model (Option B), columns are read from
 * that model's `attributes` instead.
 */
export declare interface PivotColumnAttribute {
  default?: string | number | boolean | Date
  nullable?: boolean
  validation?: {
    rule: ValidationType
    message?: ValidatorMessage
  }
}
/**
 * # `PivotConfig`
 *
 * Inline pivot configuration (Option A). Used when the pivot does not have its
 * own model in the registry. Migrations will auto-emit a table for this pivot.
 */
export declare interface PivotConfig {
  columns?: Record<string, PivotColumnAttribute>
  timestamps?: boolean
  uniques?: string[][]
}
/**
 * # `BelongsToManyConfig<T>`
 *
 * Object form of a `belongsToMany` relation declaration. Either `through`
 * (Option B — pivot is a registered model) or `pivot.columns` (Option A —
 * inline metadata) supplies the pivot column metadata. When neither is
 * supplied the relation behaves exactly like the legacy string form.
 */
export declare interface BelongsToManyConfig<T extends string = string> {
  model: T
  through?: T
  table?: string
  foreignKey?: string
  relatedKey?: string
  pivot?: PivotConfig
}
/**
 * # `ModelOptions`
 *
 * Declarative model definition used to build a typed `DatabaseSchema`.
 *
 * @example
 * ```ts
 * const User = defineModel({
 *   name: 'User',
 *   table: 'users',
 *   primaryKey: 'id',
 *   attributes: {
 *     id: { validation: { rule: {} // isInt() } },
 *     email: { validation: { rule: {} // isEmail() }, unique: true },
 *   },
 *   indexes: [{ name: 'users_email_unique', columns: ['email'] }],
 * })
 * ```
 */
export declare interface ModelOptions extends Base {
  name: string
  description?: string
  table?: string
  primaryKey?: string
  autoIncrement?: boolean
  indexes?: CompositeIndex[]
  traits?: Record<string, unknown>
  attributes?: AttributesElements
  hasOne?: HasOne<ModelNames> | ModelNames[]
  hasMany?: HasMany<ModelNames> | ModelNames[]
  belongsTo?: BelongsTo<ModelNames> | ModelNames[]
  belongsToMany?: BelongsToMany<ModelNames> | ModelNames[]
  hasOneThrough?: HasOneThrough<ModelNames>
  hasManyThrough?: HasManyThrough<ModelNames>
  morphOne?: MorphOne<ModelNames>
  morphMany?: MorphMany<ModelNames>
  morphTo?: MorphTo
  morphToMany?: MorphToMany<ModelNames>
  morphedByMany?: MorphedByMany<ModelNames>
  scopes?: {
    [key: string]: (value: any) => any
  }
  get?: {
    [key: string]: (value: any) => any
  }
  set?: {
    [key: string]: (value: any) => any
  }
}
/**
 * # `ValidatorMessage`
 *
 * Map of field identifiers to custom error messages returned by validators.
 */
export type ValidatorMessage = Record<string, string>;
export type OnForeignKeyAction = 'cascade' | 'set null' | 'restrict' | 'no action';
/**
 * # `ValidationType`
 *
 * External validator rule type (compatible with ts-validation). Kept broad to
 * avoid a hard dependency while still enabling type inference via rule shape.
 */
export type ValidationType = unknown;
export type ModelNames = string;
/**
 * # Relationship helpers
 *
 * Lightweight relationship declarations for model definitions. Each helper is a
 * record keyed by relation name with the related model name as value.
 */
export type HasOne<T extends string> = Record<string, T>;
export type HasMany<T extends string> = Record<string, T>;
export type BelongsTo<T extends string> = Record<string, T>;
export type BelongsToMany<T extends string> = Record<string, T | BelongsToManyConfig<T>>;
export type HasOneThrough<T extends string> = Record<string, { through: T, target: T }>;
export type HasManyThrough<T extends string> = Record<string, { through: T, target: T }>;
export type MorphOne<T extends string> = Record<string, T>;
export type MorphMany<T extends string> = Record<string, T>;
export type MorphTo = Record<string, unknown>;
export type MorphToMany<T extends string> = Record<string, T>;
export type MorphedByMany<T extends string> = Record<string, T>;
export type ModelDefinition = Readonly<ModelOptions>;
/**
 * # `ModelRecord`
 *
 * Collection of models keyed by model name. Kept flexible to preserve literal
 * attribute keys and value types.
 */
export type ModelRecord = Record<string, any>;
/**
 * # `InferAttributes<M>`
 *
 * Given a `ModelDefinition`, produces a record of attribute names to their
 * inferred input type based on the validator rule shape.
 */
declare type ExtractRuleInput<R> = R extends { validate: (value: infer T) => any }
  ? T
  : R extends { test: (value: infer T) => any }
    ? T
    : R extends { getRules: () => Array<{ test: (value: infer T) => any }> }
      ? T
      : unknown;
export type InferAttributes<M extends ModelDefinition> = M extends {
  attributes: infer A extends Record<string, { validation: { rule: any } }>
}
  ? { [K in keyof A & string]: ExtractRuleInput<A[K]['validation']['rule']> }
  : Record<string, unknown>;
/**
 * # `InferPrimaryKey<M>`
 *
 * Extracts a model's primary key field name, defaulting to `'id'`.
 */
export type InferPrimaryKey<M extends ModelDefinition> = M extends {
  primaryKey: infer K extends string
}
  ? K
  : 'id';
/**
 * # `InferTableName<M>`
 *
 * Resolves the table name from a model: uses `table` when provided, otherwise
 * falls back to a simple pluralized form of the model name.
 */
export type InferTableName<M extends ModelDefinition> = M extends {
  table: infer T extends string
}
  ? T
  : M extends { name: infer N extends string }
    ? `${Lowercase<N>}s`
    : string;
/**
 * Resolve a models-record entry to the raw definition. `defineModel()` (and
 * `createModel`/`createBrowserModel`) wrap definitions in an object exposing
 * `getDefinition()` / `definition`; `buildDatabaseSchema` unwraps these at
 * runtime, so the type level must unwrap them too or the schema degrades to
 * an untyped index signature.
 */
declare type UnwrapModelDefinition<M> = M extends { getDefinition: () => infer D } ? D :
    M extends { definition: infer D } ? D :
      M;
/**
 * Unwrap a relation entry to the related model's name. Entries may be a plain
 * model-name string, a `{ model: 'X' }` config (belongsToMany Option A/B), or
 * a `{ through, target }` through-relation descriptor.
 */
declare type RelationEntryModelName<E> = E extends string ? E :
    E extends { model: infer M extends string } ? M :
      E extends { target: infer T extends string } ? T :
        never;
/**
 * Normalize one relation declaration (array or record form) into a
 * `relationName -> relatedModelName` record, mirroring `buildSchemaMeta`:
 * array entries use the (unwrapped) model name as the relation name; record
 * entries use the key.
 */
declare type RelationRecordOf<V> = [V] extends [never]
    ? {} // absent relation kind — must yield {} (not never) so intersections survive
    : V extends readonly (infer E)[]
      ? { [K in RelationEntryModelName<E> & string]: K }
      : V extends Readonly<Record<string, unknown>>
        ? { [K in keyof V & string]: RelationEntryModelName<V[K]> }
        : {}
/** All relations of a model as a `relationName -> relatedModelName` record. */
declare type ModelRelationsRecord<M> = RelationRecordOf<M extends { hasOne: infer V } ? V : never>
  & RelationRecordOf<M extends { hasMany: infer V } ? V : never>
  & RelationRecordOf<M extends { belongsTo: infer V } ? V : never>
  & RelationRecordOf<M extends { belongsToMany: infer V } ? V : never>
  & RelationRecordOf<M extends { hasOneThrough: infer V } ? V : never>
  & RelationRecordOf<M extends { hasManyThrough: infer V } ? V : never>
  & RelationRecordOf<M extends { morphOne: infer V } ? V : never>
  & RelationRecordOf<M extends { morphMany: infer V } ? V : never>
  & RelationRecordOf<M extends { morphToMany: infer V } ? V : never>
  & RelationRecordOf<M extends { morphedByMany: infer V } ? V : never>;
/** Resolve a related model name to its table name within the models record. */
declare type RelatedTableName<MRecord extends ModelRecord, ModelName> = ModelName extends keyof MRecord ? InferTableName<UnwrapModelDefinition<MRecord[ModelName]>> : string;
/**
 * # `InferTableRelations<M, MRecord>`
 *
 * `relationName -> relatedTableName` record for one model, resolved against
 * the full models record. Powers the type-level narrowing of `.with()`,
 * `.whereHas()`, `.withCount()`, etc. on the query builder.
 */
export type InferTableRelations<M, MRecord extends ModelRecord> = {
  [K in keyof ModelRelationsRecord<UnwrapModelDefinition<M>> & string]: RelatedTableName<MRecord, ModelRelationsRecord<UnwrapModelDefinition<M>>[K]>
}
/**
 * # `DatabaseSchema<Models>`
 *
 * Maps model definitions to a concrete database schema shape containing the
 * table columns and primary key. This is the primary input for the query
 * builder's type-safety.
 *
 * The `relations` field is type-level only (phantom): `buildDatabaseSchema`
 * never materializes it at runtime. It maps relation names to related table
 * names so builder methods like `.with()` can narrow their accepted relation
 * names per table.
 *
 * @example
 * ```ts
 * const models = defineModels({ User, Post })
 * type Schema = DatabaseSchema<typeof models>
 * ```
 */
export type DatabaseSchema<MRecord extends ModelRecord> = {
  [MName in keyof MRecord & string as InferTableName<UnwrapModelDefinition<MRecord[MName]>>]: {
    columns: InferAttributes<UnwrapModelDefinition<MRecord[MName]>>
    primaryKey: InferPrimaryKey<UnwrapModelDefinition<MRecord[MName]>>
    /** Phantom, type-level only: relation name -> related table name. */
    relations?: InferTableRelations<MRecord[MName], MRecord>
  };
}
