# Auth Package

A comprehensive authentication system providing Laravel Passport-style token management, OAuth2 support, authorization gates/policies, WebAuthn/Passkey support, and two-factor authentication.

## Installation

```bash
bun add @stacksjs/auth
```

## Basic Usage

```typescript
import { Auth } from '@stacksjs/auth'

// Login with credentials
const result = await Auth.login({
  email: 'user@example.com',
  password: 'password123'
})

if (result) {
  console.log('Token:', result.token)
  console.log('User:', result.user)
}

// Check authentication
if (await Auth.check()) {
  const user = await Auth.user()
  console.log('Authenticated as:', user.name)
}

// Logout
await Auth.logout()
```

## Configuration

Configure authentication in `config/auth.ts`:

```typescript
export default {
  // Credential field names
  username: 'email',
  password: 'password',

  // Token configuration
  defaultTokenName: 'auth-token',
  defaultAbilities: ['*'],
  tokenExpiry: 30 * 24 * 60 * 60 * 1000, // 30 days
  tokenRotation: 24, // Rotate after 24 hours

  // Password requirements
  password: {
    minLength: 8,
    requireUppercase: true,
    requireNumbers: true,
    requireSpecialChars: false,
  },

  // Rate limiting
  rateLimit: {
    maxAttempts: 5,
    decayMinutes: 15,
  },
}
```

## Authentication Methods

### Login

```typescript
import { Auth } from '@stacksjs/auth'

// Basic login
const result = await Auth.login({
  email: 'user@example.com',
  password: 'password123'
})

// Login with custom token options
const result = await Auth.login(
  { email: 'user@example.com', password: 'secret' },
  {
    name: 'mobile-app',
    abilities: ['read', 'write'],
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
  }
)
```

### Login Using ID

```typescript
import { Auth } from '@stacksjs/auth'

// Login user by ID (useful for impersonation or social auth)
const result = await Auth.loginUsingId(userId, {
  name: 'social-login',
  abilities: ['*']
})
```

### Validate Without Login

```typescript
import { Auth } from '@stacksjs/auth'

// Check credentials without creating session
const isValid = await Auth.validate({
  email: 'user@example.com',
  password: 'password123'
})
```

### Attempt Authentication

```typescript
import { Auth } from '@stacksjs/auth'

// Attempt auth and store user
const success = await Auth.attempt({
  email: 'user@example.com',
  password: 'password123'
})

if (success) {
  const user = await Auth.user()
}
```

### One-Time Authentication

```typescript
import { Auth } from '@stacksjs/auth'

// Authenticate for single request only
const success = await Auth.once({
  email: 'user@example.com',
  password: 'password123'
})
// No token is created
```

## User & Auth State

### Getting Current User

```typescript
import { Auth } from '@stacksjs/auth'

// Get authenticated user
const user = await Auth.user()

// Get user ID
const userId = await Auth.id()

// Check if authenticated
const isAuthenticated = await Auth.check()

// Check if guest
const isGuest = await Auth.guest()
```

### Setting User (Testing)

```typescript
import { Auth } from '@stacksjs/auth'

// Set user for testing
Auth.setUser(mockUser)

// Clear auth state
Auth.clearState()
```

## Token Management

### Creating Tokens

```typescript
import { Auth } from '@stacksjs/auth'

// Create token for user
const { accessToken, plainTextToken } = await Auth.createTokenForUser(user, {
  name: 'api-token',
  abilities: ['posts:read', 'posts:write'],
  expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
})

// Simple token creation
const token = await Auth.createToken(user, 'my-token', ['*'])
```

### Validating Tokens

```typescript
import { Auth } from '@stacksjs/auth'

// Validate a token
const isValid = await Auth.validateToken(bearerToken)

// Get user from token
const user = await Auth.getUserFromToken(bearerToken)
```

### Token Abilities

```typescript
import { Auth } from '@stacksjs/auth'

// Check if token has ability
if (await Auth.tokenCan('posts:write')) {
  // Can write posts
}

// Check if token lacks ability
if (await Auth.tokenCant('admin:access')) {
  // Cannot access admin
}

// Check multiple abilities
const canAll = await Auth.tokenCanAll(['read', 'write'])
const canAny = await Auth.tokenCanAny(['admin', 'moderator'])

// Get all abilities
const abilities = await Auth.tokenAbilities()
```

### Current Access Token

```typescript
import { Auth } from '@stacksjs/auth'

// Get current token instance
const token = await Auth.currentAccessToken()
console.log(token.name)
console.log(token.abilities)
console.log(token.expiresAt)
```

### Managing User Tokens

```typescript
import { Auth } from '@stacksjs/auth'

// Get all tokens for user
const tokens = await Auth.tokens(userId)

// Find specific token
const token = await Auth.findToken(tokenId)

// Revoke specific token
await Auth.revokeToken(tokenString)
await Auth.revokeTokenById(tokenId)

// Revoke all tokens
await Auth.revokeAllTokens(userId)

// Revoke all except current
await Auth.revokeOtherTokens(userId)

// Rotate token (refresh)
const newToken = await Auth.rotateToken(oldToken)
```

### Token Cleanup

```typescript
import { Auth } from '@stacksjs/auth'

// Delete expired tokens
const expiredCount = await Auth.pruneExpiredTokens()

// Delete revoked tokens
const revokedCount = await Auth.pruneRevokedTokens()
```

## Middleware

### Auth Middleware

```typescript
import { route } from '@stacksjs/router'

// Protect routes with auth middleware
route.get('/profile', 'Actions/Profile').middleware('auth')

route.group({ middleware: 'auth' }, () => {
  route.get('/dashboard', 'Actions/Dashboard')
  route.get('/settings', 'Actions/Settings')
})
```

### Abilities Middleware

```typescript
route.get('/posts', 'Actions/ListPosts').middleware('abilities:posts:read')
route.post('/posts', 'Actions/CreatePost').middleware('abilities:posts:write')
route.delete('/posts/:id', 'Actions/DeletePost').middleware('abilities:posts:delete')
```

### Custom Middleware

```typescript
// app/Middleware/AdminMiddleware.ts
import { Auth } from '@stacksjs/auth'

export default {
  async handle(req: EnhancedRequest) {
    const user = await Auth.user()

    if (!user || user.role !== 'admin') {
      throw { statusCode: 403, message: 'Forbidden' }
    }
  }
}
```

## Authorization (Gates & Policies)

### Defining Gates

```typescript
import { Gate } from '@stacksjs/auth'

// Define authorization gates
Gate.define('edit-post', async (user, post) => {
  return user.id === post.userId
})

Gate.define('delete-post', async (user, post) => {
  return user.id === post.userId || user.role === 'admin'
})

Gate.define('admin-access', async (user) => {
  return user.role === 'admin'
})
```

### Using Gates

```typescript
import { Gate } from '@stacksjs/auth'

// Check authorization
if (await Gate.allows('edit-post', post)) {
  // User can edit
}

if (await Gate.denies('delete-post', post)) {
  // User cannot delete
}

// Authorize or throw
await Gate.authorize('admin-access')
// Throws 403 if not authorized
```

### Policies

```typescript
// app/Policies/PostPolicy.ts
import { Policy } from '@stacksjs/auth'

export default class PostPolicy extends Policy {
  async view(user: User, post: Post) {
    return post.published || user.id === post.userId
  }

  async create(user: User) {
    return user.emailVerified
  }

  async update(user: User, post: Post) {
    return user.id === post.userId
  }

  async delete(user: User, post: Post) {
    return user.id === post.userId || user.role === 'admin'
  }
}
```

### Using Policies

```typescript
import { Gate } from '@stacksjs/auth'

// Register policy
Gate.policy(Post, PostPolicy)

// Use policy
if (await Gate.allows('update', post)) {
  // Can update
}

// In route handler
route.put('/posts/:id', async (req) => {
  const post = await Post.find(req.params.id)
  await Gate.authorize('update', post)

  // Update post...
})
```

## Two-Factor Authentication (TOTP)

### Setting Up 2FA

```typescript
import {
  generateTOTPSecret,
  generateQRCodeDataURL,
  verifyTOTP,
  totpKeyUri
} from '@stacksjs/auth'

// Generate secret
const secret = generateTOTPSecret()

// Generate QR code for authenticator app
const uri = totpKeyUri({
  secret,
  issuer: 'MyApp',
  accountName: user.email
})

const qrCode = await generateQRCodeDataURL(uri)
// Display QR code to user

// Store secret for user
await user.update({ totpSecret: secret })
```

### Verifying 2FA Code

```typescript
import { verifyTOTP } from '@stacksjs/auth'

const isValid = verifyTOTP({
  token: userInputCode,
  secret: user.totpSecret
})

if (isValid) {
  // Code is correct
}
```

### 2FA in Login Flow

```typescript
import { Auth, verifyTOTP } from '@stacksjs/auth'

route.post('/login', async (req) => {
  const { email, password, twoFactorCode } = req.all()

  // Validate credentials
  const valid = await Auth.attempt({ email, password })
  if (!valid) {
    return Response.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const user = await Auth.user()

  // Check if 2FA is enabled
  if (user.totpSecret) {
    if (!twoFactorCode) {
      return Response.json({ requiresTwoFactor: true }, { status: 200 })
    }

    const validCode = verifyTOTP({
      token: twoFactorCode,
      secret: user.totpSecret
    })

    if (!validCode) {
      return Response.json({ error: 'Invalid 2FA code' }, { status: 401 })
    }
  }

  // Create token and return
  const { plainTextToken } = await Auth.createTokenForUser(user)
  return Response.json({ token: plainTextToken })
})
```

## WebAuthn / Passkeys

### Registration

```typescript
import {
  generateRegistrationOptions,
  verifyRegistrationResponse
} from '@stacksjs/auth'

// Generate registration options
route.get('/webauthn/register/options', async (req) => {
  const user = await req.user()

  const options = await generateRegistrationOptions({
    rpName: 'My App',
    rpID: 'myapp.com',
    userID: user.id.toString(),
    userName: user.email,
    userDisplayName: user.name,
    attestationType: 'none',
  })

  // Store challenge for verification
  await cache.set(`webauthn:challenge:${user.id}`, options.challenge, 300)

  return Response.json(options)
})

// Verify registration
route.post('/webauthn/register', async (req) => {
  const user = await req.user()
  const response = req.all()

  const challenge = await cache.get(`webauthn:challenge:${user.id}`)

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge: challenge,
    expectedOrigin: 'https://myapp.com',
    expectedRPID: 'myapp.com',
  })

  if (verification.verified) {
    // Store credential
    await user.passkeys().create({
      credentialId: verification.registrationInfo.credentialID,
      publicKey: verification.registrationInfo.credentialPublicKey,
      counter: verification.registrationInfo.counter,
    })
  }
})
```

### Authentication

```typescript
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse
} from '@stacksjs/auth'

// Generate auth options
route.post('/webauthn/login/options', async (req) => {
  const { email } = req.all()
  const user = await User.where('email', '=', email).first()

  const passkeys = await user.passkeys().get()

  const options = await generateAuthenticationOptions({
    rpID: 'myapp.com',
    allowCredentials: passkeys.map(p => ({
      id: p.credentialId,
      type: 'public-key',
    })),
  })

  await cache.set(`webauthn:auth:${user.id}`, options.challenge, 300)
  return Response.json(options)
})

// Verify authentication
route.post('/webauthn/login', async (req) => {
  const { email, response } = req.all()
  const user = await User.where('email', '=', email).first()

  const challenge = await cache.get(`webauthn:auth:${user.id}`)
  const passkey = await user.passkeys()
    .where('credentialId', '=', response.id)
    .first()

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challenge,
    expectedOrigin: 'https://myapp.com',
    expectedRPID: 'myapp.com',
    authenticator: {
      credentialID: passkey.credentialId,
      credentialPublicKey: passkey.publicKey,
      counter: passkey.counter,
    },
  })

  if (verification.verified) {
    // Update counter
    await passkey.update({ counter: verification.authenticationInfo.newCounter })

    // Login user
    const { plainTextToken } = await Auth.createTokenForUser(user)
    return Response.json({ token: plainTextToken })
  }
})
```

## Password Reset

```typescript
import { sendPasswordReset, resetPassword } from '@stacksjs/auth'

// Request password reset
route.post('/forgot-password', async (req) => {
  const { email } = req.all()

  await sendPasswordReset(email, {
    resetUrl: 'https://myapp.com/reset-password',
    expiresIn: 60 * 60 * 1000, // 1 hour
  })

  return Response.json({ message: 'Reset email sent' })
})

// Reset password
route.post('/reset-password', async (req) => {
  const { token, password } = req.all()

  const result = await resetPassword(token, password)

  if (result.success) {
    return Response.json({ message: 'Password reset successfully' })
  }

  return Response.json({ error: result.error }, { status: 400 })
})
```

## Rate Limiting

```typescript
import { RateLimiter } from '@stacksjs/auth'

// Check rate limit before login
route.post('/login', async (req) => {
  const { email } = req.all()

  // Check if rate limited
  if (!RateLimiter.canAttempt(email)) {
    const waitTime = RateLimiter.getWaitTime(email)
    return Response.json({
      error: 'Too many attempts',
      retryAfter: waitTime
    }, { status: 429 })
  }

  const success = await Auth.attempt(req.all())

  if (!success) {
    RateLimiter.recordFailedAttempt(email)
    return Response.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  RateLimiter.resetAttempts(email)
  // Continue with login...
})
```

## API Reference

### Auth Class Methods

| Method | Description |
|--------|-------------|
| `attempt(credentials)` | Authenticate and store user |
| `validate(credentials)` | Validate without login |
| `login(credentials, options?)` | Login and get token |
| `loginUsingId(id, options?)` | Login by user ID |
| `logout()` | Logout current user |
| `once(credentials)` | One-time authentication |
| `user()` | Get authenticated user |
| `id()` | Get user ID |
| `check()` | Check if authenticated |
| `guest()` | Check if guest |
| `setUser(user)` | Set user (testing) |
| `createTokenForUser(user, options?)` | Create token |
| `validateToken(token)` | Validate token |
| `tokenCan(ability)` | Check token ability |
| `tokenCant(ability)` | Check token lacks ability |
| `tokens(userId?)` | Get user's tokens |
| `revokeToken(token)` | Revoke token |
| `revokeAllTokens(userId?)` | Revoke all tokens |

### Gate Methods

| Method | Description |
|--------|-------------|
| `define(name, callback)` | Define gate |
| `allows(ability, ...args)` | Check if allowed |
| `denies(ability, ...args)` | Check if denied |
| `authorize(ability, ...args)` | Authorize or throw |
| `policy(model, policy)` | Register policy |

### TOTP Functions

| Function | Description |
|----------|-------------|
| `generateTOTPSecret()` | Generate secret |
| `verifyTOTP(options)` | Verify code |
| `totpKeyUri(options)` | Generate URI |
| `generateQRCodeDataURL(uri)` | Generate QR code |
| `generateQRCodeSVG(uri)` | Generate SVG QR |
