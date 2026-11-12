/**
 * What the two filesystem adapters, `local` and `bun`, share: how a file is
 * written and how its public URL is built. One copy, so the two disks cannot
 * drift apart again - the Bun adapter had kept neither fix the local one got.
 */

import { randomBytes } from 'node:crypto'
import { lstatSync } from 'node:fs'
import { chmod, mkdir, open, rename, rm, stat } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import process from 'node:process'

/**
 * Resolve beneath the configured root without following descendant symlinks.
 * The root (including its ancestor aliases) is trusted configuration. Its
 * descendants must remain under application control during filesystem I/O;
 * this check is not a sandbox against concurrent filesystem replacement.
 */
export function resolveStoragePath(root: string, path: string): string {
  const base = resolve(root)
  const target = join(base, path)
  const rel = relative(base, target)
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel))
    throw new Error(`Path traversal detected: '${path}' resolves outside storage root`)

  let current = base
  for (const segment of rel.split(sep).filter(Boolean)) {
    current = join(current, segment)
    try {
      if (lstatSync(current).isSymbolicLink())
        throw new Error(`Storage path '${path}' contains a symlink`)
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') break
      throw error
    }
  }
  return target
}

/**
 * Write `fullPath` through a temporary file beside it, renamed into place
 * once the write has finished.
 *
 * Writing in place truncated the existing file before the first byte of the
 * new one arrived. A stream that failed or was aborted left the old contents
 * gone and the new ones partial, and `putStream` then deleted the partial
 * file to tidy up - so a failed re-upload of an avatar removed the avatar. A
 * reader in the meantime saw a half-written file. Now the old file stays
 * whole until the new one is complete, readers see one or the other, and a
 * failure removes only the temporary file. The replaced file's mode carries
 * over, so a private file stays private.
 */
export async function writeAtomically(fullPath: string, write: (temporary: string) => Promise<void>): Promise<void> {
  await mkdir(dirname(fullPath), { recursive: true })
  const temporary = join(dirname(fullPath), `.${basename(fullPath)}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`)
  try {
    await write(temporary)
    const previous = await stat(fullPath).catch(() => null)
    if (previous)
      await chmod(temporary, previous.mode & 0o7777)
    await rename(temporary, fullPath)
  }
  catch (error) {
    await rm(temporary, { force: true }).catch(() => {})
    throw error
  }
}

/**
 * Write a web stream to `path`, a chunk at a time.
 *
 * A plain read-and-write loop, because neither shortcut survives Bun 1.3.
 * `Bun.write(path, new Response(stream))`, which the Bun adapter used, never
 * resolves there for any stream of any size, so an upload hung the request
 * that made it. Node's `pipeline(Readable.fromWeb(stream), ...)`, which the
 * local adapter used, completes but never rejects when the stream errors, so
 * a failed upload hung instead of failing. Each write is awaited before the
 * next read, which is all the backpressure there is to get wrong: a 512 MB
 * stream peaks under 60 MB resident on Bun 1.3.0, 1.3.14 and 1.4.4.
 *
 * `signal` aborts the copy, between chunks or while waiting for one, and
 * rejects with the signal's reason. The caller owns removing the partial file.
 */
export async function writeStreamToFile(path: string, stream: ReadableStream<Uint8Array>, signal?: AbortSignal): Promise<void> {
  signal?.throwIfAborted()

  let stop: (() => void) | undefined
  const aborted = signal && new Promise<never>((_resolve, reject) => {
    stop = () => reject(signal.reason ?? new DOMException('The operation was aborted.', 'AbortError'))
    signal.addEventListener('abort', stop, { once: true })
  })
  // Raced below; this keeps an abort that lands mid-write from being reported
  // as unhandled before the next read picks it up.
  aborted?.catch(() => {})

  const reader = stream.getReader()
  const handle = await open(path, 'w')
  try {
    for (;;) {
      const next = await (aborted ? Promise.race([reader.read(), aborted]) : reader.read())
      if (next.done)
        break
      for (let offset = 0; offset < next.value.length;)
        offset += (await handle.write(next.value, offset)).bytesWritten
    }
  }
  catch (error) {
    reader.cancel(error).catch(() => {})
    throw error
  }
  finally {
    if (stop)
      signal?.removeEventListener('abort', stop)
    await handle.close()
  }
}

/**
 * Percent-encode each segment of a storage path, keeping its slashes: a file
 * called `my photo #1.jpg` becomes `my%20photo%20%231.jpg`. Unencoded, the
 * `#` began a fragment and the browser asked for `my photo `.
 */
export function encodeStoragePath(path: string): string {
  return path.split('/').map(segment => encodeURIComponent(segment)).join('/')
}

/**
 * The public URL of `path` on a disk served from `diskUrl`.
 *
 * The disk's own `url` is used whenever it is configured, including `'/'`
 * (files served from the site root). That one was dropped: the trailing
 * slash was trimmed to `''`, which read as "not configured", and the URL
 * fell through to `APP_URL` - correct by accident only when the app's root
 * was where the files were served.
 */
export function publicUrlFor(path: string, options: { domain?: string, diskUrl?: string }): string {
  const base = withScheme(options.domain ?? options.diskUrl ?? process.env.APP_URL ?? 'http://localhost')
  return `${base.replace(/\/+$/, '')}/${encodeStoragePath(path.replace(/^\/+/, ''))}`
}

/**
 * The origin a signed URL is served from: `baseUrl`, else `APP_URL`, else
 * localhost.
 */
export function signedUrlBase(baseUrl?: string): string {
  return withScheme(baseUrl || process.env.APP_URL || 'http://localhost').replace(/\/+$/, '')
}

/**
 * A host given without a scheme, as `APP_URL` usually is (`stacks.localhost`),
 * gets `https://` - the same reading the router's `url()` gives it. Used raw,
 * it produced `stacks.localhost/avatar.png`, which a browser resolves as a
 * path on the current page. A path from the site root stays as it is.
 */
function withScheme(base: string): string {
  if (base === '' || base.startsWith('/') || /^[a-z][a-z0-9+.-]*:\/\//i.test(base))
    return base
  return `https://${base}`
}
