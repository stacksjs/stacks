import { Action } from '@stacksjs/actions/runtime'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'AuthUserAction',
  description: 'Get the authenticated user',
  method: 'GET',
  async handle(request: RequestInstance) {
    const user = await request.user()

    const result = response.json(user)
    result.headers.set('Cache-Control', 'private, no-store')
    return result
  },
})
