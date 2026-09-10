import type { ResponseStatus } from '@stacksjs/bun-router'
import { statfs } from 'node:fs/promises'
import { posix } from 'node:path'
import type { JobName } from '@stacksjs/queue'
import type { StorageAdapter, StorageManager, UploadedFileLike, Visibility } from '@stacksjs/storage'
import { Storage } from '@stacksjs/storage'
import type { StorageItemTask, StorageMetadataStore, StorageTaskKind, StorageTaskState } from './file-metadata'
import {
  aggregateTaskState,
  dispatchTasks,
  followCopy,
  followDelete,
  followRename,
  metadataFor as recordFor,
  metadataUnder,
  normalizeTags,
  setFavorite as writeFavorite,
  setTags as writeTags,
  STORAGE_TASK_KINDS,
  sweepMetadata,
  tasksForContentType,
} from './file-metadata'
import { databaseMetadataStore } from './file-metadata-store'

const DEFAULT_DISK = 'public'
const DEFAULT_MAX_ENTRIES = 1000
const MAX_PATH_LENGTH = 2048
const MAX_COMPONENT_LENGTH = 255
const STAT_CONCURRENCY = 24
/** Bounds on what a caller may attach, so one file cannot fill the tag table. */
const MAX_TAGS = 32
const MAX_TAG_LENGTH = 60

export interface DashboardFileNode {
  id: string
  name: string
  type: string
  size: number
  path: string
  lastModified: string | null
  mime_type?: string
  url?: string
  thumbnail?: string
  /**
   * Whether somebody starred this, from `storage_items` rather than from the
   * disk (stacksjs/stacks#2577). It was the literal `false` for as long as
   * there was nowhere to record the answer.
   */
  starred: boolean
  /** Tags from the `taggable` vocabulary, empty for a file nobody has tagged. */
  tags: string[]
  /**
   * The one word for this file's background work (stacksjs/stacks#2578), or
   * `null` when none was ever dispatched - which is not the same as work that
   * finished. Worst-first across the kinds, because a failure is what a viewer
   * needs to see even when two other kinds succeeded.
   */
  processing: StorageTaskState | null
  /** Each kind separately, for a UI that wants to show which half failed. */
  tasks: StorageItemTask[]
  shared: boolean
  items?: DashboardFileNode[]
}

export interface DashboardFileStats {
  files: number
  folders: number
  contentBytes: number
  byType: {
    documents: number
    images: number
    videos: number
    audio: number
    other: number
  }
  disk: {
    totalBytes: number | null
    availableBytes: number | null
    usedBytes: number | null
  }
}

export interface DashboardFileSnapshot {
  disk: string
  disks: Array<{ name: string, public: boolean }>
  root: DashboardFileNode
  stats: DashboardFileStats
  truncated: boolean
  warnings: string[]
}

export class DashboardFileError extends Error {
  readonly status: ResponseStatus
  readonly fields?: Record<string, string>

  constructor(message: string, status: ResponseStatus = 422, fields?: Record<string, string>) {
    super(message)
    this.name = 'DashboardFileError'
    this.status = status
    this.fields = fields
  }
}

type Manager = Pick<StorageManager, 'disk' | 'getConfiguredDisks' | 'getDiskConfig' | 'put'>

interface StorageEntry {
  path: string
  type: 'file' | 'directory'
}

interface EntryMetadata extends StorageEntry {
  size: number
  lastModified: string | null
  mimeType?: string
  url?: string
  thumbnail?: string
  warnings: string[]
}

function extensionOf(path: string): string {
  const extension = posix.extname(path).slice(1).toLowerCase()
  return extension || 'file'
}

function normalizeListedPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/')
}

function containsHiddenComponent(path: string): boolean {
  return path.split('/').some(component => component.startsWith('.'))
}

export function normalizeDashboardFilePath(value: unknown, options: { allowEmpty?: boolean } = {}): string {
  if (typeof value !== 'string')
    throw new DashboardFileError('Path must be a string.', 422, { path: 'Path must be a string.' })

  const path = value.trim()
  if (!path) {
    if (options.allowEmpty)
      return ''
    throw new DashboardFileError('Path is required.', 422, { path: 'Path is required.' })
  }
  if (path.length > MAX_PATH_LENGTH)
    throw new DashboardFileError(`Path must not exceed ${MAX_PATH_LENGTH} characters.`, 422, { path: 'Path is too long.' })
  if (path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path))
    throw new DashboardFileError('Path must be relative to the selected disk.', 422, { path: 'Absolute paths are not allowed.' })
  if (path.includes('\\'))
    throw new DashboardFileError('Path must use forward slashes.', 422, { path: 'Backslashes are not allowed.' })
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1F\x7F]/.test(path))
    throw new DashboardFileError('Path contains a control character.', 422, { path: 'Control characters are not allowed.' })

  const components = path.split('/')
  if (components.some(component => !component || component === '.' || component === '..'))
    throw new DashboardFileError('Path contains an invalid segment.', 422, { path: 'Empty and traversal segments are not allowed.' })
  if (components.some(component => component.length > MAX_COMPONENT_LENGTH))
    throw new DashboardFileError(`Path segments must not exceed ${MAX_COMPONENT_LENGTH} characters.`, 422, { path: 'A path segment is too long.' })

  return components.join('/')
}

export function normalizeDashboardFileName(value: unknown): string {
  if (typeof value !== 'string')
    throw new DashboardFileError('Name must be a string.', 422, { name: 'Name must be a string.' })

  const name = value.trim()
  if (!name)
    throw new DashboardFileError('Name is required.', 422, { name: 'Name is required.' })
  if (name === '.' || name === '..' || name.startsWith('.'))
    throw new DashboardFileError('Hidden and traversal names are not allowed.', 422, { name: 'Choose a visible folder name.' })
  if (name.length > MAX_COMPONENT_LENGTH)
    throw new DashboardFileError(`Name must not exceed ${MAX_COMPONENT_LENGTH} characters.`, 422, { name: 'Name is too long.' })
  if (name.includes('/') || name.includes('\\'))
    throw new DashboardFileError('Name must not contain path separators.', 422, { name: 'Path separators are not allowed.' })
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1F\x7F]/.test(name))
    throw new DashboardFileError('Name contains a control character.', 422, { name: 'Control characters are not allowed.' })

  return name
}

function resolveDisk(manager: Manager, requested: unknown) {
  const name = typeof requested === 'string' && requested.trim() ? requested.trim() : DEFAULT_DISK
  const configured = manager.getConfiguredDisks()
  if (!configured.includes(name))
    throw new DashboardFileError(`Storage disk "${name}" is not configured.`, 404)

  const config = manager.getDiskConfig(name)
  if (!config)
    throw new DashboardFileError(`Storage disk "${name}" is not configured.`, 404)

  return {
    name,
    config,
    adapter: manager.disk(name),
    public: config.visibility === 'public',
  }
}

async function mapInBatches<T, U>(values: T[], batchSize: number, mapper: (value: T) => Promise<U>): Promise<U[]> {
  const result: U[] = []
  for (let offset = 0; offset < values.length; offset += batchSize)
    result.push(...await Promise.all(values.slice(offset, offset + batchSize).map(mapper)))
  return result
}

function dashboardPublicUrl(path: string): string {
  return `/${path.split('/').map(component => encodeURIComponent(component)).join('/')}`
}

async function metadataFor(adapter: StorageAdapter, entry: StorageEntry, isPublic: boolean, servesProjectPublic: boolean): Promise<EntryMetadata> {
  let size = 0
  let lastModified: string | null = null
  let mimeType: string | undefined
  let url: string | undefined
  let thumbnail: string | undefined
  const warnings: string[] = []

  try {
    const metadata = await adapter.stat(entry.path)
    const recordedSize = Number(metadata.size)
    if (!Number.isFinite(recordedSize) || recordedSize < 0)
      throw new DashboardFileError(`Storage metadata for "${entry.path}" contains an invalid size.`, 503)
    size = recordedSize

    if (metadata.lastModified !== undefined && metadata.lastModified !== null) {
      const modified = new Date(metadata.lastModified)
      if (!Number.isFinite(modified.getTime()))
        throw new DashboardFileError(`Storage metadata for "${entry.path}" contains an invalid modification time.`, 503)
      lastModified = modified.toISOString()
    }

    if (metadata.mimeType !== undefined && typeof metadata.mimeType !== 'string')
      throw new DashboardFileError(`Storage metadata for "${entry.path}" contains an invalid MIME type.`, 503)
    mimeType = metadata.mimeType
  }
  catch (error) {
    // Object-store directory markers may not have standalone stat metadata.
    if (entry.type === 'file') {
      if (error instanceof DashboardFileError)
        throw error
      throw new DashboardFileError(`Metadata for storage file "${entry.path}" could not be read.`, 503)
    }
  }

  if (entry.type === 'file' && isPublic) {
    try {
      url = await adapter.publicUrl(entry.path)
    }
    catch {
      warnings.push(`Public URL for "${entry.path}" could not be resolved.`)
    }
    if (servesProjectPublic)
      thumbnail = dashboardPublicUrl(entry.path)
  }

  return { ...entry, size, lastModified, mimeType, url, thumbnail, warnings }
}

function categoryFor(entry: EntryMetadata): keyof DashboardFileStats['byType'] {
  const mime = entry.mimeType || ''
  const extension = extensionOf(entry.path)
  if (mime.startsWith('image/') || ['avif', 'gif', 'heic', 'jpeg', 'jpg', 'png', 'svg', 'webp'].includes(extension))
    return 'images'
  if (mime.startsWith('video/') || ['m4v', 'mkv', 'mov', 'mp4', 'webm'].includes(extension))
    return 'videos'
  if (mime.startsWith('audio/') || ['aac', 'flac', 'm4a', 'mp3', 'ogg', 'wav'].includes(extension))
    return 'audio'
  if (
    mime.startsWith('text/')
    || ['csv', 'doc', 'docx', 'md', 'odt', 'pdf', 'ppt', 'pptx', 'rtf', 'txt', 'xls', 'xlsx'].includes(extension)
  )
    return 'documents'
  return 'other'
}

async function diskCapacity(
  disk: string,
  config: ReturnType<Manager['getDiskConfig']>,
): Promise<{ stats: DashboardFileStats['disk'], warning?: string }> {
  if (!config || config.driver !== 'local')
    return { stats: { totalBytes: null, availableBytes: null, usedBytes: null } }

  try {
    const stats = await statfs(config.root)
    const totalBytes = Number(stats.blocks) * Number(stats.bsize)
    const availableBytes = Number(stats.bavail) * Number(stats.bsize)
    if (!Number.isFinite(totalBytes) || !Number.isFinite(availableBytes) || totalBytes < 0 || availableBytes < 0)
      throw new TypeError('Filesystem capacity values are invalid.')
    return { stats: { totalBytes, availableBytes, usedBytes: totalBytes - availableBytes } }
  }
  catch {
    return {
      stats: { totalBytes: null, availableBytes: null, usedBytes: null },
      warning: `Volume capacity for storage disk "${disk}" could not be read.`,
    }
  }
}

export function normalizeDashboardFileLimit(value: unknown): number {
  if (value === undefined || value === null || value === '')
    return DEFAULT_MAX_ENTRIES

  const normalized = typeof value === 'number'
    ? value
    : typeof value === 'string' && /^\d+$/.test(value.trim())
      ? Number(value)
      : Number.NaN
  if (!Number.isSafeInteger(normalized) || normalized < 1 || normalized > 5000) {
    throw new DashboardFileError('Limit must be an integer between 1 and 5000.', 422, {
      limit: 'Choose a limit between 1 and 5000.',
    })
  }
  return normalized
}

export async function getDashboardFileSnapshot(
  options: { disk?: string, maxEntries?: number } = {},
  manager: Manager = Storage,
  store: StorageMetadataStore = databaseMetadataStore,
): Promise<DashboardFileSnapshot> {
  const selected = resolveDisk(manager, options.disk)
  const maxEntries = normalizeDashboardFileLimit(options.maxEntries)
  const entries: StorageEntry[] = []
  let truncated = false

  for await (const rawEntry of selected.adapter.list('', { deep: true })) {
    const path = normalizeListedPath(String(rawEntry.path))
    if (!path || containsHiddenComponent(path))
      continue
    if (entries.length >= maxEntries) {
      truncated = true
      break
    }
    entries.push({ path, type: rawEntry.type })
  }

  // One query for the whole subtree, not one per file: a folder of a thousand
  // files would otherwise be a thousand round trips to answer a question about
  // the handful of them anybody starred (stacksjs/stacks#2577).
  const records = await metadataUnder(store, selected.name)
  const tasks = await store.tasksUnder(selected.name, '')

  const stated = await mapInBatches(
    entries,
    STAT_CONCURRENCY,
    entry => metadataFor(selected.adapter, entry, selected.public, selected.name === 'public' && selected.config.driver === 'local'),
  )
  stated.sort((a, b) => {
    const depth = a.path.split('/').length - b.path.split('/').length
    if (depth)
      return depth
    if (a.type !== b.type)
      return a.type === 'directory' ? -1 : 1
    return a.path.localeCompare(b.path)
  })

  const root: DashboardFileNode = {
    id: 'folder:',
    name: 'Home',
    type: 'folder',
    size: 0,
    path: '',
    lastModified: null,
    // The disk root is not a file and has no row; a star on "everything" would
    // not mean anything, and nothing processes a disk.
    starred: false,
    tags: [],
    processing: null,
    tasks: [],
    shared: selected.public,
    items: [],
  }
  const folders = new Map<string, DashboardFileNode>([['', root]])
  const capacity = await diskCapacity(selected.name, selected.config)
  const stats: DashboardFileStats = {
    files: 0,
    folders: 0,
    contentBytes: 0,
    byType: { documents: 0, images: 0, videos: 0, audio: 0, other: 0 },
    disk: capacity.stats,
  }

  /**
   * The recorded metadata for a path, as the fields a node carries.
   *
   * A path with no row is a file nobody starred or tagged, which is most of
   * them - so the absence of a row is the answer rather than a missing one.
   */
  function pick(path: string): Pick<DashboardFileNode, 'starred' | 'tags' | 'processing' | 'tasks'> {
    const record = recordFor(records, path)
    const running = tasks.get(path) ?? []
    return {
      starred: record.favorite,
      tags: record.tags,
      processing: aggregateTaskState(running),
      tasks: running,
    }
  }

  function ensureFolder(path: string): DashboardFileNode {
    const normalized = normalizeListedPath(path)
    const existing = folders.get(normalized)
    if (existing)
      return existing

    const parent = ensureFolder(posix.dirname(normalized) === '.' ? '' : posix.dirname(normalized))
    const folder: DashboardFileNode = {
      id: `folder:${normalized}`,
      name: posix.basename(normalized),
      type: 'folder',
      size: 0,
      path: normalized,
      lastModified: null,
      ...pick(normalized),
      shared: selected.public,
      items: [],
    }
    parent.items!.push(folder)
    folders.set(normalized, folder)
    stats.folders++
    return folder
  }

  for (const entry of stated) {
    if (entry.type === 'directory') {
      const folder = ensureFolder(entry.path)
      folder.lastModified = entry.lastModified
      continue
    }

    const parentPath = posix.dirname(entry.path) === '.' ? '' : posix.dirname(entry.path)
    const parent = ensureFolder(parentPath)
    const file: DashboardFileNode = {
      id: `file:${entry.path}`,
      name: posix.basename(entry.path),
      type: extensionOf(entry.path),
      size: entry.size,
      path: entry.path,
      lastModified: entry.lastModified,
      mime_type: entry.mimeType,
      url: entry.url,
      thumbnail: entry.thumbnail,
      ...pick(entry.path),
      shared: selected.public,
    }
    parent.items!.push(file)
    stats.files++
    stats.contentBytes += entry.size
    stats.byType[categoryFor(entry)] += entry.size
  }

  for (const folder of folders.values()) {
    folder.items!.sort((a, b) => {
      if ((a.type === 'folder') !== (b.type === 'folder'))
        return a.type === 'folder' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
  }

  // Rows for paths this walk did not see are orphans - a file deleted by
  // something other than the dashboard, which is the normal case for a bucket
  // several systems write to. The walk already enumerated every path, so
  // removing them costs one delete rather than a second listing pass.
  //
  // Skipped when the listing was TRUNCATED, and that guard is the whole reason
  // this takes the flag: a truncated walk has not shown that a path is absent,
  // only that it stopped before reaching it, and sweeping on that would delete
  // the metadata of every file past the limit (stacksjs/stacks#2577).
  await sweepMetadata(
    store,
    selected.name,
    '',
    new Set(stated.map(entry => entry.path)),
    { truncated },
  )

  return {
    disk: selected.name,
    disks: manager.getConfiguredDisks().map((name) => {
      const config = manager.getDiskConfig(name)
      return { name, public: config?.visibility === 'public' }
    }),
    root,
    stats,
    truncated,
    warnings: [
      ...(capacity.warning ? [capacity.warning] : []),
      ...stated.flatMap(entry => entry.warnings),
    ],
  }
}

export async function createDashboardDirectory(
  input: { disk?: string, path?: string, name: unknown },
  manager: Manager = Storage,
): Promise<{ path: string }> {
  const selected = resolveDisk(manager, input.disk)
  const directory = normalizeDashboardFilePath(input.path ?? '', { allowEmpty: true })
  const name = normalizeDashboardFileName(input.name)
  const path = [directory, name].filter(Boolean).join('/')

  if (await selected.adapter.directoryExists(path) || await selected.adapter.fileExists(path))
    throw new DashboardFileError(`An item named "${name}" already exists.`, 409, { name: 'Choose a different name.' })

  await selected.adapter.createDirectory(path)
  return { path }
}

export async function deleteDashboardFile(
  input: { disk?: string, path: unknown },
  manager: Manager = Storage,
  store: StorageMetadataStore = databaseMetadataStore,
): Promise<{ path: string, type: 'file' | 'directory' }> {
  const selected = resolveDisk(manager, input.disk)
  const path = normalizeDashboardFilePath(input.path)

  // Metadata is forgotten AFTER the storage delete in both branches, never
  // before: a delete that fails having already dropped the rows would leave a
  // file that still exists with its stars and tags gone (stacksjs/stacks#2577).
  if (await selected.adapter.fileExists(path)) {
    await selected.adapter.deleteFile(path)
    await followDelete(store, selected.name, path)
    return { path, type: 'file' }
  }
  if (await selected.adapter.directoryExists(path)) {
    await selected.adapter.deleteDirectory(path)
    // The subtree, because deleting a folder deletes everything under it.
    await followDelete(store, selected.name, path)
    return { path, type: 'directory' }
  }

  throw new DashboardFileError(`Storage item "${path}" was not found.`, 404)
}

/**
 * Rename a file or a folder in place.
 *
 * The parent stays put and only the last segment changes, which is what a
 * rename in a file manager means - moving something elsewhere is a different
 * gesture and would want a different endpoint.
 *
 * A directory is renamed by moving what is inside it rather than by moving the
 * directory. On a local disk `moveFile` is `fs.rename` and would happily move a
 * whole tree, but object storage has no directories at all: a folder there is a
 * shared key prefix, and renaming it means rewriting the key of every object
 * under it. Doing it the same way on both is the only version that is not
 * quietly wrong on one of them.
 *
 * See stacksjs/stacks#245.
 */
export async function renameDashboardFile(
  input: { disk?: string, path: unknown, name: unknown },
  manager: Manager = Storage,
  store: StorageMetadataStore = databaseMetadataStore,
): Promise<{ from: string, to: string, type: 'file' | 'directory', moved: number }> {
  const selected = resolveDisk(manager, input.disk)
  const from = normalizeDashboardFilePath(input.path)
  const name = normalizeDashboardFileName(input.name)

  const separator = from.lastIndexOf('/')
  const parent = separator === -1 ? '' : from.slice(0, separator)
  const to = [parent, name].filter(Boolean).join('/')

  if (to === from)
    throw new DashboardFileError('The new name matches the current one.', 422, { name: 'Choose a different name.' })

  if (await selected.adapter.fileExists(to) || await selected.adapter.directoryExists(to))
    throw new DashboardFileError(`An item named "${name}" already exists.`, 409, { name: 'Choose a different name.' })

  if (await selected.adapter.fileExists(from)) {
    await selected.adapter.moveFile(from, to)
    // After the move, so a failed move does not leave the metadata describing a
    // path with no file at it.
    await followRename(store, selected.name, from, to)
    return { from, to, type: 'file', moved: 1 }
  }

  if (!(await selected.adapter.directoryExists(from)))
    throw new DashboardFileError(`Storage item "${from}" was not found.`, 404)

  // Collected before anything moves. Mutating a tree while iterating it is how
  // a rename half-completes and leaves files under both names.
  const files: string[] = []
  for await (const entry of selected.adapter.list(from, { deep: true })) {
    const path = normalizeListedPath(String(entry.path))
    if (entry.type === 'file' && path)
      files.push(path)
  }

  for (const file of files) {
    // `list` may answer absolute-from-root or relative-to-`from` paths
    // depending on the adapter; both end with the part that has to be kept.
    const relative = file.startsWith(`${from}/`) ? file.slice(from.length + 1) : file
    await selected.adapter.moveFile(file.startsWith(`${from}/`) ? file : `${from}/${relative}`, `${to}/${relative}`)
  }

  // An empty source is what is left, and it should not be: a rename leaves one
  // item, not two. Directories are implicit on object storage, so this is a
  // no-op there rather than a failure.
  await selected.adapter.deleteDirectory(from)

  // A folder rename moves every file beneath it, so this is a prefix update
  // rather than one row - the part #2577 flagged as the one that would bite.
  await followRename(store, selected.name, from, to)

  return { from, to, type: 'directory', moved: files.length }
}

/**
 * Make a file, or everything in a folder, public or private.
 *
 * A folder is applied file by file rather than to the folder itself, for the
 * same reason a rename is: object storage has no directories, only a shared key
 * prefix, and an ACL belongs to an object. `directoryExists` there is a
 * prefix-has-objects check with nothing at that key, so asking to change the
 * "directory" would address something that does not exist.
 *
 * It is also the right answer on a local disk, where a mode on a directory
 * controls listing and traversal but not whether a file inside it can be read.
 * The files are what gate access on both, so the files are what this sets.
 *
 * See stacksjs/stacks#245.
 */
export async function setDashboardFileVisibility(
  input: { disk?: string, path: unknown, visibility: unknown },
  manager: Manager = Storage,
): Promise<{ path: string, visibility: Visibility, type: 'file' | 'directory', changed: number }> {
  const selected = resolveDisk(manager, input.disk)
  const path = normalizeDashboardFilePath(input.path)

  if (input.visibility !== 'public' && input.visibility !== 'private') {
    throw new DashboardFileError('Visibility must be "public" or "private".', 422, {
      visibility: 'Choose either public or private.',
    })
  }
  const visibility = input.visibility as Visibility

  if (await selected.adapter.fileExists(path)) {
    await selected.adapter.changeVisibility(path, visibility)
    return { path, visibility, type: 'file', changed: 1 }
  }

  if (!(await selected.adapter.directoryExists(path)))
    throw new DashboardFileError(`Storage item "${path}" was not found.`, 404)

  let changed = 0
  for await (const entry of selected.adapter.list(path, { deep: true })) {
    if (entry.type !== 'file')
      continue
    const listed = normalizeListedPath(String(entry.path))
    if (!listed)
      continue
    await selected.adapter.changeVisibility(listed.startsWith(`${path}/`) ? listed : `${path}/${listed}`, visibility)
    changed++
  }

  return { path, visibility, type: 'directory', changed }
}

/**
 * The name a duplicate gets when the caller does not choose one.
 *
 * `readme.txt` becomes `readme copy.txt`, then `readme copy 2.txt` - the
 * suffix goes before the extension, because `readme.txt copy` is a file whose
 * type the operating system, the browser and this dashboard's own type
 * grouping all read as unknown.
 *
 * A directory has no extension to preserve, and `posix.extname` returns `''`
 * for one, so the same code handles both.
 */
async function availableCopyName(path: string, exists: (candidate: string) => Promise<boolean>): Promise<string> {
  const base = posix.basename(path)
  const extension = posix.extname(base)
  const stem = extension ? base.slice(0, -extension.length) : base
  const parent = path.slice(0, Math.max(0, path.length - base.length - 1))

  for (let attempt = 1; attempt <= 100; attempt++) {
    const suffix = attempt === 1 ? 'copy' : `copy ${attempt}`
    const candidate = `${stem} ${suffix}${extension}`
    const full = [parent, candidate].filter(Boolean).join('/')
    if (!(await exists(full)))
      return candidate
  }

  throw new DashboardFileError('Too many copies of this item already exist.', 409, {
    name: 'Rename some copies, or choose a name.',
  })
}

/**
 * Copy a file, or a folder and everything in it, beside the original.
 *
 * Deep-walks a directory for the same reason rename and visibility do: object
 * storage has no folder to copy, only a shared key prefix, so duplicating one
 * means copying every object beneath it.
 *
 * The name is optional. A file manager's "Duplicate" is a single gesture that
 * has to produce something, so an omitted name becomes `<name> copy`, then
 * `<name> copy 2` - checked for availability rather than assumed, since the
 * first copy is usually not the only one.
 *
 * See stacksjs/stacks#245.
 */
export async function duplicateDashboardFile(
  input: { disk?: string, path: unknown, name?: unknown },
  manager: Manager = Storage,
  store: StorageMetadataStore = databaseMetadataStore,
): Promise<{ from: string, to: string, type: 'file' | 'directory', copied: number }> {
  const selected = resolveDisk(manager, input.disk)
  const from = normalizeDashboardFilePath(input.path)
  const taken = async (candidate: string): Promise<boolean> =>
    await selected.adapter.fileExists(candidate) || await selected.adapter.directoryExists(candidate)

  const name = input.name === undefined || input.name === null || input.name === ''
    ? await availableCopyName(from, taken)
    : normalizeDashboardFileName(input.name)

  const separator = from.lastIndexOf('/')
  const parent = separator === -1 ? '' : from.slice(0, separator)
  const to = [parent, name].filter(Boolean).join('/')

  if (to === from)
    throw new DashboardFileError('A copy needs a different name.', 422, { name: 'Choose a different name.' })
  if (await taken(to))
    throw new DashboardFileError(`An item named "${name}" already exists.`, 409, { name: 'Choose a different name.' })

  if (await selected.adapter.fileExists(from)) {
    await selected.adapter.copyFile(from, to)
    // The star and tags come with the copy. A duplicate that silently lost them
    // reads as the copy having half-failed.
    await followCopy(store, selected.name, from, to)
    return { from, to, type: 'file', copied: 1 }
  }

  if (!(await selected.adapter.directoryExists(from)))
    throw new DashboardFileError(`Storage item "${from}" was not found.`, 404)

  // Collected before anything is written, so a copy cannot pick up the files
  // it is itself creating - `to` sits beside `from` under the same parent, and
  // a deep listing that ran while copying could see them.
  const files: string[] = []
  for await (const entry of selected.adapter.list(from, { deep: true })) {
    const listed = normalizeListedPath(String(entry.path))
    if (entry.type === 'file' && listed)
      files.push(listed.startsWith(`${from}/`) ? listed : `${from}/${listed}`)
  }

  for (const file of files) {
    const destination = `${to}/${file.slice(from.length + 1)}`
    await selected.adapter.copyFile(file, destination)
    await followCopy(store, selected.name, file, destination)
  }

  // The folder's own record, separately: it is not among the files copied.
  await followCopy(store, selected.name, from, to)

  return { from, to, type: 'directory', copied: files.length }
}

/**
 * Star or unstar a file or a folder (stacksjs/stacks#2577).
 *
 * Existence is checked against the DISK, not against the table: a star on a
 * path that is not there would be an orphan the moment it was written, and the
 * caller would get a 200 for it. Folders can be starred too - they are a path
 * like any other to this table, even where the disk has no such thing.
 */
export async function setDashboardFileFavorite(
  input: { disk?: string, path: unknown, favorite: unknown },
  manager: Manager = Storage,
  store: StorageMetadataStore = databaseMetadataStore,
): Promise<{ path: string, favorite: boolean, tags: string[] }> {
  const selected = resolveDisk(manager, input.disk)
  const path = normalizeDashboardFilePath(input.path)

  if (typeof input.favorite !== 'boolean') {
    throw new DashboardFileError('Favorite must be true or false.', 422, {
      favorite: 'Send a boolean.',
    })
  }

  await assertExists(selected.adapter, path)

  const record = await writeFavorite(store, selected.name, path, input.favorite)
  return { path, favorite: record.favorite, tags: record.tags }
}

/**
 * Replace a file's tags (stacksjs/stacks#2577).
 *
 * The whole set, not a delta: a UI that can add a tag can also remove one, and
 * there is no separate signal for a removal. Names are trimmed, deduplicated
 * case-insensitively and sorted, so sending the same tags in a different order
 * produces the same record.
 *
 * They go into the `taggable` vocabulary the CMS already uses, scoped by
 * `taggable_type`, rather than a second tag table - which #2577 asks for
 * explicitly, and which matters because a tag is a word somebody chose and
 * having it mean two things in two places is how a tag list stops being useful.
 */
export async function setDashboardFileTags(
  input: { disk?: string, path: unknown, tags: unknown },
  manager: Manager = Storage,
  store: StorageMetadataStore = databaseMetadataStore,
): Promise<{ path: string, favorite: boolean, tags: string[] }> {
  const selected = resolveDisk(manager, input.disk)
  const path = normalizeDashboardFilePath(input.path)

  if (!Array.isArray(input.tags))
    throw new DashboardFileError('Tags must be an array.', 422, { tags: 'Send an array of tag names.' })
  if (input.tags.length > MAX_TAGS)
    throw new DashboardFileError(`A file may carry at most ${MAX_TAGS} tags.`, 422, { tags: 'Too many tags.' })
  for (const tag of input.tags) {
    if (typeof tag !== 'string')
      throw new DashboardFileError('Tags must be strings.', 422, { tags: 'Every tag must be a string.' })
    if (tag.trim().length > MAX_TAG_LENGTH)
      throw new DashboardFileError(`A tag must not exceed ${MAX_TAG_LENGTH} characters.`, 422, { tags: 'A tag is too long.' })
  }

  await assertExists(selected.adapter, path)

  const record = await writeTags(store, selected.name, path, normalizeTags(input.tags))
  return { path, favorite: record.favorite, tags: record.tags }
}

/** 404 unless the path is a file or a folder on the disk. */
async function assertExists(adapter: StorageAdapter, path: string): Promise<void> {
  if (await adapter.fileExists(path) || await adapter.directoryExists(path))
    return
  throw new DashboardFileError(`Storage item "${path}" was not found.`, 404)
}

/**
 * How a dispatched job reaches the queue.
 *
 * A parameter so the upload path can be tested without a queue, and so an app
 * that wants a different dispatcher - a synchronous one in a test, a
 * rate-limited one in front of a paid vision API - can supply it. The default
 * reads `@stacksjs/queue` lazily: `uploadDashboardFiles` is on the request path
 * and most uploads are not media.
 */
export type TaskDispatcher = (job: JobName, payload: Record<string, unknown>) => Promise<void>

/**
 * The job each kind of work runs.
 *
 * Typed as the generated `JobName` union rather than `string`, so a job renamed
 * or removed under this map is a compile error instead of a dispatch that fails
 * at runtime for a file nobody is watching.
 */
const TASK_JOBS = {
  optimize: 'OptimizeStorageImageJob',
  transcode: 'TranscodeStorageVideoJob',
  tag: 'TagStorageMediaJob',
} as const satisfies Record<StorageTaskKind, JobName>

const queueDispatcher: TaskDispatcher = async (job, payload) => {
  const { Jobs } = await import('@stacksjs/queue')
  await Jobs.dispatch(job as JobName, payload)
}

/**
 * Queue the processing an uploaded file calls for (stacksjs/stacks#2578).
 *
 * Only ever dispatches for a content type that has work to do - most uploads
 * are documents, and a queue entry per PDF that immediately finds nothing to do
 * is noise in the one place somebody looks when a transcode is stuck.
 *
 * A video is dispatched only when the caller supplies a profile: the ladder is
 * derived from the source dimensions, and a job that guesses builds renditions
 * nobody asked for. The dashboard knows them from the upload; a caller that
 * does not can dispatch the transcode later through
 * {@link reprocessDashboardFile}.
 */
export async function dispatchDashboardFileTasks(
  input: { disk?: string, path: unknown, contentType?: string, videoProfile?: Record<string, unknown>, only?: readonly StorageTaskKind[] },
  manager: Manager = Storage,
  store: StorageMetadataStore = databaseMetadataStore,
  dispatch: TaskDispatcher = queueDispatcher,
): Promise<StorageItemTask[]> {
  const selected = resolveDisk(manager, input.disk)
  const path = normalizeDashboardFilePath(input.path)

  const applicable = tasksForContentType(input.contentType)
  const wanted = input.only
    ? applicable.filter(kind => input.only!.includes(kind))
    : applicable

  const runnable = wanted.filter(kind => kind !== 'transcode' || input.videoProfile !== undefined)
  if (runnable.length === 0)
    return []

  return await dispatchTasks(store, selected.name, path, runnable, async (kind) => {
    await dispatch(TASK_JOBS[kind], {
      disk: selected.name,
      path,
      ...(kind === 'transcode' ? { profile: input.videoProfile } : {}),
    })
  })
}

/**
 * Run a file's processing again (stacksjs/stacks#2578).
 *
 * The re-run path the issue asked for, and it is not optional: the first
 * version of any of these produces output somebody wants regenerated - a
 * better ladder, a model that has since improved, an optimization that ran
 * before a preset changed.
 *
 * Existence is checked against the DISK, so re-running a file that has since
 * been deleted is a 404 rather than a job that fails minutes later in a worker
 * log nobody reads.
 */
export async function reprocessDashboardFile(
  input: { disk?: string, path: unknown, kinds?: unknown, videoProfile?: Record<string, unknown> },
  manager: Manager = Storage,
  store: StorageMetadataStore = databaseMetadataStore,
  dispatch: TaskDispatcher = queueDispatcher,
): Promise<{ path: string, tasks: StorageItemTask[] }> {
  const selected = resolveDisk(manager, input.disk)
  const path = normalizeDashboardFilePath(input.path)

  let only: StorageTaskKind[] | undefined
  if (input.kinds !== undefined && input.kinds !== null) {
    if (!Array.isArray(input.kinds))
      throw new DashboardFileError('Kinds must be an array.', 422, { kinds: 'Send an array of task kinds.' })
    for (const kind of input.kinds) {
      if (!STORAGE_TASK_KINDS.includes(kind as StorageTaskKind)) {
        throw new DashboardFileError(`Unknown task kind "${String(kind)}".`, 422, {
          kinds: `Choose from ${STORAGE_TASK_KINDS.join(', ')}.`,
        })
      }
    }
    only = input.kinds as StorageTaskKind[]
  }

  if (!(await selected.adapter.fileExists(path)))
    throw new DashboardFileError(`Storage item "${path}" was not found.`, 404)

  const tasks = await dispatchDashboardFileTasks(
    {
      disk: selected.name,
      path,
      contentType: await selected.adapter.mimeType(path),
      videoProfile: input.videoProfile,
      only,
    },
    manager,
    store,
    dispatch,
  )

  return { path, tasks }
}

export async function uploadDashboardFiles(
  input: { disk?: string, path?: string, files: UploadedFileLike[] },
  manager: Manager = Storage,
  store: StorageMetadataStore = databaseMetadataStore,
  dispatch: TaskDispatcher = queueDispatcher,
): Promise<Array<{ path: string, url: string, size: number, tasks: StorageItemTask[] }>> {
  const selected = resolveDisk(manager, input.disk)
  const directory = normalizeDashboardFilePath(input.path ?? '', { allowEmpty: true })
  const uploaded: Array<{ path: string, url: string, size: number, tasks: StorageItemTask[] }> = []

  try {
    for (const file of input.files) {
      const result = await manager.put(file, {
        disk: selected.name,
        dir: directory,
        filename: 'original',
        overwrite: false,
      })
      uploaded.push({ path: result.path, url: result.url, size: result.size, tasks: [] })
    }
  }
  catch (error) {
    const rollback = await Promise.allSettled(uploaded.map(file => selected.adapter.deleteFile(file.path)))
    const rollbackFailed = rollback.some(result => result.status === 'rejected')
    if (error instanceof Error && error.message.startsWith('File already exists:')) {
      throw new DashboardFileError(
        rollbackFailed
          ? `${error.message}. At least one earlier file could not be rolled back. Refresh the folder before retrying.`
          : `${error.message}. No files from this upload were kept.`,
        rollbackFailed ? 500 : 409,
        { files: rollbackFailed ? 'Refresh the folder and review the uploaded files.' : 'Rename the duplicate file and try again.' },
      )
    }
    if (rollbackFailed) {
      throw new DashboardFileError(
        'Upload failed and at least one earlier file could not be rolled back. Refresh the folder before retrying.',
        500,
        { files: 'Refresh the folder and review the uploaded files.' },
      )
    }
    throw error
  }

  // Dispatched after every file is safely written, not inside the loop above:
  // the rollback path deletes what was uploaded, and a job already queued for a
  // file that is about to be deleted would run against nothing.
  //
  // A dispatch failure is recorded on the task row rather than thrown, so a
  // queue that is down does not fail an upload that succeeded - the file is
  // there, and the dashboard shows the processing as failed.
  for (const file of uploaded) {
    file.tasks = await dispatchDashboardFileTasks(
      {
        disk: selected.name,
        path: file.path,
        contentType: await selected.adapter.mimeType(file.path).catch(() => undefined),
      },
      manager,
      store,
      dispatch,
    )
  }

  return uploaded
}
