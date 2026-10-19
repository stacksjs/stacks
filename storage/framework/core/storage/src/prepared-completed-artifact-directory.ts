import type { BigIntStats } from 'node:fs'
import type { CompletedArtifactEntry } from './completed-artifact-directory'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { closeSync, constants, fstatSync, fsyncSync, linkSync, lstatSync, mkdirSync, openSync, readdirSync, readSync, realpathSync, unlinkSync, writeSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { types } from 'node:util'
import { completedArtifactLimits } from './completed-artifact-directory'

/** Observations from no-follow lstat/open/fstat agreement; decimal strings preserve bigint identity. */
export interface CompletedArtifactIdentity {
  readonly path: string
  readonly type: 'file' | 'directory'
  readonly dev: string
  readonly ino: string
  readonly uid: string
  /** Observed creation time, including zero on filesystems without a supported birth time. */
  readonly birthtimeNs: string
  readonly nlink: string
  readonly mode: number
}

export interface PreparedCompletedArtifactFile extends CompletedArtifactIdentity {
  /** Empty-file change-time barrier only; not an immutable identity after our writes or links. */
  readonly preparationCtimeNs: string
  /** Planned complete length. The observed length at preparation is always zero. */
  readonly bytes: number
  /** SHA-256 of detached planned bytes, not a signature or a completed-content assertion. */
  readonly sha256: string
}

export interface PreparedCompletedArtifactReceipt {
  readonly directory: string
  readonly lexicalDirectory: string
  readonly parent: CompletedArtifactIdentity
  readonly root: CompletedArtifactIdentity
  readonly directories: readonly CompletedArtifactIdentity[]
  readonly files: readonly PreparedCompletedArtifactFile[]
  readonly pendingManifest: PreparedCompletedArtifactFile
  /** Initially absent alias; publication links the exact pendingManifest inode here. */
  readonly completedManifest: string
}

export interface PreparedCompletedArtifactDirectory {
  readonly receipt: PreparedCompletedArtifactReceipt
  readonly publishSync: () => { directory: string, manifest: string }
}

interface DetachedFile { path: string, bytes: Uint8Array }
interface DetachedLayout { files: DetachedFile[], directories: string[], manifest: Uint8Array }

const typedPrototype = Object.getPrototypeOf(Uint8Array.prototype)
const byteBuffer = Object.getOwnPropertyDescriptor(typedPrototype, 'buffer')!.get!
const byteOffset = Object.getOwnPropertyDescriptor(typedPrototype, 'byteOffset')!.get!
const byteLength = Object.getOwnPropertyDescriptor(typedPrototype, 'byteLength')!.get!
const setBytes = Uint8Array.prototype.set

function dataRecord(value: unknown, allowed: readonly string[]): PropertyDescriptorMap {
  if (!value || typeof value !== 'object' || types.isProxy(value)) throw new TypeError('Artifact input must be plain data')
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) throw new TypeError('Artifact input must be plain data')
  const descriptors = Object.getOwnPropertyDescriptors(value)
  for (const key of Reflect.ownKeys(descriptors)) {
    const descriptor = typeof key === 'string' ? descriptors[key] : undefined
    if (typeof key !== 'string' || !allowed.includes(key) || !descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) throw new TypeError('Artifact input must have only declared data fields')
  }
  return descriptors
}

function dataList(value: unknown): unknown[] {
  if (!value || typeof value !== 'object' || types.isProxy(value) || !Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) throw new TypeError('Artifact input must be a plain list')
  const length = Object.getOwnPropertyDescriptor(value, 'length')?.value
  if (!Number.isSafeInteger(length) || length > completedArtifactLimits.files) throw new RangeError('Artifact resource limit')
  const descriptors = Object.getOwnPropertyDescriptors(value)
  if (Reflect.ownKeys(descriptors).length !== length + 1) throw new TypeError('Artifact list cannot have holes or aliases')
  const result: unknown[] = []
  for (let index = 0; index < length; index++) {
    const descriptor = descriptors[String(index)]
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) throw new TypeError('Artifact list must contain data')
    result.push(descriptor.value)
  }
  return result
}

function entryPath(value: unknown): asserts value is string {
  if (typeof value !== 'string' || value.length > 240 || !/^[a-z0-9._/-]+$/i.test(value)) throw new TypeError('Invalid artifact entry path')
  const parts = value.split('/')
  if (parts.length > completedArtifactLimits.depth || parts.some(part => !part || part === '.' || part === '..' || part.length > 128)) throw new TypeError('Unsafe artifact entry path')
}

// Nothing in this validator executes a caller getter, iterator, proxy trap or byte-view override.
function detach(entries: unknown, manifestJson: unknown, options: unknown): DetachedLayout {
  const list = dataList(entries)
  if (typeof manifestJson !== 'string' || manifestJson.length > completedArtifactLimits.manifestBytes) throw new RangeError('Artifact resource limit')
  const manifestSize = Buffer.byteLength(manifestJson, 'utf8')
  if (manifestSize > completedArtifactLimits.manifestBytes) throw new RangeError('Completion manifest byte limit')
  let parsed: unknown
  try { parsed = JSON.parse(manifestJson) }
  catch { throw new TypeError('Invalid completion manifest JSON') }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new TypeError('Completion manifest must be a JSON object')
  const optionFields = dataRecord(options, ['directories'])
  const explicit = optionFields.directories?.value === undefined ? [] : dataList(optionFields.directories.value)
  const paths = new Set(['manifest.json', 'manifest.pending.json'])
  const directories = new Map<string, string>()
  let total = manifestSize
  const inputs: { path: string, contents: string | { buffer: ArrayBuffer, offset: number, length: number } }[] = []
  for (const entry of list) {
    const fields = dataRecord(entry, ['path', 'contents'])
    if (!Object.hasOwn(fields, 'path') || !Object.hasOwn(fields, 'contents')) throw new TypeError('Invalid artifact entry')
    const path: unknown = fields.path!.value
    entryPath(path)
    const key = path.toLowerCase()
    if (paths.has(key)) throw new TypeError('Duplicate or reserved artifact path')
    paths.add(key)
    const contents: unknown = fields.contents!.value
    if (typeof contents === 'string') {
      total += Buffer.byteLength(contents, 'utf8')
      inputs.push({ path, contents })
    }
    else {
      if (!contents || typeof contents !== 'object' || types.isProxy(contents) || !types.isUint8Array(contents)) throw new TypeError('Artifact contents must be text or unshared bytes')
      const buffer: ArrayBuffer = byteBuffer.call(contents)
      if (types.isSharedArrayBuffer(buffer)) throw new TypeError('Artifact contents must be text or unshared bytes')
      const offset: number = byteOffset.call(contents), length: number = byteLength.call(contents)
      // Construct a genuine view now so a detached input fails before any filesystem effect.
      new Uint8Array(buffer, offset, length)
      total += length
      inputs.push({ path, contents: { buffer, offset, length } })
    }
    if (total > completedArtifactLimits.bytes) throw new RangeError('Artifact byte limit')
  }
  function register(path: string, includeLeaf: boolean): void {
    const parts = path.split('/')
    for (let depth = 1; depth <= parts.length - (includeLeaf ? 0 : 1); depth++) {
      const parent = parts.slice(0, depth).join('/'), key = parent.toLowerCase()
      if (paths.has(key)) throw new TypeError('Artifact directory and file collision')
      if (directories.has(key) && directories.get(key) !== parent) throw new TypeError('Artifact directory case alias collision')
      directories.set(key, parent)
    }
  }
  for (const path of explicit) { entryPath(path); register(path, true) }
  for (const input of inputs) register(input.path, false)
  const files = inputs.map(({ path, contents }) => {
    const bytes = typeof contents === 'string' ? new TextEncoder().encode(contents) : new Uint8Array(contents.length)
    if (typeof contents !== 'string') setBytes.call(bytes, new Uint8Array(contents.buffer, contents.offset, contents.length))
    return Object.seal({ path, bytes })
  })
  return Object.seal({ files, directories: [...directories.values()].sort((a, b) => a.split('/').length - b.split('/').length), manifest: new TextEncoder().encode(manifestJson) })
}

function identity(path: string, stat: BigIntStats, type: CompletedArtifactIdentity['type']): CompletedArtifactIdentity {
  if (!(type === 'file' ? stat.isFile() : stat.isDirectory())) throw new Error('Artifact identity has an unexpected type')
  return Object.freeze({ path, type, dev: stat.dev.toString(), ino: stat.ino.toString(), uid: stat.uid.toString(), birthtimeNs: stat.birthtimeNs.toString(), nlink: stat.nlink.toString(), mode: Number(stat.mode & 0o7777n) })
}

function sameIdentity(expected: CompletedArtifactIdentity, stat: BigIntStats, links = expected.nlink): void {
  const actual = identity(expected.path, stat, expected.type)
  if (actual.dev !== expected.dev || actual.ino !== expected.ino || actual.uid !== expected.uid || actual.birthtimeNs !== expected.birthtimeNs || actual.mode !== expected.mode || actual.nlink !== links) throw new Error('Artifact identity changed')
}

function openObserved(path: string, type: CompletedArtifactIdentity['type'], flags: number, inspect: (fd: number, stat: BigIntStats) => void): CompletedArtifactIdentity {
  const before = lstatSync(path, { bigint: true })
  const observed = identity(path, before, type)
  const fd = openSync(path, flags | constants.O_NOFOLLOW | constants.O_NONBLOCK | (type === 'directory' ? constants.O_DIRECTORY : 0))
  try {
    const stat = fstatSync(fd, { bigint: true })
    sameIdentity(observed, stat)
    sameIdentity(observed, lstatSync(path, { bigint: true }))
    inspect(fd, stat)
    return observed
  }
  finally { closeSync(fd) }
}

function assertPrivate(observed: CompletedArtifactIdentity, uid: string, device: string): void {
  if (observed.uid !== uid || observed.dev !== device || observed.mode !== (observed.type === 'file' ? 0o600 : 0o700) || observed.type === 'file' && observed.nlink !== '1') throw new Error('Artifact must retain private ownership, mode and links')
}

function verifyWrittenHash(fd: number, expected: PreparedCompletedArtifactFile): void {
  const hash = createHash('sha256'), scratch = new Uint8Array(Math.min(64 * 1024, expected.bytes))
  let offset = 0
  while (offset < expected.bytes) {
    const read = readSync(fd, scratch, 0, Math.min(scratch.byteLength, expected.bytes - offset), offset)
    if (read <= 0) throw new Error('Artifact readback made no progress')
    hash.update(scratch.subarray(0, read))
    offset += read
  }
  if (hash.digest('hex') !== expected.sha256) throw new Error('Artifact written hash changed')
  const stat = fstatSync(fd, { bigint: true })
  if (stat.size !== BigInt(expected.bytes)) throw new Error('Artifact written length changed')
}

/**
 * Exclusively preallocate an empty private tree, then publish through one live synchronous closure.
 * Controlled parents and an unmodified native runtime are required. No restart writer or cleanup.
 * This blocks the isolate; caps bound bytes, not latency or physical power-loss durability.
 */
export function prepareCompletedArtifactDirectorySync(directory: string, entries: readonly CompletedArtifactEntry[], manifestJson: string, options: { directories?: readonly string[] } = {}): PreparedCompletedArtifactDirectory {
  if (typeof directory !== 'string' || directory.length < 1 || directory.length > 4096 || directory.includes('\0')) throw new TypeError('Invalid artifact directory')
  const layout = detach(entries, manifestJson, options)
  if (!constants.O_NOFOLLOW || !constants.O_NONBLOCK || !constants.O_DIRECTORY || !process.getuid) throw new Error('Prepared artifacts require POSIX no-follow, nonblocking and directory opens')
  const uid = String(process.getuid())
  const lexicalDirectory = resolve(directory)
  const parentPath = realpathSync(dirname(lexicalDirectory))
  const target = join(parentPath, basename(lexicalDirectory))
  const parentBefore = openObserved(parentPath, 'directory', constants.O_RDONLY, () => {})
  if (parentBefore.uid !== uid) throw new Error('Artifact parent must belong to the operator')
  const device = parentBefore.dev
  mkdirSync(target, { mode: 0o700 })
  const createdDirectories = new Map<string, CompletedArtifactIdentity>()
  function captureDirectory(path: string): CompletedArtifactIdentity {
    const observed = openObserved(path, 'directory', constants.O_RDONLY, (fd, stat) => {
      assertPrivate(identity(path, stat, 'directory'), uid, device)
      const created = createdDirectories.get(path)
      if (created) sameIdentity(created, stat, stat.nlink.toString())
      fsyncSync(fd)
    })
    createdDirectories.set(path, observed)
    return observed
  }
  captureDirectory(target)
  for (const path of layout.directories) {
    // Every preceding ancestor is an exclusively created, checked directory.
    captureDirectory(dirname(join(target, path)))
    mkdirSync(join(target, path), { mode: 0o700 })
    captureDirectory(join(target, path))
  }
  function preallocate(path: string, bytes: Uint8Array): PreparedCompletedArtifactFile {
    captureDirectory(dirname(path))
    const fd = openSync(path, constants.O_CREAT | constants.O_EXCL | constants.O_RDWR | constants.O_NOFOLLOW | constants.O_NONBLOCK, 0o600)
    let observed: CompletedArtifactIdentity
    let preparationCtimeNs: string
    try {
      const stat = fstatSync(fd, { bigint: true })
      observed = identity(path, stat, 'file')
      assertPrivate(observed, uid, device)
      sameIdentity(observed, lstatSync(path, { bigint: true }))
      if (stat.size !== 0n) throw new Error('Artifact preallocation must be empty')
      fsyncSync(fd)
      preparationCtimeNs = fstatSync(fd, { bigint: true }).ctimeNs.toString()
    }
    finally { closeSync(fd) }
    return Object.freeze({ ...observed, preparationCtimeNs, bytes: bytes.byteLength, sha256: createHash('sha256').update(bytes).digest('hex') })
  }
  captureDirectory(target)
  const files = layout.files.map(file => preallocate(join(target, file.path), file.bytes))
  const pendingManifest = preallocate(join(target, 'manifest.pending.json'), layout.manifest)
  const directories = layout.directories.map(path => captureDirectory(join(target, path)))
  const root = captureDirectory(target)
  const parent = openObserved(parentPath, 'directory', constants.O_RDONLY, (fd, stat) => {
    // Creating our new leaf legitimately changed the parent's link count.
    sameIdentity(parentBefore, stat, stat.nlink.toString())
    fsyncSync(fd)
  })
  const completedManifest = join(target, 'manifest.json')
  const receipt: PreparedCompletedArtifactReceipt = Object.freeze({ directory: target, lexicalDirectory, parent, root, directories: Object.freeze(directories), files: Object.freeze(files), pendingManifest, completedManifest })
  let consumed = false
  function verifyDirectory(expected: CompletedArtifactIdentity, changingLinks = false): void {
    openObserved(expected.path, 'directory', constants.O_RDONLY, (fd, stat) => {
      sameIdentity(expected, stat, changingLinks ? stat.nlink.toString() : expected.nlink)
      fsyncSync(fd)
    })
  }
  function verifyFile(expected: PreparedCompletedArtifactFile, size: number, links = '1'): void {
    openObserved(expected.path, 'file', constants.O_RDONLY, (fd, stat) => {
      sameIdentity(expected, stat, links)
      if (stat.size !== BigInt(size)) throw new Error('Artifact preallocation length changed')
      if (size === 0 && links === '1' && stat.ctimeNs.toString() !== expected.preparationCtimeNs) throw new Error('Artifact empty preallocation changed')
      if (size > 0) verifyWrittenHash(fd, expected)
    })
  }
  function verifyEmptyTree(): void {
    if (realpathSync(dirname(lexicalDirectory)) !== parentPath) throw new Error('Artifact configured parent changed')
    verifyDirectory(parent, true)
    verifyDirectory(root)
    for (const directory of directories) verifyDirectory(directory)
    const expectedChildren = new Map<string, string[]>([root, ...directories].map(item => [item.path, []]))
    for (const item of [...directories, ...files, pendingManifest]) expectedChildren.get(dirname(item.path))!.push(basename(item.path))
    for (const [path, children] of expectedChildren) {
      const actual = readdirSync(path).sort()
      const expected = children.sort()
      if (actual.length !== expected.length || actual.some((name, index) => name !== expected[index])) throw new Error('Artifact directory entries changed')
    }
    for (const file of files) verifyFile(file, 0)
    verifyFile(pendingManifest, 0)
  }
  function writeDetached(expected: PreparedCompletedArtifactFile, bytes: Uint8Array): void {
    openObserved(expected.path, 'file', constants.O_RDWR, (fd, stat) => {
      sameIdentity(expected, stat)
      if (stat.size !== 0n) throw new Error('Artifact preallocation length changed')
      if (stat.ctimeNs.toString() !== expected.preparationCtimeNs) throw new Error('Artifact empty preallocation changed')
      let offset = 0
      while (offset < bytes.byteLength) {
        const written = writeSync(fd, bytes, offset, bytes.byteLength - offset, offset)
        if (written <= 0) throw new Error('Artifact write made no progress')
        offset += written
      }
      fsyncSync(fd)
      sameIdentity(expected, fstatSync(fd, { bigint: true }))
      if (fstatSync(fd, { bigint: true }).size !== BigInt(expected.bytes)) throw new Error('Artifact write length changed')
      verifyWrittenHash(fd, expected)
    })
  }
  const publishSync = (): { directory: string, manifest: string } => {
    if (consumed) throw new Error('Prepared artifact handle is consumed')
    consumed = true
    try {
      verifyEmptyTree()
      for (let index = 0; index < files.length; index++) writeDetached(files[index]!, layout.files[index]!.bytes)
      for (const directory of [...directories].reverse()) verifyDirectory(directory)
      verifyDirectory(root)
      verifyDirectory(parent, true)
      writeDetached(pendingManifest, layout.manifest)
      linkSync(pendingManifest.path, completedManifest)
      verifyFile(pendingManifest, pendingManifest.bytes, '2')
      verifyFile({ ...pendingManifest, path: completedManifest }, pendingManifest.bytes, '2')
      // APFS changes directory nlink for the new regular-file alias; Linux need not.
      verifyDirectory(root, true)
      unlinkSync(pendingManifest.path)
      verifyFile({ ...pendingManifest, path: completedManifest }, pendingManifest.bytes)
      verifyDirectory(root)
      return { directory: target, manifest: completedManifest }
    }
    finally {
      for (const file of layout.files) file.bytes = new Uint8Array(0)
      layout.manifest = new Uint8Array(0)
    }
  }
  return Object.freeze({ receipt, publishSync })
}
