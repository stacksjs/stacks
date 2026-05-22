/**
 * MIME re-verification helpers (stacksjs/stacks#1873 S-3).
 *
 * Background: `presignedUploadUrl({ contentType })` lets the caller
 * declare what they're going to upload, and AWS signs the URL against
 * that exact `Content-Type` header. Nothing checks that the **bytes**
 * actually match the claim. An attacker who can call your presigned
 * endpoint can request `image/jpeg` (which derives a `.jpg`
 * extension), then PUT a JavaScript file. The server only sees
 * "object exists, contentType was image/jpeg" — but the bytes are
 * executable.
 *
 * These helpers exist so server code can re-detect the MIME from
 * magic bytes after the upload finishes, and either delete the
 * mismatched object or surface it as a 400.
 *
 * **Limitations** — magic-byte sniffing only works for binary formats
 * with a well-defined signature. Text-based types (JSON, CSV, plain
 * text, SVG, HTML) can't be unambiguously detected from the first few
 * bytes; for those, validate by parsing the content (e.g. try
 * `JSON.parse` for `application/json`).
 */

/**
 * Result of a magic-byte detection attempt.
 *
 * `ok: true` means the bytes match a known signature for the
 * expected content type. `ok: false` with `detected: null` means the
 * bytes didn't match any signature this helper knows; `ok: false`
 * with `detected: string` means the bytes match a *different*
 * signature than expected (e.g. PNG bytes uploaded as image/jpeg).
 */
export interface MimeVerifyResult {
  ok: boolean
  expected: string
  detected: string | null
}

/**
 * Detect a MIME type from the first chunk of a file. Returns the
 * detected MIME (e.g. `'image/png'`) or `null` if the bytes don't
 * match any known signature.
 *
 * Intentionally narrow — only the well-known binary formats that
 * appear in `presignedUploadUrl`'s extension map are detected. Text
 * formats are not covered because their signatures are ambiguous.
 */
export function detectMimeFromMagicBytes(bytes: Uint8Array | ArrayBuffer): string | null {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  if (view.length < 4) return null

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (view[0] === 0x89 && view[1] === 0x50 && view[2] === 0x4E && view[3] === 0x47
    && view[4] === 0x0D && view[5] === 0x0A && view[6] === 0x1A && view[7] === 0x0A)
    return 'image/png'

  // JPEG: FF D8 FF
  if (view[0] === 0xFF && view[1] === 0xD8 && view[2] === 0xFF)
    return 'image/jpeg'

  // GIF: GIF87a / GIF89a
  if (view[0] === 0x47 && view[1] === 0x49 && view[2] === 0x46 && view[3] === 0x38)
    return 'image/gif'

  // RIFF container — could be WebP or WAV. Check the 4-byte type tag
  // at offset 8.
  if (view[0] === 0x52 && view[1] === 0x49 && view[2] === 0x46 && view[3] === 0x46 && view.length >= 12) {
    if (view[8] === 0x57 && view[9] === 0x45 && view[10] === 0x42 && view[11] === 0x50)
      return 'image/webp'
    if (view[8] === 0x57 && view[9] === 0x41 && view[10] === 0x56 && view[11] === 0x45)
      return 'audio/wav'
  }

  // PDF: %PDF
  if (view[0] === 0x25 && view[1] === 0x50 && view[2] === 0x44 && view[3] === 0x46)
    return 'application/pdf'

  // ZIP / OOXML / EPUB: PK\3\4 (or PK\5\6 for empty archive)
  if (view[0] === 0x50 && view[1] === 0x4B && (view[2] === 0x03 || view[2] === 0x05)
    && (view[3] === 0x04 || view[3] === 0x06))
    return 'application/zip'

  // ISO Base Media File Format (MP4, MOV, HEIC, AVIF) — `ftyp` brand
  // at offset 4. The major-brand bytes at offset 8-11 distinguish the
  // concrete format.
  if (view.length >= 12 && view[4] === 0x66 && view[5] === 0x74 && view[6] === 0x79 && view[7] === 0x70) {
    const brand = String.fromCharCode(view[8] ?? 0, view[9] ?? 0, view[10] ?? 0, view[11] ?? 0)
    if (brand === 'avif' || brand === 'avis') return 'image/avif'
    if (brand === 'heic' || brand === 'heix' || brand === 'mif1') return 'image/heic'
    // Common MP4 brands: isom, iso2, mp41, mp42, avc1, dash, etc.
    return 'video/mp4'
  }

  // WebM / Matroska EBML: 1A 45 DF A3
  if (view[0] === 0x1A && view[1] === 0x45 && view[2] === 0xDF && view[3] === 0xA3)
    return 'video/webm'

  // MP3 with ID3v2: ID3
  if (view[0] === 0x49 && view[1] === 0x44 && view[2] === 0x33)
    return 'audio/mpeg'

  // MP3 without ID3 tag: sync byte FF + (E0–FF) for the next byte
  if (view[0] === 0xFF && (view[1] ?? 0) >= 0xE0)
    return 'audio/mpeg'

  return null
}

/**
 * Normalize a content-type string to its base media type (strip
 * parameters like `; charset=utf-8`, lowercase). Used so callers can
 * compare `verifyUploadedMime`'s `expected` against the value they
 * pulled off `Content-Type`, parameters and all.
 */
function normalizeContentType(contentType: string): string {
  return contentType.split(';')[0]?.trim().toLowerCase() ?? ''
}

/**
 * Verify that a file's actual contents match the claimed content type.
 * Returns `{ ok, expected, detected }` so callers can branch on the
 * result and produce useful error messages.
 *
 * Reads up to 32 bytes from the file (enough for every signature we
 * check), then matches against `detectMimeFromMagicBytes`.
 *
 * @example
 * ```ts
 * // After a presigned upload completes:
 * const result = await verifyUploadedMime('uploads/avatar.jpg', 'image/jpeg')
 * if (!result.ok) {
 *   await Storage.disk().deleteFile('uploads/avatar.jpg')
 *   return Response.json({ error: 'content type mismatch', ...result }, { status: 400 })
 * }
 * ```
 */
export async function verifyUploadedMime(
  path: string,
  expectedContentType: string,
  options: { disk?: string } = {},
): Promise<MimeVerifyResult> {
  const { Storage } = await import('./facade')
  const disk = Storage.disk(options.disk)
  const bytes = await disk.readToUint8Array(path)
  const expected = normalizeContentType(expectedContentType)
  const detected = detectMimeFromMagicBytes(bytes.slice(0, 32))

  // JPEG has two MIME aliases that match the same magic bytes —
  // accept either as a match for the `image/jpeg` family.
  const matches = (detected === expected)
    || (detected === 'image/jpeg' && (expected === 'image/jpg' || expected === 'image/pjpeg'))

  return {
    ok: matches,
    expected,
    detected,
  }
}
