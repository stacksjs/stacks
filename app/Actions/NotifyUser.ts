import { Action } from '@stacksjs/actions'
import { log } from '@stacksjs/logging'
import { schema } from '@stacksjs/validation'

/**
 * Dispatched to, not requested.
 *
 * `app/Events.ts` maps `'user:created'` onto this action, and the event system
 * calls `handle(payload, event)` with the payload alone - there is no request
 * anywhere near it. This used to read `request.get('id')`, which threw
 * `request.get is not a function` the first time a user was created, and the
 * types said nothing, because `handle`'s parameter was typed as a request that
 * never arrives.
 *
 * `invocation: 'event'` says which of the two it is, and `validations`
 * describes the payload - so the shape `handle` sees and the shape that gets
 * checked are one declaration and cannot drift.
 */
export default new Action({
  name: 'NotifyUser',
  description: 'Notify User After Creation',
  invocation: 'event',

  /*
   * The payload is a User row, so these mirror what the model says about one:
   * `id` is its auto-incrementing primary key - a positive integer, never a
   * float and never negative - and `name` carries the model's own length
   * bounds. `schema.number()` alone would have accepted `-1.5`.
   *
   * Both `.required()`, because a row that has been created has both, and
   * `.required()` is what makes them non-optional in the payload type rather
   * than `number | undefined` for the handler to guard.
   */
  validations: {
    id: { rule: schema.number().integer().positive().required() },
    name: { rule: schema.string().min(5).max(100).required() },
  },

  async handle(user) {
    log.info('[NotifyUser] User created', { id: user.id, name: user.name })

    return { success: true }
  },
})
