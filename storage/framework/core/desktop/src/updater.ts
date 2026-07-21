import { createHash, createPublicKey, verify } from 'node:crypto'
import { mkdir, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export interface DesktopUpdateManifest {
  version: string
  url: string
  sha256: string
  size: number
  sourceRevision: string
  platform: string
  architecture: string
  signingKeyId: string
  signature: string
  publishedAt?: string
  notes?: string
}

export interface CheckDesktopUpdateOptions {
  currentVersion: string
  manifestUrl: string
  trustedKeys: Record<string, string>
  fetcher?: DesktopFetcher
}

export type DesktopFetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

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
  verifyUpdateManifestSignature(manifest, options.trustedKeys)
  return compareVersions(manifest.version, options.currentVersion) > 0 ? manifest : null
}

export async function stageDesktopUpdate(
  manifest: DesktopUpdateManifest,
  destination: string,
  fetcher: DesktopFetcher = fetch,
  trustedKeys?: Record<string, string>,
): Promise<StagedDesktopUpdate> {
  validateUpdateManifest(manifest)
  if (!trustedKeys) throw new Error('Desktop update staging requires trusted signing keys')
  verifyUpdateManifestSignature(manifest, trustedKeys)
  assertSecureUrl(manifest.url)
  const response = await fetcher(manifest.url)
  if (!response.ok)
    throw new Error(`Desktop update download failed with HTTP ${response.status}`)

  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.byteLength !== manifest.size)
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
  if (!Number.isInteger(manifest.size) || manifest.size! < 0)
    throw new Error('Desktop update manifest requires a non-negative integer size')
  if (typeof manifest.sourceRevision !== 'string' || !/^[0-9a-f]{40}$/.test(manifest.sourceRevision))
    throw new Error('Desktop update manifest requires a full source revision')
  if (typeof manifest.platform !== 'string' || !['darwin', 'linux', 'win32'].includes(manifest.platform))
    throw new Error('Desktop update manifest requires a supported platform identifier')
  if (typeof manifest.architecture !== 'string' || !/^[a-z0-9_-]+$/.test(manifest.architecture))
    throw new Error('Desktop update manifest requires an architecture')
  if (typeof manifest.signingKeyId !== 'string' || !/^[a-zA-Z0-9._-]+$/.test(manifest.signingKeyId))
    throw new Error('Desktop update manifest requires a signing key ID')
  if (typeof manifest.signature !== 'string' || !/^[A-Za-z0-9_-]+$/.test(manifest.signature))
    throw new Error('Desktop update manifest requires an Ed25519 signature')
  return manifest as DesktopUpdateManifest
}

export function updateManifestPayload(manifest: DesktopUpdateManifest): Buffer {
  return Buffer.from(JSON.stringify({
    version: manifest.version,
    url: manifest.url,
    sha256: manifest.sha256.toLowerCase(),
    size: manifest.size,
    sourceRevision: manifest.sourceRevision,
    platform: manifest.platform,
    architecture: manifest.architecture,
    signingKeyId: manifest.signingKeyId,
    publishedAt: manifest.publishedAt || null,
    notes: manifest.notes || null,
  }), 'utf8')
}

export function verifyUpdateManifestSignature(manifest: DesktopUpdateManifest, trustedKeys: Record<string, string>): void {
  const encodedKey = trustedKeys[manifest.signingKeyId]
  if (!encodedKey) throw new Error(`Desktop update signing key is not trusted: ${manifest.signingKeyId}`)
  const prefix = 'ed25519-public:'
  if (!encodedKey.startsWith(prefix)) throw new Error('Desktop update signing key has an invalid encoding')
  try {
    const publicKey = createPublicKey({ key: Buffer.from(encodedKey.slice(prefix.length), 'base64url'), format: 'der', type: 'spki' })
    const signature = Buffer.from(manifest.signature, 'base64url')
    if (publicKey.asymmetricKeyType !== 'ed25519' || signature.length !== 64 || !verify(null, updateManifestPayload(manifest), publicKey, signature))
      throw new Error('invalid')
  }
  catch {
    throw new Error('Desktop update manifest signature verification failed')
  }
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
