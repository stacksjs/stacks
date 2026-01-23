import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { currentAccessToken, revokeTokenById, tokens } from '@stacksjs/auth'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'RevokeTokenAction',
  description: 'Revoke a specific access token',
  method: 'DELETE',
  async handle(request: RequestInstance) {
    const user = await request.user()

    if (!user) {
      return response.unauthorized('Authentication required')
    }

    const tokenId = Number(request.getParam('id'))

    if (!tokenId || Number.isNaN(tokenId)) {
      return response.badRequest('Invalid token ID')
    }

    // Verify the token belongs to the user
    const userTokens = await tokens(user.id)
    const tokenToRevoke = userTokens.find(t => t.id === tokenId)

    if (!tokenToRevoke) {
      return response.notFound('Token not found')
    }

    // Check if trying to revoke current token
    const current = await currentAccessToken()
    if (current && current.id === tokenId) {
      return response.badRequest('Cannot revoke the current token. Use /logout instead.')
    }

    await revokeTokenById(tokenId)

    return response.json({
      message: 'Token revoked successfully',
      token_id: tokenId,
    })
  },
})
