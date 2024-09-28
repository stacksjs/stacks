import { authenticator } from 'otplib'
import qrcode from 'qrcode'

export function generateTwoFactorSecret(): string {
  const secret = authenticator.generateSecret()

  return secret
}

export function generateTwoFactorToken(): string {
  const token = authenticator.generate(generateTwoFactorSecret())

  return token
}

export function verifyTwoFactorCode(token: string, secret: string): boolean {
  const isValid = authenticator.verify({ token, secret })

  return isValid
}

export function generateQrCode(): void {
  const user = 'johndoe@example.com'
  const service = 'StacksJS 2fa'
  const secret = generateTwoFactorSecret()
  const otpauth = authenticator.keyuri(user, service, secret)

  qrcode.toDataURL(otpauth, (err: any, imageUrl: any) => {
    if (err) {
      console.log('Error with QR')
      return
    }
  })
}
