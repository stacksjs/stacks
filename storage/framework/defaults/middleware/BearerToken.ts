import { Middleware, request } from '@stacksjs/router'

export default new Middleware({
  name: 'Bearer Token Test',
  priority: 1,
  async handle() {
    const bearerToken = request.bearerToken() || ''
    const validToken = ''

    if (!bearerToken || bearerToken !== validToken)
      throw new HttpError(401, 'Unauthorized.')
  },
})
