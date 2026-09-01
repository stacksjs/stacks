import { generateTOTP, generateTOTPSecret, totpKeyUri, verifyTOTP } from '@stacksjs/ts-auth'
import { toSvg } from 'ts-qr-codes'

export function generateTwoFactorSecret(): string {
  return generateTOTPSecret()
}

export type Token = string
export type Secret = string

export async function generateTwoFactorToken(secret: Secret): Promise<Token> {
  return generateTOTP({ secret })
}

export async function verifyTwoFactorCode(token: Token, secret: Secret): Promise<boolean> {
  return verifyTOTP(token, { secret })
}

/**
 * Generate an otpauth:// URI for two-factor authentication
 *
 * This URI can be used with any QR code library to generate a scannable
 * QR code for authenticator apps.
 *
 * @param user - User identifier (email or username)
 * @param service - Service name (e.g., 'StacksJS 2FA')
 * @param secret - Optional secret (will be generated if not provided)
 * @returns The otpauth:// URI string
 */
export function generateTwoFactorUri(
  user?: string,
  service?: string,
  secret?: Secret,
): string {
  const userIdentifier = user || 'johndoe@example.com'
  const serviceName = service || 'StacksJS 2fa'
  const otpSecret = secret || generateTwoFactorSecret()

  return totpKeyUri(userIdentifier, serviceName, otpSecret)
}

/**
 * Default pixel size for a rendered setup QR code. Large enough to scan off a
 * screen at arm's length, small enough to sit in a settings panel.
 */
const DEFAULT_QR_SIZE = 240

/**
 * Render an otpauth:// URI as a scannable QR code.
 *
 * SVG rather than a data URI: it stays sharp at any size, can be inlined into
 * a server-rendered page or an email, and is a few hundred bytes rather than
 * tens of kilobytes. `ts-qr-codes` is a pure, synchronous string function with
 * no runtime dependencies of its own, so this costs nothing at import time.
 *
 * Every authenticator setup flow needs this. Leaving it to the caller meant
 * each one either shipped an encoder to the browser or, more often, fell back
 * to asking the user to type a 32-character secret by hand.
 */
export function twoFactorQrCode(uri: string, size: number = DEFAULT_QR_SIZE): string {
  return toSvg(uri, { size, title: 'Two-factor authentication setup' })
}
