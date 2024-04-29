import { runCommand } from '@stacksjs/cli'
import type { ZlibCompressionOptions } from 'bun'

interface ZipOptions {
  cwd?: string
}

export async function zip(
  from: string | string[],
  to?: string,
  options?: ZipOptions,
) {
  const toPath = to || 'archive.zip'
  const fromPath = Array.isArray(from) ? from.join(' ') : from

  if (Array.isArray(from))
    return runCommand(`zip -r ${toPath} ${fromPath}`, options)

  return runCommand(`zip -r ${to} ${from}`, options)
}

export async function unzip(paths: string | string[]) {
  if (Array.isArray(paths)) return runCommand(`unzip ${paths.join(' ')}`)

  return runCommand(`unzip ${paths}`)
}

export function archive(paths: string | string[]) {
  return zip(paths)
}

export function unarchive(paths: string | string[]) {
  return unzip(paths)
}

export function compress(paths: string[]) {
  return zip(paths)
}

export function decompress(paths: string | string[]) {
  return unzip(paths)
}

export function gzipSync(data: Uint8Array, options?: ZlibCompressionOptions) {
  return Bun.gzipSync(data, options) // buffer extends Uint8Array
}

export function gunzipSync(data: Uint8Array) {
  return Bun.gunzipSync(data) // decompressed
}

export function deflateSync(
  data: Uint8Array,
  options?: ZlibCompressionOptions,
) {
  return Bun.deflateSync(data, options) // compressed
}

export function inflateSync(data: Uint8Array) {
  return Bun.inflateSync(data) // decompressed
}
