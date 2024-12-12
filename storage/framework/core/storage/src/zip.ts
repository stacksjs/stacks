import type { Result } from '@stacksjs/error-handling'
import type { CommandError, Subprocess } from '@stacksjs/types'
import type { ZlibCompressionOptions } from 'bun'
import { runCommand } from '@stacksjs/cli'

interface ZipOptions {
  cwd?: string
}

export async function zip(
  from: string | string[],
  to?: string,
  options?: ZipOptions,
): Promise<Result<Subprocess, CommandError>> {
  const toPath = to || 'archive.zip'
  const fromPath = Array.isArray(from) ? from.join(' ') : from

  if (Array.isArray(from))
    return runCommand(`zip -r ${toPath} ${fromPath}`, options)

  return runCommand(`zip -r ${to} ${from}`, options)
}

export async function unzip(paths: string | string[]): Promise<Result<Subprocess, CommandError>> {
  if (Array.isArray(paths))
    return runCommand(`unzip ${paths.join(' ')}`)

  return runCommand(`unzip ${paths}`)
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

export function gzipSync(data: Uint8Array, options?: ZlibCompressionOptions): Uint8Array {
  return Bun.gzipSync(data, options) // buffer extends Uint8Array
}

export function gunzipSync(data: Uint8Array): Uint8Array {
  return Bun.gunzipSync(data) // decompressed
}

export function deflateSync(data: Uint8Array, options?: ZlibCompressionOptions): Uint8Array {
  return Bun.deflateSync(data, options) // compressed
}

export function inflateSync(data: Uint8Array): Uint8Array {
  return Bun.inflateSync(data) // decompressed
}
