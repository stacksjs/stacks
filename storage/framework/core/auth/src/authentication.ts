import type { UserJsonResponse, OauthClientJsonResponse } from '@stacksjs/orm'
import type { AuthToken } from './token'
import { randomBytes } from 'node:crypto'
import { config } from '@stacksjs/config'
import { db } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { formatDate } from '@stacksjs/orm'
import { request } from '@stacksjs/router'
import { makeHash, verifyHash, encrypt, decrypt } from '@stacksjs/security'
import { RateLimiter } from './rate-limiter'
import { TokenManager } from './token'

interface Credentials {
  password: string | undefined
  email: string | undefined
  [key: string]: string | undefined
}

export class Authentication {
  private static authUser: UserJsonResponse | undefined = undefined
  private static clientSecret: string | undefined = undefined

  private static async getClientSecret(): Promise<string> {
    if (this.clientSecret)
      return this.clientSecret

    const client = await this.getPersonalAccessClient()
    this.clientSecret = client.secret
    return client.secret
  }

  private static async getPersonalAccessClient(): Promise<OauthClientJsonResponse> {
    const client = await db.selectFrom('oauth_clients')
      .where('personal_access_client', '=', true)
      .selectAll()
      .executeTakeFirst()

    if (!client)
      throw new HttpError(500, 'No personal access client found. Please run `./buddy auth:token` to create a personal access client.')

    return client
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

  public static async attempt(credentials: Credentials): Promise<boolean> {
    const username = config.auth.username || 'email'
    const password = config.auth.password || 'password'

    const email = credentials[username]

    if (!email || typeof email !== 'string')
      return false

    let hashCheck = false
    const user = await db.selectFrom('users')
      .where('email', '=', email)
      .selectAll()
      .executeTakeFirst()

    const authPass = credentials[password] || ''

    if (user?.password)
      hashCheck = await verifyHash(authPass, user.password, 'bcrypt')

    if (hashCheck && user) {
      RateLimiter.resetAttempts(email)
      this.authUser = user
      return true
    }

    RateLimiter.recordFailedAttempt(email)
    return false
  }

  public static async createToken(user: UserJsonResponse, name: string = config.auth.defaultTokenName || 'auth-token'): Promise<AuthToken> {
    const client = await this.getPersonalAccessClient()
    const clientSecret = await this.getClientSecret()

    // Generate a long JWT token
    const jwtToken = await TokenManager.generateLongJWT(user.id)

    // Set token expiry
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 30) // 30 days from now

    // Store the token in the database first to get the ID
    const result = await db.insertInto('oauth_access_tokens')
      .values({
        user_id: user.id,
        oauth_client_id: client.id,
        name,
        token: jwtToken,
        scopes: '[]',
        revoked: false,
        expires_at: formatDate(expiresAt),
      })
      .executeTakeFirst()

    if (!result?.insertId)
      throw new HttpError(500, 'Failed to create token')

    // Encrypt the token ID using client secret
    const encryptedId = encrypt(result.insertId.toString(), clientSecret)

    // Combine into final token format
    return `${encryptedId}:${jwtToken}` as AuthToken
  }

  public static async requestToken(credentials: Credentials, clientId: number, clientSecret: string): Promise<{ token: AuthToken } | null> {
    const isValidClient = await this.validateClient(clientId, clientSecret)
    if (!isValidClient)
      throw new HttpError(401, 'Invalid client credentials')

    const isValid = await this.attempt(credentials)
    if (!isValid || !this.authUser)
      return null

    return { token: await this.createToken(this.authUser, 'user-auth-token') }
  }

  public static async login(credentials: Credentials): Promise<{ token: AuthToken } | null> {
    const isValid = await this.attempt(credentials)
    if (!isValid || !this.authUser)
      return null

    return { token: await this.createToken(this.authUser, 'user-auth-token') }
  }

  public static async rotateToken(oldToken: string): Promise<AuthToken | null> {
    const [tokenId, plainToken] = oldToken.split(':')
    if (!tokenId || !plainToken)
      return null

    const clientSecret = await this.getClientSecret()
    const decryptedId = decrypt(tokenId, clientSecret)
    if (!decryptedId)
      return null

    const accessToken = await db.selectFrom('oauth_access_tokens')
      .where('id', '=', Number(decryptedId))
      .selectAll()
      .executeTakeFirst()

    if (!accessToken)
      return null

    // Verify the old token
    const isValid = await verifyHash(plainToken, accessToken.token, 'bcrypt')
    if (!isValid)
      return null

    // Generate new token
    const newToken = randomBytes(40).toString('hex')
    const hashedNewToken = await makeHash(newToken, { algorithm: 'bcrypt' })

    // Update the token
    await db.updateTable('oauth_access_tokens')
      .set({
        token: hashedNewToken,
        updated_at: formatDate(new Date()),
      })
      .where('id', '=', accessToken.id)
      .execute()

    // Encrypt the new token ID
    const encryptedId = encrypt(accessToken.id.toString(), clientSecret)
    return `${encryptedId}:${newToken}` as AuthToken
  }

  public static async validateToken(token: string): Promise<boolean> {
    const [tokenId, plainToken] = token.split(':')
    if (!tokenId || !plainToken)
      return false

    const clientSecret = await this.getClientSecret()
    const decryptedId = decrypt(tokenId, clientSecret)
    if (!decryptedId)
      return false

    const accessToken = await db.selectFrom('oauth_access_tokens')
      .where('id', '=', Number(decryptedId))
      .selectAll()
      .executeTakeFirst()

    if (!accessToken)
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

    // Rotate token if it's been used for more than 24 hours
    const lastUsed = accessToken.updated_at ? new Date(accessToken.updated_at) : new Date()
    const now = new Date()
    const hoursSinceLastUse = (now.getTime() - lastUsed.getTime()) / (1000 * 60 * 60)

    if (hoursSinceLastUse >= 24) {
      await this.rotateToken(token)
    }
    else {
      await db.updateTable('oauth_access_tokens')
        .set({
          updated_at: formatDate(now),
        })
        .where('id', '=', accessToken.id)
        .execute()
    }

    return true
  }

  public static async getUserFromToken(token: string): Promise<UserJsonResponse | undefined> {
    const [tokenId, plainToken] = token.split(':')
    if (!tokenId || !plainToken)
      return undefined

    const clientSecret = await this.getClientSecret()
    const decryptedId = decrypt(tokenId, clientSecret)
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

    await db.updateTable('oauth_access_tokens')
      .set({
        updated_at: formatDate(new Date()),
      })
      .where('id', '=', accessToken.id)
      .execute()

    return await db.selectFrom('users')
      .where('id', '=', accessToken.user_id)
      .selectAll()
      .executeTakeFirst()
  }

  public static async revokeToken(token: string): Promise<void> {
    const [tokenId, plainToken] = token.split(':')
    if (!tokenId || !plainToken)
      return

    const clientSecret = await this.getClientSecret()
    const decryptedId = decrypt(tokenId, clientSecret)
    if (!decryptedId)
      return

    await db.updateTable('oauth_access_tokens')
      .set({ revoked: true })
      .where('id', '=', Number(decryptedId))
      .execute()
  }

  public static async logout(): Promise<void> {
    const bearerToken = request.bearerToken()
    if (bearerToken)
      await this.revokeToken(bearerToken)

    this.authUser = undefined
  }
}
