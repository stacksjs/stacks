/**
 * The launch-list signup, answered in place.
 *
 * Without JavaScript a signup form posts to /api/email/subscribe and the API
 * sends the browser back to the page with `?subscribe=<outcome>`: a full
 * reload that lands the reader back at the form. That still works and stays
 * the fallback. With JavaScript this takes over the submit: the button shows
 * a spinner, the request goes out with fetch, and the answer appears under
 * the field. The page does not move.
 *
 * It ships as text, the way the theme bootstrap does (resources/data/theme.ts):
 * a client `<script>` in a marketing view or partial would pull in the stx
 * runtime, 250 KB, for one form. `signupScript` is emitted raw with
 * `{!! signupScript !!}`, and carries the same message table the server
 * renders from, so the two paths always say the same thing.
 */

import type { SubscribeNotice, SubscribeOutcome } from './blog'
import { subscribeMessages } from './blog'

/**
 * Read the JSON answer of /api/email/subscribe as an outcome. Runs in the
 * browser as well as here: `signupScript` ships its source.
 */
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

/**
 * Runs in the browser, never on the server. It must stand alone: everything
 * it uses arrives as an argument.
 *
 * A form opts in with `data-signup`. Inside it: the submit button, a
 * `[data-signup-notice="success"]` and a `[data-signup-notice="error"]`
 * element (rendered hidden by resources/partials/signup-notice.stx, so their
 * icons are already in the page's CSS), each with a `[data-signup-text]`,
 * and optionally `[data-signup-fine]` fine print that a notice replaces.
 */
function enhanceSignupForms(
  outcomeOf: (status: number, body: unknown) => SubscribeOutcome,
  messages: Record<SubscribeOutcome, SubscribeNotice>,
): void {
  // Long enough to read as "working" rather than a flicker, short enough
  // never to be the slow part.
  const minimumSpin = 450

  const enhance = (form: HTMLFormElement): void => {
    if (form.dataset.signupReady)
      return
    form.dataset.signupReady = 'true'

    const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')
    const input = form.querySelector<HTMLInputElement>('input[name="email"]')
    const fine = form.querySelector<HTMLElement>('[data-signup-fine]')

    const show = (outcome: SubscribeOutcome): void => {
      const notice = messages[outcome]

      for (const element of form.querySelectorAll<HTMLElement>('[data-signup-notice]')) {
        const match = element.dataset.signupNotice === notice.tone
        element.hidden = !match
        const text = element.querySelector('[data-signup-text]')
        if (match && text)
          text.textContent = notice.text
      }

      if (fine)
        fine.hidden = true
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault()
      if (form.dataset.signupBusy)
        return

      form.dataset.signupBusy = 'true'
      form.classList.add('is-loading')
      form.setAttribute('aria-busy', 'true')
      if (button)
        button.disabled = true

      const request = (async (): Promise<SubscribeOutcome> => {
        try {
          const response = await fetch(form.action, {
            method: 'POST',
            headers: { 'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(new FormData(form) as unknown as Record<string, string>).toString(),
          })
          let body: unknown = null
          try {
            body = await response.json()
          }
          catch {}
          return outcomeOf(response.status, body)
        }
        catch {
          return 'error'
        }
      })()

      const [outcome] = await Promise.all([request, new Promise(resolve => setTimeout(resolve, minimumSpin))])

      show(outcome)

      if (input) {
        if (outcome === 'subscribed' || outcome === 'already')
          input.value = ''
        else
          input.focus()
      }

      form.classList.remove('is-loading')
      form.removeAttribute('aria-busy')
      if (button)
        button.disabled = false
      delete form.dataset.signupBusy
    })
  }

  const run = (): void => {
    for (const form of document.querySelectorAll<HTMLFormElement>('form[data-signup]'))
      enhance(form)
  }

  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', run, { once: true })
  else
    run()
}

/**
 * The whole `<script>` element, for `{!! signupScript !!}` once per page that
 * has a signup form. Running it twice is harmless; a form is enhanced once.
 */
export const signupScript = `<script>(${enhanceSignupForms.toString()})(${subscribeOutcome.toString()}, ${JSON.stringify(subscribeMessages).replace(/</g, '\\u003c')})</script>`
