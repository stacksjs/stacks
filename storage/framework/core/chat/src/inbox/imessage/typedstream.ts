/**
 * Recovers the plain text of a message from its `attributedBody` column.
 *
 * Since macOS Ventura, Messages often leaves `message.text` NULL and keeps the
 * content only in `attributedBody`: an NSAttributedString serialized with the
 * legacy NSArchiver "typedstream" format. A full typedstream reader is a
 * project of its own, but the string we want always sits in the same place -
 * right after the archived class name `NSString` (or `NSMutableString`), as a
 * `+` (C string) field with a length prefix:
 *
 *   ...NSString \x01 \x94 \x84 \x01 + <len> <utf-8 bytes>...
 *
 * The length is a typedstream integer: one signed byte, unless that byte is
 * 0x81 (a little-endian int16 follows) or 0x82 (an int32 follows).
 */

const encoder = new TextEncoder()
const decoder = new TextDecoder('utf-8', { fatal: false })

const CLASS_MARKERS = [encoder.encode('NSString'), encoder.encode('NSMutableString')]
const PLUS = 0x2B

/** How far past the class name the `+` field may start before we give up. */
const MAX_FIELD_OFFSET = 16

function indexOf(haystack: Uint8Array, needle: Uint8Array, from = 0): number {
  outer: for (let i = from; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j])
        continue outer
    }
    return i
  }
  return -1
}

function readLength(bytes: Uint8Array, at: number): { length: number, start: number } | null {
  const tag = bytes[at]
  if (tag === undefined)
    return null
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (tag === 0x81) {
    if (at + 3 > bytes.length)
      return null
    return { length: view.getUint16(at + 1, true), start: at + 3 }
  }
  if (tag === 0x82) {
    if (at + 5 > bytes.length)
      return null
    return { length: view.getUint32(at + 1, true), start: at + 5 }
  }
  return { length: tag, start: at + 1 }
}

export function decodeAttributedBody(blob: Uint8Array | null | undefined): string | null {
  if (!blob || blob.length === 0)
    return null

  for (const marker of CLASS_MARKERS) {
    const classAt = indexOf(blob, marker)
    if (classAt === -1)
      continue

    const searchFrom = classAt + marker.length
    const searchTo = Math.min(blob.length, searchFrom + MAX_FIELD_OFFSET)
    for (let i = searchFrom; i < searchTo; i++) {
      if (blob[i] !== PLUS)
        continue
      const len = readLength(blob, i + 1)
      if (!len || len.start + len.length > blob.length)
        continue
      return decoder.decode(blob.subarray(len.start, len.start + len.length))
    }
  }

  return null
}

/**
 * The inverse, used only by tests to build fixture rows that look like what
 * Messages writes. Produces the same prefix macOS emits for a plain message.
 */
export function encodeAttributedBody(text: string): Uint8Array {
  const body = encoder.encode(text)
  let length: number[]
  if (body.length < 0x80) {
    length = [body.length]
  }
  else if (body.length <= 0xFFFF) {
    length = [0x81, body.length & 0xFF, (body.length >> 8) & 0xFF]
  }
  else {
    length = [0x82, body.length & 0xFF, (body.length >> 8) & 0xFF, (body.length >> 16) & 0xFF, (body.length >> 24) & 0xFF]
  }

  const head = [
    0x04, 0x0B, ...encoder.encode('streamtyped'), 0x81, 0xE8, 0x03, 0x84, 0x01, 0x40, 0x84, 0x84, 0x84,
    0x12, ...encoder.encode('NSAttributedString'), 0x00, 0x84, 0x84, 0x08, ...encoder.encode('NSObject'),
    0x00, 0x85, 0x92, 0x84, 0x84, 0x84, 0x08, ...encoder.encode('NSString'), 0x01, 0x94, 0x84, 0x01, PLUS,
  ]
  const tail = [0x86, 0x84, 0x02, 0x69, 0x49, 0x01, 0x01, 0x92, 0x84, 0x84, 0x84, 0x0C]

  return new Uint8Array([...head, ...length, ...body, ...tail])
}
