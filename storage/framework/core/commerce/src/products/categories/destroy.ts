import { db, matchedRows } from '@stacksjs/database/runtime'
import { formatDate } from '@stacksjs/orm'
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

  // `returning('id')` answers with the row itself, so a category removed
  // between the check above and this write reports failure. The result object
  // this used to test is truthy even when it carries `numUpdatedRows: 0`, and
  // its count would be no better on MySQL, which counts CHANGED rows:
  // deactivating an already inactive category writes nothing and reports 0.
  //
  // The timestamp goes through `formatDate` like the rest of the module.
  // `toISOString()` writes `2026-09-17T11:31:40.219Z`, which MySQL rejects
  // under its default strict sql_mode, so this threw there for every category.
  const updated = await db
    .updateTable('categories')
    .set({
      is_active: false,
      updated_at: formatDate(new Date()),
    })
    .where('id', '=', id)
    .returning('id')
    .executeTakeFirst()

  return Boolean(updated)
}

/**
 * Deactivate all child categories of a parent category
 * @param parentId The ID of the parent category
 * @returns Number of categories deactivated
 */
export async function deactivateChildCategories(parentId: string): Promise<number> {
  // Update categories with the specified parent_category_id.
  //
  // The count is what the predicate matched. MySQL reports rows CHANGED, so
  // children already inactive, re-deactivated inside the second their
  // `updated_at` already holds, were left out and a repeat call reported 0
  // where PostgreSQL and SQLite report every child (stacksjs/stacks#2639).
  const matched = await matchedRows(db
    .updateTable('categories')
    .set({
      is_active: false,
      updated_at: formatDate(new Date()),
    })
    .where('parent_category_id', '=', parentId))

  return matched.length
}
