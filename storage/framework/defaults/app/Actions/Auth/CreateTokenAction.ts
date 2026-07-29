import { Action } from '@stacksjs/actions'
import { createToken } from '@stacksjs/auth'
import { response } from '@stacksjs/router'
import { schema } from '@stacksjs/validation'
import { normalizeTokenExpiry, normalizeTokenScopes, wantsRefreshToken } from './token-request'

export default new Action({
  name: 'CreateTokenAction',
  description: 'Create a new personal access token with custom scopes',
  method: 'POST',
  async handle(request: RequestInstance) {
    const user = await request.user()

    if (!user) {
      return response.unauthorized('Authentication required')
    }

    const name = request.get('name') || 'access-token'
    const scopes = request.get('scopes') || ['*']
    const expiresInMinutes = normalizeTokenExpiry(request.get('expires_in_minutes'))
    const withRefreshToken = wantsRefreshToken(request.get('with_refresh_token'))

    await request.validate({
      name: {
        rule: schema.string().min(1).max(255).optional(),
        message: {
          min: 'Token name must be at least 1 character',
          max: 'Token name must be at most 255 characters',
        },
      },
    })

    if (expiresInMinutes === null)
      return response.badRequest('Token expiry must be between 1 minute and 1 year')

    const scopeArray = normalizeTokenScopes(scopes)

    if (scopeArray.length === 0)
      return response.badRequest('At least one valid token scope is required')

    try {
      const result = await createToken(user.id, name, scopeArray, {
        expiresInMinutes,
        withRefreshToken,
        refreshExpiresInDays: 30,
      })

      return response.json({
        access_token: result.plainTextToken,
        ...(result.refreshToken ? { refresh_token: result.refreshToken } : {}),
        token_type: 'Bearer',
        expires_in: result.expiresIn,
        token: {
          id: result.accessToken.id,
          name: result.accessToken.name,
          scopes: result.accessToken.scopes,
          expires_at: result.accessToken.expiresAt?.toISOString() || null,
        },
      })
    }
    catch (error: any) {
      return response.serverError(error.message || 'Failed to create token')
    }
  },
})
