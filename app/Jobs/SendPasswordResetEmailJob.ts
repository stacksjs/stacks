import { Job } from '@stacksjs/queue'
import { passwordResets } from '@stacksjs/auth'
import { log } from '@stacksjs/logging'

interface PasswordResetPayload {
  email: string
}

export default new Job({
  name: 'SendPasswordResetEmail',
  description: 'Sends a password reset email to the user',
  queue: 'emails',
  tries: 3,
  backoff: [10, 30, 60], // Retry after 10s, 30s, 60s

  async handle(payload: PasswordResetPayload) {
    const { email } = payload

    if (!email) {
      throw new Error('Email is required to send password reset')
    }

    log.info(`[SendPasswordResetEmailJob] Sending password reset email to ${email}`)

    try {
      await passwordResets(email).sendEmail()
      log.info(`[SendPasswordResetEmailJob] Password reset email sent successfully to ${email}`)
    }
    catch (error) {
      log.error(`[SendPasswordResetEmailJob] Failed to send password reset email to ${email}`, error)
      throw error // Re-throw to trigger retry
    }
  },
})
