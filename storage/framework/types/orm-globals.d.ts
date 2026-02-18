/**
 * Global type declarations for ORM utilities and request types.
 *
 * These types are available globally without imports in all Stacks application code.
 * They are derived dynamically from defineModel() definitions.
 *
 * @example
 * // No imports needed - these are global:
 * type PostRow = ModelRow<typeof Post>
 * type NewPost = NewModelData<typeof Post>
 * async function handle(request: RequestInstance) { ... }
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
   * const post: ModelRow<typeof Post> = await Post.find(1)
   */
  type ModelRow<T> = _ModelRow<T>

  /**
   * Insertable data type derived from a defineModel() definition.
   * All fields are optional for flexible creation.
   *
   * @example
   * type NewPost = NewModelData<typeof Post>
   * const data: NewModelData<typeof Post> = { title: 'Hello' }
   */
  type NewModelData<T> = _NewModelData<T>

  /**
   * Updateable data type derived from a defineModel() definition.
   * All fields are optional for partial updates.
   *
   * @example
   * type PostUpdate = UpdateModelData<typeof Post>
   * const data: UpdateModelData<typeof Post> = { title: 'Updated' }
   */
  type UpdateModelData<T> = _UpdateModelData<T>

  /**
   * Enhanced request interface with Laravel-style methods.
   * Provides typed input handling, validation, file uploads, and more.
   *
   * @example
   * async function handle(request: RequestInstance) {
   *   const name = request.get('name')
   *   await request.validate({ name: 'required|string' })
   * }
   */
  type RequestInstance = _RequestInstance
}
