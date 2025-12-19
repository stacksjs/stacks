export * from './config'
export * from './types'

// WebAuthn exports
export * from './webauthn'

// OTP exports
export * from './otp'

// QR Code exports
export * from './qr'

// Utility exports
export * from './utils'

// Re-export commonly used items for convenience
export {
  generateRegistrationOptions,
  generateAuthenticationOptions,
  verifyRegistrationResponse,
  verifyAuthenticationResponse,
} from './webauthn/server'

export {
  startRegistration,
  startAuthentication,
  platformAuthenticatorIsAvailable,
  browserSupportsWebAuthn,
  browserSupportsWebAuthnAutofill,
} from './webauthn/browser'

export {
  generate as generateTOTP,
  verify as verifyTOTP,
  generateSecret as generateTOTPSecret,
  keyuri as totpKeyUri,
} from './otp/totp'

export {
  generateQRCodeSVG,
  generateQRCodeDataURL,
  createQRCode,
  QRErrorCorrection,
} from './qr'
