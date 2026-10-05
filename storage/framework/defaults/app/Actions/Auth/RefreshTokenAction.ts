import { Action } from '@stacksjs/actions/runtime'
import { authCookieForBrowserSession, refreshToken } from '@stacksjs/auth'
import { response } from '@stacksjs/router'
import { schema } from '@stacksjs/validation/runtime'

export default new Action({
  name: 'RefreshTokenAction',
  description: 'Exchange a refresh token for a new access token',
  method: 'POST',
  async handle(request: RequestInstance) {
    const refreshTokenValue = request.get('refresh_token')

    await request.validate({
      refresh_token: {
        rule: schema.string().min(1).required(),
        message: {
          min: 'Refresh token is required',
        },
      },
    })

    try {
      // The lifetimes config/auth.ts sets (tokenExpiry, refreshTokenExpiry).
      // Hard-coding an hour and 30 days here overrode them on every refresh.
      const result = await refreshToken(refreshTokenValue)

      // Rotation invalidates the token the cookie was carrying, so a cookie
      // left untouched here would go stale at the exact moment the session was
      // meant to be extended: the browser keeps presenting a revoked token
      // while the JSON body holds a live one it cannot read (#2306).
      return response.json({
        access_token: result.plainTextToken,
        refresh_token: result.refreshToken,
        token_type: 'Bearer',
        expires_in: result.expiresIn,
      }, { headers: { 'Set-Cookie': authCookieForBrowserSession(result.plainTextToken, result.expiresIn) } })
    }
    catch (error: any) {
      return response.unauthorized(error.message || 'Invalid or expired refresh token')
    }
  },
})
