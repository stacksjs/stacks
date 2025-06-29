import type { PasswordResetsRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { passwordResets } from '@stacksjs/auth'
import { User } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'SendPasswordResetEmailAction',
  description: 'Send Password Reset Email',
  method: 'POST',
  model: 'PasswordResets',
  async handle(request: PasswordResetsRequestType) {
    const email = request.get('email')

    const user = await User.where('email', email).first()

    if (!user) {
      return response.error('User not found')
    }

    await passwordResets(email).sendEmail()

    return response.success('Email sent')
  },
})
