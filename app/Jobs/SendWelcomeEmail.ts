import { Job } from '@stacksjs/queue'

export default new Job({
  name: 'SendWelcomeEmail',
  description: 'Send a welcome email to a new user',
  queue: 'emails',
  tries: 3,
  backoff: 10,
  timeout: 30,

  async handle(payload: { email: string; name: string }) {
    console.log(`Sending welcome email to ${payload.name} <${payload.email}>`)

    // Your email sending logic here
    // e.g. await mail.to(payload.email).send(new WelcomeEmail(payload))
  },
})

/**
 * Usage examples:
 *
 * import SendWelcomeEmail from '~/app/Jobs/SendWelcomeEmail'
 *
 * // Dispatch to queue
 * await SendWelcomeEmail.dispatch({ email: 'user@example.com', name: 'Chris' })
 *
 * // Dispatch only if condition is met
 * await SendWelcomeEmail.dispatchIf(user.isNew, { email: user.email, name: user.name })
 *
 * // Dispatch with a 60-second delay
 * await SendWelcomeEmail.dispatchAfter(60, { email: user.email, name: user.name })
 *
 * // Execute immediately (bypass queue)
 * await SendWelcomeEmail.dispatchNow({ email: user.email, name: user.name })
 *
 * // Using the job() helper (by name)
 * import { job } from '@stacksjs/queue'
 *
 * await job('SendWelcomeEmail', { email: 'user@example.com', name: 'Chris' })
 *   .onQueue('emails')
 *   .tries(5)
 *   .delay(30)
 *   .dispatch()
 */
