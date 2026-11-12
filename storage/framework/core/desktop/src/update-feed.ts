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
  if (!/^[\w.+-]+$/.test(version) || !/^[\w.+ -]+$/.test(fileName)) throw new Error(`Invalid artifact name: ${version}/${fileName}`)
  return `${at.prefix}/${at.channel}/${at.platform}-${at.architecture}/${version}/${fileName}`
}

/** The URL an app asks: `<feedUrl>/<platform>/<arch>`, with its channel and version so the feed can answer "nothing new". */
export function updateFeedUrl(feedUrl: string, target: { platform: string, architecture: string }, query: { channel?: string, currentVersion?: string } = {}): string {
  const url = new URL(`${feedUrl.replace(/\/+$/, '')}/${target.platform}/${target.architecture}`)
  if (query.channel && query.channel !== 'stable') url.searchParams.set('channel', query.channel)
  if (query.currentVersion) url.searchParams.set('current', query.currentVersion)
  return url.toString()
}

/** As much of a storage disk as updates use. `storageUpdateStore()` adapts `@stacksjs/storage`. */
export interface UpdateStore {
  read: (key: string) => Promise<string | null>
  write: (key: string, contents: string | Uint8Array) => Promise<void>
  publicUrl: (key: string) => Promise<string>
}

/** A disk from `@stacksjs/storage` (`config/filesystems.ts`), as an `UpdateStore`. Default: the default disk. */
export async function storageUpdateStore(disk?: string): Promise<UpdateStore> {
  const { Storage } = await import('@stacksjs/storage')
  const adapter = Storage.disk(disk as Parameters<typeof Storage.disk>[0])
  return {
    read: async key => (await adapter.fileExists(key)) ? adapter.readToString(key) : null,
    write: async (key, contents) => { await adapter.write(key, typeof contents === 'string' ? contents : Buffer.from(contents)) },
    publicUrl: key => adapter.publicUrl(key),
  }
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
  /** Where artifacts are downloaded from, when the disk's own public URL is not it. The artifact's key is appended. */
  artifactBaseUrl?: string
  publishedAt?: string
}

/**
 * Publish one platform's update: the artifact first, then the signed manifest
 * that points at it. In that order, so the feed never names a file that is
 * not there yet.
 */
export async function publishDesktopUpdate(options: PublishDesktopUpdateOptions): Promise<DesktopUpdateManifest> {
  const { size, sha256 } = await describeArtifact(options.artifact)
  const artifactKey = updateArtifactKey(options, options.version, basename(options.artifact))
  await options.store.write(artifactKey, readFileSync(options.artifact))
  const url = options.artifactBaseUrl ? `${options.artifactBaseUrl.replace(/\/+$/, '')}/${artifactKey}` : await options.store.publicUrl(artifactKey)
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
    // Read here rather than through the build's config loader, which would pull the whole desktop toolchain into a web server.
    const file = join(options.root ?? process.cwd(), 'config/desktop.ts')
    updates = existsSync(file) ? (await import(pathToFileURL(file).href) as { default?: { webview?: { updates?: AnswerUpdateFeedOptions['updates'] } } }).default?.webview?.updates : undefined
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
