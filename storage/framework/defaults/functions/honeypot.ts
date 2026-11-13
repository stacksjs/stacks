/**
 * The client half of the `honeypot` middleware.
 *
 * A form creates one when it renders, feeds it whatever lands in its hidden
 * input, and spreads `fields()` into what it submits:
 *
 *   const honeypot = createHoneypot()
 *   <input type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" class="hidden" @input="honeypot.set($event.target.value)">
 *   await register({ ...values, ...honeypot.fields() })
 *
 * `_hp` is what a bot typed into the input nobody can see, and `_renderedMs`
 * is how long the form was open. The route's `honeypot` middleware reads both
 * (`app/Middleware/Honeypot.ts`); the names are the ones CMS forms already
 * send. Nothing here touches the page, a signal or the network, so it works
 * in any script and a test can drive the clock.
 */
export interface HoneypotFields {
  /** The hidden input's value. Empty for a person. */
  _hp: string
  /** Milliseconds between creating the honeypot and reading these fields. */
  _renderedMs: number
}

export interface HoneypotTrap {
  /** Record the hidden input's value. */
  set: (value: unknown) => void
  /** The two fields to send with the submission. */
  fields: () => HoneypotFields
}

export function createHoneypot(now: () => number = Date.now): HoneypotTrap {
  const openedAt = now()
  let value = ''
  return {
    set(next) {
      value = typeof next === 'string' ? next : ''
    },
    fields() {
      return { _hp: value, _renderedMs: Math.max(0, now() - openedAt) }
    },
  }
}
