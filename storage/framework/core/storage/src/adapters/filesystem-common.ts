/**
 * What the two filesystem adapters, `local` and `bun`, share: how a file is
 * written and how its public URL is built. One copy, so the two disks cannot
 * drift apart again - the Bun adapter had kept neither fix the local one got.
 */

import { randomBytes } from 'node:crypto'
import { chmod, mkdir, rename, rm, stat } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import process from 'node:process'

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
  const base = options.domain ?? options.diskUrl ?? process.env.APP_URL ?? 'http://localhost'
  return `${base.replace(/\/+$/, '')}/${encodeStoragePath(path.replace(/^\/+/, ''))}`
}
