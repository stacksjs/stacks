---
name: stacks-auth
description: Use when implementing authentication in a Stacks application — login, registration, password reset, TOTP/2FA, passkeys/WebAuthn, session management, OAuth, RBAC, gates, or policies. Covers the @stacksjs/auth package, config/auth.ts, and app/Gates.ts.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Authentication

The `@stacksjs/auth` package provides comprehensive authentication for Stacks applications, built on `@stacksjs/ts-auth`.

## Key Paths
- Core package: `storage/framework/core/auth/src/`
- Configuration: `config/auth.ts`
- Application gates: `app/Gates.ts`
- Middleware: `app/Middleware/`
- Package: `@stacksjs/auth`

## Features
- **Authentication**: Login, registration, password reset
- **WebAuthn/Passkeys**: FIDO2 passwordless authentication
- **TOTP/2FA**: Two-factor authentication with `generateTOTP`, `verifyTOTP`
- **Session Auth**: SPA cookie-based session authentication
- **Email Verification**: Built-in email verification flow
- **Token Management**: Laravel Passport-style API tokens
- **Authorization Gates**: Laravel-style gates and policies
- **RBAC**: Role-based access control

## Architecture
```
auth/src/
├── authentication.ts    # Core auth logic
├── authenticator.ts     # Authenticator implementation
├── client.ts           # Client-side auth helpers
├── middleware.ts        # Auth middleware
├── rate-limiter.ts     # Auth rate limiting
├── passkey.ts          # WebAuthn/Passkey support
├── password/reset.ts   # Password reset flow
├── register.ts         # Registration logic
├── user.ts             # User management
├── tokens.ts           # API token management
├── gate.ts             # Authorization gates
├── policy.ts           # Authorization policies
├── authorizable.ts     # Authorizable trait
├── rbac.ts             # Role-based access control
├── email-verification.ts # Email verification
└── session-auth.ts     # Session-based auth
```

## Usage
```typescript
import { authenticate, register, resetPassword } from '@stacksjs/auth'
import { generateTOTP, verifyTOTP } from '@stacksjs/auth'
```

## Gates & Policies
Define authorization rules in `app/Gates.ts`:
- Gates are simple closures that determine if a user can perform an action
- Policies are classes that group authorization logic for a model

## Gotchas
- Auth depends on `@stacksjs/ts-auth` for core functionality
- Password hashing config is in `config/hashing.ts`
- Security settings are in `config/security.ts`
- Rate limiting is built into the auth middleware
- Session auth requires proper cookie configuration
- TOTP functions are re-exported from `@stacksjs/ts-auth`

## Middleware
Auth middleware is applied to routes via `app/Middleware.ts` and individual route definitions.
