import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'AuthUserAction',
  description: 'Get the authenticated user',
  method: 'GET',
  async handle(request: RequestInstance) {
    const user = await request.user()

    return response.json(user)
  },
})
