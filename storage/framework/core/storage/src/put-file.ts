/**
 * Helpers for `Storage.put(file, opts)` — the UploadedFile-shaped
 * overload that takes a file-like object straight off `req.file()` /
 * `req.files` and returns `{ path, url }`. Lives outside `facade.ts`
 * so the facade stays focused on disk dispatch.
 *
 * See stacksjs/stacks#1856.
 */

import type { StorageManager } from './facade'

/**
 * Minimal structural shape for an uploaded file accepted by
 * `Storage.put(file, opts)`. Compatible with `@stacksjs/bun-router`'s
 * `UploadedFile` interface but defined here so storage doesn't take a
 * dependency on the router.
 */
export interface UploadedFileLike {
  /** The original filename from the client (used by `filename: 'original'`). */
  originalName?: string
  /** Client-reported MIME type (used to derive an extension when missing). */
  mimetype?: string
  /** Raw bytes — `req.files`/`req.file()` already populates this. */
  buffer: ArrayBuffer | Uint8Array | Buffer
}

/** Built-in filename strategies for `Storage.put(file, { filename })`. */
export type FilenameStrategy =
  | 'uuid'
  | 'hash'
  | 'original'
  | ((file: UploadedFileLike) => string)

export interface PutFileOptions {
  /** Disk to write to. Defaults to the configured default disk. */
  disk?: string
  /** Sub-directory inside the disk (e.g. `'avatars'`). */
  dir?: string
  /**
   * How to derive the stored filename. Defaults to `'uuid'` — predictable,
   * collision-resistant, and doesn't leak the original filename.
   */
  filename?: FilenameStrategy
  /**
   * Append an extension derived from `originalName` (preferred) or
   * `mimetype` (fallback) when the chosen filename doesn't already have
   * one. Defaults to `true`.
   */
  preserveExtension?: boolean
}

/**
 * Common MIME → extension map. Intentionally short — covers the
 * everyday upload cases (images, common docs, video, audio). For
 * exotic types, callers can pass a `filename: (f) => ...` function and
 * own the extension themselves.
 */
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/avif': 'avif',
  'application/pdf': 'pdf',
  'application/json': 'json',
  'application/zip': 'zip',
  'application/octet-stream': 'bin',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'text/html': 'html',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
}

function extFromOriginalName(name: string | undefined): string | null {
  if (!name) return null
  const idx = name.lastIndexOf('.')
  if (idx <= 0 || idx === name.length - 1) return null
  const ext = name.slice(idx + 1).toLowerCase()
  // Reject anything that looks like a path traversal token rather than an
  // extension, plus any non-alphanumeric content — defense in depth on top
  // of the storage adapter's own path checks.
  if (!/^[a-z0-9]+$/.test(ext)) return null
  return ext
}

function deriveExtension(file: UploadedFileLike): string | null {
  return extFromOriginalName(file.originalName) ?? (file.mimetype && MIME_TO_EXT[file.mimetype.toLowerCase()]) ?? null
}

function bufferLikeToHash(buffer: ArrayBuffer | Uint8Array | Buffer): string {
  const view = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer
  const hasher = new Bun.CryptoHasher('sha256')
  hasher.update(view as Uint8Array)
  return hasher.digest('hex').slice(0, 32)
}

function sanitizeOriginalName(name: string): string {
  // Strip directory separators and `..` segments. Replace anything that
  // isn't `[A-Za-z0-9._-]` with `_`. Collapse runs of `_`.
  const stripped = name.replace(/[/\\]/g, '_').replace(/\.{2,}/g, '_')
  return stripped.replace(/[^A-Za-z0-9._-]/g, '_').replace(/_+/g, '_')
}

function resolveFilename(file: UploadedFileLike, strategy: FilenameStrategy): string {
  if (typeof strategy === 'function') return strategy(file)
  switch (strategy) {
    case 'uuid': return crypto.randomUUID().replace(/-/g, '')
    case 'hash': return bufferLikeToHash(file.buffer)
    case 'original':
      return file.originalName ? sanitizeOriginalName(file.originalName) : crypto.randomUUID().replace(/-/g, '')
  }
}

function joinPath(...parts: string[]): string {
  return parts
    .filter(Boolean)
    .map((p, i) => i === 0 ? p.replace(/\/+$/, '') : p.replace(/^\/+/, '').replace(/\/+$/, ''))
    .filter(Boolean)
    .join('/')
}

export async function putUploadedFile(
  manager: StorageManager,
  file: UploadedFileLike,
  opts: PutFileOptions,
): Promise<{ path: string, url: string }> {
  const disk = manager.disk(opts.disk)

  const baseName = resolveFilename(file, opts.filename ?? 'uuid')
  const wantExt = opts.preserveExtension !== false
  const baseHasExt = /\.[A-Za-z0-9]+$/.test(baseName)
  const ext = wantExt && !baseHasExt ? deriveExtension(file) : null
  const finalName = ext ? `${baseName}.${ext}` : baseName

  const fullPath = joinPath(opts.dir ?? '', finalName)

  // Adapters accept Buffer | Uint8Array | string. Normalize ArrayBuffer.
  const contents = file.buffer instanceof ArrayBuffer
    ? new Uint8Array(file.buffer)
    : file.buffer

  await disk.write(fullPath, contents)
  const url = await disk.publicUrl(fullPath)
  return { path: fullPath, url }
}
