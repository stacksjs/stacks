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
import type {
  AttributeKeys,
  ColumnName,
  FillableKeys,
  InferModelAttributes,
  ModelAttributes,
  ModelDefinition,
} from '@stacksjs/query-builder'

/**
 * Extract the raw ModelDefinition from a defineModel() return value.
 * Uses the getDefinition() accessor that defineModel() provides.
 */
export type Def<T> = T extends { getDefinition: () => infer D extends ModelDefinition } ? D : never

/**
 * Extract foreign key columns from belongsTo relations.
 * e.g., belongsTo: ['Customer', 'Coupon'] → { customer_id: number, coupon_id: number }
 */
// eslint-disable-next-line ts/no-empty-object-type
export type BelongsToForeignKeys<TDef> =
  TDef extends { readonly belongsTo: readonly (infer R extends string)[] }
    ? { [K in R as `${Lowercase<K>}_id`]: number }
    : {}

/**
 * Full database row type: model attributes + system fields (id, uuid, timestamps) + FK columns.
 *
 * @example
 * import type { ModelRow } from '@stacksjs/orm'
 * import type Post from '../models/Post'
 * type PostJsonResponse = ModelRow<typeof Post>
 */
export type ModelRow<T> = ModelAttributes<Def<T>> & BelongsToForeignKeys<Def<T>>

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
export type NewModelData<T> = Partial<InferModelAttributes<Def<T>> & BelongsToForeignKeys<Def<T>>>

/**
 * Strict insertable shape: only attributes marked `fillable: true` in
 * the model definition (plus belongsTo foreign keys), partial because
 * many fillable columns have factory defaults at the DB layer.
 *
 * Use this when you want compile-time enforcement that consumers
 * can't pass non-fillable fields to `create()` / `insert()`.
 * {@link NewModelData} is the looser sibling that allows any attribute.
 */
export type ModelCreateData<T> = Partial<Pick<InferModelAttributes<Def<T>>, Extract<FillableKeys<Def<T>>, keyof InferModelAttributes<Def<T>>>> & BelongsToForeignKeys<Def<T>>>

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
export type UpdateModelData<T> = Partial<InferModelAttributes<Def<T>> & BelongsToForeignKeys<Def<T>>>

/**
 * Just the attribute records flagged `fillable: true` — useful for
 * code-generators and any helper that needs the typed shape of a
 * model's fillable-attribute config (e.g., admin form schemas).
 */
export type InferFillableAttributes<T> = {
  [K in Extract<FillableKeys<Def<T>>, keyof Def<T>['attributes']>]: Def<T>['attributes'][K]
}

/**
 * Every valid column name for the model (attributes + system fields
 * added by traits like `id`, `uuid`, `created_at`). Useful for
 * constraining query builders that accept a `column` parameter.
 */
export type InferColumnNames<T> = ColumnName<Def<T>>

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
  [K in AttributeKeys<Def<T>>]: Def<T>['attributes'][K] extends { type: 'number' } ? K : never
}[AttributeKeys<Def<T>>] extends infer R
  ? [R] extends [never] ? AttributeKeys<Def<T>> : R
  : never
