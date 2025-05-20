import type { User } from '@stacksjs/orm'
import type { AuthToken } from './token-manager'
import { randomBytes } from 'node:crypto'
import { db } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { request } from '@stacksjs/router'
import { makeHash, verifyHash } from '@stacksjs/security'
import { RateLimiter } from './rate-limiter'

interface Credentials {
  password: string | undefined
  email: string | undefined
  [key: string]: string | undefined
}

export class Authentication {
  private static readonly config = {
    username: 'email',
    password: 'password',
    tokenExpiry: 30 * 24 * 60 * 60 * 1000, // 30 days in milliseconds
  }

  private static authUser: User | null = null

  public static async attempt(credentials: Credentials): Promise<boolean> {
    const email = credentials[this.config.username]

    if (!email || typeof email !== 'string')
      return false

    RateLimiter.validateAttempt(email)

    let hashCheck = false
    const user = await db.selectFrom('users')
      .where('email', '=', email)
      .selectAll()
      .executeTakeFirst()

    const authPass = credentials[this.config.password]

    if (typeof authPass === 'string' && user?.password)
      hashCheck = await verifyHash(authPass, user.password, 'bcrypt')

    if (hashCheck && user) {
      RateLimiter.resetAttempts(email)
      this.authUser = new User(user)
      return true
    }

    RateLimiter.recordFailedAttempt(email)
    return false
  }

  public static async createToken(user: UserModel, name: string = 'auth-token'): Promise<AuthToken> {
    const token = randomBytes(40).toString('hex')
    const hashedToken = await makeHash(token, { algorithm: 'bcrypt' })

    const result = await db.insertInto('personal_access_tokens')
      .values({
        user_id: user.id,
        name,
        token: hashedToken,
        plain_text_token: token,
        abilities: JSON.stringify(['*']), // All abilities by default
        last_used_at: new Date().getTime(),
        expires_at: new Date(Date.now() + this.config.tokenExpiry).getTime(),
      })
      .executeTakeFirst()

    if (!result?.insertId)
      throw new HttpError(500, 'Failed to create access token')

    return `${result.insertId}|${token}` as AuthToken
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
    const [tokenId, plainToken] = oldToken.split('|')
    if (!tokenId || !plainToken)
      return null

    const accessToken = await db.selectFrom('personal_access_tokens')
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
    await db.updateTable('personal_access_tokens')
      .set({
        token: hashedNewToken,
        updated_at: new Date().toISOString(),
        last_used_at: new Date().toISOString(),
      })
      .where('id', '=', accessToken.id)
      .execute()

    return `${accessToken.id}|${newToken}` as AuthToken
  }

  public static async validateToken(token: string): Promise<boolean> {
    const [tokenId, plainToken] = token.split('|')
    if (!tokenId || !plainToken)
      return false

    const accessToken = await db.selectFrom('personal_access_tokens')
      .where('id', '=', Number(tokenId))
      .selectAll()
      .executeTakeFirst()

    if (!accessToken)
      return false

    // Check if token is expired
    if (accessToken.expires_at && new Date(accessToken.expires_at) < new Date())
      return false

    // Verify the token
    const isValid = await verifyHash(plainToken, accessToken.token, 'bcrypt')
    if (!isValid)
      return false

    // Update last used timestamp
    await db.updateTable('personal_access_tokens')
      .set({
        last_used_at: new Date().toISOString(),
      })
      .where('id', '=', accessToken.id)
      .execute()

    return true
  }

  public static async getUserFromToken(token: string): Promise<UserModel | undefined> {
    const [tokenId] = token.split('|')
    if (!tokenId)
      return undefined

    const accessToken = await db.selectFrom('personal_access_tokens')
      .where('id', '=', Number(tokenId))
      .selectAll()
      .executeTakeFirst()

    if (!accessToken)
      return undefined

    const user = await db.selectFrom('users')
      .where('id', '=', accessToken.user_id)
      .selectAll()
      .executeTakeFirst()

    return user ? new User(user) : undefined
  }

  public static async revokeToken(token: string): Promise<void> {
    const [tokenId] = token.split('|')
    if (!tokenId)
      return

    await db.deleteFrom('personal_access_tokens')
      .where('id', '=', Number(tokenId))
      .execute()
  }

  public static async logout(): Promise<void> {
    const bearerToken = request.bearerToken()
    if (bearerToken)
      await this.revokeToken(bearerToken)

    this.authUser = null
  }
}
