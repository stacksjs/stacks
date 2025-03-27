import type { CategoryJsonResponse, CategoryRequestType } from '@stacksjs/orm'
import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'
import { fetchById } from './fetch'

/**
 * Update a category by ID
 *
 * @param id The ID of the category to update
 * @param request The updated category data
 * @returns The updated category record
 */
export async function update(id: number, request: CategoryRequestType): Promise<CategoryJsonResponse | undefined> {
  // Validate the request data
  await request.validate()

  // Check if category exists
  const existingCategory = await fetchById(id)
  if (!existingCategory) {
    throw new Error(`Category with ID ${id} not found`)
  }

  // Create update data object using request fields
  const updateData: Record<string, any> = {
    name: request.get('name'),
    description: request.get('description'),
    image_url: request.get('image_url'),
    is_active: request.get<boolean>('is_active'),
    parent_category_id: request.get('parent_category_id'),
    display_order: request.get<number>('display_order'),
    updated_at: formatDate(new Date()),
  }

  // If no fields to update, just return the existing category
  if (Object.keys(updateData).length === 0) {
    return existingCategory
  }

  try {
    // Update the category
    await db
      .updateTable('categories')
      .set(updateData)
      .where('id', '=', id)
      .execute()

    // Fetch and return the updated category
    return await fetchById(id)
  }
  catch (error) {
    if (error instanceof Error) {
      // Handle duplicate name error
      if (error.message.includes('Duplicate entry') && error.message.includes('name')) {
        throw new Error('A category with this name already exists')
      }

      throw new Error(`Failed to update category: ${error.message}`)
    }

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
export async function updateDisplayOrder(id: number, newOrder: number): Promise<CategoryJsonResponse | undefined> {
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
export async function updateActiveStatus(id: number, isActive: boolean): Promise<CategoryJsonResponse | undefined> {
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
export async function updateParent(id: number, newParentId: string | null): Promise<CategoryJsonResponse | undefined> {
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
    const updateObject = {
      updated_at: formatDate(new Date()),
    } as Record<string, any>

    // Set parent_category_id explicitly based on whether newParentId is null
    if (newParentId === null) {
      await db
        .updateTable('categories')
        .set({
          ...updateObject,
          parent_category_id: undefined,
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
    const parent = await fetchById(currentParentId)
    if (!parent || !parent.parent_category_id) {
      // We've reached a root category, no cycle
      return false
    }

    currentParentId = Number(parent.parent_category_id)
  }

  return false
}
