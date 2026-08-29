import { db } from '@stacksjs/database'
import { fetchById } from './fetch'
import { mutationCount } from '../../utils/mutation-count'

/**
 * Delete a category by ID
 * @param id The ID of the category to delete
 * @returns A boolean indicating whether the deletion was successful
 */
export async function remove(id: number): Promise<boolean> {
  const result = await db
    .deleteFrom('categories')
    .where('id', '=', id)
    .executeTakeFirst()

  return mutationCount(result) > 0
}

/**
 * Bulk delete multiple categories
 * @param ids Array of category IDs to delete
 * @returns Number of categories successfully deleted
 */
export async function bulkRemove(ids: number[]): Promise<number> {
  if (!ids.length) {
    return 0
  }

  // Delete all categories in the array
  const result = await db
    .deleteFrom('categories')
    .where('id', 'in', ids)
    .executeTakeFirst()

  return mutationCount(result)
}

/**
 * Delete child categories of a parent category
 * @param parentId The ID of the parent category
 * @returns Number of categories deleted
 */
export async function removeChildCategories(parentId: string): Promise<number> {
  // Delete categories with the specified parent_category_id
  const result = await db
    .deleteFrom('categories')
    .where('parent_category_id', '=', parentId)
    .executeTakeFirst()

  return mutationCount(result)
}

/**
 * Deactivate a category (set is_active to false)
 * @param id The ID of the category to deactivate
 * @returns A boolean indicating whether the deactivation was successful
 */
export async function deactivate(id: number): Promise<boolean> {
  // First check if the category exists
  const category = await fetchById(id)

  if (!category) {
    throw new Error(`Category with ID ${id} not found`)
  }

  // Update the category status
  const result = await db
    .updateTable('categories')
    .set({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .where('id', '=', id)
    .executeTakeFirst()

  return !!result
}

/**
 * Deactivate all child categories of a parent category
 * @param parentId The ID of the parent category
 * @returns Number of categories deactivated
 */
export async function deactivateChildCategories(parentId: string): Promise<number> {
  // Update categories with the specified parent_category_id
  const result = await db
    .updateTable('categories')
    .set({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .where('parent_category_id', '=', parentId)
    .execute()

  // `execute()` on a delete answers the affected-row count. `.length` on a
  // number is `undefined`, so this reported 0 deleted every time.
  return Number(result) || 0
}
