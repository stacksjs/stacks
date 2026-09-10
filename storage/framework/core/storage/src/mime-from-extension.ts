import { basename } from 'node:path'

/**
 * A content type guessed from a path's extension.
 *
 * This is what an adapter sends as `Content-Type` when the caller did not name
 * one. It is a guess by construction - the bytes are never read - so it is only
 * ever used for writes, where being wrong means a wrong header on an object the
 * caller chose the name of. Reads report what the service stored, and anything
 * that has to be *trusted* goes through `detectMimeFromMagicBytes` in
 * `mime-verify.ts` instead, which reads the file.
 *
 * Shared because it was three private copies of one table - S3, memory and, as
 * of the Azure driver, a third (stacksjs/stacks#1896). Three copies of a lookup
 * table is three places for a format to be added to two of them.
 */
const MIME_TYPES: Record<string, string> = {
  txt: 'text/plain',
  html: 'text/html',
  css: 'text/css',
  js: 'application/javascript',
  json: 'application/json',
  xml: 'application/xml',
  pdf: 'application/pdf',
  zip: 'application/zip',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  mp4: 'video/mp4',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
}

/**
 * Guess a content type from a path's extension, falling back to
 * `application/octet-stream`.
 *
 * @example
 * ```ts
 * mimeFromExtension('reports/q1.pdf')  // 'application/pdf'
 * mimeFromExtension('archive.tar.gz')  // 'application/octet-stream'
 * ```
 */
export function mimeFromExtension(path: string): string {
  const ext = basename(path).split('.').pop()?.toLowerCase()
  return MIME_TYPES[ext || ''] || 'application/octet-stream'
}

/**
 * Extensions to give a file whose name a presigned upload generates, keyed by
 * the content type the caller signed for.
 *
 * The inverse direction of {@link mimeFromExtension}, and a deliberately
 * shorter list: this one names a file that does not exist yet, so an unknown
 * type gets no extension rather than a guess.
 */
const EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/avif': '.avif',
  'image/svg+xml': '.svg',
  'application/pdf': '.pdf',
  'application/json': '.json',
  'application/zip': '.zip',
  'text/plain': '.txt',
  'text/csv': '.csv',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'audio/mpeg': '.mp3',
  'audio/wav': '.wav',
}

/**
 * The extension for a content type, or `''` when there is no obvious one.
 *
 * Parameters are stripped first, so `text/plain; charset=utf-8` answers the
 * same as `text/plain`.
 *
 * @example
 * ```ts
 * extensionForContentType('image/png')               // '.png'
 * extensionForContentType('text/csv; charset=utf-8') // '.csv'
 * extensionForContentType('application/x-thing')     // ''
 * ```
 */
export function extensionForContentType(contentType: string): string {
  const mime = contentType.toLowerCase().split(';')[0]?.trim() ?? ''
  return EXTENSIONS[mime] ?? ''
}
