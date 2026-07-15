
type UserModel = NonNullable<Awaited<ReturnType<typeof User.find>>>
import type {
  AuthCredentials,
  AuthToken,
  NewAccessToken,
  OAuthClientRow,
  PersonalAccessToken,
  TokenCreateOptions,
} from '@stacksjs/types'
import { config } from '@stacksjs/config'
import { db } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import type { EnhancedRequest } from '@stacksjs/bun-router'
import { formatDate, User } from '@stacksjs/orm'
import { getCurrentRequest, request } from '@stacksjs/router'
import { Buffer } from 'node:buffer'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { decrypt, encrypt, verifyHash } from '@stacksjs/security'
import { log } from '@stacksjs/logging'
import { DUMMY_BCRYPT_HASH } from './internal-constants'
import { RateLimiter } from './rate-limiter'

/**
 * Per-request auth state, scoped to the active `EnhancedRequest` via
 * a Symbol-keyed slot on the request object. Replaces the three
 * `private static` fields on `Auth` (`authUser`, `currentToken`,
 * `clientSecret`) that were shared across every concurrent request
 * in the process — a textbook cross-tenant state-leak vector.
 *
 * The container is lazily allocated on first read inside a request
 * scope. Outside a request scope (CLI scripts, queued jobs, tests
 * that don't call `runWithRequest`) `authStateOrNull()` returns
 * `null`, which the `Auth` methods interpret as "no caching" — every
 * lookup hits the DB. See stacksjs/stacks#1860 A-2.
 */
interface RequestAuthState {
  authUser?: UserModel
  currentToken?: PersonalAccessToken
  clientSecret?: string
}

const REQUEST_AUTH_STATE_KEY = Symbol.for('stacks.requestAuthState')

function authStateOrNull(): RequestAuthState | null {
  const req = getCurrentRequest() as (EnhancedRequest & { [k: symbol]: unknown }) | undefined
  if (!req) return null
  let state = req[REQUEST_AUTH_STATE_KEY] as RequestAuthState | undefined
  if (!state) {
    state = {}
    ;(req as Record<symbol, unknown>)[REQUEST_AUTH_STATE_KEY] = state
  }
  return state
}

/**
 * Hash a token using SHA-256 before storing in the database.
 * The plain token is returned to the user; only the hash is persisted.
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
import { createToken as createRawToken, getPasswordChangedAt, isIssuedBeforePasswordChange, parseScopes } from './tokens'

export class Auth {
  // Per-request state lives on the request object via `authStateOrNull()`
  // (stacksjs/stacks#1860 A-2). The previous `private static` fields
  // (`authUser`, `currentToken`, `clientSecret`) were shared across
  // every concurrent request in the process — a cross-request leak
  // where one request's user could surface in another's `Auth.user()`
  // call if the second request raced the first's middleware.

  // ============================================================================
  // INTERNAL HELPERS
  // ============================================================================

  /**
   * Get bearer token from the current request
   */
  private static getBearerToken(): string | null {
    // Try to get bearer token from request method
    let bearerToken = request.bearerToken?.()

    // Fallback: get directly from Authorization header
    if (!bearerToken) {
      const authHeader = request.headers?.get?.('authorization') || request.headers?.get?.('Authorization')
      if (authHeader && authHeader.startsWith('Bearer ')) {
        bearerToken = authHeader.substring(7)
      }
    }

    return bearerToken || null
  }

  /**
   * Parse a token string into its components
   * Token format: {jwt}:{encryptedId} where encryptedId may contain colons
   */
  private static parseToken(token: string): { plainToken: string, encryptedId: string } | null {
    const firstColonIndex = token.indexOf(':')
    if (firstColonIndex === -1)
      return null

    const plainToken = token.substring(0, firstColonIndex)
    const encryptedId = token.substring(firstColonIndex + 1)

    if (!plainToken || !encryptedId)
      return null

    return { plainToken, encryptedId }
  }

  private static async getClientSecret(): Promise<string> {
    const state = authStateOrNull()
    if (state?.clientSecret)
      return state.clientSecret

    const client = await this.getPersonalAccessClient()
    if (state) state.clientSecret = client.secret
    return client.secret
  }

  /**
   * Encrypt the bearer token's embedded numeric DB id.
   *
   * Uses the framework-wide `config.app.key` as the passphrase rather
   * than the OAuth client's secret (the old behaviour). Two reasons:
   *
   *   1. Decouples token encryption from the secret, so the secret
   *      can be hashed at rest (stacksjs/stacks#1861 M-1).
   *   2. Removes the static `Auth.clientSecret` cache from the hot
   *      path of every token mint/verify.
   *
   * Tokens minted before the change decrypt via {@link decryptTokenId}'s
   * fallback path.
   */
  private static async encryptTokenId(id: string | number): Promise<string> {
    return await encrypt(String(id))
  }

  /**
   * Decrypt a bearer-token-embedded id with backward-compat for tokens
   * minted before the key swap. Returns the plaintext id string on
   * success or `null` on failure; never throws.
   */
  private static async decryptTokenId(encryptedId: string): Promise<string | null> {
    try {
      return await decrypt(encryptedId)
    }
    catch {
      // Backward-compat: tokens minted before stacksjs/stacks#1861 M-1
      // were encrypted with the OAuth client's plaintext secret as the
      // passphrase. Try that once so existing sessions survive the
      // upgrade. After every active session naturally rotates onto
      // the new key, this branch can be deleted.
      try {
        const clientSecret = await this.getClientSecret()
        return await decrypt(encryptedId, clientSecret)
      }
      catch {
        return null
      }
    }
  }

  private static async getPersonalAccessClient(): Promise<OAuthClientRow> {
    try {
      const client = await db.selectFrom('oauth_clients')
        .where('personal_access_client', '=', true)
        .where('revoked', '=', false)
        .selectAll()
        .executeTakeFirst()

      if (!client)
        throw new HttpError(500, 'No personal access client found. Please run `./buddy auth:setup` first.')

      return client as unknown as OAuthClientRow
    }
    catch (error) {
      // Check if the error is due to missing table
      if (error instanceof Error && error.message.includes('does not exist'))
        throw new HttpError(500, 'OAuth tables not found. Please run `./buddy auth:setup` first.')

      throw error
    }
  }

  private static async validateClient(clientId: number, clientSecret: string): Promise<boolean> {
    // Filter by `revoked = false` at the DB layer so a revoked client
    // can't validate even with a correct secret. The previous code
    // only checked secret equality, so `revokeClient()` flips
    // `oauth_clients.revoked = true` but `requestToken` continued to
    // mint tokens for the revoked client. See stacksjs/stacks#1860 H-4.
    const client = await db.selectFrom('oauth_clients')
      .where('id', '=', clientId)
      .where('revoked', '=', false)
      .selectAll()
      .executeTakeFirst()

    // Always run a `timingSafeEqual` against a fixed buffer so the
    // missing-client and wrong-secret branches spend the same CPU.
    // Without the dummy compare, an attacker could probe valid client
    // IDs by observing response-time differences between "client
    // missing" (fast) and "client found, secret wrong" (slow). See
    // stacksjs/stacks#1861 L-2.
    const provided = Buffer.from(clientSecret)
    if (!client?.secret) {
      const dummy = Buffer.alloc(Math.max(provided.length, 1))
      const padded = provided.length > 0 ? provided : Buffer.alloc(1)
      timingSafeEqual(dummy, padded)
      return false
    }

    const stored = String(client.secret)

    // bcrypt hashes always start with `$2`. Rows inserted before
    // stacksjs/stacks#1861 M-1 hold the plaintext secret and don't
    // match that prefix; rows inserted after hold the bcrypt hash.
    // verifyHash handles the secure compare for the hashed path;
    // legacy plaintext rows fall through to the existing
    // timing-safe byte comparison so they keep working until the
    // operator re-issues the client secret.
    if (stored.startsWith('$2')) {
      return await verifyHash(clientSecret, stored)
    }

    const storedBuf = Buffer.from(stored)
    if (storedBuf.length !== provided.length) {
      timingSafeEqual(storedBuf, storedBuf)
      return false
    }
    return timingSafeEqual(storedBuf, provided)
  }

  private static async getTokenFromId(tokenId: number): Promise<PersonalAccessToken | null> {
    const result = await db.selectFrom('oauth_access_tokens')
      .where('id', '=', tokenId)
      .selectAll()
      .executeTakeFirst()

    if (!result)
      return null

    const token = result as Record<string, unknown>

    return {
      id: token.id as number,
      userId: token.user_id as number,
      clientId: token.oauth_client_id as number,
      name: (token.name as string) || 'auth-token',
      scopes: parseScopes(token.scopes as string),
      abilities: parseScopes(token.scopes as string),
      expiresAt: token.expires_at ? new Date(String(token.expires_at)) : null,
      createdAt: token.created_at ? new Date(String(token.created_at)) : new Date(),
      updatedAt: token.updated_at ? new Date(String(token.updated_at)) : new Date(),
      revoked: !!token.revoked,
    }
  }

  // ============================================================================
  // AUTHENTICATION METHODS
  // ============================================================================

  /**
   * Attempt to authenticate with credentials
   * Similar to Laravel's Auth::attempt()
   */
  public static async attempt(credentials: AuthCredentials): Promise<boolean> {
    const username = config.auth.username || 'email'
    const password = config.auth.password || 'password'

    const email = credentials[username]

    // Validate email first to avoid unnecessary work and prevent timing leaks
    if (!email)
      return false

    // Per-email lockout enforcement. Without this check the framework
    // recorded failed attempts but never actually refused new ones, so
    // an attacker who'd burned through MAX_ATTEMPTS could keep trying.
    // The per-IP throttle middleware on /api/auth/login is the first
    // line; this is the second (in case the attacker rotates IPs but
    // keeps targeting one inbox).
    const isRateLimited = await RateLimiter.isRateLimited(email)

    const user = await User.where('email', '=', email).first()
    const authPass = credentials[password] || ''

    // Always run hash verification to prevent timing-based user enumeration
    // AND to close the lockout-timing oracle (stacksjs/stacks#1860 H-9):
    // the previous early-return on rate-limit skipped the hash entirely,
    // so an attacker could distinguish "locked out" (fast response) from
    // "wrong password" (slow bcrypt) and confirm which accounts they'd
    // already triggered the lockout on. Running the hash unconditionally
    // makes both paths spend the same CPU.
    const hashToVerify = user?.password || DUMMY_BCRYPT_HASH
    const hashCheck = await verifyHash(authPass, hashToVerify)

    // If the account is currently locked out, refuse — AFTER the dummy
    // hash above so the response timing matches the wrong-password branch.
    if (isRateLimited)
      return false

    if (hashCheck && user) {
      await RateLimiter.resetAttempts(email)
      const state = authStateOrNull()
      if (state) state.authUser = user
      return true
    }

    await RateLimiter.recordFailedAttempt(email)
    return false
  }

  /**
   * Validate credentials without logging in
   * Similar to Laravel's Auth::validate()
   */
  public static async validate(credentials: AuthCredentials): Promise<boolean> {
    const username = config.auth.username || 'email'
    const password = config.auth.password || 'password'

    const email = credentials[username]
    if (!email)
      return false

    const user = await User.where('email', '=', email).first()
    const authPass = credentials[password] || ''

    // Always run hash verification to prevent timing-based user enumeration
    const hashToVerify = user?.password || DUMMY_BCRYPT_HASH
    const hashCheck = await verifyHash(authPass, hashToVerify)

    return hashCheck && !!user
  }

  /**
   * Login and return user with token
   * Similar to Laravel's Auth::login() + token creation
   *
   * Returns both an access token and a paired refresh token (unless the
   * caller opts out via `options.withRefreshToken: false`). The access
   * token has the standard short-lived expiry; the refresh token is
   * single-use and rotates on every `/auth/refresh` exchange.
   */
  public static async login(credentials: AuthCredentials, options?: TokenCreateOptions): Promise<
    { user: UserModel, token: AuthToken, refreshToken?: string, expiresIn?: number } | null
  > {
    const isValid = await this.attempt(credentials)
    const authedUser = authStateOrNull()?.authUser
    if (!isValid || !authedUser)
      return null

    const { plainTextToken, refreshToken, expiresIn } = await this.createTokenForUser(authedUser, options)
    return { user: authedUser, token: plainTextToken, refreshToken, expiresIn }
  }

  /**
   * Login a user directly without credentials
   * Similar to Laravel's Auth::loginUsingId()
   */
  public static async loginUsingId(userId: number, options?: TokenCreateOptions): Promise<
    { user: UserModel, token: AuthToken, refreshToken?: string, expiresIn?: number } | null
  > {
    const user = await User.find(userId)
    if (!user)
      return null

    const state = authStateOrNull()
    if (state) state.authUser = user
    const { plainTextToken, refreshToken, expiresIn } = await this.createTokenForUser(user, options)
    return { user, token: plainTextToken, refreshToken, expiresIn }
  }

  /**
   * Logout the current user
   * Similar to Laravel's Auth::logout()
   *
   * Revokes the current access token AND its paired refresh token so a
   * leaked-but-not-yet-rotated refresh can't be used to mint a new
   * access token after the user has signed out.
   */
  public static async logout(): Promise<void> {
    const bearerToken = this.getBearerToken()

    if (bearerToken) {
      // Find the access-token row by hashed bearer so we can cascade-
      // revoke any refresh tokens before the access row itself.
      // Same raw-hex lookup as `validateToken` / `getUserFromToken` —
      // see their doc comments for the createTokenForUser refactor
      // context (stacksjs/stacks#1867).
      const accessToken = await db.selectFrom('oauth_access_tokens')
        .where('token', '=', hashToken(bearerToken))
        .select(['id'])
        .executeTakeFirst()
      if (accessToken) {
        await db.updateTable('oauth_refresh_tokens')
          .set({ revoked: true })
          .where('access_token_id', '=', Number(accessToken.id))
          .execute()
      }
      await this.revokeToken(bearerToken)
    }

    const state = authStateOrNull()
    if (state) {
      state.authUser = undefined
      state.currentToken = undefined
    }
  }

  // ============================================================================
  // USER & AUTH STATE METHODS
  // ============================================================================

  /**
   * Get the currently authenticated user
   * Similar to Laravel's Auth::user()
   */
  public static async user(): Promise<UserModel | undefined> {
    const state = authStateOrNull()
    if (state?.authUser)
      return state.authUser

    const bearerToken = this.getBearerToken()
    if (!bearerToken)
      return undefined

    const user = await this.getUserFromToken(bearerToken)
    if (user && state)
      state.authUser = user

    return user
  }

  /**
   * Check if a user is authenticated
   * Similar to Laravel's Auth::check()
   */
  public static async check(): Promise<boolean> {
    const user = await this.user()
    return user !== undefined
  }

  /**
   * Check if the current user is a guest (not authenticated)
   * Similar to Laravel's Auth::guest()
   */
  public static async guest(): Promise<boolean> {
    return !(await this.check())
  }

  /**
   * Get the authenticated user's ID
   * Similar to Laravel's Auth::id()
   */
  public static async id(): Promise<number | undefined> {
    const user = await this.user()
    return user?.id
  }

  /**
   * Set the authenticated user (useful for testing)
   * Similar to Laravel's Auth::setUser()
   */
  public static setUser(user: UserModel): void {
    const state = authStateOrNull()
    if (state) state.authUser = user
  }

  // ============================================================================
  // TOKEN CREATION METHODS
  // ============================================================================

  /**
   * Create a new personal access token for a user
   * Similar to Laravel Passport's $user->createToken()
   *
   * Default behaviour issues both an access token (1h) and a paired
   * refresh token (30d). Pass `options.withRefreshToken: false` to opt
   * out — useful for one-shot machine tokens that should never be
   * refreshed. Expiry windows come from `config.auth.tokenExpiry` and
   * `config.auth.refreshTokenExpiry` unless overridden via
   * `options.expiresInMinutes` / `options.refreshExpiresInDays` /
   * `options.expiresAt`.
   */
  public static async createTokenForUser(
    user: UserModel,
    options?: TokenCreateOptions,
  ): Promise<NewAccessToken> {
    const name = options?.name ?? config.auth.defaultTokenName ?? 'auth-token'
    const abilities = options?.abilities ?? options?.scopes ?? config.auth.defaultAbilities ?? ['*']

    // Resolve access-token TTL. Precedence: explicit options.expiresAt
    // → options.expiresInMinutes → config default (1h).
    const accessTtlMs = options?.expiresInMinutes !== undefined
      ? options.expiresInMinutes * 60 * 1000
      : (config.auth.tokenExpiry ?? 60 * 60 * 1000)
    const explicitExpiresAt = options?.expiresAt
    const expiresAt = explicitExpiresAt ?? new Date(Date.now() + accessTtlMs)
    const expiresInMinutes = Math.max(1, Math.floor((expiresAt.getTime() - Date.now()) / (60 * 1000)))
    const refreshExpiresInDays = options?.refreshExpiresInDays
      ?? Math.max(1, Math.round((config.auth.refreshTokenExpiry ?? 30 * 24 * 60 * 60 * 1000) / (24 * 60 * 60 * 1000)))

    log.debug(`[auth] Creating token for user#${user.id}: ${name}`)

    // Delegate to the canonical `tokens.ts:createToken` so the bearer
    // shape is the raw 40-byte hex used throughout the framework
    // (`tokens.ts:findToken`, `revokeToken`, `currentAccessToken`,
    // `tokenCan`, …). Previously this method emitted a separate
    // `${jwt}:${encryptedId}` shape that the `tokens.ts` helpers
    // couldn't resolve — `revokeOtherTokens` then degraded into
    // `revokeAllTokens` for any Auth-minted session. See
    // stacksjs/stacks#1867.
    const result = await createRawToken(
      user.id as number,
      name,
      abilities,
      {
        expiresInMinutes,
        withRefreshToken: options?.withRefreshToken !== false,
        refreshExpiresInDays,
      },
    )

    const plainTextToken = result.plainTextToken as AuthToken
    const accessToken: PersonalAccessToken = {
      id: result.accessToken.id,
      userId: result.accessToken.userId,
      clientId: result.accessToken.clientId,
      name: result.accessToken.name,
      scopes: result.accessToken.scopes,
      abilities,
      expiresAt: result.accessToken.expiresAt ?? expiresAt,
      createdAt: result.accessToken.createdAt,
      updatedAt: result.accessToken.updatedAt,
      revoked: result.accessToken.revoked,
      plainTextToken,
    }

    return {
      accessToken,
      plainTextToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
    }
  }

  /**
   * Create a token (legacy method for backwards compatibility)
   */
  public static async createToken(
    user: UserModel,
    name: string = config.auth.defaultTokenName || 'auth-token',
    abilities: string[] = config.auth.defaultAbilities || ['*'],
  ): Promise<AuthToken> {
    const { plainTextToken } = await this.createTokenForUser(user, { name, abilities })
    return plainTextToken
  }

  /**
   * Request token using client credentials
   * Similar to Laravel Passport's client credentials grant
   */
  public static async requestToken(credentials: AuthCredentials, clientId: number, clientSecret: string): Promise<{ token: AuthToken } | null> {
    const isValidClient = await this.validateClient(clientId, clientSecret)
    if (!isValidClient)
      throw new HttpError(401, 'Invalid client credentials')

    const isValid = await this.attempt(credentials)
    const authedUser = authStateOrNull()?.authUser
    if (!isValid || !authedUser)
      return null

    return { token: await this.createToken(authedUser, 'user-auth-token') }
  }

  // ============================================================================
  // TOKEN VALIDATION & RETRIEVAL
  // ============================================================================

  /**
   * Validate a token.
   *
   * Looks up the access-token row by the hashed plaintext bearer. The
   * `createTokenForUser` path (and `tokens.ts:createToken` it delegates
   * to) emits raw 40-byte hex bearers — no `${jwt}:${encryptedId}`
   * envelope. The previous parseToken + decryptTokenId chain was left
   * behind here after `createTokenForUser` switched
   * (see stacksjs/stacks#1867), so every issued bearer was unparseable
   * on the read side and validation always returned false. Going
   * straight to a hashed-token lookup mirrors `tokens.ts:findToken`.
   */
  public static async validateToken(token: string): Promise<boolean> {
    const hashedPlainToken = hashToken(token)
    const accessToken = await db.selectFrom('oauth_access_tokens')
      .where('token', '=', hashedPlainToken)
      .selectAll()
      .executeTakeFirst()

    if (!accessToken)
      return false

    log.debug(`[auth] Token validated for token#${accessToken.id}`)

    // Check if token is expired
    if (accessToken.expires_at && new Date(String(accessToken.expires_at)) < new Date()) {
      await db.deleteFrom('oauth_access_tokens')
        .where('id', '=', accessToken.id)
        .execute()
      return false
    }

    // Check if token is revoked
    if (accessToken.revoked)
      return false

    // Reject tokens issued before the user last changed their password
    // (stacksjs/stacks#1957). Binds validity to the durable users row,
    // so a stolen token survives neither a reset nor the sweep gap.
    if (isIssuedBeforePasswordChange(accessToken.created_at, await getPasswordChangedAt(accessToken.user_id)))
      return false

    // Mark the token as freshly-used. Used to be a rotation path here
    // (`if (hoursSinceLastUse >= 24h) await this.rotateToken(token)`)
    // but the rotated bearer was **discarded** by the caller —
    // `validateToken` only returns a boolean — so the DB hash got
    // replaced with the new token's hash while the user's bearer was
    // still the old one. Every subsequent request then failed auth.
    // Rotation is now an explicit `Auth.rotateToken(oldToken)` call
    // available to userland: callers (e.g., an `/auth/refresh`
    // endpoint) take the new bearer and return it to the client in
    // the response. See stacksjs/stacks#1860 A-3.
    await db.updateTable('oauth_access_tokens')
      .set({ updated_at: formatDate(new Date()) })
      .where('id', '=', accessToken.id)
      .execute()

    return true
  }

  /**
   * Get user from a token. Uses the same raw-hex hashed lookup as
   * `validateToken` — see its doc for context on why parseToken +
   * decryptTokenId was removed (stacksjs/stacks#1867 follow-up).
   */
  public static async getUserFromToken(token: string): Promise<UserModel | undefined> {
    const hashedPlainToken = hashToken(token)
    const accessToken = await db.selectFrom('oauth_access_tokens')
      .where('token', '=', hashedPlainToken)
      .selectAll()
      .executeTakeFirst()

    if (!accessToken)
      return undefined

    if (accessToken.expires_at && new Date(String(accessToken.expires_at)) < new Date()) {
      await db.deleteFrom('oauth_access_tokens')
        .where('id', '=', accessToken.id)
        .execute()
      return undefined
    }

    if (accessToken.revoked)
      return undefined

    // Cache the current token for ability checks (per-request).
    const stateForToken = authStateOrNull()
    if (stateForToken)
      stateForToken.currentToken = await this.getTokenFromId(accessToken.id as number) ?? undefined

    await db.updateTable('oauth_access_tokens')
      .set({ updated_at: formatDate(new Date()) })
      .where('id', '=', accessToken.id)
      .execute()

    if (!accessToken?.user_id)
      return undefined

    const user = await User.find(accessToken.user_id as number)

    // Reject tokens issued before the user last changed their password
    // (stacksjs/stacks#1957). The previous code read
    // `(user as any).password_changed_at` off the ORM instance, but that
    // column is undeclared (added by a defensive ALTER in auth-tables, not
    // part of the model schema), so the ORM never exposes it as a bare
    // property — the read was ALWAYS undefined and this backstop was inert
    // on the primary `authMiddleware` / `Auth.user()` path while the
    // `validateToken` path (query-backed) worked. Query the durable users
    // row exactly like `validateToken`; getPasswordChangedAt degrades to
    // legacy-allow on a missing column/table. See stacksjs/stacks#1985.
    if (isIssuedBeforePasswordChange(accessToken.created_at, await getPasswordChangedAt(accessToken.user_id)))
      return undefined

    return user
  }

  /**
   * Get the current access token instance
   * Similar to Laravel's $request->user()->currentAccessToken()
   */
  public static async currentAccessToken(): Promise<PersonalAccessToken | undefined> {
    const state = authStateOrNull()
    if (state?.currentToken)
      return state.currentToken

    const bearerToken = this.getBearerToken()
    if (!bearerToken)
      return undefined

    // Raw-hex lookup matches the createTokenForUser bearer shape — no
    // parseToken / decryptTokenId envelope. See `validateToken`'s
    // doc for context (stacksjs/stacks#1867 follow-up).
    const accessToken = await db.selectFrom('oauth_access_tokens')
      .where('token', '=', hashToken(bearerToken))
      .select(['id'])
      .executeTakeFirst()
    if (!accessToken)
      return undefined

    const token = await this.getTokenFromId(Number(accessToken.id))
    if (token && state)
      state.currentToken = token

    return token ?? undefined
  }

  // ============================================================================
  // TOKEN ABILITIES / SCOPES
  // ============================================================================

  /**
   * Check if current token has an ability
   * Similar to Laravel's $request->user()->tokenCan()
   */
  public static async tokenCan(ability: string): Promise<boolean> {
    const token = await this.currentAccessToken()
    if (!token)
      return false

    // Wildcard ability grants all permissions
    if (token.abilities.includes('*'))
      return true

    return token.abilities.includes(ability)
  }

  /**
   * Check if current token does NOT have an ability
   * Similar to Laravel's $request->user()->tokenCant()
   */
  public static async tokenCant(ability: string): Promise<boolean> {
    return !(await this.tokenCan(ability))
  }

  /**
   * Get all abilities for the current token
   */
  public static async tokenAbilities(): Promise<string[]> {
    const token = await this.currentAccessToken()
    return token?.abilities ?? []
  }

  /**
   * Check if current token has ALL specified abilities.
   *
   * Fetches the token once and checks abilities locally. The previous
   * implementation re-called `tokenCan(ability)` per iteration, which
   * re-fetched the token from the DB on every cache miss
   * (stacksjs/stacks#1860 M-4).
   */
  public static async tokenCanAll(abilities: string[]): Promise<boolean> {
    const token = await this.currentAccessToken()
    if (!token) return false
    if (token.abilities.includes('*')) return true
    return abilities.every(a => token.abilities.includes(a))
  }

  /**
   * Check if current token has ANY of the specified abilities. Same
   * single-fetch optimization as `tokenCanAll` (stacksjs/stacks#1860 M-4).
   */
  public static async tokenCanAny(abilities: string[]): Promise<boolean> {
    const token = await this.currentAccessToken()
    if (!token) return false
    if (token.abilities.includes('*')) return true
    return abilities.some(a => token.abilities.includes(a))
  }

  // ============================================================================
  // TOKEN MANAGEMENT
  // ============================================================================

  /**
   * Get all tokens for a user
   * Similar to Laravel's $user->tokens()
   */
  public static async tokens(userId?: number): Promise<PersonalAccessToken[]> {
    const uid = userId ?? (await this.id())
    if (!uid)
      return []

    const tokens = await db.selectFrom('oauth_access_tokens')
      .where('user_id', '=', uid)
      .where('revoked', '=', false)
      .selectAll()
      .execute()

    return tokens.map((token: Record<string, unknown>) => ({
      id: Number(token.id),
      userId: Number(token.user_id),
      clientId: Number(token.oauth_client_id),
      name: String(token.name || 'auth-token'),
      scopes: parseScopes(String(token.scopes ?? '')),
      abilities: parseScopes(String(token.scopes ?? '')),
      expiresAt: token.expires_at ? new Date(String(token.expires_at)) : null,
      createdAt: token.created_at ? new Date(String(token.created_at)) : new Date(),
      updatedAt: token.updated_at ? new Date(String(token.updated_at)) : new Date(),
      revoked: !!token.revoked,
    }))
  }

  /**
   * Revoke a specific token. Raw-hex hashed lookup matches the bearer
   * shape `createTokenForUser` actually emits — see `validateToken`
   * for context on why parseToken / decryptTokenId aren't used here
   * anymore (stacksjs/stacks#1867 follow-up).
   */
  public static async revokeToken(token: string): Promise<void> {
    await db.updateTable('oauth_access_tokens')
      .set({ revoked: true, updated_at: formatDate(new Date()) })
      .where('token', '=', hashToken(token))
      .execute()
  }

  /**
   * Revoke a token by its ID
   */
  public static async revokeTokenById(tokenId: number): Promise<void> {
    await db.updateTable('oauth_access_tokens')
      .set({ revoked: true, updated_at: formatDate(new Date()) })
      .where('id', '=', tokenId)
      .execute()
  }

  /**
   * Revoke all tokens for a user
   * Similar to deleting all tokens via $user->tokens()->delete()
   */
  public static async revokeAllTokens(userId?: number): Promise<void> {
    const uid = userId ?? (await this.id())
    if (!uid)
      return

    await db.updateTable('oauth_access_tokens')
      .set({ revoked: true, updated_at: formatDate(new Date()) })
      .where('user_id', '=', uid)
      .execute()
  }

  /**
   * Revoke all tokens except the current one
   */
  public static async revokeOtherTokens(userId?: number): Promise<void> {
    const uid = userId ?? (await this.id())
    if (!uid)
      return

    const currentToken = await this.currentAccessToken()
    if (!currentToken)
      return

    await db.updateTable('oauth_access_tokens')
      .set({ revoked: true, updated_at: formatDate(new Date()) })
      .where('user_id', '=', uid)
      .where('id', '!=', currentToken.id)
      .execute()
  }

  /**
   * Delete all expired tokens (cleanup)
   */
  public static async pruneExpiredTokens(): Promise<number> {
    const result = await db.deleteFrom('oauth_access_tokens')
      .where('expires_at', '<', formatDate(new Date()))
      .executeTakeFirst()

    return Number(result?.numDeletedRows) || 0
  }

  /**
   * Delete all revoked tokens (cleanup)
   */
  public static async pruneRevokedTokens(): Promise<number> {
    const result = await db.deleteFrom('oauth_access_tokens')
      .where('revoked', '=', true)
      .executeTakeFirst()

    return Number(result?.numDeletedRows) || 0
  }

  /**
   * Rotate (refresh) a bearer.
   *
   * Revokes the old token and mints a fresh one with the same name +
   * abilities + remaining-lifetime expiry. Returns the new bearer
   * (raw shape from `tokens.ts:createToken`) or `null` when the old
   * bearer didn't match a live row.
   *
   * Accepts both bearer shapes: the legacy `${jwt}:${encryptedId}`
   * form (via `bearerLookupHash` in `tokens.ts`) and the canonical
   * raw form (stacksjs/stacks#1867).
   */
  public static async rotateToken(oldToken: string): Promise<AuthToken | null> {
    // Look up the existing row through `findToken` so the legacy
    // jwt:encryptedId shape resolves via `bearerLookupHash`.
    const { findToken: findRawToken, revokeToken: revokeRawToken } = await import('./tokens')
    const existing = await findRawToken(oldToken)
    if (!existing) return null

    const remainingMs = existing.expiresAt ? existing.expiresAt.getTime() - Date.now() : (config.auth.tokenExpiry ?? 60 * 60 * 1000)
    const expiresInMinutes = Math.max(1, Math.floor(remainingMs / (60 * 1000)))

    // Revoke the old row before minting the new one. Sequencing
    // matters: a crash between the two leaves the user without a
    // valid token but doesn't leave a stale shadow row.
    await revokeRawToken(oldToken)

    // Mint a fresh token via the canonical path so the new bearer
    // matches the raw shape used by every helper in tokens.ts.
    const user = await User.find(existing.userId as number)
    if (!user) return null
    const result = await this.createTokenForUser(user, {
      name: existing.name,
      abilities: existing.scopes ?? ['*'],
      expiresInMinutes,
      withRefreshToken: false,
    })

    return result.plainTextToken
  }

  /**
   * Find a token by its ID
   */
  public static async findToken(tokenId: number): Promise<PersonalAccessToken | null> {
    return this.getTokenFromId(tokenId)
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Once - Authenticate a user for a single request
   * Similar to Laravel's Auth::once()
   */
  public static async once(credentials: AuthCredentials): Promise<boolean> {
    const username = config.auth.username || 'email'
    const password = config.auth.password || 'password'

    const email = credentials[username]
    if (!email)
      return false

    const user = await User.where('email', '=', email).first()
    const authPass = credentials[password] || ''

    // Always run hash verification to prevent timing-based user enumeration
    const hashToVerify = user?.password || DUMMY_BCRYPT_HASH
    const hashCheck = await verifyHash(authPass, hashToVerify)

    if (hashCheck && user) {
      const state = authStateOrNull()
      if (state) state.authUser = user
      return true
    }

    return false
  }

  /**
   * Get the auth guard name (for compatibility)
   */
  public static guard(_name?: string): typeof Auth {
    // Currently we only support the API guard
    return this
  }

  /**
   * Check if user was authenticated via remember token (always false for API)
   */
  public static viaRemember(): boolean {
    return false
  }

  /**
   * Clear the auth state on the active request (useful for testing).
   * No-op outside a request scope — there's no shared state to clear
   * after stacksjs/stacks#1860 A-2 moved the fields onto the request.
   */
  public static clearState(): void {
    const state = authStateOrNull()
    if (state) {
      state.authUser = undefined
      state.currentToken = undefined
      state.clientSecret = undefined
    }
  }
}
