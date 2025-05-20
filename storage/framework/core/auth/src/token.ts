import type { User } from '@stacksjs/orm'
import { randomBytes } from 'node:crypto'
import { HttpError } from '@stacksjs/error-handling'
import { makeHash, verifyHash } from '@stacksjs/security'
import { db } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export type AuthToken = `${number}:${string}`

export class TokenManager {
  static async createAccessToken(user: { id: number }): Promise<AuthToken> {
    const token = randomBytes(40).toString('hex')
    const hashedToken = await makeHash(token, { algorithm: 'bcrypt' })

    const result = await db.insertInto('personal_access_tokens')
      .values({
        user_id: user.id,
        token: hashedToken,
        name: 'auth-token',
        plain_text_token: token,
        abilities: JSON.stringify(['read', 'write', 'admin']),
        expires_at: sql`${new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString()}`,
        last_used_at: sql`${new Date().toISOString()}`,
        created_at: sql`${new Date().toISOString()}`,
        updated_at: sql`${new Date().toISOString()}`,
      })
      .executeTakeFirst()

    if (!result?.insertId)
      throw new HttpError(500, 'Failed to create access token')

    return `${Number(result.insertId)}:${token}`
  }

  static async validateToken(token: string): Promise<boolean> {
    const parts = token.split(':')

    if (parts.length !== 2)
      return false

    const [tokenId, plainToken] = parts

    const accessToken = await db.selectFrom('personal_access_tokens')
      .where('id', '=', Number(tokenId))
      .selectAll()
      .executeTakeFirst()

    if (!accessToken)
      return false

    // Verify the token hash
    const isValid = await verifyHash(plainToken, accessToken.token, 'bcrypt')
    if (!isValid)
      return false

    // Check if token is expired
    if (accessToken.expires_at && new Date(accessToken.expires_at) < new Date()) {
      // Automatically delete expired tokens
      await db.deleteFrom('personal_access_tokens')
        .where('id', '=', accessToken.id)
        .execute()
      return false
    }

    // Rotate token if it's been used for more than 24 hours
    const lastUsed = accessToken.last_used_at ? new Date(accessToken.last_used_at) : new Date()
    const now = new Date()
    const hoursSinceLastUse = (now.getTime() - lastUsed.getTime()) / (1000 * 60 * 60)

    if (hoursSinceLastUse >= 24) {
      await this.rotateToken(token)
    }
    else {
      // Update last used timestamp
      await db.updateTable('personal_access_tokens')
        .set({
          last_used_at: sql`${now.toISOString()}`,
        })
        .where('id', '=', accessToken.id)
        .execute()
    }

    return true
  }

  static async rotateToken(oldToken: string): Promise<AuthToken | null> {
    const parts = oldToken.split(':')
    if (parts.length !== 2)
      return null

    const [tokenId, plainToken] = parts
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
        plain_text_token: newToken,
        updated_at: sql`${new Date().toISOString()}`,
        last_used_at: sql`${new Date().toISOString()}`,
      })
      .where('id', '=', accessToken.id)
      .execute()

    return `${accessToken.id}:${newToken}`
  }

  static async revokeToken(token: string): Promise<void> {
    const parts = token.split(':')

    if (parts.length !== 2)
      return

    const [tokenId] = parts

    await db.deleteFrom('personal_access_tokens')
      .where('id', '=', Number(tokenId))
      .execute()
  }
}