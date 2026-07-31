import { statfs } from 'node:fs/promises'
import { posix } from 'node:path'
import type { StorageAdapter, StorageManager, UploadedFileLike } from '@stacksjs/storage'
import { Storage } from '@stacksjs/storage'

const DEFAULT_DISK = 'public'
const DEFAULT_MAX_ENTRIES = 1000
const MAX_PATH_LENGTH = 2048
const MAX_COMPONENT_LENGTH = 255
const STAT_CONCURRENCY = 24

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
  starred: false
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
  readonly status: number
  readonly fields?: Record<string, string>

  constructor(message: string, status = 422, fields?: Record<string, string>) {
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

  const metadata = await mapInBatches(
    entries,
    STAT_CONCURRENCY,
    entry => metadataFor(selected.adapter, entry, selected.public, selected.name === 'public' && selected.config.driver === 'local'),
  )
  metadata.sort((a, b) => {
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
    starred: false,
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
      starred: false,
      shared: selected.public,
      items: [],
    }
    parent.items!.push(folder)
    folders.set(normalized, folder)
    stats.folders++
    return folder
  }

  for (const entry of metadata) {
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
      starred: false,
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
      ...metadata.flatMap(entry => entry.warnings),
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
): Promise<{ path: string, type: 'file' | 'directory' }> {
  const selected = resolveDisk(manager, input.disk)
  const path = normalizeDashboardFilePath(input.path)

  if (await selected.adapter.fileExists(path)) {
    await selected.adapter.deleteFile(path)
    return { path, type: 'file' }
  }
  if (await selected.adapter.directoryExists(path)) {
    await selected.adapter.deleteDirectory(path)
    return { path, type: 'directory' }
  }

  throw new DashboardFileError(`Storage item "${path}" was not found.`, 404)
}

export async function uploadDashboardFiles(
  input: { disk?: string, path?: string, files: UploadedFileLike[] },
  manager: Manager = Storage,
): Promise<Array<{ path: string, url: string, size: number }>> {
  const selected = resolveDisk(manager, input.disk)
  const directory = normalizeDashboardFilePath(input.path ?? '', { allowEmpty: true })
  const uploaded: Array<{ path: string, url: string, size: number }> = []

  try {
    for (const file of input.files) {
      const result = await manager.put(file, {
        disk: selected.name,
        dir: directory,
        filename: 'original',
        overwrite: false,
      })
      uploaded.push({ path: result.path, url: result.url, size: result.size })
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

  return uploaded
}
