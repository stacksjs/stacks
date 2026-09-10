import { posix } from 'node:path'

/**
 * The dashboard file manager's metadata layer (stacksjs/stacks#2577).
 *
 * Everything the file manager could already do maps to a `StorageAdapter`
 * method. Favourites and tags do not: a disk knows a path, some bytes, a size
 * and an ACL, and there is nowhere on it to record that somebody starred a
 * file. `app/Models/StorageItem.ts` is where that lives, and this is the layer
 * between it and the file manager.
 *
 * ## The disk is authoritative, these rows are advisory
 *
 * The question #2577 asks to settle before anything else, because the answer
 * decides the rest. A bucket several systems write to changes without the
 * dashboard's knowledge, so a table claiming to describe its contents would be
 * wrong within a day of being right. So:
 *
 * - The listing comes from the disk. Rows are joined onto it, and a path with
 *   no row is a file with nothing recorded about it - which is most files, and
 *   is why unstarring deletes the row rather than storing `false`.
 * - A row whose path no longer exists is an orphan, and is never rendered
 *   because nothing renders rows. {@link sweepMetadata} removes the orphans a
 *   listing has just PROVED are orphans - the ones under a prefix it walked to
 *   completion - which costs nothing extra because the walk already happened.
 *   Nothing scans a whole disk to garbage collect.
 * - Renames and deletes made through the dashboard reconcile eagerly, so a
 *   starred file keeps its star as it moves. A folder is a prefix update,
 *   because moving a folder moves everything beneath it.
 *
 * The consequence, stated rather than left to be discovered: a file renamed
 * OUTSIDE the dashboard loses its metadata. Nothing connects the old path to
 * the new one - to a bucket listing a rename and a copy-then-delete are the
 * same two events - so any reconciliation there would be a guess, and a guess
 * that moves somebody's tags onto the wrong file is worse than losing them.
 */

/** What the dashboard records about one file. */
export interface StorageItemMetadata {
  favorite: boolean
  tags: string[]
}

/**
 * The three kinds of background work a file can carry (stacksjs/stacks#2578).
 *
 * `optimize` builds the image variants, `transcode` the mp4 and HLS renditions,
 * `tag` asks a vision model what is in the file. Independent: a video whose
 * transcode finished and whose tagging failed is a normal state.
 */
export type StorageTaskKind = 'optimize' | 'transcode' | 'tag'

export type StorageTaskState = 'queued' | 'running' | 'done' | 'failed'

/** One unit of background work, as the dashboard sees it. */
export interface StorageItemTask {
  kind: StorageTaskKind
  state: StorageTaskState
  attempts: number
  error?: string
  startedAt?: string
  finishedAt?: string
}

/** Every task kind, in the order a file would run them. */
export const STORAGE_TASK_KINDS: readonly StorageTaskKind[] = ['optimize', 'transcode', 'tag']

/** The `taggable_type` these rows use, which keeps them apart from the CMS's. */
export const STORAGE_ITEM_TYPE = 'storage_items'

const EMPTY: StorageItemMetadata = { favorite: false, tags: [] }

/**
 * Storage for the metadata, behind an interface.
 *
 * The file manager already takes its `Storage` manager as a parameter so its
 * tests do not need a disk; this is the same move for the same reason. The
 * default implementation is in `file-metadata-store.ts`, which reaches the
 * database and the CMS taggables module - neither of which a unit test of the
 * reconciliation rules should have to stand up.
 *
 * Paths are disk-relative and carry no leading slash, exactly as the file
 * manager reports them, so every method here can match on equality rather than
 * normalizing at each call site.
 */
export interface StorageMetadataStore {
  /** Every record on `disk` whose path is `prefix` or sits beneath it. */
  under: (disk: string, prefix: string) => Promise<Map<string, StorageItemMetadata>>
  /** Record `metadata` for one path, or drop the row when it has nothing to say. */
  write: (disk: string, path: string, metadata: StorageItemMetadata) => Promise<void>
  /** Move `from` (and everything beneath it) to `to`. Returns rows moved. */
  move: (disk: string, from: string, to: string) => Promise<number>
  /** Forget `path` and everything beneath it. Returns rows removed. */
  forget: (disk: string, path: string) => Promise<number>
  /** Remove rows under `prefix` whose path is not in `keep`. Returns rows removed. */
  sweep: (disk: string, prefix: string, keep: ReadonlySet<string>) => Promise<number>

  /**
   * Every task on `disk` whose path is `prefix` or beneath it.
   *
   * Kept on the same interface as the metadata rather than a second one,
   * because `move`, `forget` and `sweep` have to reconcile both tables and a
   * caller that could reconcile one without the other would eventually do so.
   */
  tasksUnder: (disk: string, prefix: string) => Promise<Map<string, StorageItemTask[]>>

  /** Record one task, replacing whatever was recorded for that kind. */
  writeTask: (disk: string, path: string, task: StorageItemTask) => Promise<void>
}

/**
 * Whether a record still says anything.
 *
 * A row recording `favorite: false` and no tags is indistinguishable from no
 * row at all, and keeping it would mean the table grows by one row for every
 * file anybody ever starred and unstarred. {@link StorageMetadataStore.write}
 * deletes instead.
 */
export function isEmptyMetadata(metadata: StorageItemMetadata): boolean {
  return !metadata.favorite && metadata.tags.length === 0
}

/**
 * Normalize the tags a caller supplied.
 *
 * Trimmed, emptied entries dropped, case-folded for comparison but stored as
 * first written, and deduplicated. Sorting is deliberate: two callers sending
 * the same tags in a different order should produce the same record, or a
 * "did this change" comparison anywhere upstream is a coin flip.
 */
export function normalizeTags(tags: readonly unknown[]): string[] {
  const seen = new Map<string, string>()

  for (const raw of tags) {
    if (typeof raw !== 'string')
      continue
    const tag = raw.trim()
    if (!tag)
      continue
    const key = tag.toLowerCase()
    if (!seen.has(key))
      seen.set(key, tag)
  }

  return [...seen.values()].sort((a, b) => a.localeCompare(b))
}

/**
 * Whether `path` is `prefix` itself or sits beneath it.
 *
 * The `/` matters. Without it, renaming `reports` would also rewrite
 * `reports-archive`, which is a different folder that happens to share a
 * spelling - the kind of bug that only appears once somebody has both.
 */
export function isUnderPrefix(path: string, prefix: string): boolean {
  if (!prefix)
    return true
  return path === prefix || path.startsWith(`${prefix}/`)
}

/**
 * `path` with a `from` prefix replaced by `to`.
 *
 * Returns `path` unchanged when it is not under `from`, so a caller can map a
 * whole table through this without filtering first.
 */
export function repathUnderPrefix(path: string, from: string, to: string): string {
  if (path === from)
    return to
  if (!isUnderPrefix(path, from))
    return path
  return to ? `${to}/${path.slice(from.length + 1)}` : path.slice(from.length + 1)
}

/**
 * Read the metadata for a subtree, as a map the listing can look paths up in.
 *
 * One query per listing rather than one per file: a folder of 1,000 files would
 * otherwise be 1,000 round trips to answer a question about the handful of them
 * that are starred.
 */
export async function metadataUnder(
  store: StorageMetadataStore,
  disk: string,
  prefix = '',
): Promise<Map<string, StorageItemMetadata>> {
  return await store.under(disk, prefix)
}

/** The metadata for one path, or the empty record when there is no row. */
export function metadataFor(
  records: ReadonlyMap<string, StorageItemMetadata>,
  path: string,
): StorageItemMetadata {
  return records.get(path) ?? EMPTY
}

/**
 * Star or unstar a file, leaving its tags alone.
 *
 * Reads before writing so the two fields do not clobber each other: the
 * dashboard sends them from separate controls, and a star that silently
 * cleared somebody's tags would be found long after the fact.
 */
export async function setFavorite(
  store: StorageMetadataStore,
  disk: string,
  path: string,
  favorite: boolean,
): Promise<StorageItemMetadata> {
  const current = metadataFor(await store.under(disk, path), path)
  const next: StorageItemMetadata = { favorite, tags: current.tags }
  await store.write(disk, path, next)
  return next
}

/** Replace a file's tags, leaving its star alone. */
export async function setTags(
  store: StorageMetadataStore,
  disk: string,
  path: string,
  tags: readonly unknown[],
): Promise<StorageItemMetadata> {
  const current = metadataFor(await store.under(disk, path), path)
  const next: StorageItemMetadata = { favorite: current.favorite, tags: normalizeTags(tags) }
  await store.write(disk, path, next)
  return next
}

/**
 * Follow a rename.
 *
 * Called by `renameDashboardFile` after the storage move succeeds, never
 * before: a failed move that had already rewritten the rows would leave the
 * metadata describing a file that does not exist, which is worse than the
 * metadata being briefly stale.
 *
 * A folder rename moves every row beneath it, which is why this is a prefix
 * operation rather than an update by id.
 */
export async function followRename(
  store: StorageMetadataStore,
  disk: string,
  from: string,
  to: string,
): Promise<number> {
  if (from === to)
    return 0
  return await store.move(disk, from, to)
}

/**
 * Follow a delete.
 *
 * Deleting a folder deletes everything under it, so this forgets the subtree.
 */
export async function followDelete(
  store: StorageMetadataStore,
  disk: string,
  path: string,
): Promise<number> {
  return await store.forget(disk, path)
}

/**
 * Follow a copy.
 *
 * The star and tags come with the copy, because the alternative - a duplicate
 * that silently loses them - reads as the copy having failed. The source keeps
 * its own; `duplicateDashboardFile` is a copy, not a move.
 */
export async function followCopy(
  store: StorageMetadataStore,
  disk: string,
  from: string,
  to: string,
): Promise<void> {
  const source = metadataFor(await store.under(disk, from), from)
  if (isEmptyMetadata(source))
    return
  await store.write(disk, to, source)
}

/**
 * Drop rows for paths a completed listing did not see.
 *
 * Only safe to call with a listing that ran to completion: a truncated one has
 * not proved a path is absent, only that it did not get that far, and sweeping
 * on it would delete the metadata of every file past the limit. The caller
 * passes `truncated` so the decision is made where that is known.
 */
export async function sweepMetadata(
  store: StorageMetadataStore,
  disk: string,
  prefix: string,
  seen: ReadonlySet<string>,
  options: { truncated: boolean },
): Promise<number> {
  if (options.truncated)
    return 0
  return await store.sweep(disk, prefix, seen)
}

/**
 * The one word the file manager shows for a file's processing.
 *
 * Reduces the independent tasks to a status, worst-first, because that is what
 * a caller acts on: a failure is the thing to surface even when two other kinds
 * finished. `null` means no work was ever dispatched for this file, which is
 * not the same as work that finished - an image uploaded before optimization
 * existed should not claim to have been optimized.
 */
export function aggregateTaskState(tasks: readonly StorageItemTask[]): StorageTaskState | null {
  if (tasks.length === 0)
    return null
  if (tasks.some(task => task.state === 'failed'))
    return 'failed'
  if (tasks.some(task => task.state === 'running'))
    return 'running'
  if (tasks.some(task => task.state === 'queued'))
    return 'queued'
  return 'done'
}

/**
 * Which kinds of work a file's content type calls for.
 *
 * Decided from the MIME type rather than the extension, when one is known: a
 * `.mp4` that is actually a PDF should not be handed to a transcoder. Tagging
 * applies to images and video alike, because a vision model can describe a
 * frame as readily as a photograph.
 */
export function tasksForContentType(contentType: string | undefined): StorageTaskKind[] {
  const mime = (contentType ?? '').toLowerCase().split(';')[0]?.trim() ?? ''

  if (mime.startsWith('image/')) {
    // SVG is markup, not a raster: there is nothing to re-encode, and running
    // it through a decoder is a parser attack surface for no benefit.
    if (mime === 'image/svg+xml')
      return []
    return ['optimize', 'tag']
  }

  if (mime.startsWith('video/'))
    return ['transcode', 'tag']

  return []
}

/**
 * Queue the work a file calls for, and record it.
 *
 * Recording happens BEFORE the dispatch and the row is marked failed if the
 * dispatch throws, so a queue that is down leaves a visible failure rather than
 * a file that silently never gets processed. That is the whole reason the state
 * is in a table the dashboard reads rather than only in the queue.
 */
export async function dispatchTasks(
  store: StorageMetadataStore,
  disk: string,
  path: string,
  kinds: readonly StorageTaskKind[],
  dispatch: (kind: StorageTaskKind) => Promise<void>,
): Promise<StorageItemTask[]> {
  const queued: StorageItemTask[] = []

  for (const kind of kinds) {
    const task: StorageItemTask = { kind, state: 'queued', attempts: 0 }
    await store.writeTask(disk, path, task)

    try {
      await dispatch(kind)
      queued.push(task)
    }
    catch (error) {
      const failed: StorageItemTask = {
        kind,
        state: 'failed',
        attempts: 0,
        error: describeError(error),
        finishedAt: new Date().toISOString(),
      }
      await store.writeTask(disk, path, failed)
      queued.push(failed)
    }
  }

  return queued
}

/**
 * Run one task, recording what happened to it either way.
 *
 * The three jobs share this rather than each writing their own transitions,
 * because the transitions are the part a dashboard depends on and three
 * hand-written copies would eventually disagree - one forgetting to clear the
 * error on a successful retry, say, leaving a green file with a red message.
 *
 * Rethrows on failure after recording, so the queue still counts the attempt
 * and applies its backoff. The row and the queue are answering different
 * questions: the queue decides whether to try again, the row is what somebody
 * looking at the file sees.
 */
export async function runTask<T>(
  store: StorageMetadataStore,
  disk: string,
  path: string,
  kind: StorageTaskKind,
  work: () => Promise<T>,
): Promise<T> {
  const previous = (await store.tasksUnder(disk, path)).get(path)?.find(task => task.kind === kind)
  const attempts = (previous?.attempts ?? 0) + 1
  const startedAt = new Date().toISOString()

  await store.writeTask(disk, path, { kind, state: 'running', attempts, startedAt })

  try {
    const result = await work()
    await store.writeTask(disk, path, {
      kind,
      state: 'done',
      attempts,
      startedAt,
      finishedAt: new Date().toISOString(),
      // No `error`, so a retry that succeeds clears the previous failure rather
      // than leaving a done task carrying a stale message.
    })
    return result
  }
  catch (error) {
    await store.writeTask(disk, path, {
      kind,
      state: 'failed',
      attempts,
      startedAt,
      finishedAt: new Date().toISOString(),
      error: describeError(error),
    })
    throw error
  }
}

/** A failure as a string a dashboard can show, bounded so a stack trace cannot fill the column. */
export function describeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message.length > 2000 ? `${message.slice(0, 1997)}...` : message
}

/**
 * A {@link StorageMetadataStore} held in memory.
 *
 * The counterpart to `InMemoryStorageAdapter` next door, and there for the same
 * reason: the file manager's own tests build a real disk in a temp directory
 * and should not also have to stand up a database to assert that a rename
 * carries a star with it. It is a real implementation of the contract, not a
 * stub - which is what makes it worth testing the reconciliation rules against.
 *
 * Not exported from an entry point; production reads
 * `databaseMetadataStore` from `file-metadata-store.ts`.
 */
export function createMemoryMetadataStore(): StorageMetadataStore {
  const rows = new Map<string, StorageItemMetadata>()
  const tasks = new Map<string, StorageItemTask[]>()
  const key = (disk: string, path: string): string => `${disk}\u0000${path}`

  function scan<T>(source: Map<string, T>, disk: string, prefix: string): Array<[string, T]> {
    const found: Array<[string, T]> = []
    for (const [composite, value] of source) {
      const separator = composite.indexOf('\u0000')
      if (composite.slice(0, separator) !== disk)
        continue
      const path = composite.slice(separator + 1)
      if (isUnderPrefix(path, prefix))
        found.push([path, value])
    }
    return found
  }

  function entries(disk: string, prefix: string): Array<[string, StorageItemMetadata]> {
    return scan(rows, disk, prefix)
  }

  return {
    async under(disk, prefix) {
      return new Map(entries(disk, prefix).map(([path, metadata]) => [path, { ...metadata, tags: [...metadata.tags] }]))
    },

    async write(disk, path, metadata) {
      if (isEmptyMetadata(metadata))
        rows.delete(key(disk, path))
      else
        rows.set(key(disk, path), { favorite: metadata.favorite, tags: [...metadata.tags] })
    },

    async move(disk, from, to) {
      const moving = entries(disk, from)
      for (const [path, metadata] of moving) {
        rows.delete(key(disk, path))
        rows.set(key(disk, repathUnderPrefix(path, from, to)), metadata)
      }

      // Tasks follow the file too, or a transcode that finished before a rename
      // reports as never having run.
      for (const [path, list] of scan(tasks, disk, from)) {
        tasks.delete(key(disk, path))
        tasks.set(key(disk, repathUnderPrefix(path, from, to)), list)
      }

      return moving.length
    },

    async forget(disk, path) {
      const going = entries(disk, path)
      for (const [found] of going)
        rows.delete(key(disk, found))
      for (const [found] of scan(tasks, disk, path))
        tasks.delete(key(disk, found))
      return going.length
    },

    async sweep(disk, prefix, keep) {
      const orphans = entries(disk, prefix).filter(([path]) => !keep.has(path))
      for (const [path] of orphans)
        rows.delete(key(disk, path))
      for (const [path] of scan(tasks, disk, prefix).filter(([path]) => !keep.has(path)))
        tasks.delete(key(disk, path))
      return orphans.length
    },

    async tasksUnder(disk, prefix) {
      return new Map(scan(tasks, disk, prefix).map(([path, list]) => [path, list.map(task => ({ ...task }))]))
    },

    async writeTask(disk, path, task) {
      const existing = tasks.get(key(disk, path)) ?? []
      tasks.set(key(disk, path), [...existing.filter(entry => entry.kind !== task.kind), { ...task }])
    },
  }
}

/** The parent directories a path implies, nearest first. Used by the store's prefix queries. */
export function ancestorsOf(path: string): string[] {
  const ancestors: string[] = []
  let current = posix.dirname(path)
  while (current && current !== '.' && current !== '/') {
    ancestors.push(current)
    current = posix.dirname(current)
  }
  return ancestors
}
