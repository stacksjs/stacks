import type { UpdateTagInput } from './store'
import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'

/**
 * Update a tag
 *
 * @param id The ID of the tag to update
 * @param data The data to update
 * @returns The updated tag record
 */
export async function update(id: number, data: UpdateTagInput) {
  try {
    const now = formatDate(new Date())

    const result = await db
      .updateTable('taggable')
      .set({
        ...data,
        updated_at: now,
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!result) {
      throw new Error(`Tag with ID ${id} not found`)
    }

    return result
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update tag: ${error.message}`)
    }

    throw error
  }
}
