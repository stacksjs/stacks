/**
 * A reader for Apple's binary property lists (`bplist00`), the format of
 * chat.db's `chat.properties` - where Messages keeps a group's photo,
 * among other things. Read-only and dependency-free; returns plain values:
 * dictionaries as objects, arrays, strings, numbers, booleans, null, Dates
 * and `Uint8Array` for data. NSKeyedArchiver UIDs come back as `{ uid }`.
 */

export type PlistValue = null | boolean | number | bigint | string | Date | Uint8Array | { uid: number } | PlistValue[] | { [key: string]: PlistValue }

const APPLE_EPOCH_MS = 978_307_200_000

export function parseBplist(bytes: Uint8Array): PlistValue {
  if (bytes.length < 40 || new TextDecoder().decode(bytes.subarray(0, 8)) !== 'bplist00')
    throw new Error('Not a binary property list')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const trailer = bytes.length - 32
  const offsetSize = bytes[trailer + 6]!
  const refSize = bytes[trailer + 7]!
  const count = Number(view.getBigUint64(trailer + 8))
  const top = Number(view.getBigUint64(trailer + 16))
  const table = Number(view.getBigUint64(trailer + 24))

  const uint = (at: number, size: number): number => {
    let value = 0
    for (let i = 0; i < size; i++)
      value = value * 256 + bytes[at + i]!
    return value
  }
  const offsetOf = (ref: number): number => {
    if (ref >= count)
      throw new Error('Object reference out of range')
    return uint(table + ref * offsetSize, offsetSize)
  }

  const seen = new Set<number>()
  const read = (ref: number): PlistValue => {
    if (seen.has(ref))
      throw new Error('Cyclic property list')
    seen.add(ref)
    try {
      return readAt(offsetOf(ref))
    }
    finally {
      seen.delete(ref)
    }
  }

  /** The length nibble, or the int object after it when the nibble is 0xF. */
  const lengthAt = (at: number): { length: number, start: number } => {
    const nibble = bytes[at]! & 0x0F
    if (nibble !== 0x0F)
      return { length: nibble, start: at + 1 }
    const size = 1 << (bytes[at + 1]! & 0x0F)
    return { length: uint(at + 2, size), start: at + 2 + size }
  }

  const readAt = (at: number): PlistValue => {
    const marker = bytes[at]!
    const type = marker >> 4
    switch (type) {
      case 0x0:
        return marker === 0x08 ? false : marker === 0x09 ? true : null
      case 0x1: {
        const size = 1 << (marker & 0x0F)
        if (size === 8)
          return view.getBigInt64(at + 1)
        if (size === 16)
          return view.getBigInt64(at + 9)
        return uint(at + 1, size)
      }
      case 0x2:
        return (marker & 0x0F) === 2 ? view.getFloat32(at + 1) : view.getFloat64(at + 1)
      case 0x3:
        return new Date(APPLE_EPOCH_MS + view.getFloat64(at + 1) * 1000)
      case 0x4: {
        const { length, start } = lengthAt(at)
        return bytes.slice(start, start + length)
      }
      case 0x5: {
        const { length, start } = lengthAt(at)
        return new TextDecoder('latin1').decode(bytes.subarray(start, start + length))
      }
      case 0x6: {
        const { length, start } = lengthAt(at)
        let text = ''
        for (let i = 0; i < length; i++)
          text += String.fromCharCode(view.getUint16(start + i * 2))
        return text
      }
      case 0x8:
        return { uid: uint(at + 1, (marker & 0x0F) + 1) }
      case 0xA: {
        const { length, start } = lengthAt(at)
        return Array.from({ length }, (_, i) => read(uint(start + i * refSize, refSize)))
      }
      case 0xD: {
        const { length, start } = lengthAt(at)
        const out: { [key: string]: PlistValue } = {}
        for (let i = 0; i < length; i++) {
          const key = read(uint(start + i * refSize, refSize))
          out[String(key)] = read(uint(start + (length + i) * refSize, refSize))
        }
        return out
      }
      default:
        throw new Error(`Unsupported property list object 0x${marker.toString(16)}`)
    }
  }

  return read(top)
}
