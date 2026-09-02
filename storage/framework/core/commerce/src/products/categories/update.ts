import type { RowOf } from '@stacksjs/database'
import { db } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { formatDate, isUniqueViolation } from '@stacksjs/orm'
import { fetchById } from './fetch'
import type { CategoryWriteData } from './types'

type CategoryRow = RowOf<'categories'>

/**
 * Update a category by ID
 *
 * @param id The ID of the category to update
 * @param data The updated category data
 * @returns The updated category record
 */
export async function update(id: number, data: CategoryWriteData): Promise<CategoryRow | undefined> {
  const existingCategory = await fetchById(id)
  if (!existingCategory)
    return undefined

  if (Object.hasOwn(data, 'parent_category_id')) {
    const parentCategoryId = data.parent_category_id ? Number(data.parent_category_id) : undefined
    if (parentCategoryId !== undefined && (!Number.isSafeInteger(parentCategoryId) || parentCategoryId <= 0))
      throw new HttpError(422, 'Parent category ID must be a positive integer')
    if (parentCategoryId === id)
      throw new HttpError(422, 'A category cannot be its own parent')
    if (parentCategoryId && !await fetchById(parentCategoryId))
      throw new HttpError(422, `Parent category with ID ${data.parent_category_id} not found`)
    if (parentCategoryId && await wouldCreateCircularReference(id, String(parentCategoryId)))
      throw new HttpError(422, 'This operation would create a circular category hierarchy')
  }

  try {
    const parentUpdate = Object.hasOwn(data, 'parent_category_id')
      ? { parent_category_id: data.parent_category_id || null }
      : {}
    const result = await db
      .updateTable('categories')
      .set({
        ...data,
        ...parentUpdate,
        updated_at: formatDate(new Date()),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      return undefined

    return result
  }
  catch (error) {
    if (error instanceof HttpError)
      throw error
    if (isUniqueViolation(error))
      throw new HttpError(409, 'A category with this name or slug already exists')
    if (error instanceof Error)
      throw new Error(`Failed to update category: ${error.message}`)
    throw error
  }
}

/**
 * Update category display order
 *
 * @param id The ID of the category
 * @param newOrder The new display order value
 * @returns The updated category
 */
export async function updateDisplayOrder(id: number, newOrder: number): Promise<CategoryRow | undefined> {
  // Check if category exists
  const category = await fetchById(id)

  if (!category) {
    throw new Error(`Category with ID ${id} not found`)
  }

  try {
    // Update the category's display order
    await db
      .updateTable('categories')
      .set({
        display_order: newOrder,
        updated_at: formatDate(new Date()),
      })
      .where('id', '=', id)
      .execute()

    // Fetch the updated category
    return await fetchById(id)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update category display order: ${error.message}`)
    }

    throw error
  }
}

/**
 * Update category active status
 *
 * @param id The ID of the category
 * @param isActive Whether the category should be active
 * @returns The updated category
 */
export async function updateActiveStatus(id: number, isActive: boolean): Promise<CategoryRow | undefined> {
  // Check if category exists
  const category = await fetchById(id)

  if (!category) {
    throw new Error(`Category with ID ${id} not found`)
  }

  try {
    // Update the category's active status
    await db
      .updateTable('categories')
      .set({
        is_active: isActive,
        updated_at: formatDate(new Date()),
      })
      .where('id', '=', id)
      .execute()

    // Fetch the updated category
    return await fetchById(id)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update category active status: ${error.message}`)
    }

    throw error
  }
}

/**
 * Move category to a different parent
 *
 * @param id The ID of the category to move
 * @param newParentId The ID of the new parent category, or null to make it a root category
 * @returns The updated category
 */
export async function updateParent(id: number, newParentId: string | null): Promise<CategoryRow | undefined> {
  // Check if category exists
  const category = await fetchById(id)

  if (!category) {
    throw new Error(`Category with ID ${id} not found`)
  }

  // If moving to a parent, check that the parent exists and is not the same category
  if (newParentId) {
    // Convert to number for comparison since id is number
    const newParentIdNum = Number(newParentId)

    if (newParentIdNum === id) {
      throw new Error('A category cannot be its own parent')
    }

    const parentCategory = await fetchById(newParentIdNum)
    if (!parentCategory) {
      throw new Error(`Parent category with ID ${newParentId} not found`)
    }

    // Check for circular reference
    if (await wouldCreateCircularReference(id, newParentId)) {
      throw new Error('This operation would create a circular reference in the category hierarchy')
    }
  }

  try {
    // Update the category's parent
    const updateObject: { updated_at: string, parent_category_id?: string | undefined } = {
      updated_at: formatDate(new Date()),
    }

    // Set parent_category_id explicitly based on whether newParentId is null
    if (newParentId === null) {
      await db
        .updateTable('categories')
        .set({
          ...updateObject,
          parent_category_id: null,
        })
        .where('id', '=', id)
        .execute()
    }
    else {
      await db
        .updateTable('categories')
        .set({
          ...updateObject,
          parent_category_id: newParentId,
        })
        .where('id', '=', id)
        .execute()
    }

    // Fetch the updated category
    return await fetchById(id)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update category parent: ${error.message}`)
    }

    throw error
  }
}

/**
 * Helper function to check if changing a category's parent would create a circular reference
 * @param categoryId ID of the category being moved
 * @param newParentId ID of the new parent
 * @returns boolean indicating if a circular reference would be created
 */
async function wouldCreateCircularReference(categoryId: number, newParentId: string): Promise<boolean> {
  // Convert to number for consistency in the check
  let currentParentId = Number(newParentId)
  const visited = new Set<number>()

  while (currentParentId) {
    // If we've seen this ID before, we have a cycle
    if (visited.has(currentParentId)) {
      return true
    }

    // If we've reached the original category, we have a cycle
    if (currentParentId === categoryId) {
      return true
    }

    visited.add(currentParentId)

    // Get the parent's parent
    const parent = await fetchById(currentParentId) as (CategoryRow & { parent_category_id?: string | null }) | undefined
    // Column name only. The `?? parent?.parentCategoryId` half that used to
    // follow was unreachable: `fetchById` returns a RAW row, which carries the
    // column spelling and never the declared one (stacksjs/stacks#2417).
    const nextParentId = parent?.parent_category_id
    if (!parent || !nextParentId) {
      // We've reached a root category, no cycle
      return false
    }

    currentParentId = Number(nextParentId)
  }

  return false
}
