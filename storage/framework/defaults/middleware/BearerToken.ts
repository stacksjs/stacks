import type { Request } from '@stacksjs/router'
import { Middleware } from '@stacksjs/router'
import { HttpError } from 'error-handling'

export default new Middleware({
  name: 'Bearer Token Test',
  priority: 1,
  async handle(request: Request) {
    const bearerToken = request.bearerToken() || ''
    const validToken = ''

    if (!bearerToken || bearerToken !== validToken)
      throw new HttpError(401, 'Unauthorized.')
  },
})
