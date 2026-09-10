/**
 * File information for any file (stacksjs/stacks#308).
 *
 * The question a file manager, an upload form or a preview pane actually asks
 * is "what is this, and can I show it" - so that is what this answers: the
 * mime type, the size, a `kind` a UI can branch on, and format-specific detail
 * where it is cheap to get.
 *
 * Lives in `@stacksjs/storage` rather than a new `@stacksjs/file-preview`
 * package. It is a property OF a stored file, it needs the mime detection
 * already here, and a separate package would have to re-export half of this
 * one to be usable.
 *
 * ## Why the mime type is sniffed rather than taken from the extension
 *
 * An extension is a claim by whoever named the file. `detectMimeFromMagicBytes`
 * reads what the bytes actually are, which is the whole point when the file
 * arrived from an upload - and `verifyUploadedMime` beside it exists because
 * that difference is a security boundary, not a nicety. The extension is used
 * only as a fallback for formats with no usable magic bytes, and the result
 * says which happened.
 */

import { extname } from 'node:path'
import { detectMimeFromMagicBytes } from './mime-verify'

/** What a UI branches on: how to present the file, not what encodes it. */
export type FileKind = 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'archive' | 'font' | 'other'

export interface FileInfo {
  /** Detected mime type, or `application/octet-stream` when nothing matched. */
  mime: string
  /** How the mime type was decided. */
  mimeSource: 'magic-bytes' | 'extension' | 'fallback'
  /** Size in bytes. */
  size: number
  /** The presentation category. */
  kind: FileKind
  /** Whether a preview can be rendered from the bytes alone. */
  previewable: boolean
  /** Image dimensions and colour detail, when the file is an image. */
  image?: ImageInfo
}

/** What `ts-images` reports about a decoded image. */
export interface ImageInfo {
  width: number
  height: number
  format: string
  channels?: number
  bitDepth?: number
  hasAlpha?: boolean
  colorSpace?: string
}

/**
 * Extension fallbacks, for formats whose magic bytes are absent or ambiguous.
 *
 * Deliberately short. Every entry here is a guess about a file's contents made
 * from its name, so the list covers the cases where there is nothing better -
 * plain text and the XML-ish formats - rather than mirroring a full mime
 * database and pretending the extra entries are knowledge.
 */
const EXTENSION_MIME: Record<string, string> = {
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.csv': 'text/csv',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.svg': 'image/svg+xml',
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.ts': 'text/typescript',
  '.yaml': 'application/yaml',
  '.yml': 'application/yaml',
}

/** Mime prefixes and exact types that map to a presentation kind. */
const KIND_BY_TYPE: ReadonlyArray<[RegExp, FileKind]> = [
  [/^image\//, 'image'],
  [/^video\//, 'video'],
  [/^audio\//, 'audio'],
  [/^font\/|^application\/(?:x-)?font/, 'font'],
  [/^application\/pdf$/, 'pdf'],
  [/^application\/(?:zip|x-tar|gzip|x-7z|x-rar|x-bzip)/, 'archive'],
  [/^text\/|^application\/(?:json|xml|yaml|javascript|typescript)/, 'text'],
]

/** The presentation category for a mime type. */
export function fileKind(mime: string): FileKind {
  for (const [pattern, kind] of KIND_BY_TYPE) {
    if (pattern.test(mime))
      return kind
  }
  return 'other'
}

/**
 * Whether a preview can be rendered from the bytes alone.
 *
 * `false` does not mean "no preview is possible" - it means one cannot be made
 * here, without a transcoder, a renderer or a headless browser. A caller that
 * has those can still produce one; the point is that this module does not
 * pretend it did.
 *
 * SVG is excluded from previewable despite being an image: rendering
 * attacker-supplied SVG is script execution, and the decision to do it anyway
 * belongs to the caller who knows where the file came from.
 */
export function isPreviewable(mime: string): boolean {
  if (mime === 'image/svg+xml')
    return false
  return fileKind(mime) === 'image' || fileKind(mime) === 'text'
}

/** Resolve the mime type from bytes first, then the name. */
export function resolveMime(bytes: Uint8Array, name?: string): { mime: string, source: FileInfo['mimeSource'] } {
  const sniffed = detectMimeFromMagicBytes(bytes)
  if (sniffed)
    return { mime: sniffed, source: 'magic-bytes' }

  if (name) {
    const byExtension = EXTENSION_MIME[extname(name).toLowerCase()]
    if (byExtension)
      return { mime: byExtension, source: 'extension' }
  }

  return { mime: 'application/octet-stream', source: 'fallback' }
}

/**
 * Describe a file from its bytes.
 *
 * `name` is optional and used only for the extension fallback, so this works
 * for an in-memory upload that has no path yet.
 *
 * Image metadata is read through `ts-images`, imported lazily: a caller asking
 * about a PDF should not pay to load an image decoder. A decode failure is not
 * an error - a truncated or malformed image is still a file with a size and a
 * type, and returning that beats throwing on the one case a file manager most
 * needs to display.
 */
export async function fileInfoFromBytes(bytes: Uint8Array, name?: string): Promise<FileInfo> {
  const { mime, source } = resolveMime(bytes, name)
  const kind = fileKind(mime)

  const info: FileInfo = {
    mime,
    mimeSource: source,
    size: bytes.byteLength,
    kind,
    previewable: isPreviewable(mime),
  }

  if (kind === 'image' && mime !== 'image/svg+xml') {
    try {
      const { getMetadata } = await import('ts-images')
      info.image = await getMetadata(bytes) as ImageInfo
    }
    catch {
      // Malformed, truncated, or a format the decoder does not know. The file
      // is still describable, and a preview pane that shows "image, 4 MB"
      // beats one that shows an exception.
    }
  }

  return info
}

/** Describe a file on disk. */
export async function fileInfo(path: string): Promise<FileInfo> {
  const file = Bun.file(path)
  const bytes = new Uint8Array(await file.arrayBuffer())
  return fileInfoFromBytes(bytes, path)
}
