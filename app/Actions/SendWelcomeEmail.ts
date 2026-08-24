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

  /*
   * `to` is an address, and `name` carries the User model's own length bounds -
   * the payload is built from a User row, so the two should not disagree about
   * what a name is.
   *
   * `to` is `.required()` and `name` is not, which is what `RegisterAction`
   * actually dispatches: the address always resolves (it falls back to the one
   * being registered) while `name` reads `user?.name` and can be absent. So
   * `user.name` types as `string | undefined`, and the `|| 'there'` below stops
   * being defensive habit and starts being the thing the type asks for.
   */
  validations: {
    to: { rule: schema.string().email().required() },
    name: { rule: schema.string().min(5).max(100) },
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
