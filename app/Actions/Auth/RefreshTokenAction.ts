import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { refreshToken } from '@stacksjs/auth'
import { response } from '@stacksjs/router'
import { schema } from '@stacksjs/validation'

export default new Action({
  name: 'RefreshTokenAction',
  description: 'Exchange a refresh token for a new access token',
  method: 'POST',
  async handle(request: RequestInstance) {
    const refreshTokenValue = request.get('refresh_token')

    await request.validate({
      refresh_token: {
        rule: schema.string().min(1),
        message: {
          min: 'Refresh token is required',
        },
      },
    })

    try {
      const result = await refreshToken(refreshTokenValue, {
        expiresInMinutes: 60, // 1 hour access token
        refreshExpiresInDays: 30, // 30 day refresh token
      })

      return response.json({
        access_token: result.plainTextToken,
        refresh_token: result.refreshToken,
        token_type: 'Bearer',
        expires_in: result.expiresIn,
      })
    }
    catch (error: any) {
      return response.unauthorized(error.message || 'Invalid or expired refresh token')
    }
  },
})
