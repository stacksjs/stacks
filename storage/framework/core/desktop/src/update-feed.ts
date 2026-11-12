import type { UnsignedUpdateManifest } from './update-signing'
import type { DesktopUpdateManifest } from './updater'
import { existsSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { describeArtifact, signUpdateManifest } from './update-signing'
import { compareVersions, validateUpdateManifest } from './updater'

/**
 * Where a release's artifacts and manifests live, and the feed an app reads
 * them through. One manifest per channel, platform and architecture, at a
 * fixed key, so publishing a release is writing the artifact and then that one
 * file, and serving the feed is reading it back.
 */

export const UPDATE_PLATFORMS = ['darwin', 'linux', 'win32'] as const
export const DEFAULT_UPDATE_PREFIX = 'desktop-updates'

export interface UpdateLocation {
  platform: string
  architecture: string
  channel?: string
  prefix?: string
}

function checkedLocation(location: UpdateLocation): Required<UpdateLocation> {
  const channel = location.channel || 'stable'
  const prefix = (location.prefix ?? DEFAULT_UPDATE_PREFIX).replace(/^\/+|\/+$/g, '')
  if (!(UPDATE_PLATFORMS as readonly string[]).includes(location.platform)) throw new Error(`Unknown desktop platform: ${location.platform}`)
  if (!/^[a-z0-9_]+$/.test(location.architecture)) throw new Error(`Unknown desktop architecture: ${location.architecture}`)
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(channel)) throw new Error(`Invalid release channel: ${channel}`)
  return { platform: location.platform, architecture: location.architecture, channel, prefix }
}

/** The storage key of the manifest an app on this channel, platform and architecture is served. */
export function updateManifestKey(location: UpdateLocation): string {
  const at = checkedLocation(location)
  return `${at.prefix}/${at.channel}/${at.platform}-${at.architecture}/latest.json`
}

/** The storage key of one version's artifact. Versioned, so a published file is never overwritten by the next release. */
export function updateArtifactKey(location: UpdateLocation, version: string, fileName: string): string {
  const at = checkedLocation(location)
  // Each starts with a letter, digit or underscore, so neither can be `.` or `..`: the key stays inside its version folder.
  if (!/^\w[\w.+-]*$/.test(version) || !/^\w[\w.+ -]*$/.test(fileName)) throw new Error(`Invalid artifact name: ${version}/${fileName}`)
  return `${at.prefix}/${at.channel}/${at.platform}-${at.architecture}/${version}/${fileName}`
}

/** The URL an app asks: `<feedUrl>/<platform>/<arch>`, with its channel and version so the feed can answer "nothing new". */
export function updateFeedUrl(feedUrl: string, target: { platform: string, architecture: string }, query: { channel?: string, currentVersion?: string } = {}): string {
  const url = new URL(`${feedUrl.replace(/\/+$/, '')}/${target.platform}/${target.architecture}`)
  if (query.channel && query.channel !== 'stable') url.searchParams.set('channel', query.channel)
  if (query.currentVersion) url.searchParams.set('current', query.currentVersion)
  return url.toString()
}

/**
 * Where an artifact is downloaded from when nothing else serves the disk:
 * `<feedUrl>/files/<channel>/<platform>-<arch>/<version>/<file>`, the route
 * beside the feed. The folder on the disk (`prefix`) is not part of it.
 */
export function updateArtifactUrl(feedUrl: string, location: UpdateLocation, version: string, fileName: string): string {
  const key = updateArtifactKey({ ...location, prefix: '' }, version, fileName)
  return `${feedUrl.replace(/\/+$/, '')}/files/${key.replace(/^\/+/, '').split('/').map(encodeURIComponent).join('/')}`
}

/**
 * Why an artifact URL cannot be published, or null. A manifest is signed and
 * read by apps on other machines: a loopback or development host in it is an
 * update nobody can download.
 */
export function artifactUrlProblem(url: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  }
  catch {
    return `${url} is not a URL`
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return `${url} is not an http(s) URL`
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  const local = host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.test') || host.endsWith('.local') || host === '::1' || host === '0.0.0.0' || /^127\./.test(host)
  return local ? `${url} is on this machine (${host}): no installed app could download it` : null
}

/** A stored file, opened for download. `start` and `end` are byte offsets, both inclusive. */
export interface StoredArtifact {
  size: number
  stream: (range?: { start: number, end: number }) => Promise<ReadableStream<Uint8Array>>
}

/** As much of a storage disk as updates use. `storageUpdateStore()` adapts `@stacksjs/storage`. */
export interface UpdateStore {
  read: (key: string) => Promise<string | null>
  write: (key: string, contents: string | Uint8Array) => Promise<void>
  publicUrl: (key: string) => Promise<string>
  /** Open a stored artifact for download, without reading it into memory. Null when it is not there. */
  open?: (key: string) => Promise<StoredArtifact | null>
}

/** A disk from `@stacksjs/storage` (`config/filesystems.ts`), as an `UpdateStore`. Default: the default disk. */
export async function storageUpdateStore(disk?: string): Promise<UpdateStore> {
  const { Storage } = await import('@stacksjs/storage')
  const adapter = Storage.disk(disk as Parameters<typeof Storage.disk>[0])
  return {
    read: async key => (await adapter.fileExists(key)) ? adapter.readToString(key) : null,
    write: async (key, contents) => { await adapter.write(key, typeof contents === 'string' ? contents : Buffer.from(contents)) },
    publicUrl: key => adapter.publicUrl(key),
    open: async (key) => {
      if (!(await adapter.fileExists(key))) return null
      const size = await adapter.fileSize(key)
      return {
        size,
        stream: async (range) => {
          const whole = typeof adapter.getStream === 'function'
            ? await adapter.getStream(key)
            : new Blob([await adapter.readToUint8Array(key) as Uint8Array<ArrayBuffer>]).stream() as ReadableStream<Uint8Array>
          return range ? sliceStream(whole, range.start, range.end) : whole
        },
      }
    },
  }
}

/** Bytes `start` to `end` (inclusive) of a stream, read a chunk at a time. Works on any disk, whether or not it can seek. */
export function sliceStream(source: ReadableStream<Uint8Array>, start: number, end: number): ReadableStream<Uint8Array> {
  const reader = source.getReader()
  let offset = 0
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      while (true) {
        if (offset > end) {
          await reader.cancel()
          controller.close()
          return
        }
        const { done, value } = await reader.read()
        if (done) {
          controller.close()
          return
        }
        const from = Math.max(start - offset, 0)
        const to = Math.min(end + 1 - offset, value.byteLength)
        offset += value.byteLength
        if (to > from) {
          controller.enqueue(value.subarray(from, to))
          return
        }
      }
    },
    cancel: reason => reader.cancel(reason),
  })
}

export interface PublishDesktopUpdateOptions extends UpdateLocation {
  store: UpdateStore
  /** The file an installed app downloads: a zipped `.app`, an `.msi`, an `.AppImage`. */
  artifact: string
  version: string
  /** The full commit the artifact was built from. */
  sourceRevision: string
  privateKey: string
  keyId?: string
  notes?: string
  /** Where artifacts are downloaded from: a bucket or CDN that serves the disk. The artifact's key is appended. */
  artifactBaseUrl?: string
  /** The feed the app reads. Without `artifactBaseUrl`, the artifact is downloaded through the route beside it. */
  feedUrl?: string
  publishedAt?: string
}

/**
 * The URL a published artifact is downloaded from: under `artifactBaseUrl`
 * when a bucket or CDN serves the disk, else through the route beside the
 * feed, which works for any disk. The disk's own public URL is the answer
 * only when neither is known.
 */
export async function publishedArtifactUrl(options: UpdateLocation & { store: UpdateStore, artifactBaseUrl?: string, feedUrl?: string }, version: string, fileName: string): Promise<string> {
  const key = updateArtifactKey(options, version, fileName)
  if (options.artifactBaseUrl) return `${options.artifactBaseUrl.replace(/\/+$/, '')}/${key.split('/').map(encodeURIComponent).join('/')}`
  if (options.feedUrl) return updateArtifactUrl(options.feedUrl, options, version, fileName)
  return options.store.publicUrl(key)
}

/**
 * Publish one platform's update: the artifact first, then the signed manifest
 * that points at it. In that order, so the feed never names a file that is
 * not there yet.
 */
export async function publishDesktopUpdate(options: PublishDesktopUpdateOptions): Promise<DesktopUpdateManifest> {
  const { size, sha256 } = await describeArtifact(options.artifact)
  const artifactKey = updateArtifactKey(options, options.version, basename(options.artifact))
  const url = await publishedArtifactUrl(options, options.version, basename(options.artifact))
  await options.store.write(artifactKey, readFileSync(options.artifact))
  const unsigned: UnsignedUpdateManifest = {
    version: options.version,
    url,
    sha256,
    size,
    sourceRevision: options.sourceRevision,
    platform: options.platform,
    architecture: options.architecture,
    publishedAt: options.publishedAt ?? new Date().toISOString(),
    ...(options.notes ? { notes: options.notes } : {}),
  }
  const manifest = signUpdateManifest(unsigned, options.privateKey, options.keyId)
  await options.store.write(updateManifestKey(options), `${JSON.stringify(manifest, null, 2)}\n`)
  return manifest
}

const feedHeaders = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }

/**
 * Answer an app asking for its update: the stored manifest, 204 when the app
 * says it already runs that version or newer, 404 when nothing was published
 * for its platform. The manifest is served as stored: its signature covers it,
 * so the server holds no key and cannot alter what an app will accept.
 */
export async function serveUpdateFeed(options: UpdateLocation & { store: UpdateStore, currentVersion?: string | null }): Promise<Response> {
  let key: string
  try {
    key = updateManifestKey(options)
  }
  catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), { status: 404, headers: feedHeaders })
  }
  const stored = await options.store.read(key)
  if (!stored) return new Response(JSON.stringify({ error: 'No update has been published for this platform.' }), { status: 404, headers: feedHeaders })
  let manifest: DesktopUpdateManifest
  try {
    manifest = validateUpdateManifest(JSON.parse(stored))
  }
  catch {
    return new Response(JSON.stringify({ error: 'The published update manifest is not valid.' }), { status: 500, headers: feedHeaders })
  }
  if (options.currentVersion) {
    try {
      if (compareVersions(manifest.version, options.currentVersion) <= 0) return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } })
    }
    catch {
      // A version the app made up is not a reason to withhold the manifest.
    }
  }
  return new Response(stored, { headers: feedHeaders })
}

const artifactTypes: Record<string, string> = {
  zip: 'application/zip',
  dmg: 'application/x-apple-diskimage',
  msi: 'application/x-msi',
  exe: 'application/vnd.microsoft.portable-executable',
  appimage: 'application/vnd.appimage',
  deb: 'application/vnd.debian.binary-package',
  rpm: 'application/x-rpm',
}

function refused(status: number, error: string, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify({ error }), { status, headers: { ...feedHeaders, ...headers } })
}

/** One `bytes=` range of a file of `size` bytes: the offsets, `null` for "send it all", or `false` when it cannot be satisfied. */
export function parseByteRange(header: string | null | undefined, size: number): { start: number, end: number } | null | false {
  if (!header) return null
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  // Several ranges, or another unit: the whole file is a valid answer to both.
  if (!match || (!match[1] && !match[2])) return null
  if (!match[1]) {
    const last = Number(match[2])
    if (!last || !size) return false
    return { start: Math.max(size - last, 0), end: size - 1 }
  }
  const start = Number(match[1])
  const end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1
  if (start >= size || start > end) return false
  return { start, end }
}

export interface ServeUpdateArtifactOptions {
  store: UpdateStore
  prefix?: string
  channel: string
  /** `<platform>-<arch>`, as in the artifact's key and URL. */
  target: string
  version: string
  file: string
  /** The request's `Range` header. */
  range?: string | null
  /** `HEAD` answers the headers alone. */
  method?: string
}

/**
 * Stream one published artifact: what the URL in a manifest or release.json
 * names when the route beside the feed serves the disk. Only a key of the
 * artifact shape under the configured folder is ever read, so no path reaches
 * another folder or another file on the disk. Streams, with a length and
 * byte ranges, so a download can be resumed and nothing is held in memory.
 */
export async function serveUpdateArtifact(options: ServeUpdateArtifactOptions): Promise<Response> {
  const missing = (): Response => refused(404, 'No such release artifact.')
  const split = /^([a-z0-9]+)-([a-z0-9_]+)$/.exec(options.target)
  if (!split) return missing()
  let key: string
  try {
    key = updateArtifactKey({ platform: split[1]!, architecture: split[2]!, channel: options.channel, prefix: options.prefix }, options.version, options.file)
  }
  catch {
    return missing()
  }
  if (!options.store.open) return missing()
  const stored = await options.store.open(key)
  if (!stored) return missing()

  const range = parseByteRange(options.range, stored.size)
  if (range === false) return refused(416, 'The requested range is outside the file.', { 'content-range': `bytes */${stored.size}` })
  const length = range ? range.end - range.start + 1 : stored.size
  const headers: Record<string, string> = {
    'content-type': artifactTypes[options.file.slice(options.file.lastIndexOf('.') + 1).toLowerCase()] ?? 'application/octet-stream',
    'content-length': String(length),
    'content-disposition': `attachment; filename="${options.file}"`,
    'accept-ranges': 'bytes',
    // A version's artifact is written once and never replaced.
    'cache-control': 'public, max-age=31536000, immutable',
    'x-content-type-options': 'nosniff',
  }
  if (range) headers['content-range'] = `bytes ${range.start}-${range.end}/${stored.size}`
  const body = options.method?.toUpperCase() === 'HEAD' ? null : await stored.stream(range ?? undefined)
  return new Response(body, { status: range ? 206 : 200, headers })
}

type UpdatesConfig = { disk?: string, prefix?: string, channel?: string }

/** `webview.updates` of the project at `root`, read without the desktop toolchain a web server has no use for. */
async function projectUpdates(root?: string): Promise<UpdatesConfig | undefined> {
  const file = join(root ?? process.cwd(), 'config/desktop.ts')
  return existsSync(file) ? (await import(pathToFileURL(file).href) as { default?: { webview?: { updates?: UpdatesConfig } } }).default?.webview?.updates : undefined
}

export interface AnswerUpdateArtifactOptions extends Omit<ServeUpdateArtifactOptions, 'store' | 'prefix'> {
  root?: string
  updates?: UpdatesConfig
  store?: UpdateStore
}

/**
 * A published artifact of the app this project builds, as a route handler's
 * answer: `GET /api/updates/files/{channel}/{target}/{version}/{file}`.
 */
export async function answerUpdateArtifact(options: AnswerUpdateArtifactOptions): Promise<Response> {
  const updates = options.updates ?? (options.store ? undefined : await projectUpdates(options.root))
  if (!updates && !options.store) return refused(404, 'This app publishes no desktop updates.')
  return serveUpdateArtifact({ ...options, store: options.store ?? await storageUpdateStore(updates?.disk), prefix: updates?.prefix })
}

export interface AnswerUpdateFeedOptions {
  platform: string
  architecture: string
  channel?: string | null
  currentVersion?: string | null
  /** The project whose `config/desktop.ts` says where updates are stored. Default: the working directory. */
  root?: string
  /** `webview.updates` from the config, when the caller already has it. */
  updates?: { disk?: string, prefix?: string, channel?: string }
  store?: UpdateStore
}

/**
 * The update feed for the app this project builds, as a route handler's
 * answer: `GET /api/updates/{platform}/{arch}`. Reads the manifest
 * `buddy release:desktop` published, from the disk and folder
 * `webview.updates` names. A project that publishes no desktop updates
 * answers 404.
 */
export async function answerUpdateFeed(options: AnswerUpdateFeedOptions): Promise<Response> {
  let updates = options.updates
  if (!updates && !options.store) {
    updates = await projectUpdates(options.root)
    if (!updates) return new Response(JSON.stringify({ error: 'This app publishes no desktop updates.' }), { status: 404, headers: feedHeaders })
  }
  return serveUpdateFeed({
    store: options.store ?? await storageUpdateStore(updates?.disk),
    platform: options.platform,
    architecture: options.architecture,
    channel: options.channel || updates?.channel,
    prefix: updates?.prefix,
    currentVersion: options.currentVersion,
  })
}
