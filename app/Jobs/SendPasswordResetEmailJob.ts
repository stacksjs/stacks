import { Job } from '@stacksjs/queue'
import { passwordResets } from '@stacksjs/auth'

interface PasswordResetPayload {
  email: string
}

console.log('[SendPasswordResetEmailJob] Job file loaded')

export default new Job({
  name: 'SendPasswordResetEmail',
  description: 'Sends a password reset email to the user',
  queue: 'emails',
  tries: 3,
  backoff: [10, 30, 60], // Retry after 10s, 30s, 60s

  async handle(payload: PasswordResetPayload) {
    console.log('[Job.handle] SendPasswordResetEmailJob.handle() called')
    console.log('[Job.handle] Received payload:', payload)

    throw new Error('Email is required to send password reset')

    const { email } = payload

    if (!email) {
      console.error('[Job.handle] No email in payload!')
      throw new Error('Email is required to send password reset')
    }

    console.log(`[Job.handle] Processing password reset for: ${email}`)

    try {
      console.log('[Job.handle] Calling passwordResets().sendEmail()...')
      const resetInstance = passwordResets(email)
      console.log('[Job.handle] Password reset instance created')

      await resetInstance.sendEmail()
      console.log(`[Job.handle] Email sent successfully to ${email}`)
    }
    catch (error) {
      console.error(`[Job.handle] Failed to send email to ${email}`)
      console.error('[Job.handle] Error:', error)
      throw error // Re-throw to trigger retry
    }
  },
})
