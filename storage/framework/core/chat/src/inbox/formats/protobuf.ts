/**
 * A schema-less protocol buffers reader. WhatsApp keeps reactions and quoted
 * replies as protobuf blobs inside its Core Data store, with no published
 * schema, so fields are read by number: `fields(bytes)` splits a message
 * into its wire-level fields, and the helpers pull out what a caller knows
 * by number. Malformed input throws; callers treat that as "not present".
 */

export interface ProtoField {
  field: number
  /** 0 varint, 1 fixed64, 2 length-delimited, 5 fixed32. */
  wire: number
  /** varints and fixed values as bigint, length-delimited as bytes. */
  value: bigint | Uint8Array
}

function varint(bytes: Uint8Array, at: number): { value: bigint, next: number } {
  let value = 0n
  let shift = 0n
  for (let i = at; i < bytes.length && i < at + 10; i++) {
    const byte = bytes[i]!
    value |= BigInt(byte & 0x7F) << shift
    if ((byte & 0x80) === 0)
      return { value, next: i + 1 }
    shift += 7n
  }
  throw new Error('Truncated varint')
}

export function fields(bytes: Uint8Array): ProtoField[] {
  const out: ProtoField[] = []
  let at = 0
  while (at < bytes.length) {
    const key = varint(bytes, at)
    at = key.next
    const field = Number(key.value >> 3n)
    const wire = Number(key.value & 7n)
    if (field === 0)
      throw new Error('Field number 0')
    if (wire === 0) {
      const v = varint(bytes, at)
      out.push({ field, wire, value: v.value })
      at = v.next
    }
    else if (wire === 1 || wire === 5) {
      const size = wire === 1 ? 8 : 4
      if (at + size > bytes.length)
        throw new Error('Truncated fixed field')
      let value = 0n
      for (let i = size - 1; i >= 0; i--)
        value = (value << 8n) | BigInt(bytes[at + i]!)
      out.push({ field, wire, value })
      at += size
    }
    else if (wire === 2) {
      const length = varint(bytes, at)
      const start = length.next
      const end = start + Number(length.value)
      if (end > bytes.length)
        throw new Error('Truncated length-delimited field')
      out.push({ field, wire, value: bytes.subarray(start, end) })
      at = end
    }
    else {
      throw new Error(`Unsupported wire type ${wire}`)
    }
  }
  return out
}

/** Fields of a message, or null when the bytes are not one. */
export function tryFields(bytes: Uint8Array | null | undefined): ProtoField[] | null {
  if (!bytes || bytes.length === 0)
    return null
  try {
    return fields(bytes)
  }
  catch {
    return null
  }
}

export function bytesOf(list: ProtoField[] | null, field: number): Uint8Array | null {
  const found = list?.find(f => f.field === field && f.wire === 2)
  return found ? found.value as Uint8Array : null
}

export function allBytesOf(list: ProtoField[] | null, field: number): Uint8Array[] {
  return (list ?? []).filter(f => f.field === field && f.wire === 2).map(f => f.value as Uint8Array)
}

export function stringOf(list: ProtoField[] | null, field: number): string | null {
  const raw = bytesOf(list, field)
  if (!raw)
    return null
  const text = new TextDecoder('utf-8', { fatal: true })
  try {
    return text.decode(raw)
  }
  catch {
    return null
  }
}

export function numberOf(list: ProtoField[] | null, field: number): bigint | null {
  const found = list?.find(f => f.field === field && f.wire !== 2)
  return found ? found.value as bigint : null
}
