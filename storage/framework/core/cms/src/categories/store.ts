import type { CategorizableModelsTable, CategorizableTable } from '@stacksjs/orm'
import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'
import { slugify } from 'ts-slug'

interface CategoryData {
  name: string
  description?: string
  categorizable_id: number
  categorizable_type: string
  is_active?: boolean
}

interface CategorizableModelData {
  category_id: number
  categorizable_id: number
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
    const categoryData = {
      name: data.name,
      slug: slugify(data.name),
      description: data.description,
      categorizable_id: data.categorizable_id,
      categorizable_type: data.categorizable_type,
      is_active: data.is_active ?? true,
    }

    // Start a transaction to ensure both inserts succeed or fail together
    const result = await db.transaction().execute(async (trx) => {
      // Insert into categorizable table first
      const category = await trx
        .insertInto('categorizable')
        .values(categoryData)
        .returningAll()
        .executeTakeFirst()

      if (!category)
        throw new Error('Failed to create category')

      // Insert into categorizable_models pivot table
      const pivotData = {
        category_id: category.id!, // We know this exists because we checked category exists
        categorizable_id: data.categorizable_id,
        categorizable_type: data.categorizable_type,
      }

      await trx
        .insertInto('categorizable_models')
        .values(pivotData)
        .execute()

      return category
    })

    return result
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
      categorizable_id: data.categorizable_id,
      categorizable_type: data.categorizable_type,
    }

    const result = await db
      .insertInto('categorizable_models')
      .values(modelData)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to create categorizable model relationship')

    return result
  }
  catch (error) {
    if (error instanceof Error)
      throw new TypeError(`Failed to create categorizable model relationship: ${error.message}`)

    throw error
  }
}
