/**
 * Base32 encoding/decoding utilities (RFC 4648)
 */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function base32Encode(input: Uint8Array): string {
  let bits = 0
  let value = 0
  let output = ''

  for (let i = 0; i < input.length; i++) {
    value = (value << 8) | input[i]
    bits += 8

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31]
  }

  // Add padding
  while (output.length % 8 !== 0) {
    output += '='
  }

  return output
}

export function base32Decode(input: string): Uint8Array {
  // Remove padding and convert to uppercase
  input = input.toUpperCase().replace(/=+$/, '')

  let bits = 0
  let value = 0
  let index = 0
  const output = new Uint8Array(Math.ceil((input.length * 5) / 8))

  for (let i = 0; i < input.length; i++) {
    const char = input[i]
    const charValue = BASE32_ALPHABET.indexOf(char)

    if (charValue === -1) {
      throw new Error(`Invalid base32 character: ${char}`)
    }

    value = (value << 5) | charValue
    bits += 5

    if (bits >= 8) {
      output[index++] = (value >>> (bits - 8)) & 255
      bits -= 8
    }
  }

  return output.slice(0, index)
}
