import type { Result } from '@stacksjs/error-handling'
import type { CommandError, Subprocess } from '@stacksjs/types'
import type { ZlibCompressionOptions } from 'bun'
import { runCommand } from '@stacksjs/cli'

interface ZipOptions {
  cwd?: string
}

/*
 * Arguments go as an ARRAY, never as a joined string.
 *
 * These used to build a shell command and single-quote each path with a
 * `shellEscape` helper. `runCommand` spawns without a shell, so those quotes
 * arrived as literal characters in the filename: `zip` looked for a file
 * called `'uploads'`, quotes included, and answered `zip error: Nothing to
 * do!` on a directory that was plainly not empty. Every one of these
 * functions was therefore broken for every input it escaped - which is to say
 * all of them - and nothing noticed, because they had no caller until
 * `storage:backup` (stacksjs/stacks#269).
 *
 * The array form is what `exec` uses as argv directly, so a path with a space
 * in it also works now, which the string form could never have managed.
 */

export async function zip(
  from: string | string[],
  to?: string,
  options?: ZipOptions,
): Promise<Result<Subprocess, CommandError>> {
  const toPath = to || 'archive.zip'
  const sources = Array.isArray(from) ? from : [from]

  return runCommand(['zip', '-r', toPath, ...sources], options)
}

/**
 * Extract each archive in `paths`, in order, stopping at the first failure.
 *
 * One `unzip` run per archive: `unzip -o a.zip b.zip` does not extract two
 * archives, it extracts the member named `b.zip` from `a.zip`, so with more
 * than one path nothing was extracted from any archive but the first, and
 * from that one only a member that happened to share the second's name.
 */
export async function unzip(
  paths: string | string[],
  options?: ZipOptions,
): Promise<Result<Subprocess, CommandError>> {
  const [first, ...rest] = Array.isArray(paths) ? paths : [paths]
  if (first === undefined)
    throw new Error('unzip() needs at least one archive')

  let result = await runCommand(['unzip', '-o', first], options)
  for (const source of rest) {
    if (result.isErr)
      break
    result = await runCommand(['unzip', '-o', source], options)
  }

  return result
}

export function archive(paths: string | string[], to?: string, options?: ZipOptions): Promise<Result<Subprocess, CommandError>> {
  return zip(paths, to, options)
}

export function unarchive(paths: string | string[], options?: ZipOptions): Promise<Result<Subprocess, CommandError>> {
  return unzip(paths, options)
}

export function compress(paths: string[], to?: string, options?: ZipOptions): Promise<Result<Subprocess, CommandError>> {
  return zip(paths, to, options)
}

export function decompress(paths: string | string[], options?: ZipOptions): Promise<Result<Subprocess, CommandError>> {
  return unzip(paths, options)
}

/*
 * Bun's zlib bindings take `Uint8Array<ArrayBuffer>` - a view over a real
 * ArrayBuffer - while `Uint8Array` alone defaults to `ArrayBufferLike`, which
 * also admits a SharedArrayBuffer. These wrappers keep the wider parameter so
 * callers need not care, and name the narrowing here rather than reaching for
 * `any`, which also unchecked the options object beside it.
 */
export function gzipSync(data: Uint8Array, options?: ZlibCompressionOptions): Uint8Array {
  return Bun.gzipSync(data as Uint8Array<ArrayBuffer>, options)
}

export function gunzipSync(data: Uint8Array): Uint8Array {
  return Bun.gunzipSync(data as Uint8Array<ArrayBuffer>)
}

export function deflateSync(data: Uint8Array, options?: ZlibCompressionOptions): Uint8Array {
  return Bun.deflateSync(data as Uint8Array<ArrayBuffer>, options)
}

export function inflateSync(data: Uint8Array): Uint8Array {
  return Bun.inflateSync(data as Uint8Array<ArrayBuffer>)
}

/** One file for {@link zipEntries}. */
export interface ZipEntry {
  /** The file's path inside the archive, with forward slashes (`exports/members.csv`). */
  name: string
  /** The file's contents; a string is written as UTF-8. */
  data: string | Uint8Array
  /** When the file was last changed. Defaults to `options.date`, then to now. */
  date?: Date
}

export interface ZipEntriesOptions {
  /**
   * DEFLATE level, 0-9 (default 6). An entry is deflated only when that makes
   * it smaller and stored as it is otherwise; 0 stores every entry.
   */
  level?: number
  /**
   * The timestamp for entries that carry no `date` of their own (default:
   * now). Pass a fixed date to get byte-identical archives for the same input.
   */
  date?: Date
}

/** The largest size or offset a ZIP without ZIP64 can record. */
const ZIP32_LIMIT = 0xFFFFFFFF
const zipText = new TextEncoder()

/** MS-DOS date and time as ZIP headers carry them: local time, 2-second steps, 1980-2107. */
function dosDateTime(at: Date): { date: number, time: number } {
  if (Number.isNaN(at.getTime()))
    throw new Error('zipEntries(): an entry has an invalid date')

  if (at.getFullYear() < 1980)
    return { date: (1 << 5) | 1, time: 0 } // 1980-01-01 00:00:00, the earliest a DOS date holds
  if (at.getFullYear() > 2107)
    return { date: (127 << 9) | (12 << 5) | 31, time: (23 << 11) | (59 << 5) | 29 } // 2107-12-31 23:59:58

  return {
    date: ((at.getFullYear() - 1980) << 9) | ((at.getMonth() + 1) << 5) | at.getDate(),
    time: (at.getHours() << 11) | (at.getMinutes() << 5) | (at.getSeconds() >> 1),
  }
}

/** A relative path with forward slashes, refused when it could escape the folder it is extracted into. */
function zipEntryName(name: string): string {
  const path = String(name ?? '').replace(/\\/g, '/')
  if (!path || path.startsWith('/') || /^[a-z]:/i.test(path) || path.includes('\0')
    || path.split('/').some(part => part === '' || part === '.' || part === '..'))
    throw new Error(`zipEntries(): "${name}" is not a safe file name inside a ZIP (relative, forward slashes, no empty, "." or ".." parts)`)

  return path
}

/**
 * Build a ZIP archive in memory and return its bytes - for a download made of
 * several files, answered straight from a request:
 *
 * ```ts
 * const bytes = zipEntries([
 *   { name: 'members.csv', data: membersCsv },
 *   { name: 'README.txt', data: 'What each file holds.' },
 * ])
 * return new Response(bytes, { headers: { 'Content-Type': 'application/zip' } })
 * ```
 *
 * Unlike {@link zip}, nothing touches the disk and no `zip` binary is needed.
 * The format follows PKWARE's APPNOTE 6.3 (section 4): CRC-32 per entry,
 * UTF-8 names (general purpose bit 11), DOS timestamps, and each entry
 * deflated (method 8, Bun's raw DEFLATE) when that is smaller, else stored
 * (method 0). Every unzip tool reads both.
 *
 * Entry order is kept. A repeated name, or a name that is absolute or holds a
 * `..` part, is refused. There is no ZIP64, so an archive past 65,535 entries
 * or 4 GB (any entry, offset or the whole archive) throws rather than writing
 * a file readers would get wrong.
 */
export function zipEntries(entries: ZipEntry[], options: ZipEntriesOptions = {}): Uint8Array {
  if (entries.length > 0xFFFF)
    throw new Error(`zipEntries(): ${entries.length} entries is more than the 65,535 a ZIP without ZIP64 holds`)

  const level = options.level ?? 6
  if (!Number.isInteger(level) || level < 0 || level > 9)
    throw new Error(`zipEntries(): level must be an integer from 0 to 9, got ${level}`)

  const tooBig = (what: string): Error => new Error(`zipEntries(): ${what} is past the 4 GB a ZIP without ZIP64 holds`)
  const fallbackDate = options.date ?? new Date()
  const seen = new Set<string>()
  const parts: Uint8Array[] = []
  const centrals: Uint8Array[] = []
  let offset = 0

  for (const entry of entries) {
    const path = zipEntryName(entry.name)
    if (seen.has(path))
      throw new Error(`zipEntries(): two entries are named "${path}"`)
    seen.add(path)

    const name = zipText.encode(path)
    if (name.length > 0xFFFF)
      throw new Error(`zipEntries(): the name "${path.slice(0, 40)}..." is longer than 65,535 bytes`)

    const raw = typeof entry.data === 'string' ? zipText.encode(entry.data) : entry.data
    if (raw.length >= ZIP32_LIMIT)
      throw tooBig(`"${path}" (${raw.length} bytes)`)
    if (offset >= ZIP32_LIMIT)
      throw tooBig(`the archive before "${path}"`)

    const crc = Bun.hash.crc32(raw) >>> 0
    const deflated = level > 0 && raw.length > 0 ? deflateSync(raw, { level: level as ZlibCompressionOptions['level'] }) : undefined
    const method = deflated && deflated.length < raw.length ? 8 : 0
    const data = method === 8 ? deflated! : raw
    const { date, time } = dosDateTime(entry.date ?? fallbackDate)

    // Local file header (4.3.7), followed by the entry's bytes.
    const local = new Uint8Array(30 + name.length)
    const head = new DataView(local.buffer)
    head.setUint32(0, 0x04034B50, true)
    head.setUint16(4, 20, true) // version needed to extract: 2.0 (deflate)
    head.setUint16(6, 0x0800, true) // bit 11: the name is UTF-8
    head.setUint16(8, method, true)
    head.setUint16(10, time, true)
    head.setUint16(12, date, true)
    head.setUint32(14, crc, true)
    head.setUint32(18, data.length, true)
    head.setUint32(22, raw.length, true)
    head.setUint16(26, name.length, true)
    head.setUint16(28, 0, true) // extra field length
    local.set(name, 30)

    // Central directory header (4.3.12).
    const central = new Uint8Array(46 + name.length)
    const dir = new DataView(central.buffer)
    dir.setUint32(0, 0x02014B50, true)
    dir.setUint16(4, 0x0314, true) // made by: UNIX, spec 2.0, so the mode below is read
    dir.setUint16(6, 20, true)
    dir.setUint16(8, 0x0800, true)
    dir.setUint16(10, method, true)
    dir.setUint16(12, time, true)
    dir.setUint16(14, date, true)
    dir.setUint32(16, crc, true)
    dir.setUint32(20, data.length, true)
    dir.setUint32(24, raw.length, true)
    dir.setUint16(28, name.length, true)
    // 30 extra length, 32 comment length, 34 disk number, 36 internal attributes: all 0
    dir.setUint32(38, (0o100644 << 16) >>> 0, true) // a regular file, rw-r--r--
    dir.setUint32(42, offset, true) // where its local header starts
    central.set(name, 46)

    parts.push(local, data)
    centrals.push(central)
    offset += local.length + data.length
  }

  const directorySize = centrals.reduce((total, part) => total + part.length, 0)
  if (offset >= ZIP32_LIMIT || offset + directorySize + 22 > ZIP32_LIMIT)
    throw tooBig('the archive')

  // End of central directory record (4.3.16).
  const end = new Uint8Array(22)
  const tail = new DataView(end.buffer)
  tail.setUint32(0, 0x06054B50, true)
  // 4 this disk, 6 disk with the directory: both 0
  tail.setUint16(8, entries.length, true)
  tail.setUint16(10, entries.length, true)
  tail.setUint32(12, directorySize, true)
  tail.setUint32(16, offset, true)
  // 20 comment length: 0

  const out = new Uint8Array(offset + directorySize + end.length)
  let at = 0
  for (const part of [...parts, ...centrals, end]) {
    out.set(part, at)
    at += part.length
  }

  return out
}
