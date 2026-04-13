import { mail, template } from '@stacksjs/email'
import { log } from '@stacksjs/logging'
import { Job } from '@stacksjs/queue'

export default new Job({
  name: 'SendWelcomeEmail',
  description: 'Send a welcome email to a new user',
  queue: 'emails',
  tries: 3,
  backoff: 60,
  timeout: 30,

  async handle(payload: { email: string; name: string }) {
    const { email, name } = payload

    if (!email) {
      log.warn('[job] SendWelcomeEmail: no email provided')
      return
    }

    log.debug(`[job] Sending welcome email to ${name || 'there'} <${email}>`)

    const { html, text } = await template('welcome', {
      subject: 'Welcome!',
      variables: { name: name || 'there', email },
    })

    await mail.send({
      to: email,
      subject: 'Welcome to Stacks!',
      html,
      text,
    })

    log.info(`[job] Welcome email sent to ${email}`)
  },
})

/**
 * Usage examples (no imports needed — jobs are auto-imported):
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
 * // Using the job() helper (by name, also auto-imported)
 * await job('SendWelcomeEmail', { email: 'user@example.com', name: 'Chris' })
 *   .onQueue('emails')
 *   .tries(5)
 *   .delay(30)
 *   .dispatch()
 */
