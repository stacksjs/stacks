/**
 * Helpers for `Storage.put(file, opts)` — the UploadedFile-shaped
 * overload that takes a file-like object straight off `req.file()` /
 * `req.files` and returns `{ path, url }`. Lives outside `facade.ts`
 * so the facade stays focused on disk dispatch.
 *
 * See stacksjs/stacks#1856.
 */

import type { StorageManager } from './facade'
import type { PutResult } from './types'
import type { DiskName } from './types/filesystem'

/**
 * Optional metadata fields shared by every uploaded-file shape we
 * accept. The `name` / `mimeType` aliases are present so the router's
 * `UploadedFile` class (which uses the class-style names) flows
 * through alongside the direct-parse shape (which uses the
 * snake-style `originalName` / `mimetype`).
 */
interface UploadedFileMetadata {
  /** Original filename from the client (used by `filename: 'original'`). */
  originalName?: string
  /** Class-style alias that the router's `UploadedFile` exposes as `name`. */
  name?: string
  /** Client-reported MIME type (used to derive an extension when missing). */
  mimetype?: string
  /** Class-style alias that the router's `UploadedFile` exposes as `mimeType`. */
  mimeType?: string
}

/**
 * Minimal structural shape for an uploaded file accepted by
 * `Storage.put(file, opts)`. Modeled as a discriminated union so the
 * type-checker rejects `Storage.put({})` and similar empty-object
 * mistakes (stacksjs/stacks#1873 S-13). At least one of `buffer`,
 * `bytes()`, or `arrayBuffer()` must be present — that's the runtime
 * contract `readBytes()` enforces with a throw, and now the
 * structural contract the type system enforces at compile time.
 *
 * Two callsites land here in practice (stacksjs/stacks#1856):
 *
 *   1. **Direct multipart parse** (the original router shape, before
 *      bun-router wrapped each entry in an `UploadedFile` class).
 *      `{ originalName, mimetype, buffer }` — synchronous.
 *   2. **Router's `UploadedFile` class** (current shape from
 *      `req.file(key)` / `req.files`). Exposes `name`, `mimeType`, and
 *      an async `bytes()` / `arrayBuffer()` accessor instead of a
 *      `buffer` property — Bun's `File` is lazy by design.
 */
export type UploadedFileLike = UploadedFileMetadata & (
  | { buffer: ArrayBuffer | Uint8Array | Buffer, bytes?: () => Promise<Uint8Array>, arrayBuffer?: () => Promise<ArrayBuffer> }
  | { bytes: () => Promise<Uint8Array>, buffer?: ArrayBuffer | Uint8Array | Buffer, arrayBuffer?: () => Promise<ArrayBuffer> }
  | { arrayBuffer: () => Promise<ArrayBuffer>, buffer?: ArrayBuffer | Uint8Array | Buffer, bytes?: () => Promise<Uint8Array> }
)

/** Built-in filename strategies for `Storage.put(file, { filename })`. */
export type FilenameStrategy =
  | 'uuid'
  | 'hash'
  | 'original'
  | ((file: UploadedFileLike) => string)

export interface PutFileOptions {
  /** Disk to write to. Defaults to the configured default disk. */
  disk?: DiskName
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
  /**
   * Optional image-processing pipeline applied before write
   * (stacksjs/stacks#1856 Stage 5). Receives the raw bytes + a Sharp
   * instance loaded lazily from the `@stacksjs/storage/image` submodule;
   * returns the processed bytes that get persisted. Throws a clear
   * error if `sharp` isn't installed — projects that don't need image
   * transforms don't pay the native-module install cost.
   *
   * If the transform changes the output format (e.g. JPEG → WebP), the
   * caller is responsible for updating `mimetype` / `filename` to match
   * — the storage layer doesn't sniff bytes.
   *
   * @example
   * ```ts
   * import { transform } from '@stacksjs/storage/image'
   *
   * await Storage.put(file, {
   *   disk: 'public',
   *   dir: 'avatars',
   *   transform: transform(img => img.resize(512, 512, { fit: 'cover' }).webp({ quality: 85 })),
   * })
   * ```
   */
  transform?: (input: Uint8Array | Buffer | ArrayBuffer) => Promise<Uint8Array | Buffer>
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

function originalNameOf(file: UploadedFileLike): string | undefined {
  return file.originalName ?? file.name
}

function mimetypeOf(file: UploadedFileLike): string | undefined {
  return file.mimetype ?? file.mimeType
}

function deriveExtension(file: UploadedFileLike): string | null {
  const mime = mimetypeOf(file)
  return extFromOriginalName(originalNameOf(file)) ?? (mime && MIME_TO_EXT[mime.toLowerCase()]) ?? null
}

/**
 * Pull raw bytes off whichever shape the caller passed in. Synchronous
 * `.buffer` wins (direct-parse shape) because it's free; otherwise we
 * fall back to the class-style async accessors. Throws if neither is
 * available — that's an upstream contract bug, not a runtime miss.
 */
async function readBytes(file: UploadedFileLike): Promise<ArrayBuffer | Uint8Array | Buffer> {
  if (file.buffer !== undefined) return file.buffer
  if (typeof file.bytes === 'function') return await file.bytes()
  if (typeof file.arrayBuffer === 'function') return await file.arrayBuffer()
  throw new Error('UploadedFile is missing both `buffer` and `bytes()`/`arrayBuffer()` accessors — cannot read file contents.')
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

async function resolveFilename(file: UploadedFileLike, strategy: FilenameStrategy): Promise<string> {
  if (typeof strategy === 'function') return strategy(file)
  switch (strategy) {
    case 'uuid': return crypto.randomUUID().replace(/-/g, '')
    case 'hash': {
      const bytes = await readBytes(file)
      return bufferLikeToHash(bytes)
    }
    case 'original': {
      const name = originalNameOf(file)
      return name ? sanitizeOriginalName(name) : crypto.randomUUID().replace(/-/g, '')
    }
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
): Promise<PutResult & { url: string }> {
  const disk = manager.disk(opts.disk)

  const baseName = await resolveFilename(file, opts.filename ?? 'uuid')
  const wantExt = opts.preserveExtension !== false
  const baseHasExt = /\.[A-Za-z0-9]+$/.test(baseName)
  const ext = wantExt && !baseHasExt ? deriveExtension(file) : null
  const finalName = ext ? `${baseName}.${ext}` : baseName

  const fullPath = joinPath(opts.dir ?? '', finalName)

  // Adapters accept Buffer | Uint8Array | string. Normalize ArrayBuffer
  // and read the class-shape's async accessor when there's no sync
  // `.buffer` property.
  const raw = await readBytes(file)
  let contents: Uint8Array | Buffer = raw instanceof ArrayBuffer ? new Uint8Array(raw) : raw

  // Optional image-processing pipeline (stacksjs/stacks#1856 Stage 5).
  // Runs *after* filename resolution so the same `dir/filename.ext`
  // path is used for the transformed bytes. If the caller wants to
  // change the extension (e.g. JPEG → WebP), they pass an explicit
  // `filename` and pre-built `transform` together.
  if (opts.transform) {
    contents = await opts.transform(contents)
  }

  // `disk.write()` now returns size/lastModified/contentType
  // (stacksjs/stacks#1888 S-8) — surface that alongside the
  // public URL so a single upload call carries everything a
  // caller needs to persist against their domain model.
  const written = await disk.write(fullPath, contents)
  const url = await disk.publicUrl(fullPath)
  return { ...written, path: fullPath, url }
}
