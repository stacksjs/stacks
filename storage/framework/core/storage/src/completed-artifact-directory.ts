import { link, mkdir, open, unlink } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { Buffer } from 'node:buffer'

export { prepareCompletedArtifactDirectorySync } from './prepared-completed-artifact-directory'
export type { CompletedArtifactIdentity, PreparedCompletedArtifactDirectory, PreparedCompletedArtifactFile, PreparedCompletedArtifactReceipt } from './prepared-completed-artifact-directory'

export interface CompletedArtifactEntry { path: string, contents: string | Uint8Array }
export const completedArtifactLimits = Object.freeze({ files: 1024, bytes: 128 * 1024 * 1024, manifestBytes: 16 * 1024 * 1024, depth: 4 })
/**
 * Publish a new private local artifact after syncing its files and directory entries.
 * Parents must be operator controlled. Requires hard links and directory fsync;
 * this protocol is not a tested storage hardware power-loss guarantee.
 */
export async function writeCompletedArtifact(directory: string, entries: readonly CompletedArtifactEntry[], manifestJson: string, options: { directories?: readonly string[] } = {}): Promise<{ directory: string, manifest: string }> {
  if (typeof directory !== 'string' || directory.length < 1 || directory.length > 4096 || directory.includes('\0')) throw new TypeError('Invalid artifact directory')
  if (!Array.isArray(entries) || entries.length > completedArtifactLimits.files || typeof manifestJson !== 'string' || manifestJson.length > completedArtifactLimits.manifestBytes) throw new RangeError('Artifact resource limit')
  const manifestSize = Buffer.byteLength(manifestJson, 'utf8')
  if (manifestSize > completedArtifactLimits.manifestBytes) throw new RangeError('Completion manifest byte limit')
  let manifest: unknown
  try { manifest = JSON.parse(manifestJson) }
  catch { throw new TypeError('Invalid completion manifest JSON') }
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw new TypeError('Completion manifest must be a JSON object')
  let total = manifestSize
  const paths = new Set(['manifest.json', 'manifest.pending.json'])
  function validatePath(path: unknown): asserts path is string {
    if (typeof path !== 'string' || path.length > 240 || !/^[a-z0-9._/-]+$/i.test(path)) throw new TypeError('Invalid artifact entry path')
    const parts = path.split('/')
    if (parts.length > completedArtifactLimits.depth || parts.some(part => !part || part === '.' || part === '..' || part.length > 128)) throw new TypeError('Unsafe artifact entry path')
  }
  const files = entries.map(entry => {
    if (!entry || typeof entry !== 'object' || Object.keys(entry).length !== 2 || !Object.hasOwn(entry, 'path') || !Object.hasOwn(entry, 'contents')) throw new TypeError('Invalid artifact entry')
    validatePath(entry.path)
    const key = entry.path.toLowerCase()
    if (paths.has(key)) throw new TypeError('Duplicate or reserved artifact path')
    paths.add(key)
    let size: number
    if (typeof entry.contents === 'string') {
      size = Buffer.byteLength(entry.contents, 'utf8')
    }
    else if (entry.contents instanceof Uint8Array && !(typeof SharedArrayBuffer !== 'undefined' && entry.contents.buffer instanceof SharedArrayBuffer)) size = entry.contents.length
    else throw new TypeError('Artifact contents must be text or unshared bytes')
    total += size
    if (total > completedArtifactLimits.bytes) throw new RangeError('Artifact byte limit')
    return { path: entry.path, contents: entry.contents }
  })
  if (!options || typeof options !== 'object' || Object.keys(options).some(key => key !== 'directories') || options.directories !== undefined && (!Array.isArray(options.directories) || options.directories.length > completedArtifactLimits.files)) throw new TypeError('Invalid artifact directory options')
  const directorySpellings = new Map<string, string>()
  function registerDirectories(path: string, includeLeaf: boolean) {
    const parts = path.split('/')
    for (let depth = 1; depth <= parts.length - (includeLeaf ? 0 : 1); depth++) {
      const parent = parts.slice(0, depth).join('/')
      const key = parent.toLowerCase()
      if (paths.has(key)) throw new TypeError('Artifact directory and file collision')
      const spelling = directorySpellings.get(key)
      if (spelling !== undefined && spelling !== parent) throw new TypeError('Artifact directory case alias collision')
      directorySpellings.set(key, parent)
    }
  }
  for (const path of options.directories ?? []) {
    validatePath(path)
    registerDirectories(path, true)
  }
  for (const file of files) registerDirectories(file.path, false)
  // Validation and size accounting precede all cloning and filesystem mutation.
  const manifestBytes = new TextEncoder().encode(manifestJson)
  const snapshot = files.map(file => ({ path: file.path, bytes: typeof file.contents === 'string' ? new TextEncoder().encode(file.contents) : new Uint8Array(file.contents) }))
  const target = resolve(directory)
  const directories = [...directorySpellings.values()]
  async function writeSynced(path: string, data: Uint8Array) {
    const file = await open(path, 'wx', 0o600)
    try { await file.writeFile(data); await file.sync() }
    finally { await file.close() }
  }
  async function syncDirectory(path: string) {
    const folder = await open(path, 'r')
    try { await folder.sync() }
    finally { await folder.close() }
  }
  await mkdir(target, { mode: 0o700 })
  for (const path of [...directories].sort((a, b) => a.split('/').length - b.split('/').length)) await mkdir(join(target, path), { mode: 0o700 })
  for (const file of snapshot) await writeSynced(join(target, file.path), file.bytes)
  for (const path of [...directories].sort((a, b) => b.split('/').length - a.split('/').length)) await syncDirectory(join(target, path))
  await syncDirectory(target)
  await syncDirectory(dirname(target))
  const pending = join(target, 'manifest.pending.json'), completed = join(target, 'manifest.json')
  await writeSynced(pending, manifestBytes)
  await link(pending, completed)
  await syncDirectory(target)
  await unlink(pending)
  await syncDirectory(target)
  return { directory: target, manifest: completed }
}
