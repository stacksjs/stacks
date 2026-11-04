/** Native directory cookies keep a restarted local inventory bounded in both I/O and memory. */
import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { Buffer } from 'node:buffer'
import type { DirectoryPage, DirectoryPageOptions } from './types'

export class DirectoryListingChangedError extends Error {
  constructor() { super('The directory changed during inventory. Restart this directory with a fresh cursor.'); this.name = 'DirectoryListingChangedError' }
}

export function directoryPageSize(options: DirectoryPageOptions): number {
  const size = options.limit ?? 100
  if (!Number.isInteger(size) || size < 1 || size > 1000) throw new TypeError('A directory page limit must be an integer from 1 to 1000')
  return size
}

/** Shallow pages only. Cookies are invalidated on any directory mutation, never silently skipped. */
export async function localDirectoryPage(fullPath: string, path: string, options: DirectoryPageOptions = {}): Promise<DirectoryPage> {
  const limit = directoryPageSize(options)
  if (process.platform !== 'darwin' && process.platform !== 'linux') throw new Error('Durable local directory pages require a POSIX host')
  let before
  try { before = await stat(fullPath, { bigint: true }) }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT' && !options.cursor) return { entries: [], nextCursor: null }
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new DirectoryListingChangedError()
    throw error
  }
  if (!before.isDirectory()) throw new Error('Directory pages require a directory')
  const identity = [fullPath, before.dev, before.ino, before.mtimeNs, before.ctimeNs].join(':')
  let block = 0n
  let skip = 0
  if (options.cursor) {
    let decoded
    try {
      if (options.cursor.length > 8192) throw new TypeError('Invalid directory cursor')
      decoded = JSON.parse(Buffer.from(options.cursor, 'base64url').toString())
    }
    catch { throw new TypeError('Invalid directory cursor') }
    if (decoded?.v !== 1 || typeof decoded.block !== 'string' || !/^\d{1,19}$/.test(decoded.block) || BigInt(decoded.block) > 9223372036854775807n || !Number.isInteger(decoded.skip) || decoded.skip < 0 || decoded.skip > 32768) throw new TypeError('Invalid directory cursor')
    if (decoded.identity !== identity) throw new DirectoryListingChangedError()
    block = BigInt(decoded.block)
    skip = decoded.skip
  }
  // Loaded only for the POSIX page API; the general adapter stays portable.
  const { dlopen, FFIType, toArrayBuffer } = await import('bun:ffi')
  const darwin = process.platform === 'darwin'
  const errnoName = darwin ? '__error' : '__errno_location'
  const readName = darwin ? '__getdirentries64' : 'getdents64'
  const libc = dlopen(darwin ? '/usr/lib/libSystem.B.dylib' : 'libc.so.6', {
    open: { args: [FFIType.cstring, FFIType.i32], returns: FFIType.i32 },
    lseek: { args: [FFIType.i32, FFIType.i64, FFIType.i32], returns: FFIType.i64 },
    [readName]: { args: darwin ? [FFIType.i32, FFIType.ptr, FFIType.u64, FFIType.ptr] : [FFIType.i32, FFIType.ptr, FFIType.u64], returns: FFIType.i64 },
    close: { args: [FFIType.i32], returns: FFIType.i32 },
    [errnoName]: { args: [], returns: FFIType.ptr },
  })
  const api = libc.symbols
  let descriptor = -1
  try {
    const errno = new Int32Array(toArrayBuffer(api[errnoName]!()!, 0, 4))
    descriptor = api.open(Buffer.from(`${fullPath}\0`), 0)
    if (descriptor < 0) throw new Error(`Cannot open directory for inventory (errno ${errno[0]})`)
    if (BigInt(api.lseek(descriptor, block, 0)) < 0n) throw new Error(`Cannot resume directory inventory (errno ${errno[0]})`)
    const entries: DirectoryPage['entries'] = []
    const buffer = new Uint8Array(32768)
    const view = new DataView(buffer.buffer)
    const base = new BigInt64Array(1)
    let ended = false
    let scanned = 0
    while (scanned < limit) {
      const size = Number(darwin ? api[readName]!(descriptor, buffer, buffer.length, base) : api[readName]!(descriptor, buffer, buffer.length))
      if (size < 0) throw new Error(`Cannot read directory for inventory (errno ${errno[0]})`)
      if (skip > size || (!size && skip)) throw new TypeError('Invalid directory cursor boundary')
      if (!size) { ended = true; break }
      let offset = 0
      while (offset < size && scanned < limit) {
        const length = view.getUint16(offset + 16, true)
        const nameOffset = darwin ? 21 : 19
        if (length <= nameOffset || offset + length > size) throw new Error('Invalid native directory entry')
        const next = offset + length
        if (offset < skip) {
          if (next > skip) throw new TypeError('Invalid directory cursor boundary')
          offset = next
          continue
        }
        scanned++
        const nameBytes = buffer.subarray(offset + nameOffset, next)
        const end = nameBytes.indexOf(0)
        if (end < 0) throw new Error('Invalid native directory name')
        const name = Buffer.from(nameBytes.subarray(0, end)).toString()
        const kind = buffer[offset + (darwin ? 20 : 18)]
        offset = next
        if (name === '.' || name === '..') continue
        if (kind === 4 || kind === 8) entries.push({ path: join(path, name), type: kind === 4 ? 'directory' : 'file' })
        else if (kind === 0) {
          const { lstat } = await import('node:fs/promises')
          const info = await lstat(join(fullPath, name))
          if (info.isFile() || info.isDirectory()) entries.push({ path: join(path, name), type: info.isDirectory() ? 'directory' : 'file' })
        }
      }
      skip = offset
      if (offset === size) {
        block = BigInt(api.lseek(descriptor, 0n, 1))
        if (block < 0n) throw new Error(`Cannot checkpoint directory inventory (errno ${errno[0]})`)
        skip = 0
      }
    }
    const after = await stat(fullPath, { bigint: true })
    if ([fullPath, after.dev, after.ino, after.mtimeNs, after.ctimeNs].join(':') !== identity) throw new DirectoryListingChangedError()
    return { entries, nextCursor: ended ? null : Buffer.from(JSON.stringify({ v: 1, identity, block: String(block), skip })).toString('base64url') }
  }
  finally {
    if (descriptor >= 0) api.close(descriptor)
    libc.close()
  }
}
