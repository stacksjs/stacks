import type { PageBlock } from '../blocks/types'
import { formatDate } from '@stacksjs/orm'
import { slugify } from 'ts-slug'
import { parseStoredBlocks, validateBlocks } from '../blocks/registry'
import { getDb } from '../database'
import { recordSlugChangeRedirects } from '../redirects'
import { storeRevision } from '../revisions'

export interface SavePageDocumentInput {
  title: string
  /** Requested slug; empty derives from the title. Root pages may use '/'. */
  slug?: string
  parentId?: number | null
  template?: string
  blocks?: unknown
  metaDescription?: string | null
  status?: 'draft' | 'published' | 'scheduled' | 'archived'
  scheduledAt?: string | null
  authorId?: number | null
  note?: string | null
}

export interface SavedPageDocument {
  id: number
  path: string
  blocks: PageBlock[]
}

interface PageRow {
  id: number
  site_id: number
  parent_id: number | null
  title: string
  slug: string | null
  path: string | null
  blocks: string | null
  meta_description: string | null
}

class PageDocumentError extends Error {
  readonly status = 422
  constructor(message: string, readonly details?: unknown) {
    super(message)
    this.name = 'PageDocumentError'
  }
}

async function parentPath(db: Awaited<ReturnType<typeof getDb>>, siteId: number, parentId: number | null | undefined): Promise<string> {
  if (!parentId)
    return ''

  const parent = await db
    .selectFrom('pages')
    .where('id', '=', parentId)
    .where('site_id', '=', siteId)
    .select(['path'])
    .executeTakeFirst() as { path: string | null } | undefined

  if (!parent?.path)
    throw new PageDocumentError(`Parent page ${parentId} not found on this site`)

  return parent.path === '/' ? '' : parent.path
}

async function uniquePathFor(
  db: Awaited<ReturnType<typeof getDb>>,
  siteId: number,
  basePath: string,
  requestedSlug: string,
  excludePageId?: number,
): Promise<{ slug: string, path: string }> {
  const cleaned = slugify(requestedSlug)
  if (!cleaned)
    throw new PageDocumentError('Slug resolves to an empty string')

  let candidate = cleaned
  for (let attempt = 2; attempt < 100; attempt++) {
    const path = `${basePath}/${candidate}`
    let query = db
      .selectFrom('pages')
      .where('site_id', '=', siteId)
      .where('path', '=', path)
      .select(['id'])
    if (excludePageId)
      query = query.where('id', '!=', excludePageId)

    const clash = await query.executeTakeFirst() as { id: number } | undefined
    if (!clash)
      return { slug: candidate, path }

    candidate = `${cleaned}-${attempt}`
  }

  throw new PageDocumentError(`Could not find a free path for "${cleaned}"`)
}

/**
 * Create a page as a validated block document. `siteId` is a REQUIRED first
 * argument - the route boundary resolves it once (`requireSite()` for public
 * surfaces, the site switcher for the dashboard); nothing in this layer
 * defaults it from ambient context.
 */
export async function createPageDocument(siteId: number, input: SavePageDocumentInput): Promise<SavedPageDocument> {
  const db = await getDb()

  const validated = await validateBlocks(input.blocks ?? [])
  if (!validated.ok)
    throw new PageDocumentError('Invalid page blocks', validated.errors)

  const isRoot = input.slug === '/'
  const base = isRoot ? '' : await parentPath(db, siteId, input.parentId)
  const { slug, path } = isRoot
    ? { slug: '/', path: '/' }
    : await uniquePathFor(db, siteId, base, input.slug || input.title)

  const now = formatDate(new Date())
  const written = await db
    .insertInto('pages')
    .values({
      site_id: siteId,
      author_id: input.authorId ?? null,
      parent_id: isRoot ? null : input.parentId ?? null,
      title: input.title,
      slug,
      path,
      template: input.template ?? 'default',
      blocks: JSON.stringify(validated.blocks),
      meta_description: input.metaDescription ?? null,
      status: input.status ?? 'draft',
      scheduled_at: input.scheduledAt ?? null,
      published_at: input.status === 'published' ? now : null,
      views: 0,
      conversions: 0,
      created_at: now,
      updated_at: now,
    })
    .returningAll()
    .executeTakeFirst() as { id?: number } | undefined

  const id = Number(written?.id)
  if (!id) {
    // SQLite ignores RETURNING on some paths; re-select by unique (site, path).
    const row = await db
      .selectFrom('pages')
      .where('site_id', '=', siteId)
      .where('path', '=', path)
      .select(['id'])
      .executeTakeFirst() as { id: number } | undefined
    if (!row)
      throw new Error('Failed to create page')
    return { id: Number(row.id), path, blocks: validated.blocks }
  }

  return { id, path, blocks: validated.blocks }
}

/**
 * Update a page as a document: validates blocks, snapshots the previous
 * state as a revision, recomputes `path` when the slug or parent moved,
 * rewrites descendant paths, and records 301s for every path that changed.
 */
export async function updatePageDocument(siteId: number, pageId: number, input: SavePageDocumentInput): Promise<SavedPageDocument> {
  const db = await getDb()

  const current = await db
    .selectFrom('pages')
    .where('id', '=', pageId)
    .where('site_id', '=', siteId)
    .select(['id', 'site_id', 'parent_id', 'title', 'slug', 'path', 'blocks', 'meta_description'])
    .executeTakeFirst() as PageRow | undefined

  if (!current)
    throw new PageDocumentError(`Page ${pageId} not found on this site`)

  const validated = await validateBlocks(input.blocks ?? [])
  if (!validated.ok)
    throw new PageDocumentError('Invalid page blocks', validated.errors)

  await storeRevision(pageId, {
    title: current.title,
    blocks: current.blocks,
    metaDescription: current.meta_description,
  }, { authorId: input.authorId, note: input.note ?? null })

  const isRoot = (input.slug ?? current.slug) === '/'
  const nextParentId = input.parentId !== undefined ? input.parentId : current.parent_id
  const base = isRoot ? '' : await parentPath(db, siteId, nextParentId)
  const requestedSlug = input.slug || current.slug || input.title
  const { slug, path } = isRoot
    ? { slug: '/', path: '/' }
    : await uniquePathFor(db, siteId, base, requestedSlug, pageId)

  const now = formatDate(new Date())
  await db
    .updateTable('pages')
    .set({
      title: input.title,
      slug,
      path,
      parent_id: isRoot ? null : nextParentId ?? null,
      ...(input.template !== undefined && { template: input.template }),
      blocks: JSON.stringify(validated.blocks),
      meta_description: input.metaDescription ?? null,
      ...(input.status !== undefined && { status: input.status }),
      ...(input.scheduledAt !== undefined && { scheduled_at: input.scheduledAt }),
      ...(input.status === 'published' && { published_at: now }),
      updated_at: now,
    })
    .where('id', '=', pageId)
    .execute()

  // The page moved: rewrite descendant paths and leave redirects behind for
  // every path that changed, the page's own included.
  if (current.path && current.path !== path) {
    const moves = [{ fromPath: current.path, toPath: path }]

    const descendants = await db
      .selectFrom('pages')
      .where('site_id', '=', siteId)
      .where('path', 'like', `${current.path}/%`)
      .select(['id', 'path'])
      .execute() as { id: number, path: string }[]

    for (const descendant of descendants) {
      const nextPath = path + descendant.path.slice(current.path.length)
      await db
        .updateTable('pages')
        .set({ path: nextPath, updated_at: now })
        .where('id', '=', descendant.id)
        .execute()
      moves.push({ fromPath: descendant.path, toPath: nextPath })
    }

    await recordSlugChangeRedirects(siteId, moves)
  }

  return { id: pageId, path, blocks: validated.blocks }
}

export { PageDocumentError }

/** A page as an editor needs it: meta, parsed blocks, and where it lives. */
export interface EditablePageDocument {
  id: number
  siteId: number
  title: string
  slug: string
  path: string
  parentId: number | null
  template: string | null
  metaDescription: string | null
  status: string
  scheduledAt: string | null
  publishedAt: string | null
  updatedAt: string | null
  blocks: PageBlock[]
}

/**
 * Load one page for editing, scoped to its site.
 *
 * `pages.fetchById` returns the raw row, which leaves every caller to parse
 * `blocks` themselves and - more to the point - to remember the site check. An
 * editor that looks a page up by id alone will happily open another tenant's
 * page, so `siteId` is required and the lookup is scoped by it.
 *
 * Returns null when the page does not exist ON THAT SITE, which is the same
 * answer as "not found" and deliberately indistinguishable from it.
 */
export async function fetchPageDocument(siteId: number, pageId: number): Promise<EditablePageDocument | null> {
  const db = await getDb()

  const row = await db
    .selectFrom('pages')
    .where('id', '=', pageId)
    .where('site_id', '=', siteId)
    .selectAll()
    .executeTakeFirst() as Record<string, unknown> | undefined

  if (!row)
    return null

  return {
    id: Number(row.id),
    siteId: Number(row.site_id),
    title: String(row.title ?? ''),
    slug: String(row.slug ?? ''),
    path: String(row.path ?? ''),
    parentId: row.parent_id === null || row.parent_id === undefined ? null : Number(row.parent_id),
    template: row.template === null || row.template === undefined ? null : String(row.template),
    metaDescription: row.meta_description === null || row.meta_description === undefined ? null : String(row.meta_description),
    status: String(row.status ?? 'draft'),
    scheduledAt: row.scheduled_at === null || row.scheduled_at === undefined ? null : String(row.scheduled_at),
    publishedAt: row.published_at === null || row.published_at === undefined ? null : String(row.published_at),
    updatedAt: row.updated_at === null || row.updated_at === undefined ? null : String(row.updated_at),
    blocks: parseStoredBlocks(row.blocks),
  }
}
