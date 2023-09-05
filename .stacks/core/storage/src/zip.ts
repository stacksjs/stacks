import type { ZlibCompressionOptions } from 'bun'

type ZipOptions = ZlibCompressionOptions

export async function zip(paths: string | string[], options?: ZipOptions) {
  const data = []
  const pathsArray = Array.isArray(paths) ? paths : [paths]

  for (const path of pathsArray) {
    const file = Bun.file(path)
    const arrayBuffer = await file.arrayBuffer()
    data.push(new Uint8Array(arrayBuffer))
  }

  return gzipSync(Buffer.concat(data), options) // compressed
}

export async function unzip(paths: string | string[]) {
  const data = []
  const pathsArray = Array.isArray(paths) ? paths : [paths]

  for (const path of pathsArray) {
    const file = Bun.file(path)
    const arrayBuffer = await file.arrayBuffer()
    data.push(new Uint8Array(arrayBuffer))
  }

  return gunzipSync(Buffer.concat(data)) // decompressed
}

export function compress(paths: string[], options?: ZipOptions) {
  return zip(paths, options) // compressed
}

export function decompress(paths: string | string[]) {
  return unzip(paths) // decompressed
}

export function gzipSync(buffer: Uint8Array, options?: ZipOptions) {
  return Bun.gzipSync(buffer, options) // buffer extends Uint8Array
}

export function gunzipSync(data: Uint8Array) {
  return Bun.gunzipSync(data) // decompressed
}

export async function deflateSync(data: Uint8Array, options?: ZipOptions) {
  return Bun.deflateSync(data, options) // compressed
}

export function inflateSync(data: Uint8Array) {
  return Bun.inflateSync(data) // decompressed
}
