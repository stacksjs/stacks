import type { UserModel } from '../../../orm/src/models/User'
import { randomBytes } from 'node:crypto'
import { HttpError } from '@stacksjs/error-handling'
import { makeHash, verifyHash } from '@stacksjs/security'
import AccessToken from '../../../orm/src/models/AccessToken'

export type AuthToken = `${number}:${number}:${string}`

export class TokenManager {
  static async createAccessToken(user: UserModel, teamId: number): Promise<AuthToken> {
    const token = randomBytes(40).toString('hex')
    const hashedToken = await makeHash(token, { algorithm: 'bcrypt' })

    const accessToken = await AccessToken.create({
      team_id: teamId,
      user_id: user.id,
      token: hashedToken,
      name: 'auth-token',
      plain_text_token: token,
      abilities: ['read', 'write', 'admin'],
      expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(), // 30 days
      last_used_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    if (!accessToken?.id)
      throw new HttpError(500, 'Failed to create access token')

    return `${accessToken.id}:${teamId || 0}:${token}`
  }

  static async validateToken(token: string): Promise<boolean> {
    const parts = token.split(':')

    if (parts.length !== 3)
      return false

    const [tokenId, teamId, plainToken] = parts

    const accessToken = await AccessToken.where('id', Number(tokenId))
      .where('team_id', Number(teamId))
      .first()

    if (!accessToken)
      return false

    // Verify the token hash
    const isValid = await verifyHash(plainToken, accessToken.token, 'bcrypt')
    if (!isValid)
      return false

    // Check if token is expired
    if (accessToken.expires_at && new Date(accessToken.expires_at) < new Date()) {
      // Automatically delete expired tokens
      await AccessToken.where('id', accessToken.id).delete()
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
      await AccessToken.where('id', accessToken.id).update({
        last_used_at: now.toISOString(),
      })
    }

    return true
  }

  static async rotateToken(oldToken: string): Promise<AuthToken | null> {
    const parts = oldToken.split(':')
    if (parts.length !== 3)
      return null

    const [tokenId, teamId, plainToken] = parts
    const accessToken = await AccessToken.where('id', Number(tokenId))
      .where('team_id', Number(teamId))
      .first()

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
    await AccessToken.where('id', accessToken.id).update({
      token: hashedNewToken,
      plain_text_token: newToken,
      updated_at: new Date().toISOString(),
      last_used_at: new Date().toISOString(),
    })

    return `${accessToken.id}:${Number(teamId)}:${newToken}`
  }

  static async revokeToken(token: string): Promise<void> {
    const parts = token.split(':')

    if (parts.length !== 3)
      return

    const [tokenId] = parts

    await AccessToken.where('id', Number(tokenId)).delete()
  }
}
