import type { TaggableTable } from '@stacksjs/orm'
import { db } from '@stacksjs/database'
import { uniqueSlug } from '@stacksjs/slug'

interface UpdateTagData {
  id: number
  name?: string
  slug?: string
  description?: string
  is_active?: boolean
  taggable_id?: number
  taggable_type?: string
}

/**
 * Update a tag
 *
 * @param id The tag id
 * @param data The tag data to update
 * @returns The updated tag record
 */
export async function update(data: UpdateTagData): Promise<TaggableTable> {
  try {
    const id = data.id

    if (!id) {
      throw new Error('Tag ID is required for update')
    }

    if (data.name !== undefined) {
      if (data.name.trim() === '') {
        throw new Error('Tag name cannot be empty')
      }

      const slug = await uniqueSlug(data.name, { table: 'taggables', column: 'slug' })

      // Enforce unique slugs on update
      const existingSlug = await db
        .selectFrom('taggables')
        .selectAll()
        .where('slug', '=', slug)
        .where('id', '!=', id)
        .executeTakeFirst()

      if (existingSlug) {
        throw new Error(`Tag with unique slug "${slug}" already exists`)
      }

      data.slug = slug
    }

    // Remove id from the data to avoid updating it
    const { id: _id, ...updateData } = data

    const result = await db
      .updateTable('taggables')
      .set(updateData as unknown as Record<string, unknown>)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to update tag')

    return result as unknown as TaggableTable
  }
  catch (error) {
    if (error instanceof Error)
      throw new TypeError(`Failed to update tag: ${error.message}`)

    throw error
  }
}
