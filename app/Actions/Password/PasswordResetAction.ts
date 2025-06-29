import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { passwordResets } from '@stacksjs/auth'
import { User } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'PasswordResetAction',
  description: 'Password Reset',
  method: 'POST',
  model: 'PasswordResets',
  async handle(request: RequestInstance) {
    const token = request.get('token')
    const password = request.get('password')
    const passwordConfirmation = request.get('password_confirmation')
    const email = request.get('email')

    if (password !== passwordConfirmation)
      return response.error('Password confirmation does not match')

    if (!token || !password || !email)
      return response.error('Missing required fields')

    const user = await User.where('email', email).first()

    if (!user)
      return response.error('User not found')

    const success = await passwordResets(email).resetPassword(token, password)

    if (!success)
      return response.error('Invalid or expired reset token')

    return response.success('Password has been reset successfully')
  },
})
