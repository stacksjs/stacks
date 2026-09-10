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

export async function unzip(
  paths: string | string[],
  options?: ZipOptions,
): Promise<Result<Subprocess, CommandError>> {
  const sources = Array.isArray(paths) ? paths : [paths]

  return runCommand(['unzip', '-o', ...sources], options)
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
