---
name: stacks-socials
description: Use when implementing social authentication in Stacks — OAuth2 flows with GitHub/Google/Facebook/Twitter providers, the AbstractProvider base class, PKCE support, state management, scope configuration, social user profiles, or token handling. Covers @stacksjs/socials.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Socials

OAuth2-based social authentication with 4 built-in providers.

## Key Paths
- Core package: `storage/framework/core/socials/src/`

## Source Files
```
socials/src/
├── index.ts          # re-exports from drivers/
├── abstract.ts       # AbstractProvider base class
├── token.ts          # Token class
├── types.ts          # SocialUser, provider-specific interfaces
├── exceptions.ts     # InvalidStateException, ConfigException
└── drivers/
    ├── index.ts      # re-exports all 4 providers
    ├── github.ts     # GitHub OAuth provider
    ├── google.ts     # Google OAuth provider
    ├── facebook.ts   # Facebook OAuth provider
    └── twitter.ts    # Twitter/X OAuth2 + PKCE provider
```

## AbstractProvider Base Class

All providers extend `AbstractProvider` which implements `ProviderInterface`. The constructor takes a `ProviderConfig`:

```typescript
interface ProviderConfig {
  clientId: string
  clientSecret: string
  redirectUrl: string
  guzzle?: Record<string, any>
}
```

Properties and methods on `AbstractProvider`:

```typescript
abstract class AbstractProvider implements ProviderInterface {
  // Protected state
  protected clientId: string
  protected clientSecret: string
  protected redirectUrl: string
  protected parameters: Record<string, any> = {}
  protected _scopes: string[] = []
  protected scopeSeparator: string = ','
  protected _stateless: boolean = false
  protected _usesPKCE: boolean = false
  protected user: SocialUser | null = null

  // Abstract methods (each provider implements)
  abstract getAuthUrl(): Promise<string>           // public, returns Promise
  protected abstract getTokenUrl(): string         // protected
  abstract getAccessToken(code: string): Promise<string>
  abstract getUserByToken(token: string): Promise<SocialUser>

  // Scope management
  scopes(scopes: string | string[]): this      // merge into existing (deduplicates via Set)
  setScopes(scopes: string | string[]): this   // replace all scopes (deduplicates via Set)
  getScopes(): string[]

  // Configuration
  setRedirectUrl(url: string): this
  stateless(): this                             // sets _stateless = true
  enablePKCE(): this                            // sets _usesPKCE = true
  with(parameters: Record<string, any>): this   // replaces custom query parameters

  // User retrieval
  async userFromToken(token: string): Promise<SocialUser>  // calls getUserByToken, adds token

  // URL building (protected)
  protected buildAuthUrlFromBase(url: string, state: string | null): string
  protected getCodeFields(state: string | null = null): Record<string, any>
  protected formatScopes(scopes: string[], scopeSeparator: string): string

  // State helpers (protected)
  protected usesState(): boolean          // returns !_stateless
  protected isStateless(): boolean        // returns _stateless
  protected getState(): string            // 20 random bytes -> 40 hex chars

  // PKCE helpers (protected)
  protected usesPKCE(): boolean
  protected getCodeVerifier(): string              // 48 random bytes -> 96 hex chars
  protected async getCodeChallenge(): Promise<string>  // SHA-256 of verifier, base64url encoded
  protected getCodeChallengeMethod(): string       // always 'S256'
}
```

The `getCodeFields()` method builds the query parameters for the authorization URL:
- Always includes: `client_id`, `redirect_uri`, `scope` (joined by `scopeSeparator`), `response_type: 'code'`
- Conditionally adds `state` when `usesState()` is true
- Conditionally adds `code_challenge` and `code_challenge_method` when `usesPKCE()` is true
- Merges in any custom `parameters` set via `with()`

## Provider Implementations

### GitHub Provider

```typescript
class GitHubProvider extends AbstractProvider {
  protected baseUrl = 'https://github.com'
  protected apiUrl = 'https://api.github.com'
}
```

- Config source: `config.services.github` (clientId, clientSecret, redirectUrl, scopes)
- Default scopes: `['read:user', 'user:email']`
- Auth URL: `https://github.com/login/oauth/authorize` with scopes joined by space
- Token URL: `https://github.com/login/oauth/access_token` (POST)
- User API: Fetches `/user` and `/user/emails` in parallel via `Promise.all`
- Email resolution: Primary email first, then verified, then first available
- Uses `@stacksjs/api` `fetcher` for HTTP requests
- Throws `ConfigException` if clientId, clientSecret, or redirectUrl missing
- GitHub token response: `GitHubTokenResponse { access_token, error?, error_description? }`

### Google Provider

```typescript
class GoogleProvider extends AbstractProvider {
  protected baseUrl = 'https://accounts.google.com'
  protected apiUrl = 'https://www.googleapis.com'
}
```

- Config source: `config.services.google`
- Default scopes: `['https://www.googleapis.com/auth/userinfo.profile', 'https://www.googleapis.com/auth/userinfo.email']`
- Auth URL: `https://accounts.google.com/o/oauth2/v2/auth` (includes `access_type: 'offline'`, `prompt: 'consent'`)
- Token URL: `https://accounts.google.com/oauth2/v4/token` (POST with `grant_type: 'authorization_code'`)
- User API: `https://www.googleapis.com/oauth2/v2/userinfo` with Bearer token
- Maps `given_name` to `nickname`, `picture` to `avatar`
- Google user type: `{ id, email, verified_email, name, given_name, family_name, picture, locale }`

### Facebook Provider

```typescript
class FacebookProvider extends AbstractProvider {
  protected baseUrl = 'https://www.facebook.com'
  protected apiUrl = 'https://graph.facebook.com'
}
```

- Config source: `config.services.facebook`
- Default scopes: `['email', 'public_profile']`
- Auth URL: `https://www.facebook.com/v18.0/dialog/oauth` with scopes joined by comma
- Token URL: `https://graph.facebook.com/v18.0/oauth/access_token` (GET request, not POST)
- User API: `https://graph.facebook.com/v18.0/me?fields=id,name,email,picture`
- Token is passed as query parameter `access_token`, not in Authorization header
- Always sets `nickname: null` (Facebook does not expose usernames)
- Avatar extracted from `picture.data.url`
- Error response shape: `{ error: { message, type, code } }` (nested object, unlike other providers)

### Twitter/X Provider

```typescript
class TwitterProvider extends AbstractProvider {
  protected baseUrl = 'https://twitter.com'
  protected apiUrl = 'https://api.twitter.com'
  private codeVerifier: string | null = null
}
```

- Config source: `config.services.twitter`
- Default scopes: `['users.read', 'tweet.read']`
- Uses OAuth 2.0 with PKCE (not OAuth 1.0a)
- Auth URL: `https://twitter.com/i/oauth2/authorize` with PKCE code challenge
- Token URL: `https://api.twitter.com/2/oauth2/token` (POST with Basic auth)
- User API: `https://api.twitter.com/2/users/me?user.fields=profile_image_url` with Bearer token
- PKCE implementation uses its own `generateCodeVerifier()` and `generateCodeChallenge()` methods (using `node:crypto` `randomBytes` and `createHash`), not the base class PKCE
- Code verifier: `randomBytes(32)` -> base64 -> alphanumeric only -> max 128 chars
- Token exchange uses Basic auth: `Buffer.from(clientId:clientSecret).toString('base64')`
- `getAccessToken()` throws if `codeVerifier` is null -- `getAuthUrl()` must be called first
- Maps `username` to `nickname`, `profile_image_url` to `avatar`

## SocialUser Interface

```typescript
interface SocialUser {
  id: string
  nickname: string | null
  name: string
  email: string | null
  avatar: string | null
  token: string
  raw?: any               // full provider API response
}
```

## ProviderInterface

```typescript
interface ProviderInterface {
  getAuthUrl: () => Promise<string>
  getAccessToken: (code: string) => Promise<string>
  getUserByToken: (token: string) => Promise<SocialUser>
}
```

## Token Class

```typescript
class Token {
  constructor(
    public accessToken: string,
    public refreshToken: string | null = null,
    public expiresIn: number | null = null,
    public approvedScopes: string[] = [],
  ) {}
}
```

## Provider-Specific Types

```typescript
// GitHub
interface GitHubUser { id: number, login: string, name: string | null, avatar_url: string | null, [key: string]: any }
interface GitHubEmail { email: string, primary: boolean, verified: boolean }
interface GitHubTokenResponse { access_token: string, error?: string, error_description?: string }

// Twitter/X
interface TwitterUser { id: string, username: string, name: string, email?: string, profile_image_url?: string }
interface TwitterTokenResponse { access_token: string, token_type: string, expires_in: number, scope: string, error?: string, error_description?: string }

// Google (local to google.ts)
interface GoogleUser { id: string, email: string, verified_email: boolean, name: string, given_name: string, family_name: string, picture: string, locale: string }
interface GoogleTokenResponse { access_token: string, token_type: string, expires_in: number, error?: string, error_description?: string }

// Facebook (local to facebook.ts)
interface FacebookUser { id: string, email?: string, name: string, picture?: { data: { url: string } } }
interface FacebookTokenResponse { access_token: string, token_type: string, expires_in: number, error?: { message: string, type: string, code: number } }
```

## Exceptions

```typescript
class InvalidStateException extends Error { name = 'InvalidStateException' }
class ConfigException extends Error { name = 'ConfigException' }
```

Providers throw `ConfigException` when `clientId`, `clientSecret`, or `redirectUrl` are missing.

## OAuth2 Flow

### 1. Get Auth URL
```typescript
const github = new GitHubProvider({ clientId: '', clientSecret: '', redirectUrl: '' })
const authUrl = await github.scopes(['user:email', 'read:org']).getAuthUrl()
// Each provider reads actual config from config.services.<provider>
// The constructor config is overridden by getConfig() in each provider
```

### 2. Handle Callback
```typescript
const token = await github.getAccessToken(code)
const user = await github.getUserByToken(token)
// user: { id, nickname, name, email, avatar, token, raw }
```

### 3. User from Existing Token
```typescript
const user = await github.userFromToken(existingToken)
// Calls getUserByToken internally, adds token to result
```

## Configuration Source

All providers read from the Stacks config object:
```typescript
config.services.github   // { clientId, clientSecret, redirectUrl, scopes }
config.services.google   // { clientId, clientSecret, redirectUrl, scopes }
config.services.facebook // { clientId, clientSecret, redirectUrl, scopes }
config.services.twitter  // { clientId, clientSecret, redirectUrl, scopes }
```

Each provider's `getConfig()` method reads these and also calls `this.setScopes()` with the configured scopes.

## Dependencies
- `@stacksjs/api` -- `fetcher` used for all HTTP requests (provides `.withHeaders()`, `.get()`, `.post()`)
- `@stacksjs/config` -- provides `config.services.*` for provider credentials
- `node:buffer` and `node:crypto` -- used by Twitter provider for PKCE and Basic auth

## Gotchas
- The `ProviderConfig` constructor params are largely ignored -- each provider's `getConfig()` reads from `config.services.*` instead
- `getAuthUrl()` returns `Promise<string>` (not `string`) -- it is async
- `getTokenUrl()` is `protected` -- not part of the public `ProviderInterface`
- GitHub joins scopes with space, Facebook with comma, Google with space, Twitter with space
- Facebook uses GET for token exchange; all others use POST
- Facebook `nickname` is always `null`
- Twitter requires `getAuthUrl()` before `getAccessToken()` because the code verifier is stored as instance state
- Twitter uses its own PKCE implementation via `node:crypto`, not the base class `getCodeVerifier()`/`getCodeChallenge()`
- Google auth URL includes `access_type: 'offline'` and `prompt: 'consent'` for refresh token support
- The base class state token is 40 hex chars (20 bytes), not the 20 chars stated in some docs
- `userFromToken()` spreads the user object and adds/overwrites the `token` field
- All providers include the full API response in `SocialUser.raw`
- Errors from GitHub/Google/Twitter are flat objects with `error` + `error_description`; Facebook nests it under `error.message`
