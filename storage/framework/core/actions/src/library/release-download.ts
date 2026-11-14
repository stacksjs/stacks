import type { LibrarySourceReceipt } from './release-source'
import type { LibraryNetworkOptions } from './release-network'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { inflateRawSync } from 'node:zlib'
import { safeArchivePath } from './archive'
import { librarySha256, validateLibraryReleaseSource } from './release-artifacts'
import { createLibraryReleaseReader } from './release-network'

/** Decode only bounded ordinary files, never extracting provider paths or links. */
export function libraryArtifactZipFiles(data: Uint8Array): Map<string, Uint8Array> {
  const bytes = Buffer.from(data)
  let end = bytes.length - 22
  while (end >= Math.max(0, bytes.length - 65_557) && bytes.readUInt32LE(end) !== 0x06054b50) end--
  if (end < 0 || end + 22 > bytes.length || bytes.readUInt32LE(end) !== 0x06054b50 || end + 22 + bytes.readUInt16LE(end + 20) !== bytes.length
    || bytes.readUInt16LE(end + 4) || bytes.readUInt16LE(end + 6)) throw new Error('Invalid provider artifact ZIP')
  const count = bytes.readUInt16LE(end + 10)
  let offset = bytes.readUInt32LE(end + 16)
  if (!count || count > 10_000 || bytes.readUInt16LE(end + 8) !== count || offset + bytes.readUInt32LE(end + 12) !== end) throw new Error('Provider artifact ZIP exceeds bounds')
  const files = new Map<string, Uint8Array>()
  let expanded = 0
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || bytes.readUInt32LE(offset) !== 0x02014b50) throw new Error('Invalid provider artifact ZIP directory')
    const flags = bytes.readUInt16LE(offset + 8)
    const method = bytes.readUInt16LE(offset + 10)
    const compressed = bytes.readUInt32LE(offset + 20)
    const size = bytes.readUInt32LE(offset + 24)
    const nameLength = bytes.readUInt16LE(offset + 28)
    const next = offset + 46 + nameLength + bytes.readUInt16LE(offset + 30) + bytes.readUInt16LE(offset + 32)
    const mode = bytes.readUInt32LE(offset + 38) >>> 16
    const local = bytes.readUInt32LE(offset + 42)
    if (next > end || flags & 1 || ![0, 8].includes(method) || ![0, 0o100000, 0o040000].includes(mode & 0o170000) || size > 64 * 1024 * 1024 || (expanded += size) > 512 * 1024 * 1024)
      throw new Error('Unsupported or oversized provider artifact ZIP entry')
    const name = new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(offset + 46, offset + 46 + nameLength))
    offset = next
    const path = name.endsWith('/') ? name.slice(0, -1) : name
    if (!safeArchivePath(path) || files.has(path)) throw new Error('Unsafe or duplicate provider artifact path')
    if (name.endsWith('/')) continue
    if (local + 30 > offset || bytes.readUInt32LE(local) !== 0x04034b50) throw new Error('Invalid provider artifact ZIP file')
    const start = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28)
    if (start + compressed > bytes.readUInt32LE(end + 16)) throw new Error('Provider artifact ZIP file exceeds bounds')
    const raw = bytes.subarray(start, start + compressed)
    const content = method === 0 ? raw : inflateRawSync(raw, { maxOutputLength: Math.max(1, size) })
    if (content.length !== size) throw new Error('Provider artifact ZIP expanded size differs')
    files.set(path, content)
  }
  if (offset !== end) throw new Error('Provider artifact ZIP directory length differs')
  for (const path of files.keys()) {
    const parts = path.split('/')
    for (let index = 1; index < parts.length; index++)
      if (files.has(parts.slice(0, index).join('/'))) throw new Error('Conflicting provider artifact paths')
  }
  return files
}

/** Download only the accepted artifact ID, checking its actual provider digest. */
export async function downloadLibraryReleaseSource(receipt: LibrarySourceReceipt, directory: string, options: LibraryNetworkOptions & { token?: string } = {}): Promise<void> {
  validateLibraryReleaseSource(receipt.source)
  const artifact = receipt.artifact
  if (receipt.schemaVersion !== 1 || !Number.isSafeInteger(artifact?.id) || artifact.id <= 0 || !Number.isSafeInteger(artifact.bytes) || artifact.bytes <= 0 || artifact.bytes > 256 * 1024 * 1024
    || !/^sha256:[a-f0-9]{64}$/.test(artifact.digest ?? '')
    || artifact.downloadUrl !== `https://api.github.com/repos/${receipt.source.repository}/actions/artifacts/${artifact.id}/zip`)
    throw new Error('Expected a bounded accepted artifact ID, SHA-256 digest and owned GitHub download URL')
  const reader = createLibraryReleaseReader(options)
  const request = options.fetch ?? fetch
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), Math.min(options.requestTimeoutMs ?? 15_000, reader.remaining()))
  let location: string
  try {
    const response = await request(receipt.artifact.downloadUrl, { redirect: 'manual', signal: controller.signal, headers: options.token ? { Authorization: `Bearer ${options.token}`, Accept: 'application/vnd.github+json' } : { Accept: 'application/vnd.github+json' } })
    await response.body?.cancel()
    const url = new URL(response.headers.get('location') ?? '')
    if (response.status !== 302 || url.protocol !== 'https:' || url.username || url.password
      || !(url.hostname.endsWith('.blob.core.windows.net') || url.hostname.endsWith('.actions.githubusercontent.com')))
      throw new Error('Provider artifact did not return an approved signed download URL')
    location = url.href
  }
  finally { clearTimeout(timeout) }
  const bytes = await reader.read(location, { maxBytes: 256 * 1024 * 1024 })
  if (!bytes || bytes.length !== receipt.artifact.bytes || `sha256:${librarySha256(bytes)}` !== receipt.artifact.digest) throw new Error('Provider artifact digest or length differs')
  const files = libraryArtifactZipFiles(bytes)
  await mkdir(directory, { recursive: false })
  for (const [path, content] of files) {
    const target = join(directory, path)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, content, { flag: 'wx' })
  }
}
