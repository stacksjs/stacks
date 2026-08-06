/**
 * stacksjs/stacks#2227 — a validation failure came back in three different
 * shapes depending on which code path produced it, and the one an Action's
 * `validations:` block produced automatically was the odd one out: it used
 * `error` where everything else uses `message`, and omitted `message` entirely.
 *
 * A client correctly reading `data.message` — which is right for
 * `response.unauthorized()`, `forbidden()`, `error()` and `validationError()` —
 * got `undefined` for the response type forms hit most, and fell back to its own
 * hand-written string. In the reporting app a 5-character password on `/login`
 * failed `min(6)` and the visitor was told "Invalid email or password." for a
 * 422 that was not even a 401.
 */

import { describe, expect, it } from 'bun:test'
import { response } from '@stacksjs/bun-router'

/** The envelope every error response in the framework is supposed to use. */
async function bodyOf(res: Response): Promise<Record<string, unknown>> {
  return await res.json() as Record<string, unknown>
}

describe('the canonical error envelope', () => {
  it('is { success: false, message, errors } for a validation failure', async () => {
    const res = response.validationError({ email: ['is required'] }) as Response

    expect(res.status).toBe(422)
    expect(await bodyOf(res)).toEqual({
      success: false,
      message: 'Validation failed',
      errors: { email: ['is required'] },
    })
  })

  it('uses `message` across every other error helper too', async () => {
    // This is why `message` is the right key: four helpers already agree on it,
    // and the automatic 422 was the only dissenter.
    for (const res of [
      response.unauthorized('nope') as Response,
      response.forbidden('nope') as Response,
      response.notFound('nope') as Response,
      response.error('nope', 400) as Response,
    ]) {
      const body = await bodyOf(res)
      expect(body.message).toBe('nope')
      expect(body.success).toBe(false)
      // The key the automatic 422 used to carry instead.
      expect(body).not.toHaveProperty('error')
    }
  })
})

describe('the automatic 422 emitted for an Action `validations:` block', () => {
  // The router path now delegates to `response.validationError` rather than
  // hand-building a body, so it cannot drift from the envelope again. Asserted
  // against the source, since exercising it needs a booted router + action.
  const src = new URL('../src/stacks-router.ts', import.meta.url).pathname

  it('delegates instead of hand-building the body', async () => {
    const text = await Bun.file(src).text()

    expect(text).toContain('return response.validationError(errors) as Response')
    expect(text).toContain('return validationFailureResponse(validationResult.errors)')
  })

  it('no longer emits the `error`-keyed shape', async () => {
    const text = await Bun.file(src).text()

    // The exact literal that made this path the odd one out.
    expect(text).not.toContain('{ error: \'Validation failed\', errors:')
  })
})

describe('the auto-CRUD write path agrees', () => {
  it('emits the same envelope as the router', async () => {
    // Two more emitters of the old shape lived here. Leaving them would have
    // meant fixing the router and still shipping two shapes.
    const text = await Bun.file(new URL('../../orm/routes.ts', import.meta.url).pathname).text()

    expect(text).not.toContain('{ error: \'Validation failed\', errors:')
    expect(text).toContain('{ success: false, message: \'Validation failed\', errors:')
  })
})
