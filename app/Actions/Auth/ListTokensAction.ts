import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { tokens } from '@stacksjs/auth'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'ListTokensAction',
  description: 'List all access tokens for the authenticated user',
  method: 'GET',
  async handle(request: RequestInstance) {
    const user = await request.user()

    if (!user) {
      return response.unauthorized('Authentication required')
    }

    const userTokens = await tokens(user.id)

    return response.json({
      tokens: userTokens.map(token => ({
        id: token.id,
        name: token.name,
        scopes: token.scopes,
        expires_at: token.expiresAt?.toISOString() || null,
        created_at: token.createdAt.toISOString(),
        last_used_at: token.updatedAt.toISOString(),
      })),
      count: userTokens.length,
    })
  },
})
