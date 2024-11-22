import { Middleware, request } from '@stacksjs/router'
import { HttpError } from 'index'
import { AccessToken, Team } from '../../storage/framework/orm/src'

export default new Middleware({
  name: 'Bearer Token Test',
  priority: 1,
  async handle() {
    const bearerToken = request.bearerToken() || ''
    const validToken = 'Test@1234'

  if (!bearerToken || bearerToken !== validToken)
      throw new HttpError(401, 'Unauthorized.')
  },
})
