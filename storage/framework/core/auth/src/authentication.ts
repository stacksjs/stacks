import type { UserJsonResponse } from '@stacksjs/orm'
import type { AuthToken } from './token'
import { randomBytes } from 'node:crypto'
import { config } from '@stacksjs/config'
import { db } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { formatDate } from '@stacksjs/orm'
import { request } from '@stacksjs/router'
import { makeHash, verifyHash } from '@stacksjs/security'
import { RateLimiter } from './rate-limiter'

interface Credentials {
  password: string | undefined
  email: string | undefined
  [key: string]: string | undefined
}

export class Authentication {
  private static authUser: UserJsonResponse | undefined = undefined

  private static async checkOAuthClients(): Promise<void> {
    const clientCount = await db.selectFrom('oauth_clients')
      .select(db.fn.count('id').as('count'))
      .executeTakeFirst()

    if (!clientCount?.count || Number(clientCount.count) === 0)
      throw new HttpError(500, 'No OAuth clients found. Please run `./buddy auth:token` to create a personal access client.')
  }

  private static async getPersonalAccessClient(): Promise<number> {
    const client = await db.selectFrom('oauth_clients')
      .where('personal_access_client', '=', true)
      .select('id')
      .executeTakeFirst()

    if (!client)
      throw new HttpError(500, 'No personal access client found. Please run `./buddy auth:token` to create a personal access client.')

    return client.id
  }

  private static async validateClient(clientId: number, clientSecret: string): Promise<boolean> {
    await this.checkOAuthClients()

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

    // RateLimiter.validateAttempt(email)

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
    await this.checkOAuthClients()
    const clientId = await this.getPersonalAccessClient()

    const token = randomBytes(40).toString('hex')
    const hashedToken = await makeHash(token, { algorithm: 'bcrypt' })
    const tokenExpiry = config.auth.tokenExpiry || 30 * 24 * 60 * 60 * 1000

    const result = await db.insertInto('oauth_access_tokens')
      .values({
        user_id: user.id,
        oauth_client_id: clientId,
        name,
        token: hashedToken,
        scopes: '[]',
        revoked: false,
        expires_at: formatDate(new Date(Date.now() + tokenExpiry)),
      })
      .executeTakeFirst()

    if (!result?.insertId)
      throw new HttpError(500, 'Failed to create access token')

    const insertId = result.insertId || Number(result.numInsertedOrUpdatedRows)

    return `${insertId}:${token}` as AuthToken
  }

  public static async requestToken(credentials: Credentials, clientId: number, clientSecret: string): Promise<{ token: AuthToken } | null> {
    // First validate the client
    const isValidClient = await this.validateClient(clientId, clientSecret)
    if (!isValidClient)
      throw new HttpError(401, 'Invalid client credentials')

    // Then attempt to authenticate the user
    const isValid = await this.attempt(credentials)
    if (!isValid || !this.authUser)
      return null

    // Create user token
    const token = await this.createToken(this.authUser, 'user-auth-token')

    return { token }
  }

  public static async login(credentials: Credentials): Promise<{ token: AuthToken } | null> {
    const isValid = await this.attempt(credentials)

    if (!isValid || !this.authUser)
      return null

    // Create user token
    const token = await this.createToken(this.authUser, 'user-auth-token')

    return { token }
  }

  public static async rotateToken(oldToken: string): Promise<AuthToken | null> {
    const [tokenId, plainToken] = oldToken.split(':')
    if (!tokenId || !plainToken)
      return null

    const accessToken = await db.selectFrom('oauth_access_tokens')
      .where('id', '=', Number(tokenId))
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
        updated_at: new Date().toISOString(),
      })
      .where('id', '=', accessToken.id)
      .execute()

    return `${accessToken.id}:${newToken}` as AuthToken
  }

  public static async validateToken(token: string): Promise<boolean> {
    const [tokenId, plainToken] = token.split(':')
    if (!tokenId || !plainToken)
      return false

    const accessToken = await db.selectFrom('oauth_access_tokens')
      .where('id', '=', Number(tokenId))
      .selectAll()
      .executeTakeFirst()

    if (!accessToken)
      return false

    // Check if token is expired
    if (accessToken.expires_at && new Date(accessToken.expires_at) < new Date())
      return false

    // Check if token is revoked
    if (accessToken.revoked)
      return false

    // Verify the token
    const isValid = await verifyHash(plainToken, accessToken.token, 'bcrypt')
    if (!isValid)
      return false

    return true
  }

  public static async getUserFromToken(token: string): Promise<UserJsonResponse | undefined> {
    const [tokenId] = token.split(':')
    if (!tokenId)
      return undefined

    const accessToken = await db.selectFrom('oauth_access_tokens')
      .where('id', '=', Number(tokenId))
      .selectAll()
      .executeTakeFirst()

    if (!accessToken)
      return undefined

    const user = await db.selectFrom('users')
      .where('id', '=', accessToken.user_id)
      .selectAll()
      .executeTakeFirst()

    return user || undefined
  }

  public static async revokeToken(token: string): Promise<void> {
    const [tokenId] = token.split(':')
    if (!tokenId)
      return

    await db.updateTable('oauth_access_tokens')
      .set({
        revoked: true,
        updated_at: new Date().toISOString(),
      })
      .where('id', '=', Number(tokenId))
      .execute()
  }

  public static async logout(): Promise<void> {
    const bearerToken = request.bearerToken()

    if (bearerToken)
      await this.revokeToken(bearerToken)

    this.authUser = undefined
  }
}
