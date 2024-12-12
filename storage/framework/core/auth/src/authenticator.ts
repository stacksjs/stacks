import { handleError } from '@stacksjs/error-handling'
import { authenticator } from 'otplib'
import qrcode from 'qrcode'

export function generateTwoFactorSecret(): string {
  const secret = authenticator.generateSecret()

  return secret
}

export type Token = string
export type Secret = string
export function generateTwoFactorToken(): Token {
  return authenticator.generate(generateTwoFactorSecret())
}

export function verifyTwoFactorCode(token: Token, secret: Secret): boolean {
  const isValid = authenticator.verify({ token, secret })

  return isValid
}

export function generateQrCode(): void {
  const user = 'johndoe@example.com'
  const service = 'StacksJS 2fa'
  const secret = generateTwoFactorSecret()
  const otpauth = authenticator.keyuri(user, service, secret)

  qrcode.toDataURL(otpauth, (err: any) => {
    // qrcode.toDataURL(otpauth, (err: any, imageUrl: any) => {
    if (err) {
      handleError('Error with QR', err)
    }
  })
}
