import { formatDate } from '@stacksjs/orm'
import { getDb } from '../database'

export interface PageDocumentSnapshot {
  title: string
  blocks: string | null
  metaDescription: string | null
}

export interface PageRevisionRow {
  id: number
  page_id: number
  author_id: number | null
  revision: number
  title: string
  blocks: string | null
  meta_description: string | null
  note: string | null
  created_at: string | null
}

const REVISION_COLUMNS = [
  'id',
  'page_id',
  'author_id',
  'revision',
  'title',
  'blocks',
  'meta_description',
  'note',
  'created_at',
] as const

/**
 * Snapshot a page's CURRENT document before an overwrite. Callers pass the
 * pre-update state; the row records what the save replaced, so "restore
 * revision N" recovers exactly what the editor saw before save N+1.
 * Prunes to the newest `keep` revisions per page.
 */
export async function storeRevision(
  pageId: number,
  snapshot: PageDocumentSnapshot,
  options: { authorId?: number | null, note?: string | null, keep?: number } = {},
): Promise<number> {
  const db = await getDb()
  const keep = options.keep ?? 50

  const latest = await db
    .selectFrom('page_revisions')
    .where('page_id', '=', pageId)
    .select(['revision'])
    .orderBy('revision', 'desc')
    .limit(1)
    .executeTakeFirst() as { revision: number } | undefined

  const revision = (latest?.revision ?? 0) + 1

  await db
    .insertInto('page_revisions')
    .values({
      page_id: pageId,
      author_id: options.authorId ?? null,
      revision,
      title: snapshot.title,
      blocks: snapshot.blocks,
      meta_description: snapshot.metaDescription,
      note: options.note ?? null,
      created_at: formatDate(new Date()),
      updated_at: formatDate(new Date()),
    })
    .execute()

  // Prune beyond the retention window. A second query rather than a clever
  // delete-join: revision counts are tiny and this reads clearly.
  const stale = await db
    .selectFrom('page_revisions')
    .where('page_id', '=', pageId)
    .select(['id'])
    .orderBy('revision', 'desc')
    .offset(keep)
    .limit(1000)
    .execute() as { id: number }[]

  if (stale.length > 0) {
    await db
      .deleteFrom('page_revisions')
      .where('id', 'in', stale.map(row => row.id))
      .execute()
  }

  return revision
}

export async function fetchRevisions(pageId: number, limit = 50): Promise<PageRevisionRow[]> {
  const db = await getDb()
  return await db
    .selectFrom('page_revisions')
    .where('page_id', '=', pageId)
    .select([...REVISION_COLUMNS])
    .orderBy('revision', 'desc')
    .limit(limit)
    .execute() as PageRevisionRow[]
}

/**
 * Copy a revision's document back onto its page. The page's current state is
 * snapshotted first, so a restore is itself undoable.
 */
export async function restoreRevision(revisionId: number, options: { authorId?: number | null } = {}): Promise<void> {
  const db = await getDb()

  const revision = await db
    .selectFrom('page_revisions')
    .where('id', '=', revisionId)
    .select([...REVISION_COLUMNS])
    .executeTakeFirst() as PageRevisionRow | undefined

  if (!revision)
    throw new Error(`Page revision ${revisionId} not found`)

  const page = await db
    .selectFrom('pages')
    .where('id', '=', revision.page_id)
    .select(['id', 'title', 'blocks', 'meta_description'])
    .executeTakeFirst() as { id: number, title: string, blocks: string | null, meta_description: string | null } | undefined

  if (!page)
    throw new Error(`Page ${revision.page_id} not found for revision ${revisionId}`)

  await storeRevision(page.id, {
    title: page.title,
    blocks: page.blocks,
    metaDescription: page.meta_description,
  }, { authorId: options.authorId, note: `before restoring revision ${revision.revision}` })

  await db
    .updateTable('pages')
    .set({
      title: revision.title,
      blocks: revision.blocks,
      meta_description: revision.meta_description,
      updated_at: formatDate(new Date()),
    })
    .where('id', '=', page.id)
    .execute()
}
