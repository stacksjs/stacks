import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { createToken } from '@stacksjs/auth'
import { response } from '@stacksjs/router'
import { schema } from '@stacksjs/validation'

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
    const expiresInMinutes = request.get('expires_in_minutes') || 60

    await request.validate({
      name: {
        rule: schema.string().min(1).max(255).optional(),
        message: {
          min: 'Token name must be at least 1 character',
          max: 'Token name must be at most 255 characters',
        },
      },
    })

    // Parse scopes - can be array or comma-separated string
    let scopeArray: string[] = ['*']
    if (Array.isArray(scopes)) {
      scopeArray = scopes
    }
    else if (typeof scopes === 'string') {
      scopeArray = scopes.split(',').map(s => s.trim()).filter(Boolean)
    }

    try {
      const result = await createToken(user.id, name, scopeArray, {
        expiresInMinutes: Number(expiresInMinutes) || 60,
        withRefreshToken: true,
        refreshExpiresInDays: 30,
      })

      return response.json({
        access_token: result.plainTextToken,
        refresh_token: result.refreshToken,
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
