import type { CategorizableTable } from '@stacksjs/orm'
import type { Request } from '@stacksjs/router'
import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'
import { slugify } from 'ts-slug'
type CategorizableUpdate = Partial<Omit<CategorizableTable, 'id' | 'created_at'>>

/**
 * Update a category by ID
 *
 * @param id The ID of the category to update
 * @param request The updated category data
 * @returns The updated category record
 */
export async function update(id: number, request: Request): Promise<CategorizableTable | undefined> {
  try {
    await request.validate()

    const updateData: CategorizableUpdate = {
      name: request.get('name'),
      description: request.get('description'),
      slug: slugify(request.get('name')),
      categorizable_id: request.get('categorizable_id'),
      categorizable_type: request.get('categorizable_type'),
      is_active: request.get<boolean>('is_active'),
      updated_at: formatDate(new Date()),
    }

    if (Object.keys(updateData).length === 0) {
      return await db
        .selectFrom('categorizable')
        .where('id', '=', id)
        .selectAll()
        .executeTakeFirst()
    }

    await db
      .updateTable('categorizable')
      .set(updateData)
      .where('id', '=', id)
      .execute()

    const updatedCategory = await db
      .selectFrom('categorizable')
      .where('id', '=', id)
      .selectAll()
      .executeTakeFirst()

    return updatedCategory
  }
  catch (error) {
    if (error instanceof Error)
      throw new TypeError(`Failed to update category: ${error.message}`)

    throw error
  }
}
