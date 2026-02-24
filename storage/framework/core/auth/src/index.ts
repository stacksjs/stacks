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

// Role-Based Access Control (RBAC)
export * from './rbac'

// Email Verification
export * from './email-verification'

// Session-based Authentication (SPA Cookie Auth)
export * from './session-auth'

// TOTP (Two-Factor Authentication) - re-export from ts-auth
export {
  generateTOTP,
  verifyTOTP,
  generateTOTPSecret,
  totpKeyUri,
} from '@stacksjs/ts-auth'
