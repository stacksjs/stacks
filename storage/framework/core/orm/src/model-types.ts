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
  InferModelAttributes,
  ModelAttributes,
  ModelDefinition,
} from 'bun-query-builder'

/**
 * Extract the raw ModelDefinition from a defineModel() return value.
 * Uses the getDefinition() accessor that defineModel() provides.
 */
export type Def<T> = T extends { getDefinition: () => infer D extends ModelDefinition } ? D : never

/**
 * Extract foreign key columns from belongsTo relations.
 * e.g., belongsTo: ['Customer', 'Coupon'] → { customer_id: number, coupon_id: number }
 */
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
 * type PostJsonResponse = ModelRow<Post>
 */
export type ModelRow<T> = ModelAttributes<Def<T>> & BelongsToForeignKeys<Def<T>>

/**
 * Insertable data type: model attributes + FK columns, all optional.
 *
 * @example
 * import type { NewModelData } from '@stacksjs/orm'
 * import type Post from '../models/Post'
 * type NewPost = NewModelData<Post>
 */
export type NewModelData<T> = Partial<InferModelAttributes<Def<T>> & BelongsToForeignKeys<Def<T>>>

/**
 * Updateable data type: model attributes + FK columns, all optional.
 *
 * @example
 * import type { UpdateModelData } from '@stacksjs/orm'
 * import type Post from '../models/Post'
 * type PostUpdate = UpdateModelData<Post>
 */
export type UpdateModelData<T> = Partial<InferModelAttributes<Def<T>> & BelongsToForeignKeys<Def<T>>>
