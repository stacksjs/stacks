import { Auth } from '@stacksjs/auth'
import { HttpError } from '@stacksjs/error-handling'
import { log } from '@stacksjs/logging'
import { Middleware } from '@stacksjs/router'

export default new Middleware({
  name: 'Auth',
  priority: 1,
  async handle(request) {
    // Check bearer token first (API auth)
    const bearerToken = request.bearerToken()

    if (bearerToken) {
      log.debug(`[middleware:auth] Validating bearer token`)
      const isValid = await Auth.validateToken(bearerToken)
      if (!isValid)
        throw new HttpError(401, 'Unauthorized. Invalid token.')

      log.debug(`[middleware:auth] Bearer token valid`)
      return
    }

    // Check session cookie (web auth)
    const sessionId = request.cookie('session_id')

    if (sessionId) {
      log.debug(`[middleware:auth] Validating session`)
      const { sessionCheck } = await import('@stacksjs/auth')
      const isValid = await sessionCheck(sessionId)
      if (!isValid)
        throw new HttpError(401, 'Unauthorized. Session expired.')

      log.debug(`[middleware:auth] Session valid`)
      return
    }

    throw new HttpError(401, 'Unauthorized. No token or session provided.')
  },
})
