import { Buffer } from 'node:buffer'
import { randomBytes } from 'node:crypto'
import { db, sql } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'

export type AuthToken = string

export class TokenManager {
  static async createAccessToken(user: { id: number }): Promise<AuthToken> {
    const token = randomBytes(40).toString('hex')

    const result = await db.insertInto('oauth_access_tokens')
      .values({
        oauth_client_id: 1, // Fixed OAuth client ID
        user_id: user.id,
        token,
        name: 'auth-token',
        scopes: JSON.stringify(['read', 'write', 'admin']),
        revoked: false,
        expires_at: sql`${new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString()}`,
        created_at: sql`${new Date().toISOString()}`,
        updated_at: sql`${new Date().toISOString()}`,
      })
      .executeTakeFirst()

    if (!result?.insertId)
      throw new HttpError(500, 'Failed to create access token')

    return token
  }

  static async validateToken(token: string): Promise<boolean> {
    const accessToken = await db.selectFrom('oauth_access_tokens')
      .where('token', '=', token)
      .selectAll()
      .executeTakeFirst()

    if (!accessToken)
      return false

    // Check if token is expired
    if (accessToken.expires_at && new Date(accessToken.expires_at) < new Date()) {
      // Automatically delete expired tokens
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
      // Update last used timestamp
      await db.updateTable('oauth_access_tokens')
        .set({
          updated_at: sql`${now.toISOString()}`,
        })
        .where('id', '=', accessToken.id)
        .execute()
    }

    return true
  }

  static async rotateToken(oldToken: string): Promise<AuthToken | null> {
    const accessToken = await db.selectFrom('oauth_access_tokens')
      .where('token', '=', oldToken)
      .selectAll()
      .executeTakeFirst()

    if (!accessToken)
      return null

    // Generate new token
    const newToken = randomBytes(40).toString('hex')

    // Update the token
    await db.updateTable('oauth_access_tokens')
      .set({
        token: newToken,
        updated_at: sql`${new Date().toISOString()}`,
      })
      .where('id', '=', accessToken.id)
      .execute()

    return newToken
  }

  static async revokeToken(token: string): Promise<void> {
    await db.updateTable('oauth_access_tokens')
      .set({
        revoked: true,
        updated_at: sql`${new Date().toISOString()}`,
      })
      .where('token', '=', token)
      .execute()
  }

  static async generateLongJWT(userId: number): Promise<string> {
    // Generate a long random string for the token
    const randomPart = randomBytes(64).toString('base64')

    // Create JWT-like structure with header and payload
    const header = {
      alg: 'HS256',
      typ: 'JWT',
    }

    const payload = {
      sub: userId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 30), // 30 days
      jti: randomBytes(16).toString('hex'),
    }

    // Convert header and payload to base64
    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64')
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64')

    // Combine all parts to create a JWT-like token
    return `${encodedHeader}.${encodedPayload}.${randomPart}`
  }
}
