export * from './authentication'
export * from './authenticator'
export * from './client'
export * from './middleware'
export * from './rate-limiter'

// WebAuthn/Passkey support (now using ts-auth - no external dependencies)
export * from './passkey'

export * from './password/reset'

export * from './register'

export * from './user'

// Token management (Laravel Passport-style)
export * from './tokens'

// Authorization Gates & Policies (Laravel-style)
export * from './gate'
export * from './policy'
export * from './authorizable'

// TOTP (Two-Factor Authentication) - re-export from ts-auth
export {
  generateTOTP,
  verifyTOTP,
  generateTOTPSecret,
  totpKeyUri,
  // QR Code generation
  generateQRCodeSVG,
  generateQRCodeDataURL,
  createQRCode,
  QRErrorCorrection,
} from 'ts-auth'
