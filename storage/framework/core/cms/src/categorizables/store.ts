import type { CategorizableModelsTable, CategorizableTable } from '@stacksjs/orm'
import { db } from '@stacksjs/database'
import { slugify } from 'ts-slug'

interface CategoryData {
  name: string
  description?: string
  categorizable_type: string
  is_active?: boolean
}

interface CategorizableModelData {
  category_id: number
  categorizable_type: string
}

/**
 * Create a new category and its pivot table entry
 *
 * @param data The category data to create
 * @returns The created category record
 */
export async function store(data: CategoryData): Promise<CategorizableTable> {
  try {
    if (!data.name || data.name.trim() === '') {
      throw new Error('Category name is required')
    }

    if (!data.categorizable_type || data.categorizable_type.trim() === '') {
      throw new Error('Category categorizable_type is required')
    }

    const categoryData = {
      name: data.name,
      slug: slugify(data.name),
      description: data.description,
      categorizable_type: data.categorizable_type,
      is_active: data.is_active ?? true,
    }

    const category = await db
      .insertInto('categorizables')
      .values(categoryData)
      .returningAll()
      .executeTakeFirst()

    if (!category)
      throw new Error('Failed to create category')

    return category as CategorizableTable
  }
  catch (error) {
    if (error instanceof Error)
      throw new TypeError(`Failed to create category: ${error.message}`)

    throw error
  }
}

/**
 * Create a new categorizable model relationship
 *
 * @param data The categorizable model data to create
 * @returns The created categorizable model record
 */
export async function storeCategorizableModel(data: CategorizableModelData): Promise<CategorizableModelsTable> {
  try {
    const modelData = {
      category_id: data.category_id,
      categorizable_type: data.categorizable_type,
    }

    const result = await db
      .insertInto('categorizable_models')
      .values(modelData)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to create categorizable model relationship')

    return result as unknown as CategorizableModelsTable
  }
  catch (error) {
    if (error instanceof Error)
      throw new TypeError(`Failed to create categorizable model relationship: ${error.message}`)

    throw error
  }
}

/**
 * Create multiple categories and their pivot table entries in a single transaction
 *
 * @param data Array of category data to create
 * @returns Array of created category records
 */
export async function bulkStore(data: CategoryData[]): Promise<CategorizableTable[]> {
  try {
    // Start a transaction to ensure all inserts succeed or fail together
    const results = await db.transaction(async (trx: any) => {
      const categories: CategorizableTable[] = []

      for (const item of data) {
        const categoryData = {
          name: item.name,
          slug: slugify(item.name),
          description: item.description,
          categorizable_type: item.categorizable_type,
          is_active: item.is_active ?? true,
        }

        // Insert into categorizable table
        const category = await trx
          .insertInto('categorizables')
          .values(categoryData)
          .returningAll()
          .executeTakeFirst()

        if (!category)
          throw new Error(`Failed to create category: ${item.name}`)

        categories.push(category as CategorizableTable)
      }

      return categories
    })

    return results
  }
  catch (error) {
    if (error instanceof Error)
      throw new TypeError(`Failed to create categories: ${error.message}`)

    throw error
  }
}
