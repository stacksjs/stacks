import { Auth } from '@stacksjs/auth'
import { HttpError } from '@stacksjs/error-handling'
import { Middleware } from '@stacksjs/router'

export default new Middleware({
  name: 'Auth',
  priority: 1,
  async handle(request: Request) {
    const authHeader = request.headers.get('Authorization')
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

    if (!bearerToken)
      throw new HttpError(401, 'Unauthorized. No token provided.')

    // Validate the token
    const isValid = await Auth.validateToken(bearerToken)
    if (!isValid)
      throw new HttpError(401, 'Unauthorized. Invalid token.')
  },
})
