/**
 * Refuse a request from inside `handle()` (stacksjs/stacks#3311).
 *
 * `validations` refuse a field before `handle()` runs. Some refusals are only
 * known once it has: the cart is empty, the item has gone, the order is
 * already paid. Actions wrote those as `response.json({ error }, 400)`, and a
 * browser form posting there was shown that JSON.
 *
 * `refuse()` answers a caller that asked for data with exactly that body, and
 * marks it so the router can send a browser form back to its page with the
 * message instead (`requestContext.formError()`, or `error(field)` when the
 * refusal names one).
 *
 * ```ts
 * if (!cart)
 *   return refuse('Your cart is empty.', { status: 400 })
 * ```
 */

import type { RefusalResponse } from '@stacksjs/actions'

/**
 * Where the router reads what a refusal says: on the `Response` an action
 * returns, or on an error a middleware throws. A registered symbol, so code
 * that must not load the router (the CSRF middleware) can set it too.
 */
export const FORM_REFUSAL: unique symbol = Symbol.for('stacks.formRefusal')

export interface FormRefusal {
  /** What to tell the person, in a sentence. */
  message: string
  /** The field it is about, when it is about one. */
  field?: string
  /** The status a caller that asked for data is answered with. */
  status: number
}

export interface RefuseOptions {
  /** The status for a caller that asked for data. `422` unless said otherwise. */
  status?: number
  /** The field the message is about. Without one it is about the whole form. */
  field?: string
}

/**
 * A refusal: `{ error: message }` with `status` (and `errors` by field when
 * one is named) for a caller that asked for data, and the person's page,
 * saying `message`, for a browser form.
 */
export function refuse(message: string, options: RefuseOptions = {}): RefusalResponse {
  const status = options.status ?? 422
  if (!Number.isInteger(status) || status < 400 || status > 599)
    throw new RangeError(`refuse() needs a 4xx or 5xx status, not ${status}`)
  const body: Record<string, unknown> = { error: message }
  if (options.field)
    body.errors = { [options.field]: [message] }
  const answer = Response.json(body, { status })
  const refusal: FormRefusal = { message, status, ...(options.field ? { field: options.field } : {}) }
  Object.defineProperty(answer, FORM_REFUSAL, { value: refusal })
  return answer as RefusalResponse
}

/** What a refusal says, or undefined when `value` is not one. */
export function formRefusalOf(value: unknown): FormRefusal | undefined {
  if (value === null || typeof value !== 'object')
    return undefined
  const refusal = (value as Record<symbol, unknown>)[FORM_REFUSAL] as FormRefusal | undefined
  return refusal && typeof refusal.message === 'string' && typeof refusal.status === 'number' ? refusal : undefined
}
