import { db } from '@stacksjs/database'
import { slug } from '@stacksjs/strings'

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
export async function store(data: Omit<CategorizableTable, 'id' | 'created_at' | 'updated_at'>): Promise<CategorizableTable> {
  try {
    const categoryData = {
      name: data.name,
      slug: data.slug,
      is_active: data.is_active,
      categorizable_type: data.categorizable_type,
    }

    const result = await db
      .insertInto('categorizable')
      .values(categoryData)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to create category')

    return result as CategorizableTable
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

export async function findOrCreateByName(data: Partial<CategorizableTable>): Promise<CategorizableTable> {
  if (!data.name)
    throw new Error('Name is required')

  const existingCategory = await db
    .selectFrom('categorizable')
    .selectAll()
    .where('name', '=', data.name)
    .executeTakeFirst()

  if (existingCategory)
    return existingCategory as CategorizableTable

  const categoryData = {
    name: data.name,
    slug: slug(data.name),
    is_active: data.is_active ?? true,
    categorizable_type: data.categorizable_type ?? 'default',
  }

  return await store(categoryData)
}
