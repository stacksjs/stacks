import type { RequestInstance } from '@stacksjs/types'
import { Authentication } from '@stacksjs/auth'
import { HttpError } from '@stacksjs/error-handling'
import { Middleware } from '@stacksjs/router'

export default new Middleware({
  name: 'Auth',
  priority: 1,
  async handle(request: RequestInstance) {
    const bearerToken = request.bearerToken()

    if (!bearerToken)
      throw new HttpError(401, 'Unauthorized. No token provided.')

    // Validate the token
    const isValid = await Authentication.validateToken(bearerToken)
    if (!isValid)
      throw new HttpError(401, 'Unauthorized. Invalid token.')
  },
})
