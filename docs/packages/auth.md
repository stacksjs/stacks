---
title: Auth Package
description: "A comprehensive authentication system providing Laravel Passport-style token management, OAuth2 support, authorization gates/policies, WebAuthn/Passkey sup..."
---
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
  // The LABEL written to a token's `name` column — what a "your active
  // sessions" list shows. Not the cookie name; see `cookie` below.
  defaultTokenName: 'auth-token',
  defaultAbilities: ['*'],

  // The browser cookie that carries an access token.
  cookie: {
    name: 'auth-token',
    path: '/',
    sameSite: 'Lax',
    // domain: '.example.com',
    // secure: true, // defaults from the configured app URL
  },
  tokenExpiry: 30 * 24 * 60 * 60 * 1000, // 30 days

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

// Revoke all except the request's own token (or an explicit one). With no
// current token (a cookie-session request) every token is revoked.
const { keptTokenId } = await Auth.revokeOtherTokens(userId)
await Auth.revokeOtherTokens(userId, { exceptTokenId: 12 })

// Rotate token (refresh)
const newToken = await Auth.rotateToken(oldToken)
```

Rotation is explicit because the caller must return the replacement bearer to
the client. Validation never rotates a token behind the client's back. Use a
refresh-token exchange for ordinary long-lived sessions.

Individual revocation updates an access token and its paired refresh tokens in
one transaction. If storage rejects either update, neither change is committed
and the error reaches the caller. `logoutCookie()` only clears the browser
cookie after revocation succeeds, preserving the credential for a retry on
failure. Other sessions are not changed. See [#2610](https://github.com/stacksjs/stacks/issues/2610).

An already-rotated token does not identify its replacement in the current
schema. Revoking a predecessor is not a sign-out of that replacement; use
`revokeAllTokens` when the intent is to revoke every session for the owner.

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
import { generateTwoFactorSetup } from '@stacksjs/auth'

// Secret, otpauth:// URI and QR code in one synchronous call
const { secret, uri, qr } = generateTwoFactorSetup(user.email, 'MyApp')

// `qr` is an SVG string, not a data URI: it stays sharp at any size, inlines
// into a server-rendered page or an email, and is a few hundred bytes rather
// than tens of kilobytes.
```

The pieces are also available individually - `generateTwoFactorSecret()`,
`generateTwoFactorUri(email, serviceName, secret)` and
`twoFactorQrCode(uri, size?)` - for a flow that needs to interleave its own
steps. `stashPendingTwoFactorSecret` holds the secret server-side while the
user scans it, so it is never enabled from an unconfirmed code.

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

`passwordResets(email)` returns the three actions for that address, so the
email is never a parameter you can get wrong halfway through the flow:

```typescript
import { passwordResets } from '@stacksjs/auth'
import { response } from '@stacksjs/router'

// Request password reset
route.post('/forgot-password', async (req) => {
  const { email } = req.all()

  // Creates the token, invalidating any outstanding one for this address,
  // and sends the mail. The expiry comes from config.auth.passwordReset.expire.
  await passwordResets(email).sendEmail()

  return response.json({ message: 'Reset email sent' })
})

// Reset password
route.post('/reset-password', async (req) => {
  const { email, token, password } = req.all()

  const result = await passwordResets(email).resetPassword(token, password)

  if (result.success)
    return response.json({ message: 'Password reset successfully' })

  return response.json({ error: result.error }, { status: 400 })
})
```

`verifyToken(token)` checks a token without consuming it, for a reset page that
wants to show the form only when the link is still valid.

`sendEmail()` takes options for apps with their own templates or a delivery
ledger, and for accounts someone else created:

```typescript
await passwordResets(email).sendEmail({
  purpose: 'setup', // 'reset' (default) or 'setup': a first password for an invited account
  expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60_000),
  // Runs after the token commits, instead of the framework mail.
  deliver: async ({ purpose, userId, email, token, url, expiresAt }) => {
    await sendLocalizedMail(email, { url, expiresAt, purpose })
  },
})
```

`token` and `url` are the live credential: never log them. An unknown or
throttled address is still a silent no-op, so the endpoint cannot be used to
enumerate accounts.

### Changing a password, and the credential sweep

A successful reset stamps `password_changed_at` (every token issued before it
is refused) and revokes two-factor challenges, magic links, OAuth grants and
codes, tokens and sessions, in one transaction. That sweep is exported, so
every other path that changes how an account proves who it is uses the same
one:

```typescript
import { changePassword, revokeAccountCredentials } from '@stacksjs/auth'

// Signed-in user changing their password: keep this device, sign out the rest.
const current = await Auth.currentAccessToken()
const result = await changePassword(user.id, req.get('current_password'), req.get('password'), {
  keepTokenId: current?.id,
})
if (!result.success)
  return response.json({ error: result.reason }, { status: 422 })

// An admin forcing a sign-out everywhere, inside your own transaction.
await db.transaction(async (tx) => {
  await revokeAccountCredentials(user.id, { tx })
})
```

`changePassword` verifies the current password, commits only if that hash is
still the stored one, runs the sweep and, after commit, sends the
`password-changed` mail (pass `notify: false` or your own function). Enforce
your password policy before calling it.

## Rate Limiting

The login, magic-link and two-factor paths lock an address after five failures
for fifteen minutes. The same limiter is available directly:

```typescript
import { RateLimiter } from '@stacksjs/auth'

route.post('/login', async (req) => {
  const { email } = req.all()

  // Throws HttpError(429) while the address is locked.
  await RateLimiter.validateAttempt(email)

  const success = await Auth.attempt(req.all())
  if (!success) {
    await RateLimiter.recordFailedAttempt(email)
    return Response.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  await RateLimiter.resetAttempts(email)
  // Continue with login...
})
```

When `config/cache.ts` uses the Redis driver, attempts are counted there, so a
lockout holds across every worker and instance; while Redis is unreachable the
limiter falls back to process memory and warns once. Without Redis it counts per
process. `config.security.rateLimit.scale` (or `STACKS_RATE_LIMIT_SCALE`)
multiplies the threshold, and every route `.rateLimit()`, so a test suite can
raise it instead of turning limits off.

## Social sign-in

The `social` route bundle mounts three routes when a provider is configured in
`config/services.ts`:

| Route | What it does |
|---|---|
| `GET /auth/{provider}` | Issues a single-use OAuth `state`, bound to this browser by an HttpOnly cookie, and redirects to the provider. `?redirect_to=/path` picks the landing page. |
| `GET\|POST /auth/{provider}/callback` | Redeems that state (a code from another browser is refused before it is exchanged), resolves the user, and redirects to `redirect_to#stx_handoff=<code>`. |
| `POST /auth/handoff` | Trades the one-use code (60 seconds, this browser only) for the session: the token pack and the auth cookie. |

`useAuth().completeSocialLogin()` on the landing page does the last step. No
bearer or refresh token ever appears in a URL.

`resolveSocialSignIn()` decides which local user an identity is. It links to an
existing account by email only when the provider verified the address and the
local account verified it too; otherwise it throws `SocialSignInRefusedError`
with `reason` `'unverified-provider-email'` or `'unverified-local-email'`. A new
account made from a provider-verified address starts verified.

For a custom flow, use the same primitives:

```typescript
import { createSessionHandoff, redeemSessionHandoff } from '@stacksjs/auth'
import { consumeOAuthFlow, issueOAuthFlow, readOAuthFlowCookie, socialHandoffCodeRedirect } from '@stacksjs/socials'

// Start: send `flow.cookie` with the redirect.
const flow = await issueOAuthFlow({ purpose: 'social:google', ttlMs: 10 * 60_000 })
driver.withState(flow.state)

// Callback: null for a forged, replayed, expired or foreign-browser state.
const started = await consumeOAuthFlow(state, {
  purpose: 'social:google',
  browserSecret: readOAuthFlowCookie(request.headers.get('cookie'), state),
})

// Hand over a code, not tokens.
const handoff = await createSessionHandoff(userId, { bindTo: 'cookie' })
const redirect = socialHandoffCodeRedirect(handoff.code, { redirectTo: '/account' })
redirect.headers.append('Set-Cookie', handoff.cookie!)
```

A native app whose sign-in sheet keeps its own cookies binds the handoff to a
verifier instead: `createSessionHandoff(userId, { bindTo: { challenge: sha256Hex(verifier) } })`,
redeemed with `redeemSessionHandoff(code, verifier)`.

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

## Cookie sessions for the browser

An API client holds a bearer token in a header. A browser coming back from an
OAuth redirect or a form POST has nothing but cookies, so `@stacksjs/auth`
carries the same personal access token in an `HttpOnly` cookie:

```ts
import { Auth, authCookie, clearAuthCookie } from '@stacksjs/auth'

const session = await Auth.loginUsingId(user.id)

return new Response(null, {
  status: 303,
  headers: {
    'Location': '/account',
    'Set-Cookie': authCookie(String(session.token)),
  },
})
```

The cookie is `HttpOnly` (no page script needs it), `SameSite=Lax` (a link from
an email arrives signed in, a cross-site POST does not) and `Secure` unless the
configured app URL is a plain-HTTP loopback host. Configure its name, path,
domain, SameSite, or explicit Secure override through `config.auth.cookie`.
Issuance and `clearAuthCookie()` share those attributes, so logout removes the
same cookie. It carries a real token, so it is revocable through the usual token
calls and survives a restart.

The Auth middleware reads it automatically — bearer header first, then this
cookie. `authCookieName()` is the single resolver both sides use, so the name
written is always the name read. Until stacksjs/stacks#2236 it was not:
`authCookie()` wrote `stacks_auth` while every reader looked for
`defaultTokenName`, and the whole path was quietly inert.

On the client, finish the handoff instead of writing storage keys by hand:

```ts
const { completeSocialLogin } = useAuth()
await completeSocialLogin()
```
