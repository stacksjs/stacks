type PageJsonResponse = ModelRow<typeof Page>
type NewPage = NewModelData<typeof Page>
import { formatDate } from '@stacksjs/orm'
import { getDb } from '../database'
import { resolveWrittenRow } from '../results'
import { createPageDocument } from './document'

/**
 * Create a new page.
 *
 * A page belongs to a site and is found by its path, so `site_id` decides
 * which of the two ways this runs.
 *
 * WITH a site, the work belongs to `createPageDocument`: it validates the
 * blocks, derives a unique path under the parent, and writes the columns the
 * serving layer reads. This function used to write `author_id`, `title`,
 * `template`, `views` and `conversions` and nothing else - so a page created
 * through it had no `site_id`, no `path` and no `blocks`, and `resolvePublishedPage`
 * could never return it. The insert succeeded, the caller got a row back, and
 * the page simply did not exist as far as the website was concerned.
 *
 * WITHOUT a site, the legacy shape is preserved for the single-site apps that
 * predate site scoping, rather than throwing at them.
 *
 * @param data The page data to create
 * @returns The created page record
 */
export async function store(data: NewPage): Promise<PageJsonResponse> {
  const db = await getDb()

  if (data.site_id) {
    const saved = await createPageDocument(Number(data.site_id), {
      title: String(data.title ?? ''),
      slug: String(data.slug ?? data.path ?? data.title ?? ''),
      parentId: data.parent_id === null || data.parent_id === undefined ? undefined : Number(data.parent_id),
      authorId: data.author_id === null || data.author_id === undefined ? undefined : Number(data.author_id),
      template: data.template === null || data.template === undefined ? undefined : String(data.template),
      metaDescription: data.meta_description === null || data.meta_description === undefined ? undefined : String(data.meta_description),
      status: data.status as 'draft' | 'published' | 'scheduled' | undefined,
      blocks: parseIncomingBlocks(data.blocks),
    })

    // Re-select the whole row rather than handing back the document result:
    // callers expect a page record, and one missing `site_id` and `path` is
    // exactly the shape this function used to return by mistake.
    const result = await db
      .selectFrom('pages')
      .selectAll()
      .where('id', '=', saved.id)
      .executeTakeFirst() as PageJsonResponse | undefined

    if (!result)
      throw new Error('Failed to create page')

    return result
  }

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

    const written = await db
      .insertInto('pages')
      .values(pageData)
      .returningAll()
      .executeTakeFirst()

    const result = await resolveWrittenRow<PageJsonResponse>(db, 'pages', written)

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

/**
 * Blocks arrive either already parsed (a dashboard action) or as the JSON
 * string a form posted. Both are accepted; anything else becomes an empty
 * document, which `validateBlocks` will accept and the editor can fill in.
 */
function parseIncomingBlocks(blocks: unknown): Array<{ type: string, props?: Record<string, unknown> }> {
  if (Array.isArray(blocks))
    return blocks as Array<{ type: string, props?: Record<string, unknown> }>

  if (typeof blocks === 'string' && blocks.trim()) {
    try {
      const parsed = JSON.parse(blocks)
      return Array.isArray(parsed) ? parsed : []
    }
    catch {
      return []
    }
  }

  return []
}
