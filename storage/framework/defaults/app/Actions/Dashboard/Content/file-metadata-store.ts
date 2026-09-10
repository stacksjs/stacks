import type { StorageItemMetadata, StorageMetadataStore } from './file-metadata'
import { db, sqlDateTime } from '@stacksjs/database'
import { isEmptyMetadata, isUnderPrefix, normalizeTags, repathUnderPrefix, STORAGE_ITEM_TYPE } from './file-metadata'

/**
 * The database-backed {@link StorageMetadataStore} (stacksjs/stacks#2577).
 *
 * Split from `file-metadata.ts` so the reconciliation rules there can be tested
 * without a database - the file manager makes the same split with its `Manager`
 * parameter, and for the same reason.
 *
 * Two tables. `storage_items` holds the row per `(disk, path)`; tags go through
 * `taggables` and `taggable_models`, which is the trait the CMS already uses and
 * which #2577 asks for by name. `taggable_type` is `storage_items`, so a file's
 * tags and a post's live in the same vocabulary table without colliding.
 *
 * Written against the query builder rather than the `StorageItem` model because
 * every operation here is a set operation - one query for a subtree, one prefix
 * update for a folder rename - and doing those a row at a time through the model
 * would turn a folder of a thousand files into a thousand round trips.
 */

interface StorageItemRow {
  id: number
  disk: string
  path: string
  favorite: number | boolean | null
}

function toBoolean(value: number | boolean | null | undefined): boolean {
  // SQLite has no boolean type, so `favorite` comes back as 0/1 here and as a
  // real boolean on Postgres and MySQL.
  return value === true || value === 1
}

/**
 * The rows for a subtree, keyed by path.
 *
 * `prefix` matches the path itself as well as everything under it, so a single
 * path can be looked up with the same call the listing uses - which is what lets
 * `setFavorite` read-before-write without a second query shape.
 */
async function rowsUnder(disk: string, prefix: string): Promise<StorageItemRow[]> {
  // Cast through `unknown`: the query builder types a `selectAll()` on a table
  // it has no generated interface for as `Record<string, unknown>`, and the two
  // shapes do not overlap enough for a direct assertion. The columns are the
  // ones the migration creates.
  const all = async (build: (q: ReturnType<typeof scoped>) => ReturnType<typeof scoped>): Promise<StorageItemRow[]> =>
    await build(scoped(disk)).execute() as unknown as StorageItemRow[]

  if (!prefix)
    return await all(query => query)

  // Two queries rather than one with an OR. The builder's `or` group takes a
  // shape this table has no generated interface for, and an `orWhere` on the
  // fluent chain would bind as `disk = ? AND path = ? OR path LIKE ?` - which
  // reads rows from every other disk. Both of these are indexed, and a subtree
  // read is not a hot path.
  //
  // `LIKE 'prefix/%'` plus the exact match, never `LIKE 'prefix%'`: the looser
  // pattern also matches `reports-archive` when the prefix is `reports`, which
  // is a different folder that happens to share a spelling.
  const [exact, beneath] = await Promise.all([
    all(query => query.where('path', '=', prefix)),
    all(query => query.where('path', 'like', `${escapeLike(prefix)}/%`)),
  ])

  return [...exact, ...beneath]
}

/** The `storage_items` rows for one disk, before any path filter. */
function scoped(disk: string) {
  return db.selectFrom('storage_items').selectAll().where('disk', '=', disk)
}

/**
 * Escape the wildcards `LIKE` would otherwise interpret.
 *
 * A path may legally contain `%` or `_`, and an unescaped `_` matches any
 * character - so a folder named `q_1` would sweep `q11` along with itself.
 */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, character => `\\${character}`)
}

async function tagsFor(ids: number[]): Promise<Map<number, string[]>> {
  const byItem = new Map<number, string[]>()
  if (ids.length === 0)
    return byItem

  const rows = await db
    .selectFrom('taggable_models')
    .innerJoin('taggables', 'taggables.id', '=', 'taggable_models.tag_id')
    .select(['taggable_models.taggable_id as itemId', 'taggables.name as name'])
    .where('taggable_models.taggable_type', '=', STORAGE_ITEM_TYPE)
    .where('taggable_models.taggable_id', 'in', ids)
    .execute() as Array<{ itemId: number, name: string }>

  for (const row of rows) {
    const existing = byItem.get(row.itemId)
    if (existing)
      existing.push(row.name)
    else
      byItem.set(row.itemId, [row.name])
  }

  for (const [id, names] of byItem)
    byItem.set(id, normalizeTags(names))

  return byItem
}

/** The `taggables` row for a name, created if this is the first file to use it. */
async function tagIdFor(name: string): Promise<number> {
  const existing = await db
    .selectFrom('taggables')
    .select(['id'])
    .where('name', '=', name)
    .where('taggable_type', '=', STORAGE_ITEM_TYPE)
    .executeTakeFirst() as { id: number } | undefined

  if (existing)
    return existing.id

  await db
    .insertInto('taggables')
    .values({
      name,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
      taggable_type: STORAGE_ITEM_TYPE,
      is_active: true,
      created_at: sqlDateTime(),
      updated_at: sqlDateTime(),
    })
    .execute()

  // Re-selected rather than read from the write's return value, which on SQLite
  // is only `{ changes, lastInsertRowid }`.
  const created = await db
    .selectFrom('taggables')
    .select(['id'])
    .where('name', '=', name)
    .where('taggable_type', '=', STORAGE_ITEM_TYPE)
    .executeTakeFirst() as { id: number } | undefined

  if (!created)
    throw new Error(`[file-metadata] failed to create the tag "${name}"`)

  return created.id
}

async function itemIdFor(disk: string, path: string): Promise<number | undefined> {
  const row = await db
    .selectFrom('storage_items')
    .select(['id'])
    .where('disk', '=', disk)
    .where('path', '=', path)
    .executeTakeFirst() as { id: number } | undefined

  return row?.id
}

async function deleteItems(ids: number[]): Promise<void> {
  if (ids.length === 0)
    return

  // Pivot rows first: a `storage_items` row removed while its pivot rows remain
  // leaves tags attached to an id that will eventually be reused by a different
  // file, which is how somebody else's tags appear on your upload.
  await db
    .deleteFrom('taggable_models')
    .where('taggable_type', '=', STORAGE_ITEM_TYPE)
    .where('taggable_id', 'in', ids)
    .execute()

  await db.deleteFrom('storage_items').where('id', 'in', ids).execute()
}

export const databaseMetadataStore: StorageMetadataStore = {
  async under(disk, prefix) {
    const rows = await rowsUnder(disk, prefix)
    const tags = await tagsFor(rows.map(row => row.id))

    const records = new Map<string, StorageItemMetadata>()
    for (const row of rows) {
      records.set(row.path, {
        favorite: toBoolean(row.favorite),
        tags: tags.get(row.id) ?? [],
      })
    }

    return records
  },

  async write(disk, path, metadata) {
    const existingId = await itemIdFor(disk, path)

    if (isEmptyMetadata(metadata)) {
      // Nothing left to say about this file, so the row goes. A row recording
      // "not starred, no tags" is indistinguishable from no row, and keeping it
      // would grow the table by one for every file anybody ever starred and
      // then unstarred.
      if (existingId !== undefined)
        await deleteItems([existingId])
      return
    }

    let id = existingId
    if (id === undefined) {
      await db
        .insertInto('storage_items')
        .values({
          disk,
          path,
          favorite: metadata.favorite,
          created_at: sqlDateTime(),
          updated_at: sqlDateTime(),
          uuid: crypto.randomUUID(),
        })
        .execute()

      id = await itemIdFor(disk, path)
      if (id === undefined)
        throw new Error(`[file-metadata] failed to create the record for ${disk}:${path}`)
    }
    else {
      await db
        .updateTable('storage_items')
        .set({ favorite: metadata.favorite, updated_at: sqlDateTime() })
        .where('id', '=', id)
        .execute()
    }

    // Tags are replaced rather than merged: the caller sends the whole set,
    // because a UI that can add a tag can also remove one and there is no
    // separate signal for that.
    await db
      .deleteFrom('taggable_models')
      .where('taggable_type', '=', STORAGE_ITEM_TYPE)
      .where('taggable_id', '=', id)
      .execute()

    for (const name of metadata.tags) {
      await db
        .insertInto('taggable_models')
        .values({
          tag_id: await tagIdFor(name),
          taggable_id: id,
          taggable_type: STORAGE_ITEM_TYPE,
          created_at: sqlDateTime(),
          updated_at: sqlDateTime(),
        })
        .execute()
    }
  },

  async move(disk, from, to) {
    const rows = await rowsUnder(disk, from)
    if (rows.length === 0)
      return 0

    // Read, repath and write each row rather than one `UPDATE ... SET path =
    // REPLACE(path, ...)`: the SQL form differs across the three engines this
    // supports, and a folder rename is a handful of rows, not a hot path.
    //
    // A destination that already has a row is overwritten, matching the storage
    // move it is following - `renameDashboardFile` has already replaced the file
    // at `to`, so leaving its old metadata behind would describe the file that
    // is gone.
    for (const row of rows) {
      const next = repathUnderPrefix(row.path, from, to)
      if (next === row.path)
        continue

      const collision = await itemIdFor(disk, next)
      if (collision !== undefined && collision !== row.id)
        await deleteItems([collision])

      await db
        .updateTable('storage_items')
        .set({ path: next, updated_at: sqlDateTime() })
        .where('id', '=', row.id)
        .execute()
    }

    return rows.length
  },

  async forget(disk, path) {
    const rows = await rowsUnder(disk, path)
    await deleteItems(rows.map(row => row.id))
    return rows.length
  },

  async sweep(disk, prefix, keep) {
    const rows = await rowsUnder(disk, prefix)
    const orphans = rows.filter(row => isUnderPrefix(row.path, prefix) && !keep.has(row.path))
    await deleteItems(orphans.map(row => row.id))
    return orphans.length
  },
}

export type { StorageItemMetadata, StorageMetadataStore }
