import { Auth, authCookieName, sessionUser } from '@stacksjs/auth'
import { config } from '@stacksjs/config'
import { HttpError } from '@stacksjs/error-handling'
import { Middleware } from '@stacksjs/router'

function bearerToken(request: any): string | null {
  if (typeof request.bearerToken === 'function') {
    const token = request.bearerToken()
    if (token)
      return token
  }

  const header
    = (typeof request.header === 'function' && request.header('authorization'))
      || request.headers?.get?.('authorization')
      || request.headers?.get?.('Authorization')
  return typeof header === 'string' && header.startsWith('Bearer ')
    ? header.slice(7)
    : null
}

async function stampTokenUser(request: any, token: string): Promise<void> {
  const user = await Auth.getUserFromToken(token)
  if (!user)
    throw new HttpError(401, 'Unauthorized. Invalid or expired token.')

  Auth.setUser(user)
  request._authenticatedUser = user
  request._currentAccessToken = await Auth.currentAccessToken()
}

export default new Middleware({
  name: 'Auth',
  priority: 1,

  async handle(request) {
    const token = bearerToken(request)
    if (token) {
      await stampTokenUser(request, token)
      return
    }

    // One resolver, so the name a cookie is written under is the name it is
    // read under (stacksjs/stacks#2236).
    const tokenCookieName = authCookieName()
    const cookieToken = request.cookie?.(tokenCookieName)
    if (cookieToken) {
      await stampTokenUser(request, cookieToken)
      return
    }

    const sessionId = request.cookie?.('session_id')
    if (sessionId) {
      const user = await sessionUser(sessionId)
      if (!user)
        throw new HttpError(401, 'Unauthorized. Session expired.')

      Auth.setUser(user)
      request._authenticatedUser = user
      return
    }

    throw new HttpError(401, 'Unauthorized. No token or session provided.')
  },
})
