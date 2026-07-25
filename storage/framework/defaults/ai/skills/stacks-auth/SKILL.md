---
name: stacks-auth
description: Use when implementing authentication, authorization, passkeys, TOTP/2FA, RBAC, gates, policies, session auth, token management, email verification, password resets, or rate limiting in a Stacks application. Covers the @stacksjs/auth package, config/auth.ts, app/Gates.ts, and app/Middleware/.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Authentication & Authorization

The `@stacksjs/auth` package provides comprehensive authentication and authorization for Stacks applications, built on `@stacksjs/ts-auth`.

## Key Paths

- Core package source: `storage/framework/core/auth/src/`
- Configuration: `config/auth.ts`
- Security config: `config/security.ts`
- Hashing config: `config/hashing.ts`
- Application gates: `app/Gates.ts`
- Application middleware: `app/Middleware/`
- Middleware aliases: `app/Middleware.ts`
- Auth types: `storage/framework/core/types/src/auth.ts`

## Source Files

```
auth/src/
├── index.ts              # All re-exports
├── authentication.ts     # Auth class - core auth logic
├── authenticator.ts      # 2FA and personal access client
├── client.ts             # Client re-exports
├── middleware.ts          # Auth middleware handler
├── rate-limiter.ts        # RateLimiter class (5 attempts, 15min lockout)
├── passkey.ts             # WebAuthn/Passkey support
├── password/reset.ts      # Password reset flow
├── register.ts            # User registration
├── user.ts                # Auth user helpers
├── tokens.ts              # Token CRUD, scopes, refresh tokens, OAuth clients
├── gate.ts                # Authorization gates & policies
├── policy.ts              # BasePolicy class + discovery
├── authorizable.ts        # User authorization mixin
├── rbac.ts                # Full RBAC system
├── email-verification.ts  # Email verification flow
└── session-auth.ts        # Session-based SPA auth
```

## Auth Class (authentication.ts) — Static Methods

### Login & Authentication
- `Auth.attempt(credentials: AuthCredentials): Promise<boolean>` — validate credentials without creating token
- `Auth.validate(credentials: AuthCredentials): Promise<boolean>` — alias for attempt
- `Auth.login(credentials: AuthCredentials, options?: TokenCreateOptions): Promise<{ user, token } | null>` — login and create token
- `Auth.loginUsingId(userId: number, options?: TokenCreateOptions): Promise<{ user, token } | null>` — login by user ID
- `Auth.logout(): Promise<void>` — revoke current token
- `Auth.once(credentials: AuthCredentials): Promise<boolean>` — one-time auth without token
- `Auth.requestToken(credentials, clientId, clientSecret): Promise<{ token } | null>` — OAuth token request

### User State
- `Auth.user(): Promise<UserModel | undefined>` — get authenticated user from bearer token
- `Auth.check(): Promise<boolean>` — is user authenticated?
- `Auth.guest(): Promise<boolean>` — is user a guest?
- `Auth.id(): Promise<number | undefined>` — get authenticated user ID
- `Auth.setUser(user: UserModel): void` — manually set user

### Token Creation
- `Auth.createTokenForUser(user, options?: TokenCreateOptions): Promise<NewAccessToken>`
- `Auth.createToken(user, name?, abilities?): Promise<AuthToken>`

### Token Validation
- `Auth.validateToken(token: string): Promise<boolean>` — validate bearer token
- `Auth.getUserFromToken(token: string): Promise<UserModel | undefined>`
- `Auth.currentAccessToken(): Promise<PersonalAccessToken | undefined>`

### Token Abilities (Scopes)
- `Auth.tokenCan(ability: string): Promise<boolean>`
- `Auth.tokenCant(ability: string): Promise<boolean>`
- `Auth.tokenAbilities(): Promise<string[]>`
- `Auth.tokenCanAll(abilities: string[]): Promise<boolean>`
- `Auth.tokenCanAny(abilities: string[]): Promise<boolean>`

### Token Management
- `Auth.tokens(userId?: number): Promise<PersonalAccessToken[]>`
- `Auth.revokeToken(token: string): Promise<void>`
- `Auth.revokeTokenById(tokenId: number): Promise<void>`
- `Auth.revokeAllTokens(userId?: number): Promise<void>`
- `Auth.revokeOtherTokens(userId?: number): Promise<void>`
- `Auth.pruneExpiredTokens(): Promise<number>`
- `Auth.pruneRevokedTokens(): Promise<number>`
- `Auth.rotateToken(oldToken: string): Promise<AuthToken | null>`
- `Auth.findToken(tokenId: number): Promise<PersonalAccessToken | null>`

### Utility
- `Auth.guard(name?: string): typeof Auth` — select guard (returns self)
- `Auth.viaRemember(): boolean` — always false currently
- `Auth.clearState(): void` — clear cached user/token

## Token System (tokens.ts)

### Access Tokens
- `tokens(userId: number): Promise<AccessToken[]>`
- `findToken(plainTextToken: string): Promise<AccessToken | null>`
- `currentAccessToken(): Promise<AccessToken | null>`
- `createToken(userId, name?, scopes?, options?): Promise<PersonalAccessTokenResult>`
  - Options: `{ expiresInMinutes?, withRefreshToken?, refreshExpiresInDays? }`

### Refresh Tokens
- `refreshToken(refreshTokenPlain, options?): Promise<RefreshTokenResult>`
- `validateRefreshToken(refreshTokenPlain): Promise<boolean>`
- `revokeRefreshToken(refreshTokenPlain): Promise<void>`
- `revokeAllRefreshTokens(userId): Promise<void>`
- `deleteExpiredRefreshTokens(): Promise<number>`
- `deleteRevokedRefreshTokens(daysOld?): Promise<number>`

### Token Revocation
- `revokeToken(plainTextToken): Promise<void>`
- `revokeTokenById(tokenId): Promise<void>`
- `revokeAllTokens(userId): Promise<void>`
- `revokeOtherTokens(userId): Promise<void>`
- `deleteExpiredTokens(): Promise<number>`
- `deleteRevokedTokens(daysOld?): Promise<number>`

### Token Scopes
- `tokenCan(scope): Promise<boolean>`
- `tokenCant(scope): Promise<boolean>`
- `tokenCanAll(scopes): Promise<boolean>`
- `tokenCanAny(scopes): Promise<boolean>`
- `tokenAbilities(): Promise<string[]>`
- `parseScopes(scopes: string | string[] | null | undefined): TokenScopes`

### OAuth Clients
- `clients(userId): Promise<OAuthClient[]>`
- `findClient(clientId): Promise<OAuthClient | null>`
- `createClient(options: CreateClientOptions): Promise<CreateClientResult>`
- `revokeClient(clientId): Promise<void>`

## Two-Factor Authentication (authenticator.ts)

- `generateTwoFactorSecret(): string`
- `generateTwoFactorToken(secret: Secret): Promise<Token>`
- `verifyTwoFactorCode(token: Token, secret: Secret): Promise<boolean>`
- `generateTwoFactorUri(user?, service?, secret?): string`
- `createPersonalAccessClient(): Promise<Result<string, never>>`

### Re-exported from @stacksjs/ts-auth:
- `generateTOTP`, `verifyTOTP`, `generateTOTPSecret`, `totpKeyUri`

## Authorization Gates (gate.ts)

### Gate Functions
- `define<T>(ability: string, callback: GateCallback<T>): void`
- `policy(model: string | { name }, policyClass: new () => Policy): void`
- `before(callback): void` — run before any gate check
- `after(callback): void` — run after any gate check
- `allows(ability, user, ...args): Promise<boolean>`
- `denies(ability, user, ...args): Promise<boolean>`
- `can(ability, user, ...args): Promise<boolean>`
- `cannot(ability, user, ...args): Promise<boolean>`
- `any(abilities[], user, ...args): Promise<boolean>`
- `all(abilities[], user, ...args): Promise<boolean>`
- `none(abilities[], user, ...args): Promise<boolean>`
- `authorize(ability, user, ...args): Promise<AuthorizationResponse>` — throws on deny
- `inspect(ability, user, ...args): Promise<AuthorizationResponse>` — never throws
- `has(ability): boolean`
- `hasPolicy(model): boolean`
- `abilities(): string[]`
- `getPolicyFor<T>(model: T): Policy<T> | null`
- `flush(): void` — clear all gates

### Gate Facade — `Gate.define()`, `Gate.can()`, etc.

### AuthorizationResponse Class
- `static allow(message?): AuthorizationResponse`
- `static deny(message?, code?): AuthorizationResponse`
- `allowed(): boolean`, `denied(): boolean`
- `authorize(): void` — throws AuthorizationException if denied

### Policy Interface
Methods: `before?`, `viewAny?`, `view?`, `create?`, `update?`, `delete?`, `restore?`, `forceDelete?`

### BasePolicy Abstract Class
Protected helpers: `allow(message?)`, `deny(message?, code?)`, `denyIf(condition)`, `denyUnless(condition)`, `allowIf(condition)`

## RBAC System (rbac.ts)

### Role Management
- `Rbac.createRole(name, guardName?, description?): Promise<RoleRecord>`
- `Rbac.findRole(name, guardName?): Promise<RoleRecord | null>`
- `Rbac.deleteRole(name, guardName?): Promise<void>`
- `Rbac.getAllRoles(guardName?): Promise<RoleRecord[]>`

### Permission Management
- `Rbac.createPermission(name, guardName?, description?): Promise<PermissionRecord>`
- `Rbac.findPermission(name, guardName?): Promise<PermissionRecord | null>`
- `Rbac.deletePermission(name, guardName?): Promise<void>`
- `Rbac.getAllPermissions(guardName?): Promise<PermissionRecord[]>`

### User-Role Operations
- `Rbac.getUserRoles(user): Promise<RoleRecord[]>`
- `Rbac.assignRole(user, roleName, guardName?): Promise<void>`
- `Rbac.removeRole(user, roleName, guardName?): Promise<void>`
- `Rbac.removeAllRoles(user): Promise<void>`
- `Rbac.syncRoles(user, roleNames[], guardName?): Promise<void>`
- `Rbac.hasRole(user, roleName, guardName?): Promise<boolean>`
- `Rbac.hasAnyRole(user, roleNames[], guardName?): Promise<boolean>`
- `Rbac.hasAllRoles(user, roleNames[], guardName?): Promise<boolean>`

### User-Permission Operations
- `Rbac.getUserPermissions(user): Promise<PermissionRecord[]>`
- `Rbac.givePermission(user, permissionName, guardName?): Promise<void>`
- `Rbac.revokePermission(user, permissionName, guardName?): Promise<void>`
- `Rbac.revokeAllPermissions(user): Promise<void>`
- `Rbac.syncPermissions(user, permissionNames[], guardName?): Promise<void>`
- `Rbac.hasPermission(user, permissionName, guardName?): Promise<boolean>`
- `Rbac.hasAnyPermission(user, permissionNames[], guardName?): Promise<boolean>`
- `Rbac.hasAllPermissions(user, permissionNames[], guardName?): Promise<boolean>`

### Role-Permission Operations
- `Rbac.getRolePermissions(roleId): Promise<PermissionRecord[]>`
- `Rbac.givePermissionToRole(roleName, permissionName, guardName?): Promise<void>`
- `Rbac.revokePermissionFromRole(roleName, permissionName, guardName?): Promise<void>`
- `Rbac.syncRolePermissions(roleName, permissionNames[], guardName?): Promise<void>`

### withRbac Mixin
`withRbac(user)` — adds `hasRole()`, `hasPermission()`, `assignRole()`, `givePermission()`, etc. to any user object

### RBAC Types
```typescript
interface RoleRecord { id, name, guard_name, description?, created_at?, updated_at? }
interface PermissionRecord { id, name, guard_name, description?, created_at?, updated_at? }
interface RbacStore { findRoleByName, createRole, deleteRole, getAllRoles, findPermissionByName, createPermission, ... }
```

## Session Auth (session-auth.ts)

- `SessionAuth.login(email, password): Promise<{ user, sessionId }>`
- `SessionAuth.logout(sessionId): void`
- `SessionAuth.user(sessionId): Promise<UserModel | undefined>`
- `SessionAuth.check(sessionId): boolean`
- `SessionAuth.refresh(sessionId, ttlMs?): boolean`

Internal: in-memory Map with 10k session limit, 5-minute eviction interval, timing-safe password comparison with dummy bcrypt hash.

## Email Verification (email-verification.ts)

- `EmailVerification.isVerified(user): boolean`
- `EmailVerification.send(user): Promise<void>`
- `EmailVerification.verify(userId, token): Promise<EmailVerificationResult>`
- `EmailVerification.resend(user): Promise<EmailVerificationResult>`

## Password Reset (password/reset.ts)

```typescript
const actions = passwordResets(email)
await actions.sendEmail()
const valid = await actions.verifyToken(token)
const result = await actions.resetPassword(token, newPassword)
```

## Registration (register.ts)

- `register(credentials: NewUser): Promise<{ token: AuthToken }>`

## User Helpers (user.ts)

- `authUser(): Promise<UserModel | undefined>`
- `check(): Promise<boolean>`
- `id(): Promise<number | undefined>`
- `email(): Promise<string | undefined>`
- `name(): Promise<string | undefined>`
- `isAuthenticated(): Promise<boolean>`
- `logout(): Promise<void>`
- `refresh(): Promise<void>`

## Passkey/WebAuthn (passkey.ts)

- `getUserPasskeys(userId): Promise<PasskeyAttribute[]>`
- `getUserPasskey(userId, passkeyId): Promise<PasskeyAttribute | undefined>`
- `setCurrentRegistrationOptions(user, verified): Promise<void>`

### Re-exported from @stacksjs/ts-auth:
- `generateRegistrationOptions`, `generateAuthenticationOptions`
- `verifyRegistrationResponse`, `verifyAuthenticationResponse`
- `startRegistration`, `startAuthentication` (browser)
- `browserSupportsWebAuthn`, `browserSupportsWebAuthnAutofill`
- `platformAuthenticatorIsAvailable`

## Auth Middleware (middleware.ts)

```typescript
export const authMiddlewareHandler = {
  name: 'auth',
  handle: authMiddleware, // validates bearer token, throws 401
}
```

## Rate Limiter (rate-limiter.ts)

```typescript
class RateLimiter {
  static MAX_ATTEMPTS = 5
  static LOCKOUT_DURATION = 15 * 60 * 1000  // 15 minutes
  static MAX_STORE_SIZE = 10_000
  static EVICTION_INTERVAL = 5 * 60 * 1000  // 5 minutes

  static isRateLimited(email): boolean
  static recordFailedAttempt(email): void
  static resetAttempts(email): void
  static validateAttempt(email): void  // throws HttpError 429
}
```

## Authorizable Mixin (authorizable.ts)

```typescript
const authUser = withAuthorization(user)
await authUser.can('edit-post', post)
await authUser.cannot('delete-post', post)
await authUser.canAny(['edit', 'delete'], post)
await authUser.canAll(['edit', 'publish'], post)
await authUser.authorize('edit-post', post)  // throws if denied
```

## Configuration

### config/auth.ts
```typescript
{
  default: 'api',
  guards: { api: { driver: 'token', provider: 'users' } },
  providers: { users: { driver: 'database', table: 'users' } },
  username: 'email',      // AUTH_USERNAME_FIELD env
  password: 'password',   // AUTH_PASSWORD_FIELD env
  tokenExpiry: 30,         // days, AUTH_TOKEN_EXPIRY env
  tokenRotation: 7,        // days, AUTH_TOKEN_ROTATION env
  defaultAbilities: ['*'],
  defaultTokenName: 'auth_token',
  passwordReset: { expire: 60, throttle: 60 }
}
```

### config/hashing.ts
```typescript
{
  driver: 'bcrypt',         // 'bcrypt' | 'argon2'
  bcrypt: { rounds: 12 },
  argon2: { memory: 65536, time: 3 }
}
```

### config/security.ts
```typescript
{
  firewall: {
    enabled: true,
    countryCodes: [],
    ipAddresses: { allowlist: [], blocklist: [] },
    rateLimitPerMinute: 500,
    useIpReputationLists: true,
    useKnownBadInputsRuleSet: true
  }
}
```

## Middleware Aliases (app/Middleware.ts)

Available middleware names: `maintenance`, `auth`, `guest`, `api`, `team`, `logger`, `abilities`, `can`, `throttle`, `local`, `development`, `staging`, `production`, `env.local`, `env.development`, `env.staging`, `env.production`, `role`, `permission`, `verified` (EnsureEmailIsVerified)

## Application Gates Example (app/Gates.ts)

```typescript
Gate.define('access-admin', (user) => user?.email?.endsWith('@stacksjs.org') ?? false)
Gate.define('edit-settings', (user) => !!user)
Gate.define('view-dashboard', (user) => !!user)
```

## Default API Routes

- `POST /login` → LoginAction (validates email + password)
- `POST /register` → RegisterAction
- `POST /auth/refresh` → RefreshTokenAction
- `POST /auth/token` → CreateTokenAction
- `GET /auth/tokens` → ListTokensAction (auth middleware)
- `DELETE /auth/tokens/{id}` → RevokeTokenAction (auth middleware)
- `GET /me` → GetMeAction (auth middleware)
- `POST /logout` → LogoutAction (auth middleware)

## User Model Traits

```typescript
// User model uses:
traits: {
  useAuth: { usePasskey: true },
  useUuid: true,
  useTimestamps: true,
  useSocials: ['github'],
}
```

## Gotchas

- Auth depends on `@stacksjs/ts-auth` for TOTP and passkey functions
- Password hashing defaults to bcrypt with 12 rounds (config/hashing.ts)
- Rate limiter uses in-memory Map, resets on server restart — not shared across workers
- Session auth also uses in-memory Map with 10k limit — for SPA cookie auth
- Token format is `tokenId|plainText` — the `|` separates the encrypted ID from the plain token
- The `parseToken()` helper splits on `|` to extract both parts
- Bearer tokens come from the `Authorization: Bearer <token>` header
- `Auth.user()` internally calls `getBearerToken()` → `parseToken()` → `getTokenFromId()` → validates hash
- RBAC has an internal cache (`userRoles`, `userPermissions`, `rolePermissions`) — call `Rbac.flushCache()` after direct DB changes
- Gate `before` callbacks can short-circuit — return `true` to allow, `null` to continue checking
- `withRbac()` and `withAuthorization()` return new objects with methods mixed in
- The `RbacStore` interface must be implemented and set via `Rbac.setStore()` for RBAC to work
- Password reset tokens expire after 60 minutes by default
- Default token abilities are `['*']` — wildcard access
- Token expiry defaults to 30 days
- Session auth uses timing-safe bcrypt comparison even for failed lookups (dummy hash prevents timing attacks)

## Build

```bash
cd storage/framework/core/auth && bun build.ts
```
