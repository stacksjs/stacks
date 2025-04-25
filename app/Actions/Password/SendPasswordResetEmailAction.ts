import type { UserRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { User } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { passwordResets } from '@stacksjs/auth'

export default new Action({
  name: 'SendPasswordResetEmailAction',
  description: 'Send Password Reset Email',
  method: 'POST',
  requestFile: 'PasswordResetEmailRequest',
  async handle(request: UserRequestType) {
    const email = request.get('email')

    const user = await User.where('email', email).first()

    if (!user) {
      return response.error('User not found')
    }

    const token = await passwordResets(email).getToken()

    return token
  },
})
