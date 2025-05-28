import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { RequestInstance } from '@stacksjs/types'

export default new Action({
  name: 'AuthUserAction',
  description: 'Get the authenticated user',
  method: 'GET',
  async handle(request: RequestInstance) {
    const user = await request.user()

    return response.json(user)
  },
})
