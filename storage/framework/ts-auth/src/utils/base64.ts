/**
 * Base64 encoding/decoding utilities
 */

export function base64Encode(input: Uint8Array | string): string {
  if (typeof input === 'string') {
    return Buffer.from(input, 'utf-8').toString('base64')
  }
  return Buffer.from(input).toString('base64')
}

export function base64Decode(input: string): string {
  return Buffer.from(input, 'base64').toString('utf-8')
}

export function base64UrlEncode(input: Uint8Array | string): string {
  const base64 = base64Encode(input)
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

export function base64UrlDecode(input: string): string {
  // Add padding
  let base64 = input
    .replace(/-/g, '+')
    .replace(/_/g, '/')

  while (base64.length % 4) {
    base64 += '='
  }

  return base64Decode(base64)
}
