import type { Result } from '@stacksjs/error-handling'
import type { CommandError, Subprocess } from '@stacksjs/types'
import type { ZlibCompressionOptions } from 'bun'
import { runCommand } from '@stacksjs/cli'

function shellEscape(arg: string): string {
  return `'${arg.replace(/'/g, "'\\''")}'`
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
  return zip(paths) as any
}

export function unarchive(paths: string | string[]): Promise<Result<Subprocess, CommandError>> {
  return unzip(paths) as any
}

export function compress(paths: string[]): Promise<Result<Subprocess, CommandError>> {
  return zip(paths) as any
}

export function decompress(paths: string | string[]): Promise<Result<Subprocess, CommandError>> {
  return unzip(paths) as any
}

export function gzipSync(data: Uint8Array, options?: ZlibCompressionOptions): Uint8Array {
  return Bun.gzipSync(data as any, options)
}

export function gunzipSync(data: Uint8Array): Uint8Array {
  return Bun.gunzipSync(data as any)
}

export function deflateSync(data: Uint8Array, options?: ZlibCompressionOptions): Uint8Array {
  return Bun.deflateSync(data as any, options)
}

export function inflateSync(data: Uint8Array): Uint8Array {
  return Bun.inflateSync(data as any)
}
