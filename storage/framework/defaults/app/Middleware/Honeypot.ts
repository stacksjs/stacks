import { config } from '@stacksjs/config'
import { HttpError } from '@stacksjs/error-handling'
import { checkSubmissionSpam } from '@stacksjs/forms/spam'
import { Middleware } from '@stacksjs/router'

/**
 * Honeypot Middleware
 *
 * Refuses a submission that a form-filling bot gave away, on any route that
 * takes one. It reads the two fields the framework's forms already send
 * (`defaults/routes/forms.ts`, `createHoneypot()`):
 *
 * - `_hp`: the value of an input people never see. Bots fill every input, so
 *   any value in it means a bot.
 * - `_renderedMs`: how long the form was open before it was sent. Nobody
 *   reads a form and types a name, an address and a password in under
 *   `config.forms.spam.minSubmitSeconds` (3 by default).
 *
 * A request that carries neither field passes: an API client, a native app or
 * a form written before this existed is not a bot for lacking them. So the
 * middleware is safe to put on a route before its form sends the fields, and
 * it is one signal among others, not the gate. A rate limit is still the
 * route's job.
 *
 * `config.forms.spam.honeypot: false` and `minSubmitSeconds: 0` turn the two
 * checks off, here as on CMS forms.
 *
 * Usage:
 * route.post('/register', 'Actions/Auth/RegisterAction').middleware('honeypot')
 * route.post('/contact', 'Actions/ContactAction').middleware('honeypot')
 *
 * In the form, `createHoneypot()` from `functions/honeypot` supplies the two
 * fields; `components/Dashboard/Auth/Register.stx` is the worked example.
 */
export default new Middleware({
  name: 'honeypot',
  priority: 2,

  handle(request) {
    const body = honeypotBody(request)
    const signal = checkSubmissionSpam(
      { honeypot: body._hp, renderedAtMs: body._renderedMs },
      (config as { forms?: { spam?: { honeypot?: boolean, minSubmitSeconds?: number } } }).forms?.spam ?? {},
    )

    // The same sentence either way, and the one a refused registration
    // already answers with: a bot learns nothing about which field gave it
    // away, and a person who really was that fast is told what to do.
    if (signal === 'honeypot')
      throw new HttpError(422, 'This could not be completed. Please check your details and try again.')
    if (signal === 'too_fast')
      throw new HttpError(429, 'That was submitted too quickly. Please wait a moment and try again.')
  },
})

function honeypotBody(request: unknown): { _hp?: unknown, _renderedMs?: unknown } {
  const req = request as { all?: () => unknown, get?: (key: string) => unknown, body?: unknown }
  const all = typeof req.all === 'function' ? req.all() : undefined
  if (all && typeof all === 'object')
    return all as Record<string, unknown>
  if (typeof req.get === 'function')
    return { _hp: req.get('_hp'), _renderedMs: req.get('_renderedMs') }
  return req.body && typeof req.body === 'object' && !(req.body instanceof ReadableStream) ? req.body as Record<string, unknown> : {}
}
