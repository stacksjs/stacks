import type { CategorizableTable } from '@stacksjs/orm'
import { db } from '@stacksjs/database'
import { slugify } from 'ts-slug'

/**
 * Fetch a category by ID
 */
export async function fetchById(id: number): Promise<CategorizableTable | undefined> {
  return await db
    .selectFrom('categorizables')
    .where('id', '=', id)
    .where('is_active', '=', true)
    .selectAll()
    .executeTakeFirst()
}

/**
 * Fetch all categories
 */
export async function fetchAll(): Promise<CategorizableTable[]> {
  return await db.selectFrom('categorizables').selectAll().execute()
}

/**
 * Fetch categories by name
 */
export async function fetchByName(name: string): Promise<CategorizableTable[]> {
  return await db
    .selectFrom('categorizables')
    .where('name', '=', name)
    .where('is_active', '=', true)
    .selectAll()
    .execute()
}

/**
 * Fetch category by slug
 */
export async function fetchBySlug(slug: string): Promise<CategorizableTable | undefined> {
  return await db
    .selectFrom('categorizables')
    .where('slug', '=', slug)
    .where('is_active', '=', true)
    .selectAll()
    .executeTakeFirst()
}

/**
 * Fetch categories with posts
 */
export async function fetchWithPosts(id: number): Promise<CategorizableTable | undefined> {
  return await db
    .selectFrom('categorizables')
    .where('id', '=', id)
    .where('is_active', '=', true)
    .selectAll()
    .executeTakeFirst()
}

/**
 * Find a category by name or create it if it doesn't exist
 *
 * @param name The name of the category to find or create
 * @param categorizableType Type of the categorizable entity
 * @param description Optional description for the category
 * @returns The existing or newly created category
 */
export async function firstOrCreate(
  name: string,
  categorizableType: string,
  description?: string,
): Promise<CategorizableTable> {
  try {
    // First try to find the category by name
    const existingCategory = await db
      .selectFrom('categorizables')
      .selectAll()
      .where('name', '=', name)
      .executeTakeFirst()

    if (existingCategory) {
      return existingCategory
    }

    // If category doesn't exist, create it
    const now = new Date()
    const categoryData = {
      name,
      slug: slugify(name),
      description,
      is_active: true,
      created_at: now.toDateString(),
      categorizable_type: categorizableType,
    }

    const result = await db
      .insertInto('categorizables')
      .values(categoryData)
      .returningAll()
      .executeTakeFirst()

    if (!result) {
      throw new Error('Failed to create category')
    }

    return result
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to find or create category: ${error.message}`)
    }

    throw error
  }
}
