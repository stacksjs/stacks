/**
 * Global type declarations for ORM utilities and request types.
 *
 * These types are available globally without imports in all Stacks application code.
 * Model types are derived dynamically from defineModel() definitions via `as const`.
 *
 * @example
 * // No imports needed — all of these are global:
 * type PostRow = ModelRow<typeof Post>
 * type NewPost = NewModelData<typeof Post>
 *
 * // Actions with model: Post get fully typed requests automatically:
 * new Action({
 *   model: Post,
 *   async handle(request) {
 *     request.get('title')   // autocompletes to Post fields, returns string
 *     request.get('invalid') // TS error!
 *   }
 * })
 */

import type { ModelRow as _ModelRow, NewModelData as _NewModelData, UpdateModelData as _UpdateModelData } from '@stacksjs/orm'
import type { RequestInstance as _RequestInstance } from '@stacksjs/types'

export {}

declare global {
  /**
   * Full database row type derived from a defineModel() definition.
   * Includes model attributes + system fields (id, uuid, timestamps) + FK columns.
   *
   * @example
   * type PostRow = ModelRow<typeof Post>
   */
  type ModelRow<T> = _ModelRow<T>

  /**
   * Insertable data type derived from a defineModel() definition.
   * All fields are optional for flexible creation.
   *
   * @example
   * type NewPost = NewModelData<typeof Post>
   */
  type NewModelData<T> = _NewModelData<T>

  /**
   * Updateable data type derived from a defineModel() definition.
   * All fields are optional for partial updates.
   *
   * @example
   * type PostUpdate = UpdateModelData<typeof Post>
   */
  type UpdateModelData<T> = _UpdateModelData<T>

  /**
   * Model-aware request interface.
   *
   * When parameterized with a model type, all input methods narrow to that model's
   * field names and types. Automatically inferred in Action handlers via `model: Post`.
   *
   * @example
   * // Bare — accepts any key:
   * function handle(request: RequestInstance) { ... }
   *
   * @example
   * // Model-aware — full narrowing:
   * function handle(request: RequestInstance<typeof Post>) {
   *   request.get('title') // autocompletes, typed return
   * }
   */
  type RequestInstance<TModel = never> = [TModel] extends [never]
    ? _RequestInstance
    : _RequestInstance<_ModelRow<TModel>>
}
