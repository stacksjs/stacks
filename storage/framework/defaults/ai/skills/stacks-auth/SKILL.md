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

### Personal access tokens (Sanctum-shaped)

`oauth_access_tokens` is polymorphic: `tokenable_type` holds the owner's TABLE
name (`users`, `authors`) and `tokenable_id` its id there, so any model
declaring `useAuth` can hold tokens - not only `User`.

- `createToken(id, name, scopes, { tokenableType })` — mint one. Returns the
  plaintext ONCE (`plainTextToken`); the table stores a hash and nothing can
  recover it afterwards. `tokenableType` defaults to `users`.
- `tokens(id, tokenableType?)` — list an owner's live tokens.
- `tokenCan(scope)` / `tokenCanAll` / `tokenCanAny` / `tokenAbilities` — check
  the current request's token.
- `revokeToken`, `revokeTokenById`, `revokeAllTokens(id, type?)`,
  `revokeOtherTokens(id, type?)` — revocation also revokes the paired refresh
  token, which a raw row delete does not.
- `setTrailActor(id)` — attribute writes in a queue job or CLI run that has no
  request to read a user from.

The `PersonalAccessToken` model maps the same table, so `owner.with('tokenable')`
lists exactly what `createToken` minted. It deliberately generates no CRUD
routes: minting and revoking both carry semantics a generic route does not.
- `Auth.once(credentials: AuthCredentials): Promise<boolean>` — one-time auth without token
- `Auth.requestUserTokenWithClient(credentials, clientId, clientSecret): Promise<{ token } | null>` authenticates both a legacy OAuth client and an end user password, then issues a user token. It is not the client credentials grant.
- `Auth.requestToken(...)` is the deprecated compatibility alias for that same legacy exchange. New delegated integrations use the authorization-code provider.

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

### OAuth Provider and PKCE

The authorization server is opt-in through `config/auth.ts` under
`oauthProvider`. It is separate from social sign-in, where Stacks is the OAuth
client. The provider profile is Authorization Code with S256 PKCE and rotating
refresh tokens. Confidential client credentials are opt-in through
`oauthProvider.clientCredentials` and mint access-only tokens without refresh
tokens. Protected resource-server introspection is separately opt-in through
`oauthProvider.introspection`; it authenticates a confidential client and
requires that client to share a configured resource audience with the token.
It does not support implicit or password grants or OpenID Connect.

When enabled, the default auth route bundle registers:

- `GET` and `POST /oauth/authorize`
- `POST /oauth/token`
- `POST /oauth/revoke`
- `GET /.well-known/oauth-authorization-server`
- owner-managed clients under `/auth/oauth/clients`
- user-managed connected applications under `/auth/oauth/connections`

Set a canonical `issuer`, then register every scope and resource explicitly.
Resource audiences are absolute URIs and redirect URIs use exact matching.
The consent view is `auth/oauth/consent` by default and can be overridden with
`oauthProvider.consent.view`. Use `oauthProvider.consent.resolveWorkspace` when
the application must bind consent to current server-owned workspace authority.
Use `oauthProvider.subjectEligibility` when account status is represented by
application data that is not simply the presence of a user row. The callback
is rechecked before consent approval, delegated code exchange and refresh, and
by introspection; returning false revokes the affected grant and reports the
token inactive.

Provider actions return 404 while `oauthProvider.enabled` is false. The token
and revocation endpoints use protocol credentials and intentionally skip
browser CSRF. Authorization approval, client management, and disconnect remain
authenticated and CSRF protected.

- `resolveOAuthProviderConfig(options)` returns `null` unless explicitly enabled
- `generatePkceVerifier()` creates a 256-bit RFC 7636 verifier
- `createS256CodeChallenge(verifier)` derives its S256 challenge
- `verifyS256CodeChallenge(verifier, challenge)` validates without a plain fallback
- `isValidPkceVerifier(value)` checks the required 43 to 128 character syntax

## Two-Factor Authentication (authenticator.ts)

- `generateTwoFactorSecret(): string`
- `generateTwoFactorToken(secret: Secret): Promise<Token>`
- `verifyTwoFactorCode(token: Token, secret: Secret): Promise<boolean>`
- `generateTwoFactorUri(user?, service?, secret?): string`
- `createPersonalAccessClient(): Promise<Result<string, never>>`

### Re-exported from @stacksjs/ts-auth
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

### Gate Facade — `Gate.define()`, `Gate.can()`, etc

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
- `Rbac.syncRoles(user, roleNames[], guardName?): Promise<void>` - replaces assignments for that guard and preserves roles from other guards
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
- `SessionAuth.refresh(sessionId, ttlMs?): boolean`, rejects non-positive or non-finite TTLs without changing the session

Internal: database-backed `sessions` rows with expiry, optional IP/User-Agent fingerprint checks, transactional logout and refresh, and timing-safe password comparison with a dummy bcrypt hash. Sessions survive process restarts and are shared by workers through the configured database.

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

### Re-exported from @stacksjs/ts-auth
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
  tokenExpiry: 60 * 60 * 1000, // milliseconds, 1 hour
  refreshTokenExpiry: 30 * 24 * 60 * 60 * 1000, // milliseconds
  browserSession: {
    baselineLifetime: 7 * 24 * 60 * 60 * 1000, // absolute milliseconds
    rememberedLifetime: 30 * 24 * 60 * 60 * 1000,
    withRefreshToken: false, // fixed browser lifetime, no unused refresh token
    logoutRedirect: '/login?logged_out=1', // local path for HTML logout only
  },
  defaultAbilities: ['*'],
  defaultTokenName: 'auth-token',
  passwordReset: { expire: 60, throttle: 60 }
}
```

`browserSession` applies to credentials issued by the default login,
registration, and completed two-factor actions. Dedicated personal access
token and OAuth issuance remain unchanged. The default login form sends
`remember`; registration uses the baseline tier unless a custom client sends
that field. A two-factor challenge preserves the choice without minting a
session until verification succeeds. Cookie Max-Age comes from the lifetime
returned by token issuance, so it cannot outlive the token. Cookie-authenticated
writes use the CSRF flow and same-origin credentials.

When migrating an app that copied framework auth actions, remove only the
equivalent login, registration, two-factor, logout, and cookie-helper overrides.
Retain application-specific onboarding and event hooks.

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

Auth-relevant aliases: `auth`, `guest`, `verified` (EnsureEmailIsVerified),
`abilities`, `can`, `role`, `permission`, `team`, `signed`, `throttle`. The
environment aliases are `env`, `env:local`, `env:development` / `env:dev`,
`env:staging`, `env:production` / `env:prod` — with a COLON, not a dot; an
earlier version of this list wrote `env.local` and those never existed. See
`stacks-middleware` for the full set and for the `!alias` and `alias:params`
forms.

## Application Gates (app/Gates.ts)

```typescript
import { defineGates } from '@stacksjs/auth'

export default defineGates({
  gates: {
    'access-admin': user => user?.email?.endsWith('@stacksjs.com') ?? false,
    'edit-settings': user => !!user,
    'view-dashboard': user => !!user,
  },
  policies: {
    Post: 'PostPolicy',
  },
})
```

Registered at boot by `initializeAuthorization()`, from
`injectGlobalAutoImports()` — the one place every entry point comes through, so
HTTP, `buddy seed`, a scheduled job and a console command all get the same
gates.

Both halves of `policies` are checked: the key names a model the ORM exposes,
the value a policy file under `app/Policies/` or the framework defaults. An
explicit mapping WINS over the `<Model>Policy` naming convention, which is the
reason to write one.

`Gate.define(...)` still works for a gate registered at runtime; `defineGates`
is the declarative form and the one the ability-name completions come from.

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
- Rate limiting uses a process-local memory store by default. Production deployments with multiple workers should configure the atomic Redis store or provide a custom atomic store.
- Session auth is database-backed through the `sessions` table, so it survives server restarts and is shared across workers.
- New personal and delegated access tokens are opaque 40-byte hex bearers hashed at rest. Legacy `jwt:encryptedId` bearers remain readable during migration.
- Token validation hashes the bearer directly. Do not parse or expose token contents, and never log plaintext bearer values.
- Bearer tokens come from the `Authorization: Bearer <token>` header
- `Auth.user()` internally calls `getBearerToken()` and resolves the bearer through a hashed token lookup
- RBAC has an internal cache (`userRoles`, `userPermissions`, `rolePermissions`) — call `Rbac.flushCache()` after direct DB changes
- `syncRoles()` and `syncPermissions()` are guard-scoped replacements: they preserve assignments belonging to other guards
- Gate `before` callbacks can short-circuit — return `true` to allow, `null` to continue checking
- An ability with no gate and no policy method **denies**. That is the right default, and it means a gate that was never registered is indistinguishable from one that says no — which is how `initializeAuthorization()` went unnoticed while nothing called it
- `allows()` and friends take `Ability`, which is open (`GateName | PolicyAbility | (string & {})`). A `/can/:ability` route passes an ability straight through, so narrowing it would reject correct code; the union is for completions
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
