import type { PageBlock } from '../blocks/types'
import { parseStoredBlocks } from '../blocks/registry'
import { getDb } from '../database'

export interface PublishedPage {
  id: number
  siteId: number
  title: string
  path: string
  template: string
  metaDescription: string | null
  blocks: PageBlock[]
  publishedAt: string | null
}

/** Trim a trailing slash (except the root) so `/about/` and `/about` are one page. */
export function normalizePath(path: string): string {
  if (!path.startsWith('/'))
    path = `/${path}`
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path
}

/**
 * The published page at `path` on a site, or null. Only `status='published'`
 * rows with a past `published_at` serve - a draft or scheduled page is
 * invisible here no matter what its path says, which is the entire reason
 * public reads do not ride the pages API.
 */
export async function resolvePublishedPage(siteId: number, rawPath: string): Promise<PublishedPage | null> {
  const db = await getDb()
  const path = normalizePath(rawPath)

  const row = await db
    .selectFrom('pages')
    .where('site_id', '=', siteId)
    .where('path', '=', path)
    .where('status', '=', 'published')
    .select(['id', 'site_id', 'title', 'path', 'template', 'meta_description', 'blocks', 'published_at'])
    .executeTakeFirst() as {
    id: number
    site_id: number
    title: string
    path: string
    template: string
    meta_description: string | null
    blocks: string | null
    published_at: string | null
  } | undefined

  if (!row)
    return null

  return {
    id: Number(row.id),
    siteId: Number(row.site_id),
    title: row.title,
    path: row.path,
    template: row.template,
    metaDescription: row.meta_description,
    blocks: parseStoredBlocks(row.blocks),
    publishedAt: row.published_at,
  }
}
