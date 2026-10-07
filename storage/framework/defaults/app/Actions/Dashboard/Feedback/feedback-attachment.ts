/**
 * What a feedback submission may attach, and where it is written.
 *
 * A screenshot is most of what a reviewer sends, which is why
 * stacksjs/stacks#2872 asks for it. It is also the one part of this feature
 * that is an unauthenticated write, so every decision is here rather than in
 * the action: a limit that can only be reached through an HTTP request with a
 * crafted file is a limit nobody tests.
 *
 * The existing `FileUploadAction` is deliberately not reused. It takes `disk`
 * and `path` from the request, which is right for a signed-in dashboard user
 * and an arbitrary-write primitive for a feedback link.
 */

/**
 * One file per submission.
 *
 * A reviewer sends one screenshot of one thing; the brief asks for one thing
 * per message so each can be picked up on its own. More than one is a
 * multi-file upload API on an endpoint that authenticates nobody.
 */
export const FEEDBACK_ATTACHMENT_MAX_FILES = 1

/**
 * 5 MB, which is a generous full-window PNG screenshot on a retina display
 * and far below what would make this worth using as free object storage. The
 * route's rate limit caps the rest.
 */
export const FEEDBACK_ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024

/**
 * The image types accepted, and the extension each is stored under.
 *
 * SVG is deliberately absent and must stay absent. It is XML, it can carry
 * script, and it would be uploaded by an unauthenticated stranger and later
 * opened by a signed-in operator looking at their own dashboard, which is
 * the shape of a stored cross-site scripting bug rather than a screenshot.
 *
 * Nothing here is decided from the declared `Content-Type`, which the
 * submitter writes.
 */
export const FEEDBACK_ATTACHMENT_TYPES = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
} as const

export type FeedbackAttachmentType = keyof typeof FEEDBACK_ATTACHMENT_TYPES

/** How many leading bytes {@link sniffImageType} needs. */
export const SNIFF_BYTES = 12

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length)
    return false
  return signature.every((byte, index) => bytes[offset + index] === byte)
}

/**
 * The type the bytes actually are, or null.
 *
 * Read from the file's own leading bytes, because the declared content type
 * and the filename are both written by whoever is uploading. A `.png` that is
 * an HTML document would otherwise be stored as an image and served as one.
 */
export function sniffImageType(bytes: Uint8Array): FeedbackAttachmentType | null {
  // \x89PNG\r\n\x1a\n
  if (startsWith(bytes, [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))
    return 'image/png'
  // JPEG's SOI, then any marker.
  if (startsWith(bytes, [0xFF, 0xD8, 0xFF]))
    return 'image/jpeg'
  // RIFF....WEBP: the size field sits between the two, so the second
  // signature is checked at its own offset rather than appended.
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8))
    return 'image/webp'
  // GIF87a and GIF89a share these four.
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38]))
    return 'image/gif'
  return null
}

export type FeedbackAttachmentRefusal = 'empty' | 'too-large' | 'unsupported'

export type FeedbackAttachmentVerdict =
  | { ok: true, type: FeedbackAttachmentType, extension: string }
  | { ok: false, reason: FeedbackAttachmentRefusal, message: string }

/**
 * Whether a file of this size may be attached at all.
 *
 * Separate from {@link acceptAttachment} because it is the gate that has to
 * be passed BEFORE the bytes are read. The router hands an action an
 * `UploadedFile` wrapper, which exposes `size` synchronously and has no
 * `slice`, so reading the leading bytes means reading the whole file: a
 * caller that sniffed first would load a 2 GB upload into memory to decide
 * it was too large. Checked by itself, nothing is read.
 */
export function acceptAttachmentSize(size: number): { ok: true } | { ok: false, reason: FeedbackAttachmentRefusal, message: string } {
  if (!Number.isFinite(size) || size <= 0)
    return { ok: false, reason: 'empty', message: 'That file is empty.' }

  if (size > FEEDBACK_ATTACHMENT_MAX_BYTES) {
    const mb = Math.floor(FEEDBACK_ATTACHMENT_MAX_BYTES / (1024 * 1024))
    return { ok: false, reason: 'too-large', message: `A screenshot must be ${mb} MB or smaller.` }
  }

  return { ok: true }
}

/**
 * Whether this file may be attached.
 *
 * `size` is the whole file's length and `head` its leading bytes. The size is
 * judged first, through {@link acceptAttachmentSize}, so the order of the
 * refusals is the same whether a caller gates on size separately or not.
 */
export function acceptAttachment(input: { size: number, head: Uint8Array }): FeedbackAttachmentVerdict {
  const sized = acceptAttachmentSize(input.size)
  if (!sized.ok)
    return sized

  const type = sniffImageType(input.head)
  if (!type) {
    // Named rather than vague: a reviewer who tried to attach a PDF or a zip
    // should know which of the two rules they hit.
    return { ok: false, reason: 'unsupported', message: 'Attach a PNG, JPEG, WebP or GIF image.' }
  }

  return { ok: true, type, extension: FEEDBACK_ATTACHMENT_TYPES[type] }
}

const ALLOWED_EXTENSIONS: ReadonlySet<string> = new Set(Object.values(FEEDBACK_ATTACHMENT_TYPES))

/**
 * Where the file is written.
 *
 * Every segment is generated. The submitter contributes no part of the path,
 * not even the extension, which comes from the sniffed type: a filename is an
 * untrusted string and path traversal through an upload name is the oldest
 * bug in this category.
 *
 * Under a fixed `feedback/` prefix so an operator can find, audit or sweep
 * the whole lot, and keyed by card so a deleted card's screenshot is one
 * prefix to remove.
 */
export function feedbackAttachmentPath(cardId: number, id: string, extension: string): string {
  if (!Number.isSafeInteger(cardId) || cardId <= 0)
    throw new Error('A feedback attachment needs the id of the card it belongs to.')
  if (!/^[0-9a-f-]{8,64}$/i.test(id))
    throw new Error(`Refusing to build an attachment path from ${JSON.stringify(id)}.`)
  // An allowlist, not a shape check. `^[a-z0-9]{2,5}$` admitted `phtml`,
  // which is a shape a `.png` can never have and a suffix some web servers
  // will happily execute. The extension always comes from
  // FEEDBACK_ATTACHMENT_TYPES, so membership is the real rule.
  if (!ALLOWED_EXTENSIONS.has(extension))
    throw new Error(`Refusing to build an attachment path with extension ${JSON.stringify(extension)}.`)

  return `feedback/${cardId}/${id.toLowerCase()}.${extension}`
}
