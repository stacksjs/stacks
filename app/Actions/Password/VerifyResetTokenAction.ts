import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { passwordResets } from '@stacksjs/auth'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'VerifyResetTokenAction',
  description: 'Verify Password Reset Token',
  method: 'POST',
  model: 'PasswordResets',
  async handle(request: RequestInstance) {
    const token = request.get('token')
    const email = request.get('email')

    // Validate required fields
    if (!token || !email) {
      return response.error('Token and email are required', 422)
    }

    // Verify the token
    const isValid = await passwordResets(email).verifyToken(token)

    if (!isValid) {
      return response.error('Invalid or expired reset token', 400)
    }

    return response.success('Token is valid')
  },
})
