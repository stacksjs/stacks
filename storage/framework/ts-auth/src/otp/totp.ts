/**
 * TOTP (Time-based One-Time Password) Implementation
 * Native implementation to replace otplib
 */

import { base32Decode, base32Encode } from '../utils/base32'

export interface TOTPOptions {
  /** Secret key (base32 encoded) */
  secret: string
  /** Time step in seconds (default: 30) */
  step?: number
  /** Code digits (default: 6) */
  digits?: number
  /** HMAC algorithm (default: 'SHA-1') */
  algorithm?: 'SHA-1' | 'SHA-256' | 'SHA-512'
  /** Window for validation (default: 1) */
  window?: number
}

/**
 * Generate a random base32 secret
 */
export function generateSecret(length: number = 20): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return base32Encode(bytes)
}

/**
 * Generate a TOTP code
 */
export function generate(options: TOTPOptions): string {
  const step = options.step || 30
  const digits = options.digits || 6
  const algorithm = options.algorithm || 'SHA-1'

  const counter = Math.floor(Date.now() / 1000 / step)
  return generateHOTP({
    secret: options.secret,
    counter,
    digits,
    algorithm,
  })
}

/**
 * Verify a TOTP code
 */
export function verify(token: string, options: TOTPOptions): boolean {
  const step = options.step || 30
  const window = options.window ?? 1
  const currentCounter = Math.floor(Date.now() / 1000 / step)

  // Check current time and within window
  for (let i = -window; i <= window; i++) {
    const counter = currentCounter + i
    const expectedToken = generateHOTP({
      secret: options.secret,
      counter,
      digits: options.digits || 6,
      algorithm: options.algorithm || 'SHA-1',
    })

    if (timingSafeEqual(token, expectedToken)) {
      return true
    }
  }

  return false
}

/**
 * Generate an otpauth:// URI for QR codes
 */
export function keyuri(
  accountName: string,
  issuer: string,
  secret: string,
  options?: {
    algorithm?: 'SHA-1' | 'SHA-256' | 'SHA-512'
    digits?: number
    period?: number
  },
): string {
  const params = new URLSearchParams({
    secret,
    issuer,
  })

  if (options?.algorithm && options.algorithm !== 'SHA-1') {
    params.set('algorithm', options.algorithm)
  }

  if (options?.digits && options.digits !== 6) {
    params.set('digits', options.digits.toString())
  }

  if (options?.period && options.period !== 30) {
    params.set('period', options.period.toString())
  }

  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}?${params.toString()}`
}

// HOTP Implementation (used by TOTP)

interface HOTPOptions {
  secret: string
  counter: number
  digits: number
  algorithm: 'SHA-1' | 'SHA-256' | 'SHA-512'
}

function generateHOTP(options: HOTPOptions): string {
  const secret = base32Decode(options.secret)
  const counter = numberToBuffer(options.counter)

  // Generate HMAC
  const hmac = hmacDigest(secret, counter, options.algorithm)

  // Dynamic truncation
  const offset = hmac[hmac.length - 1] & 0x0f
  const code = (
    ((hmac[offset] & 0x7f) << 24)
    | ((hmac[offset + 1] & 0xff) << 16)
    | ((hmac[offset + 2] & 0xff) << 8)
    | (hmac[offset + 3] & 0xff)
  )

  // Generate OTP
  const otp = code % (10 ** options.digits)
  return otp.toString().padStart(options.digits, '0')
}

function hmacDigest(key: Uint8Array, message: Uint8Array, algorithm: string): Uint8Array {
  // Use Bun's CryptoHasher for HMAC
  const algoMap: Record<string, string> = {
    'SHA-1': 'sha1',
    'SHA-256': 'sha256',
    'SHA-512': 'sha512',
  }

  const hasher = new Bun.CryptoHasher(algoMap[algorithm] || 'sha1', key)
  hasher.update(message)

  const hex = hasher.digest('hex')
  const bytes = new Uint8Array(hex.length / 2)

  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = Number.parseInt(hex.substr(i, 2), 16)
  }

  return bytes
}

function numberToBuffer(num: number): Uint8Array {
  const buffer = new Uint8Array(8)
  const view = new DataView(buffer.buffer)
  view.setUint32(4, num, false) // Big-endian
  return buffer
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }

  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }

  return result === 0
}
