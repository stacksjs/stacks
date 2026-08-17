type PageJsonResponse = ModelRow<typeof Page>
type PageUpdate = UpdateModelData<typeof Page>
import { getDb } from '../database'
import { fetchById } from './fetch'
import { isRow } from '../results'
import { formatDate } from '@stacksjs/orm'

/**
 * Update a page.
 *
 * A change to `slug` or `blocks` is not a column write: the slug decides the
 * page's `path` (and every child's path under it), and blocks have to be
 * validated and snapshotted into a revision before they replace what is live.
 * Those go through `updatePageDocument`, which does all three.
 *
 * Everything else - title alone, template, meta description, view counters -
 * is a plain column update, and stays one.
 *
 * @param id The id of the page to update
 * @param data The page data to update
 * @returns The updated page record
 */
export async function update(id: number, data: Partial<PageUpdate>): Promise<PageJsonResponse> {
  const db = await getDb()

  const touchesDocument = data.slug !== undefined || data.blocks !== undefined

  if (touchesDocument) {
    const current = await db
      .selectFrom('pages')
      .where('id', '=', id)
      .select(['id', 'site_id', 'title', 'slug'])
      .executeTakeFirst() as { id: number, site_id: number | null, title: string, slug: string | null } | undefined

    if (!current)
      throw new TypeError(`Failed to update page: page ${id} not found`)

    if (current.site_id) {
      const { updatePageDocument } = await import('./document')

      await updatePageDocument(Number(current.site_id), id, {
        title: String(data.title ?? current.title),
        slug: data.slug === undefined ? (current.slug ?? undefined) : String(data.slug),
        template: data.template === null || data.template === undefined ? undefined : String(data.template),
        metaDescription: data.meta_description === null || data.meta_description === undefined ? undefined : String(data.meta_description),
        status: data.status as 'draft' | 'published' | 'scheduled' | 'archived' | undefined,
        blocks: data.blocks,
      })

      const saved = await fetchById(id)

      if (!saved)
        throw new Error('Failed to update page')

      return saved as PageJsonResponse
    }
  }

  try {
    const updateData = {
      ...data,
      updated_at: formatDate(new Date()),
    }

    const result = await db
      .updateTable('pages')
      .set(updateData)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    // SQLite ignores RETURNING on UPDATE (result is { changes, ... }, and its
    // lastInsertRowid is stale), so re-select by the id we already have.
    if (isRow<PageJsonResponse>(result))
      return result

    const page = await fetchById(id)

    if (!page)
      throw new Error('Failed to update page')

    return page as PageJsonResponse
  }
  catch (error) {
    if (error instanceof Error)
      throw new TypeError(`Failed to update page: ${error.message}`)

    throw error
  }
}
