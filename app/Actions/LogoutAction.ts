import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { Authentication } from '@stacksjs/auth'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'LogoutAction',
  description: 'Logout from the application',
  method: 'POST',
  async handle(request: RequestInstance) {
    await Authentication.logout()

    return response.json({
      message: 'Successfully logged out',
    })
  },
})
