import { Action } from '@stacksjs/actions'
import { Auth } from '@stacksjs/auth'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'LogoutAction',
  description: 'Logout from the application',
  method: 'POST',
  async handle() {
    await Auth.logout()

    return response.json({
      message: 'Successfully logged out',
    })
  },
})
