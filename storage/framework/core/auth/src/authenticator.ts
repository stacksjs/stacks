import { handleError } from '@stacksjs/error-handling'
import { generate, generateQRCodeDataURL, generateSecret, keyuri, QRErrorCorrection, verify } from 'ts-auth'

export function generateTwoFactorSecret(): string {
  return generateSecret()
}

export type Token = string
export type Secret = string

export function generateTwoFactorToken(secret: Secret): Token {
  return generate({ secret })
}

export function verifyTwoFactorCode(token: Token, secret: Secret): boolean {
  return verify(token, { secret })
}

/**
 * Generate a QR code for two-factor authentication
 *
 * @param user - User identifier (email or username)
 * @param service - Service name (e.g., 'StacksJS 2FA')
 * @param secret - Optional secret (will be generated if not provided)
 * @returns Promise resolving to the data URL of the QR code
 */
export async function generateQrCode(
  user?: string,
  service?: string,
  secret?: Secret
): Promise<string> {
  const userIdentifier = user || 'johndoe@example.com'
  const serviceName = service || 'StacksJS 2fa'
  const otpSecret = secret || generateTwoFactorSecret()
  const otpauth = keyuri(userIdentifier, serviceName, otpSecret)

  try {
    return await generateQRCodeDataURL({
      text: otpauth,
      width: 256,
      height: 256,
      correctLevel: QRErrorCorrection.H,
    })
  }
  catch (error) {
    handleError('Error generating QR code', error)
    throw error
  }
}
