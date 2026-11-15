import type { InstalledLibraryPackageOptions } from './installed.js'
import { createHash } from 'node:crypto'
import { closeSync, constants, fstatSync, lstatSync, openSync, opendirSync, readSync, realpathSync } from 'node:fs'
import { isAbsolute, join, relative } from 'node:path'
import { safeArchivePath } from './archive.js'

export interface InstalledFileIdentity { sha256: string, bytes: number }

function fail(message: string): never { throw new Error(`Release verification blocked: ${message}`) }
function hash(bytes: Uint8Array): string { return createHash('sha256').update(bytes).digest('hex') }
function contained(root: string, path: string): boolean {
  const child = relative(root, path)
  return !!child && child !== '..' && !child.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) && !isAbsolute(child)
}

// Shared with legacy release evidence, whose root node_modules exception is
// intentionally unavailable on the public standalone-package interface.
export function verifyInstalledFiles(directory: string, expected: ReadonlyMap<string, InstalledFileIdentity | Uint8Array>, options: InstalledLibraryPackageOptions = {}, separateDependencies = false): Map<string, Uint8Array> {
  const maxEntries = options.maxEntries ?? 100_000
  const maxDepth = options.maxDepth ?? 128
  const maxBytes = options.maxBytes ?? 256 * 1024 * 1024
  const maxFileBytes = options.maxFileBytes ?? maxBytes
  for (const limit of [maxEntries, maxDepth, maxBytes, maxFileBytes]) {
    if (!Number.isSafeInteger(limit) || limit <= 0) fail('Installed package budgets must be positive safe integers')
  }
  if (expected.size > maxEntries) fail('Installed package expected inventory exceeds its budget')
  const identities = new Map<string, InstalledFileIdentity>()
  let expectedBytes = 0
  for (const [name, entry] of expected) {
    const size = entry instanceof Uint8Array ? entry.byteLength : entry?.bytes
    if (!Number.isSafeInteger(size) || size < 0 || size > maxFileBytes || expectedBytes + size > maxBytes)
      fail('Installed package expected inventory exceeds its budget')
    const identity = entry instanceof Uint8Array ? { sha256: hash(entry), bytes: size } : entry
    if (!safeArchivePath(name) || !identity || !Number.isSafeInteger(identity.bytes) || identity.bytes < 0 || !/^[a-f0-9]{64}$/.test(identity.sha256))
      fail('Installed package expected inventory has an unsafe path or identity')
    expectedBytes += identity.bytes
    identities.set(name, identity)
  }
  const rootStat = lstatSync(directory)
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) fail('Installed package root must be a real directory')
  const root = realpathSync(directory)
  if (options.consumerRoot && !contained(realpathSync(options.consumerRoot), root)) fail('Installed package resolves outside its consumer root')
  const actual = new Map<string, Uint8Array>()
  const hasBundledDependencies = [...expected.keys()].some(name => name.startsWith('node_modules/'))
  let entries = 0
  let bytesRead = 0
  function visit(path: string, depth: number): void {
    if (depth > maxDepth) fail('Installed package directory depth exceeds its budget')
    const fullDirectory = join(root, path)
    const before = lstatSync(fullDirectory)
    if (!before.isDirectory() || before.isSymbolicLink() || realpathSync(fullDirectory) !== fullDirectory)
      fail('Installed package directory is a link or escapes its root')
    const handle = opendirSync(fullDirectory)
    try {
      for (let entry = handle.readSync(); entry; entry = handle.readSync()) {
        if (++entries > maxEntries) fail('Installed package entry count exceeds its budget')
        const name = path ? `${path}/${entry.name}` : entry.name
        if (!safeArchivePath(name)) fail('Installed package contains an unsafe path')
        // Only legacy evidence delegates separately installed dependencies.
        if (separateDependencies && !path && entry.name === 'node_modules' && !hasBundledDependencies) continue
        const fullPath = join(root, name)
        const stat = lstatSync(fullPath)
        if (stat.isSymbolicLink()) fail(`Installed package file ${name} is a symbolic link`)
        if (!separateDependencies && name === '.bun-tag' && !stat.isFile()) fail(`Installed package file ${name} is not a regular file`)
        if (stat.isDirectory()) { visit(name, depth + 1); continue }
        if (!stat.isFile()) fail(`Installed package file ${name} is not a regular file`)
        const identity = identities.get(name)
        const bunTag = !identity && name === '.bun-tag' && options.allowBunTag === true
        if (!identity && !bunTag) fail(`Installed package file ${name} differs from the verified archive`)
        if (stat.size > maxFileBytes || bytesRead + stat.size > maxBytes) fail('Installed package file bytes exceed their budget')
        if ((identity && stat.size !== identity.bytes) || (bunTag && stat.size !== 95)) fail(`Installed package file ${name} differs from the verified archive`)
        // Open without following a substituted leaf; never read a FIFO/device.
        const fd = openSync(fullPath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0))
        let bytes: Uint8Array
        try {
          const opened = fstatSync(fd)
          if (!opened.isFile() || opened.dev !== stat.dev || opened.ino !== stat.ino || opened.size !== stat.size) fail(`Installed package file ${name} changed during inspection`)
          bytes = new Uint8Array(stat.size)
          let offset = 0
          while (offset < bytes.length) {
            const count = readSync(fd, bytes, offset, bytes.length - offset, null)
            if (!count) fail(`Installed package file ${name} changed during inspection`)
            offset += count
          }
          const after = fstatSync(fd)
          if (readSync(fd, new Uint8Array(1), 0, 1, null) || after.size !== stat.size || after.mtimeMs !== opened.mtimeMs || after.ctimeMs !== opened.ctimeMs)
            fail(`Installed package file ${name} changed during inspection`)
        }
        finally { closeSync(fd) }
        bytesRead += bytes.length
        if (bunTag) {
          if (!/^sha512-[A-Za-z0-9+/]{86}==$/.test(new TextDecoder().decode(bytes))) fail('Installed package has invalid Bun installer metadata')
        }
        else {
          if (hash(bytes) !== identity!.sha256) fail(`Installed package file ${name} differs from the verified archive`)
          actual.set(name, bytes)
        }
      }
    }
    finally { handle.closeSync() }
    const after = lstatSync(fullDirectory)
    if (!after.isDirectory() || after.dev !== before.dev || after.ino !== before.ino || after.mtimeMs !== before.mtimeMs || after.ctimeMs !== before.ctimeMs || realpathSync(fullDirectory) !== fullDirectory)
      fail('Installed package directory changed during inspection')
  }
  visit('', 0)
  if (actual.size !== expected.size) fail('Installed package is missing files from the verified archive')
  if (realpathSync(directory) !== root) fail('Installed package root changed during inspection')
  return actual
}
