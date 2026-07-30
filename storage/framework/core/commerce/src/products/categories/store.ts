type CategoryJsonResponse = ModelRow<typeof Category>
import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { isUniqueViolation } from '@stacksjs/orm'
import { slug } from '@stacksjs/strings'
import { fetchById } from './fetch'
import type { CategoryWriteData } from './types'

export interface CategorizableTable {
  id: number
  name: string
  slug: string
  description?: string
  is_active: boolean
  categorizable_type: string
  created_at?: string
  updated_at?: string
}

/**
 * Create a new category
 *
 * @param data The category data to store
 * @returns The newly created category record
 */
export async function store(data: CategoryWriteData): Promise<CategoryJsonResponse> {
  try {
    const parentCategoryId = data.parent_category_id ? Number(data.parent_category_id) : undefined
    if (parentCategoryId !== undefined && (!Number.isSafeInteger(parentCategoryId) || parentCategoryId <= 0))
      throw new HttpError(422, 'Parent category ID must be a positive integer')
    if (parentCategoryId && !await fetchById(parentCategoryId))
      throw new HttpError(422, `Parent category with ID ${data.parent_category_id} not found`)

    const categoryData = {
      ...data,
      uuid: randomUUIDv7(),
      is_active: data.is_active ?? true,
      parent_category_id: data.parent_category_id || null,
    }

    const result = await db
      .insertInto('categories')
      .values(categoryData)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to create category')

    return result as CategoryJsonResponse
  }
  catch (error) {
    if (error instanceof HttpError)
      throw error
    if (isUniqueViolation(error))
      throw new HttpError(409, 'A category with this name or slug already exists')
    if (error instanceof Error)
      throw new Error(`Failed to create category: ${error.message}`)
    throw error
  }
}

export async function findOrCreateByName(data: Partial<CategorizableTable>): Promise<CategoryJsonResponse> {
  if (!data.name)
    throw new Error('Name is required')

  const existingCategory = await db
    .selectFrom('categories')
    .selectAll()
    .where('name', '=', data.name)
    .executeTakeFirst()

  if (existingCategory)
    return existingCategory as CategoryJsonResponse

  const categoryData: CategoryWriteData = {
    name: data.name,
    slug: slug(data.name),
    is_active: data.is_active ?? true,
    display_order: 0,
  }

  return await store(categoryData)
}
