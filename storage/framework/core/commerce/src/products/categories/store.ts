import type { CategoryJsonResponse, NewCategory } from '@stacksjs/orm'
import { db } from '@stacksjs/database'
import { slug } from '@stacksjs/strings'
import { fetchById } from './fetch'

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
export async function store(data: NewCategory): Promise<CategoryJsonResponse> {
  try {
    // Add missing required properties
    const categoryData = {
      ...data,
      slug: data.name?.toLowerCase().replace(/\s+/g, '-') || '',
      categorizable_type: 'product',
      display_order: 0,
    }

    const result = await db
      .insertInto('categories')
      .values(categoryData)
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to create category')

    const insertId = Number(result.insertId) || Number(result.numInsertedOrUpdatedRows)

    const model = await fetchById(insertId)

    if (!model)
      throw new Error('Failed to create category')

    return model
  }
  catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Duplicate entry') && error.message.includes('name')) {
        throw new Error('A category with this name already exists')
      }

      throw new Error(`Failed to create category: ${error.message}`)
    }

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
    return existingCategory

  const categoryData = {
    name: data.name,
    slug: slug(data.name),
    is_active: data.is_active ?? true,
    categorizable_type: data.categorizable_type ?? 'default',
    display_order: 0,

  }

  return await store(categoryData)
}
