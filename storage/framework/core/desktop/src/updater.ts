import { createHash } from 'node:crypto'
import { mkdir, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export interface DesktopUpdateManifest {
  version: string
  url: string
  sha256: string
  size?: number
  publishedAt?: string
  notes?: string
}

export interface CheckDesktopUpdateOptions {
  currentVersion: string
  manifestUrl: string
  fetcher?: typeof fetch
}

export interface StagedDesktopUpdate {
  manifest: DesktopUpdateManifest
  path: string
  bytes: number
}

export async function checkForDesktopUpdate(options: CheckDesktopUpdateOptions): Promise<DesktopUpdateManifest | null> {
  assertSecureUrl(options.manifestUrl)
  const response = await (options.fetcher || fetch)(options.manifestUrl, {
    headers: { Accept: 'application/json' },
  })
  if (!response.ok)
    throw new Error(`Desktop update check failed with HTTP ${response.status}`)

  const manifest = validateUpdateManifest(await response.json())
  return compareVersions(manifest.version, options.currentVersion) > 0 ? manifest : null
}

export async function stageDesktopUpdate(
  manifest: DesktopUpdateManifest,
  destination: string,
  fetcher: typeof fetch = fetch,
): Promise<StagedDesktopUpdate> {
  validateUpdateManifest(manifest)
  assertSecureUrl(manifest.url)
  const response = await fetcher(manifest.url)
  if (!response.ok)
    throw new Error(`Desktop update download failed with HTTP ${response.status}`)

  const bytes = new Uint8Array(await response.arrayBuffer())
  if (manifest.size !== undefined && bytes.byteLength !== manifest.size)
    throw new Error(`Desktop update size mismatch: expected ${manifest.size}, received ${bytes.byteLength}`)

  const checksum = createHash('sha256').update(bytes).digest('hex')
  if (checksum !== manifest.sha256.toLowerCase())
    throw new Error('Desktop update checksum mismatch')

  await mkdir(dirname(destination), { recursive: true })
  const temporaryPath = `${destination}.download-${crypto.randomUUID()}`
  await writeFile(temporaryPath, bytes, { mode: 0o700 })
  await rename(temporaryPath, destination)
  return { manifest, path: destination, bytes: bytes.byteLength }
}

export function compareVersions(left: string, right: string): number {
  const leftParts = parseVersion(left)
  const rightParts = parseVersion(right)
  for (let index = 0; index < 3; index++) {
    const difference = leftParts[index]! - rightParts[index]!
    if (difference !== 0) return Math.sign(difference)
  }
  return 0
}

export function validateUpdateManifest(input: unknown): DesktopUpdateManifest {
  if (!input || typeof input !== 'object')
    throw new Error('Desktop update manifest must be an object')
  const manifest = input as Partial<DesktopUpdateManifest>
  parseVersion(manifest.version || '')
  if (typeof manifest.url !== 'string')
    throw new Error('Desktop update manifest requires a URL')
  if (typeof manifest.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(manifest.sha256))
    throw new Error('Desktop update manifest requires a SHA-256 checksum')
  if (manifest.size !== undefined && (!Number.isInteger(manifest.size) || manifest.size < 0))
    throw new Error('Desktop update manifest size must be a non-negative integer')
  return manifest as DesktopUpdateManifest
}

function parseVersion(version: string): [number, number, number] {
  const match = version.match(/^v?(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?$/)
  if (!match)
    throw new Error(`Invalid semantic version: ${version}`)
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

function assertSecureUrl(value: string): void {
  const url = new URL(value)
  const isLoopback = ['localhost', '127.0.0.1', '::1'].includes(url.hostname)
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLoopback))
    throw new Error('Desktop updates require HTTPS outside loopback development')
}
