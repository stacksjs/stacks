import type { UserModel } from '@stacksjs/orm'
import type {
  AuthCredentials,
  AuthToken,
  NewAccessToken,
  OAuthClientRow,
  PersonalAccessToken,
  TokenCreateOptions,
  TokenScopes,
} from '@stacksjs/types'
import { config } from '@stacksjs/config'
import { db } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { formatDate, User } from '@stacksjs/orm'
import { request } from '@stacksjs/router'
import { decrypt, encrypt, verifyHash } from '@stacksjs/security'
import { RateLimiter } from './rate-limiter'
import { TokenManager } from './token'

export class Auth {
  private static authUser: UserModel | undefined = undefined
  private static clientSecret: string | undefined = undefined
  private static currentToken: PersonalAccessToken | undefined = undefined

  // ============================================================================
  // INTERNAL HELPERS
  // ============================================================================

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
    if (this.clientSecret)
      return this.clientSecret

    const client = await this.getPersonalAccessClient()
    this.clientSecret = client.secret
    return client.secret
  }

  private static async getPersonalAccessClient(): Promise<OAuthClientRow> {
    try {
      const client = await db.selectFrom('oauth_clients')
        .where('personal_access_client', '=', true)
        .selectAll()
        .executeTakeFirst()

      if (!client)
        throw new HttpError(500, 'No personal access client found. Please run `./buddy auth:setup` first.')

      return client
    }
    catch (error) {
      // Check if the error is due to missing table
      if (error instanceof Error && error.message.includes('does not exist'))
        throw new HttpError(500, 'OAuth tables not found. Please run `./buddy auth:setup` first.')

      throw error
    }
  }

  private static async validateClient(clientId: number, clientSecret: string): Promise<boolean> {
    const client = await db.selectFrom('oauth_clients')
      .where('id', '=', clientId)
      .selectAll()
      .executeTakeFirst()

    if (!client)
      return false

    return client.secret === clientSecret
  }

  private static parseScopes(scopes: string | string[] | null | undefined): TokenScopes {
    if (!scopes)
      return []
    if (Array.isArray(scopes))
      return scopes as TokenScopes
    try {
      const parsed = JSON.parse(scopes)
      return Array.isArray(parsed) ? parsed as TokenScopes : []
    }
    catch {
      return []
    }
  }

  private static async getTokenFromId(tokenId: number): Promise<PersonalAccessToken | null> {
    const token = await db.selectFrom('oauth_access_tokens')
      .where('id', '=', tokenId)
      .selectAll()
      .executeTakeFirst()

    if (!token)
      return null

    return {
      id: token.id,
      userId: token.user_id,
      clientId: token.oauth_client_id,
      name: token.name || 'auth-token',
      abilities: this.parseScopes(token.scopes),
      expiresAt: token.expires_at ? new Date(token.expires_at) : null,
      createdAt: token.created_at ? new Date(token.created_at) : new Date(),
      updatedAt: token.updated_at ? new Date(token.updated_at) : new Date(),
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

    let hashCheck = false
    const user = await User.where('email', '=', email).first()

    const authPass = credentials[password] || ''

    if (user?.password) {
      hashCheck = await verifyHash(authPass, user.password)
    }

    if (!email)
      return false

    if (hashCheck && user) {
      RateLimiter.resetAttempts(email)
      this.authUser = user
      return true
    }

    RateLimiter.recordFailedAttempt(email)
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
    if (!user?.password)
      return false

    const authPass = credentials[password] || ''
    return verifyHash(authPass, user.password, 'bcrypt')
  }

  /**
   * Login and return user with token
   * Similar to Laravel's Auth::login() + token creation
   */
  public static async login(credentials: AuthCredentials, options?: TokenCreateOptions): Promise<{ user: UserModel, token: AuthToken } | null> {
    const isValid = await this.attempt(credentials)
    if (!isValid || !this.authUser)
      return null

    const { plainTextToken } = await this.createTokenForUser(this.authUser, options)
    return { user: this.authUser, token: plainTextToken }
  }

  /**
   * Login a user directly without credentials
   * Similar to Laravel's Auth::loginUsingId()
   */
  public static async loginUsingId(userId: number, options?: TokenCreateOptions): Promise<{ user: UserModel, token: AuthToken } | null> {
    const user = await User.find(userId)
    if (!user)
      return null

    this.authUser = user
    const { plainTextToken } = await this.createTokenForUser(user, options)
    return { user, token: plainTextToken }
  }

  /**
   * Logout the current user
   * Similar to Laravel's Auth::logout()
   */
  public static async logout(): Promise<void> {
    const bearerToken = request.bearerToken()
    if (bearerToken)
      await this.revokeToken(bearerToken)

    this.authUser = undefined
    this.currentToken = undefined
  }

  // ============================================================================
  // USER & AUTH STATE METHODS
  // ============================================================================

  /**
   * Get the currently authenticated user
   * Similar to Laravel's Auth::user()
   */
  public static async user(): Promise<UserModel | undefined> {
    if (this.authUser)
      return this.authUser

    const bearerToken = request.bearerToken()
    if (!bearerToken)
      return undefined

    const user = await this.getUserFromToken(bearerToken)
    if (user)
      this.authUser = user

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
    this.authUser = user
  }

  // ============================================================================
  // TOKEN CREATION METHODS
  // ============================================================================

  /**
   * Create a new personal access token for a user
   * Similar to Laravel Passport's $user->createToken()
   */
  public static async createTokenForUser(
    user: UserModel,
    options?: TokenCreateOptions,
  ): Promise<NewAccessToken> {
    const client = await this.getPersonalAccessClient()
    const clientSecret = await this.getClientSecret()

    const name = options?.name ?? config.auth.defaultTokenName ?? 'auth-token'
    const abilities = options?.abilities ?? config.auth.defaultAbilities ?? ['*']

    // Generate a JWT-like token with embedded metadata
    const token = TokenManager.generateJWT(user.id)

    // Set token expiry
    const expiresAt = options?.expiresAt ?? new Date(Date.now() + (config.auth.tokenExpiry ?? 30 * 24 * 60 * 60 * 1000))

    // Store the token in the database
    const [result] = await db.insertInto('oauth_access_tokens')
      .values({
        user_id: user.id,
        oauth_client_id: client.id,
        name,
        token,
        scopes: JSON.stringify(abilities),
        revoked: false,
        expires_at: formatDate(expiresAt),
      })
      .returning('id')
      .execute()

    const insertId = Number(result?.id)

    if (!insertId)
      throw new HttpError(500, 'Failed to create token')

    // Encrypt the token ID using client secret
    const encryptedId = await encrypt(insertId.toString(), clientSecret)

    // Combine into final token format: token:encryptedId
    const plainTextToken = `${token}:${encryptedId}` as AuthToken

    const accessToken: PersonalAccessToken = {
      id: insertId,
      userId: user.id,
      clientId: client.id,
      name,
      abilities,
      expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
      revoked: false,
      plainTextToken,
    }

    return { accessToken, plainTextToken }
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
    if (!isValid || !this.authUser)
      return null

    return { token: await this.createToken(this.authUser, 'user-auth-token') }
  }

  // ============================================================================
  // TOKEN VALIDATION & RETRIEVAL
  // ============================================================================

  /**
   * Validate a token
   */
  public static async validateToken(token: string): Promise<boolean> {
    const parsed = this.parseToken(token)
    if (!parsed)
      return false

    const { plainToken, encryptedId } = parsed
    const clientSecret = await this.getClientSecret()
    const decryptedId = await decrypt(encryptedId, clientSecret)
    if (!decryptedId)
      return false

    const accessToken = await db.selectFrom('oauth_access_tokens')
      .where('id', '=', Number(decryptedId))
      .selectAll()
      .executeTakeFirst()

    if (!accessToken || accessToken.token !== plainToken)
      return false

    // Check if token is expired
    if (accessToken.expires_at && new Date(accessToken.expires_at) < new Date()) {
      await db.deleteFrom('oauth_access_tokens')
        .where('id', '=', accessToken.id)
        .execute()
      return false
    }

    // Check if token is revoked
    if (accessToken.revoked)
      return false

    // Rotate token if it's been used for more than configured hours
    const rotationHours = config.auth.tokenRotation ?? 24
    const lastUsed = accessToken.updated_at ? new Date(accessToken.updated_at) : new Date()
    const now = new Date()
    const hoursSinceLastUse = (now.getTime() - lastUsed.getTime()) / (1000 * 60 * 60)

    if (hoursSinceLastUse >= rotationHours) {
      await this.rotateToken(token)
    }
    else {
      await db.updateTable('oauth_access_tokens')
        .set({ updated_at: formatDate(now) })
        .where('id', '=', accessToken.id)
        .execute()
    }

    return true
  }

  /**
   * Get user from a token
   */
  public static async getUserFromToken(token: string): Promise<UserModel | undefined> {
    const parsed = this.parseToken(token)
    if (!parsed)
      return undefined

    const { plainToken, encryptedId } = parsed
    const clientSecret = await this.getClientSecret()
    const decryptedId = await decrypt(encryptedId, clientSecret)
    if (!decryptedId)
      return undefined

    const accessToken = await db.selectFrom('oauth_access_tokens')
      .where('id', '=', Number(decryptedId))
      .selectAll()
      .executeTakeFirst()

    if (!accessToken || accessToken.token !== plainToken)
      return undefined

    if (accessToken.expires_at && new Date(accessToken.expires_at) < new Date()) {
      await db.deleteFrom('oauth_access_tokens')
        .where('id', '=', accessToken.id)
        .execute()
      return undefined
    }

    if (accessToken.revoked)
      return undefined

    // Cache the current token for ability checks
    this.currentToken = await this.getTokenFromId(accessToken.id) ?? undefined

    await db.updateTable('oauth_access_tokens')
      .set({ updated_at: formatDate(new Date()) })
      .where('id', '=', accessToken.id)
      .execute()

    if (!accessToken?.user_id)
      return undefined

    return await User.find(accessToken.user_id)
  }

  /**
   * Get the current access token instance
   * Similar to Laravel's $request->user()->currentAccessToken()
   */
  public static async currentAccessToken(): Promise<PersonalAccessToken | undefined> {
    if (this.currentToken)
      return this.currentToken

    const bearerToken = request.bearerToken()
    if (!bearerToken)
      return undefined

    const parsed = this.parseToken(bearerToken)
    if (!parsed)
      return undefined

    const clientSecret = await this.getClientSecret()
    const decryptedId = await decrypt(parsed.encryptedId, clientSecret)
    if (!decryptedId)
      return undefined

    const token = await this.getTokenFromId(Number(decryptedId))
    if (token)
      this.currentToken = token

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
   * Check if current token has ALL specified abilities
   */
  public static async tokenCanAll(abilities: string[]): Promise<boolean> {
    for (const ability of abilities) {
      if (!(await this.tokenCan(ability)))
        return false
    }
    return true
  }

  /**
   * Check if current token has ANY of the specified abilities
   */
  public static async tokenCanAny(abilities: string[]): Promise<boolean> {
    for (const ability of abilities) {
      if (await this.tokenCan(ability))
        return true
    }
    return false
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

    return tokens.map(token => ({
      id: token.id,
      userId: token.user_id,
      clientId: token.oauth_client_id,
      name: token.name || 'auth-token',
      abilities: this.parseScopes(token.scopes),
      expiresAt: token.expires_at ? new Date(token.expires_at) : null,
      createdAt: token.created_at ? new Date(token.created_at) : new Date(),
      updatedAt: token.updated_at ? new Date(token.updated_at) : new Date(),
      revoked: !!token.revoked,
    }))
  }

  /**
   * Revoke a specific token
   */
  public static async revokeToken(token: string): Promise<void> {
    const parsed = this.parseToken(token)
    if (!parsed)
      return

    const clientSecret = await this.getClientSecret()
    const decryptedId = await decrypt(parsed.encryptedId, clientSecret)
    if (!decryptedId)
      return

    await db.updateTable('oauth_access_tokens')
      .set({ revoked: true, updated_at: formatDate(new Date()) })
      .where('id', '=', Number(decryptedId))
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
   * Rotate (refresh) a token
   */
  public static async rotateToken(oldToken: string): Promise<AuthToken | null> {
    const parsed = this.parseToken(oldToken)
    if (!parsed)
      return null

    const { plainToken, encryptedId } = parsed
    const clientSecret = await this.getClientSecret()
    const decryptedId = await decrypt(encryptedId, clientSecret)
    if (!decryptedId)
      return null

    const accessToken = await db.selectFrom('oauth_access_tokens')
      .where('id', '=', Number(decryptedId))
      .selectAll()
      .executeTakeFirst()

    if (!accessToken || accessToken.token !== plainToken)
      return null

    // Generate new JWT token
    const newToken = TokenManager.generateJWT(accessToken.user_id)

    // Update the token
    await db.updateTable('oauth_access_tokens')
      .set({
        token: newToken,
        updated_at: formatDate(new Date()),
      })
      .where('id', '=', accessToken.id)
      .execute()

    // Return new token with encrypted ID
    const newEncryptedId = await encrypt(accessToken.id.toString(), clientSecret)
    return `${newToken}:${newEncryptedId}` as AuthToken
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
    if (!user?.password)
      return false

    const authPass = credentials[password] || ''
    const hashCheck = await verifyHash(authPass, user.password, 'bcrypt')

    if (hashCheck) {
      this.authUser = user
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
   * Clear the auth state (useful for testing)
   */
  public static clearState(): void {
    this.authUser = undefined
    this.currentToken = undefined
    this.clientSecret = undefined
  }
}
