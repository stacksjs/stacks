import { generateTOTP, generateTOTPSecret, totpKeyUri, verifyTOTP } from '@stacksjs/ts-auth'

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
