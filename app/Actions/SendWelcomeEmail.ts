import { Action } from '@stacksjs/actions'
import { mail, template } from '@stacksjs/email'
import { log } from '@stacksjs/logging'
import { schema } from '@stacksjs/validation'

/**
 * Dispatched to, not requested.
 *
 * `app/Events.ts` maps `'user:registered'` onto this action, and the event
 * system calls `handle(payload, event)` with the payload alone. This used to
 * read `request.get('to')`, which threw `request.get is not a function` the
 * first time anybody registered - and the types said nothing, because
 * `handle`'s parameter was typed as a request that never arrives.
 *
 * The payload is the one `RegisterAction` dispatches: `{ id, email, name, to }`.
 * Only what this action reads is declared.
 */
export default new Action({
  name: 'SendWelcomeEmail',
  description: 'Sends a welcome email to newly registered users',
  invocation: 'event',

  validations: {
    to: { rule: schema.string().email() },
    name: { rule: schema.string() },
  },

  async handle(user) {
    const name = user.name || 'there'

    log.debug(`[action] Sending welcome email to ${user.to}`)

    const { html, text } = await template('welcome', {
      subject: 'Welcome!',
      variables: { name, email: user.to },
    })

    await mail.send({
      to: user.to,
      subject: 'Welcome to Stacks!',
      html,
      text,
    })

    log.info(`[action] Welcome email sent to ${user.to}`)

    return {
      success: true,
      message: `Welcome email sent to ${user.to}`,
    }
  },
})
