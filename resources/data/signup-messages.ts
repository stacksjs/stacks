/**
 * What the launch-list signup can come to, and what the reader is told.
 *
 * Imported by the server (subscribeNotice in ./blog.ts, for a plain form post
 * that comes back with `?subscribe=<outcome>`) and by the browser (the
 * SignupForm component, which answers in place). It imports nothing, so the
 * client bundle stays this table and one function.
 */

export interface SubscribeNotice {
  tone: 'success' | 'error'
  text: string
}

/** What /api/email/subscribe can answer, as `?subscribe=<outcome>`. */
export type SubscribeOutcome = 'subscribed' | 'already' | 'invalid' | 'busy' | 'error'

export const subscribeMessages: Record<SubscribeOutcome, SubscribeNotice> = {
  subscribed: { tone: 'success', text: 'Thanks, you are on the list. A welcome email is on its way to your inbox.' },
  already: { tone: 'success', text: 'You are already on the list. We will write the day Stacks opens up.' },
  invalid: { tone: 'error', text: 'That email address did not look right. Try it again?' },
  busy: { tone: 'error', text: 'That was a lot of tries in a minute. Give it a moment and try again.' },
  error: { tone: 'error', text: 'Something went wrong on our side and you are not on the list yet. Please try again.' },
}

/** Whether a string names an outcome (and not, say, `toString`). */
export function isSubscribeOutcome(value: unknown): value is SubscribeOutcome {
  return typeof value === 'string' && Object.hasOwn(subscribeMessages, value)
}

/** Read the JSON answer /api/email/subscribe gives a script as an outcome. */
export function subscribeOutcome(status: number, body: unknown): SubscribeOutcome {
  const data = body && typeof body === 'object' ? body as { success?: unknown, message?: unknown } : {}

  if (status === 429)
    return 'busy'

  if (status >= 200 && status < 300) {
    if (data.success === true)
      return data.message === 'Already subscribed' ? 'already' : 'subscribed'
    if (data.success === false)
      return 'invalid'
  }

  return 'error'
}
