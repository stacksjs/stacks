import type { NewPage, PageJsonResponse } from '@stacksjs/orm'
import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'

/**
 * Create a new page
 *
 * @param data The page data to create
 * @returns The created page record
 */
export async function store(data: NewPage): Promise<PageJsonResponse> {
  try {
    const pageData = {
      author_id: data.author_id,
      title: data.title,
      template: data.template,
      views: data.views || 0,
      conversions: data.conversions || 0,
      created_at: formatDate(new Date()),
      updated_at: formatDate(new Date()),
    }

    const result = await db
      .insertInto('pages')
      .values(pageData)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to create page')

    return result
  }
  catch (error) {
    if (error instanceof Error)
      throw new TypeError(`Failed to create page: ${error.message}`)

    throw error
  }
}
