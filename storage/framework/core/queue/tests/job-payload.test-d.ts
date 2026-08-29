/**
 * A job's declared payload is enforced at every dispatcher.
 *
 * `Job` was not generic. `handle` took `JobHandler = (_data?: any) => …` and
 * each dispatcher declared its OWN free generic, `dispatch<T = unknown>(payload?:
 * T)`, so the two were unrelated types that could never disagree. A job written
 *
 *   new Job({ handle(payload: { email: string, name?: string }) { … } })
 *
 * accepted `dispatch({ emial: … })`, `dispatch('a bare string')` and bare
 * `dispatch()` alike. The declared payload was decorative, and the failure
 * arrived as a runtime read of `undefined` inside the worker - far from the
 * call that caused it, on a queue, usually in production.
 *
 * Nothing here executes; it is checked by `bun run typecheck`.
 */

import { Job } from '../src/action'

// ── a job that declares what it takes ─────────────────────────────────────

const sendWelcomeEmail = new Job({
  name: 'SendWelcomeEmail',
  async handle(payload: { email: string, name?: string }) {
    return payload.email
  },
})

// The declared shape is accepted, with and without the optional member.
export const good = async (): Promise<void> => {
  await sendWelcomeEmail.dispatch({ email: 'a@example.com', name: 'Chris' })
  await sendWelcomeEmail.dispatch({ email: 'a@example.com' })
}

export const misspelled = async (): Promise<void> => {
  // @ts-expect-error - 'emial' is not a member of the declared payload.
  await sendWelcomeEmail.dispatch({ emial: 'a@example.com' })
}

export const wrongShape = async (): Promise<void> => {
  // @ts-expect-error - a string is not the declared payload.
  await sendWelcomeEmail.dispatch('a@example.com')
}

export const missingPayload = async (): Promise<void> => {
  // @ts-expect-error - the job declares a payload, so one is required.
  await sendWelcomeEmail.dispatch()
}

// Every dispatcher speaks the same type, not just `dispatch`.
export const siblings = async (): Promise<void> => {
  await sendWelcomeEmail.dispatchNow({ email: 'a@example.com' })
  await sendWelcomeEmail.dispatchIf(true, { email: 'a@example.com' })
  await sendWelcomeEmail.dispatchUnless(false, { email: 'a@example.com' })
  await sendWelcomeEmail.dispatchAfter(60, { email: 'a@example.com' })
}

export const siblingsAreChecked = async (): Promise<void> => {
  // @ts-expect-error - dispatchNow is held to the same shape as dispatch.
  await sendWelcomeEmail.dispatchNow({ emial: 'a@example.com' })
  // @ts-expect-error - and so is dispatchAfter.
  await sendWelcomeEmail.dispatchAfter(60, 'a@example.com')
}

// ── a job that declares nothing ───────────────────────────────────────────

// A job with no payload must stay dispatchable bare, which is what the
// framework's own scheduled jobs do.
const inspire = new Job({
  name: 'Inspire',
  handle: () => ({ quote: 'hello' }),
})

export const bare = async (): Promise<void> => {
  await inspire.dispatch()
  await inspire.dispatchNow()
}
