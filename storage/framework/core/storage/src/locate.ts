import { join } from 'node:path'
import { Storage } from './facade'

/**
 * Where a stored file can be served from, without reading it.
 *
 * A large file (a video, an archive) cannot go through `readToUint8Array` to
 * answer a request: iOS asks for `Range: bytes=0-1` before it plays anything,
 * and holding 300 MB to answer two bytes is the bug. So a file on a local disk
 * comes back as a lazy `Bun.file()` the response slices, and a file in an
 * object store comes back as a temporary URL to redirect to, where the store
 * serves its own ranges. Apps had each written this, reaching past the facade
 * for a disk's root.
 */
export type LocatedFile =
  | { kind: 'file', disk: string, file: Blob, path: string }
  | { kind: 'url', disk: string, url: string }

export interface LocateOptions {
  /** Disks to look in, in order. Default: the default disk. */
  disks?: readonly string[]
  /** Seconds a temporary URL lasts. Default 300. */
  expiresIn?: number
}

/** The root a disk keeps files under on this machine, or null for a disk with none (an object store). */
export function localDiskRoot(name?: string): string | null {
  const config = Storage.getDiskConfig(name) as { driver?: string, root?: string } | undefined
  if (!config?.root)
    return null
  return config.driver === 'local' || config.driver === 'bun' ? config.root : null
}

/**
 * The file at `path` as something a response can be built from: a lazy local
 * file, or a temporary URL. Null when no listed disk has it. A disk that
 * throws (a bucket briefly unreachable) counts as not having it, so the next
 * disk is tried.
 */
export async function locateFile(path: string, options: LocateOptions = {}): Promise<LocatedFile | null> {
  const disks = options.disks?.length ? options.disks : [Storage.getDefaultDisk()]
  for (const disk of disks) {
    try {
      const root = localDiskRoot(disk)
      if (root) {
        const local = join(root, path)
        const file = Bun.file(local)
        if (await file.exists())
          return { kind: 'file', disk, file, path: local }
        continue
      }
      const adapter = Storage.disk(disk as Parameters<typeof Storage.disk>[0])
      if (await adapter.fileExists(path))
        return { kind: 'url', disk, url: await adapter.temporaryUrl(path, { expiresIn: options.expiresIn ?? 300 }) }
    }
    catch {
      // The next disk: one unreachable store should cost this file, not every file.
    }
  }
  return null
}
