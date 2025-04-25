import { Action } from '@stacksjs/actions'
import { passwordResets } from '@stacksjs/auth'
import { User } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { RequestInstance } from '@stacksjs/types'

export default new Action({
  name: 'PasswordResetAction',
  description: 'Password Reset',
  method: 'POST',
  requestFile: 'PasswordResetRequest',
  async handle(request: RequestInstance) {
    const token = request.get('token')
    const password = request.get('password')
    const email = request.get('email')

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
