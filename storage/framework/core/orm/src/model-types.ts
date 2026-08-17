/**
 * Generic model type utilities for deriving types from defineModel() definitions.
 *
 * Instead of a central list of model types, each consumer imports its model
 * directly and derives the type:
 *
 *   import type { ModelRow, NewModelData } from '@stacksjs/orm'
 *   import type Post from '../models/Post'
 *
 *   // Full row type (attributes + system fields + FK columns)
 *   type PostRow = ModelRow<Post>
 *
 *   // Insertable type
 *   type NewPost = NewModelData<Post>
 *
 *   // Or just use the model's typed query methods directly:
 *   const post = await Post.find(id) // already fully typed!
 */
import type { Validator } from '@stacksjs/validation'
import type { MODEL_DEFINITION } from './define-model'

/**
 * Extract the raw ModelDefinition from a defineModel() return value.
 * Uses the getDefinition() accessor that defineModel() provides.
 */
export type Def<T> = T extends { readonly [MODEL_DEFINITION]: infer TDefinition }
  ? TDefinition
  : T extends { getDefinition: () => infer TDefinition }
    ? TDefinition
    : never

/**
 * Extract foreign key columns from belongsTo relations.
 * e.g., belongsTo: ['Customer', 'Coupon'] → { customer_id: number, coupon_id: number }
 */
type SnakeCase<S extends string> = S extends `${infer TFirst}${infer TRest}`
  ? TFirst extends Lowercase<TFirst>
    ? `${TFirst}${SnakeCase<TRest>}`
    : `_${Lowercase<TFirst>}${SnakeCase<TRest>}`
  : S

type BelongsToForeignKeyOf<TEntry> = TEntry extends string
  ? `${SnakeCase<Uncapitalize<TEntry>>}_id`
  : TEntry extends { readonly foreignKey: infer TForeignKey extends string }
    ? TForeignKey
    : TEntry extends { readonly model: infer TModel extends string }
      ? `${SnakeCase<Uncapitalize<TModel>>}_id`
      : never

type BelongsToForeignKeyNames<TDef> = TDef extends { readonly belongsTo: infer TRelations }
  ? TRelations extends readonly (infer TEntry)[]
    ? BelongsToForeignKeyOf<TEntry>
    : TRelations extends Readonly<Record<string, infer TEntry>>
      ? BelongsToForeignKeyOf<TEntry>
      : never
  : never

export type BelongsToForeignKeys<TDef> = {
  [TKey in BelongsToForeignKeyNames<TDef>]: number
}

type DefinitionAttributes<TDef> = TDef extends { readonly attributes: infer TAttributes }
  ? TAttributes
  : never

type AttributeKeys<TDef> = keyof DefinitionAttributes<TDef> & string

type PrimitiveType<TType> = TType extends 'string'
  ? string
  : TType extends 'number' ? number
    : TType extends 'boolean' ? boolean
      : TType extends 'date' ? Date
        : TType extends 'json' ? Record<string, unknown>
          : TType extends readonly (infer TValue)[] ? TValue
            : TType extends Validator<infer TValue> ? TValue
              : unknown

type WidenDefault<TValue> = TValue extends string
  ? string
  : TValue extends number ? number
    : TValue extends boolean ? boolean
      : TValue

type AttributeValue<TAttribute> = TAttribute extends { readonly type: infer TType }
  ? PrimitiveType<TType>
  : TAttribute extends { readonly factory: (...args: never[]) => infer TValue } ? TValue
    : TAttribute extends { readonly validation: { readonly rule: infer TRule } }
      ? TRule extends Validator<infer TValue> ? TValue : unknown
      : TAttribute extends { readonly default: infer TDefault } ? WidenDefault<TDefault>
        : unknown

/**
 * An attribute is nullable when it says so outright, or when `required: false`
 * marks it optional. The latter is what makes the generated column nullable, so
 * the row type has to agree with the schema the migration emits.
 */
type IsNullableAttribute<TAttribute> = TAttribute extends { readonly nullable: true }
  ? true
  : TAttribute extends { readonly required: false } ? true : false

type DeclaredAttributes<TDef> = {
  [TKey in AttributeKeys<TDef>]: IsNullableAttribute<DefinitionAttributes<TDef>[TKey]> extends true
    ? AttributeValue<DefinitionAttributes<TDef>[TKey]> | null
    : AttributeValue<DefinitionAttributes<TDef>[TKey]>
}

type SnakeCaseAttributes<TDef> = {
  [TKey in AttributeKeys<TDef> as SnakeCase<TKey>]: DeclaredAttributes<TDef>[TKey]
}

type PrimaryKey<TDef> = TDef extends { readonly primaryKey: infer TKey extends string } ? TKey : 'id'

type TraitFields<TDef> = { [TKey in PrimaryKey<TDef>]: number }
  & (TDef extends { readonly traits: { readonly useUuid: true } } ? { uuid: string } : {})
  & (TDef extends { readonly traits: { readonly useTimestamps: true } } ? {
    created_at: string
    updated_at: string | null
  } : {})
  & (TDef extends { readonly traits: { readonly timestampable: true | object } } ? {
    created_at: string
    updated_at: string | null
  } : {})
  & (TDef extends { readonly traits: { readonly useSoftDeletes: true } } ? { deleted_at: string | null } : {})
  & (TDef extends { readonly traits: { readonly softDeletable: true | object } } ? { deleted_at: string | null } : {})
  & (TDef extends { readonly traits: { readonly useAuth: true | object } } ? {
    two_factor_secret: string | null
    public_key: string | null
  } : {})
  & (TDef extends { readonly traits: { readonly billable: true } } ? { stripe_id: string | null } : {})

type InferredModelRow<TDef> = DeclaredAttributes<TDef>
  & SnakeCaseAttributes<TDef>
  & Omit<TraitFields<TDef>, AttributeKeys<TDef> | SnakeCase<AttributeKeys<TDef>>>
  & Omit<BelongsToForeignKeys<TDef>, AttributeKeys<TDef> | SnakeCase<AttributeKeys<TDef>>>

type FillableKeys<TDef> = {
  [TKey in AttributeKeys<TDef>]: DefinitionAttributes<TDef>[TKey] extends { readonly fillable: true }
    ? TKey
    : never
}[AttributeKeys<TDef>]

type OptionalFillableKeys<TDef> = {
  [TKey in FillableKeys<TDef>]: DefinitionAttributes<TDef>[TKey] extends
  { readonly nullable: true } | { readonly default: unknown }
    ? TKey
    : never
}[FillableKeys<TDef>]

/**
 * Full database row type: model attributes + system fields (id, uuid, timestamps) + FK columns.
 *
 * @example
 * import type { ModelRow } from '@stacksjs/orm'
 * import type Post from '../models/Post'
 * type PostJsonResponse = ModelRow<typeof Post>
 */
export type ModelRow<T> = InferredModelRow<Def<T>>

/**
 * Same as {@link ModelRow} but with every field optional. Useful for
 * partial-projection reads (`select('id', 'name')`) and test fixtures
 * that don't bother populating every column.
 */
export type ModelRowLoose<T> = Partial<ModelRow<T>>

/**
 * Insertable data type: model attributes + FK columns, all optional.
 *
 * @example
 * import type { NewModelData } from '@stacksjs/orm'
 * import type Post from '../models/Post'
 * type NewPost = NewModelData<typeof Post>
 */
export type NewModelData<T> = Partial<ModelRow<T>>

/**
 * Strict insertable shape: only attributes marked `fillable: true` in
 * the model definition (plus belongsTo foreign keys), partial because
 * many fillable columns have factory defaults at the DB layer.
 *
 * Use this when you want compile-time enforcement that consumers
 * can't pass non-fillable fields to `create()` / `insert()`.
 * {@link NewModelData} is the looser sibling that allows any attribute.
 */
export type ModelCreateData<T> = Partial<InferFillableAttributes<T> & BelongsToForeignKeys<Def<T>>>

/** Loose variant of {@link ModelCreateData} — same shape as {@link NewModelData}, aliased for naming-parity with the row types. */
export type ModelCreateDataLoose<T> = NewModelData<T>

/**
 * Updateable data type: model attributes + FK columns, all optional.
 *
 * @example
 * import type { UpdateModelData } from '@stacksjs/orm'
 * import type Post from '../models/Post'
 * type PostUpdate = UpdateModelData<typeof Post>
 */
export type UpdateModelData<T> = Partial<ModelRow<T>>

/** Attribute values accepted by mass-assignment writes. */
export type InferFillableAttributes<T> = {
  [TKey in Exclude<FillableKeys<Def<T>>, OptionalFillableKeys<Def<T>>>]: DeclaredAttributes<Def<T>>[TKey]
} & {
  [TKey in OptionalFillableKeys<Def<T>>]?: DeclaredAttributes<Def<T>>[TKey]
}

/**
 * Every valid column name for the model (attributes + system fields
 * added by traits like `id`, `uuid`, `created_at`). Useful for
 * constraining query builders that accept a `column` parameter.
 */
export type InferColumnNames<T> = AttributeKeys<Def<T>>
  | SnakeCase<AttributeKeys<Def<T>>>
  | PrimaryKey<Def<T>>
  | BelongsToForeignKeyNames<Def<T>>
  | keyof TraitFields<Def<T>>

/**
 * Attribute keys whose `type` is declared as `'number'` in the model
 * definition. Used to constrain aggregate methods (`sum`, `avg`,
 * `min`, `max`) so they can't be called against string columns.
 *
 * Models that don't declare an explicit `type` per attribute (the
 * common case — most validation rules are inferred from
 * `schema.number()` chains, not declared on `type`) fall back to
 * `AttributeKeys<Def<T>>` here. Tighten by declaring `type: 'number'`
 * on the attribute spec when narrowing matters.
 */
export type InferNumericColumns<T> = {
  [TKey in AttributeKeys<Def<T>>]: AttributeValue<DefinitionAttributes<Def<T>>[TKey]> extends number
    ? TKey
    : never
}[AttributeKeys<Def<T>>]
