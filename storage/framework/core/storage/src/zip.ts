import type { Result } from '@stacksjs/error-handling'
import type { CommandError, Subprocess } from '@stacksjs/types'
import type { ZlibCompressionOptions } from 'bun'
import { runCommand } from '@stacksjs/cli'

function shellEscape(_arg: string): string {
  return `'${_arg.replace(/'/g, "'\\''")}'`
}

interface ZipOptions {
  cwd?: string
}

export async function zip(
  from: string | string[],
  to?: string,
  options?: ZipOptions,
): Promise<Result<Subprocess, CommandError>> {
  const toPath = to || 'archive.zip'

  if (Array.isArray(from)) {
    const fromPath = from.map(f => shellEscape(f)).join(' ')
    return runCommand(`zip -r ${shellEscape(toPath)} ${fromPath}`, options)
  }

  return runCommand(`zip -r ${shellEscape(toPath)} ${shellEscape(from)}`, options)
}

export async function unzip(paths: string | string[]): Promise<Result<Subprocess, CommandError>> {
  if (Array.isArray(paths))
    return runCommand(`unzip ${paths.map(p => shellEscape(p)).join(' ')}`)

  return runCommand(`unzip ${shellEscape(paths)}`)
}

export function archive(paths: string | string[]): Promise<Result<Subprocess, CommandError>> {
  return zip(paths)
}

export function unarchive(paths: string | string[]): Promise<Result<Subprocess, CommandError>> {
  return unzip(paths)
}

export function compress(paths: string[]): Promise<Result<Subprocess, CommandError>> {
  return zip(paths)
}

export function decompress(paths: string | string[]): Promise<Result<Subprocess, CommandError>> {
  return unzip(paths)
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
