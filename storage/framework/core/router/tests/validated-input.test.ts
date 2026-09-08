/**
 * `request.getValidated()` and `request.safe()` are Laravel's
 * `$request->validated()` under different names: the declared fields, already
 * checked, without whatever else the client sent.
 *
 * They returned `{}` after a request the router had just validated. The only
 * way to populate them was to call `request.validate()` again inside the
 * handler, redoing work done a few frames up - and the declared return type
 * promised the fields either way, so a handler reading `getValidated().email`
 * type-checked and got `undefined`.
 *
 * Absent optional fields are absent here too, which is both what Laravel does
 * and what the inferred payload type now says: a rule without `.required()`
 * produces an optional key.
 */

import { describe, expect, it } from 'bun:test'
import { schema } from '@stacksjs/validation'
import { Action } from '@stacksjs/actions'
import { createStacksRouter } from '../src/stacks-router'

function subject() {
  const action = new Action({
    name: 'ValidatedSubject',
    skipCsrf: true,
    validations: {
      email: { rule: schema.string().email().required() },
      age: { rule: schema.number().integer().positive() },
    },
    async handle(req: any) {
      return { validated: req.getValidated(), onlyEmail: req.safe().only(['email']) }
    },
  })

  const router = createStacksRouter()
  router.post('/validated-subject', action as any)
  return router
}

async function post(body: unknown): Promise<any> {
  const res = await subject().bunRouter.handleRequest(new Request('http://localhost/validated-subject', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }))
  return res.json()
}

describe('the router records what it validated', () => {
  it('returns the declared fields', async () => {
    const { validated } = await post({ email: 'a@b.com', age: 3 })

    expect(validated).toEqual({ email: 'a@b.com', age: 3 })
  })

  it('leaves out what was never declared', async () => {
    const { validated } = await post({ email: 'a@b.com', age: 3, extra: 'undeclared' })

    expect(validated).not.toHaveProperty('extra')
  })

  it('omits an optional field that was not sent', async () => {
    const { validated } = await post({ email: 'a@b.com' })

    expect(validated).toEqual({ email: 'a@b.com' })
  })

  it('feeds safe(), which is the same data behind a picker', async () => {
    const { onlyEmail } = await post({ email: 'a@b.com', age: 3 })

    expect(onlyEmail).toEqual({ email: 'a@b.com' })
  })
})

describe('action validation error labels', () => {
  it('keeps labels and request-specific messages correct across repeated failures', async () => {
    const router = createStacksRouter()
    let handled = false
    router.post('/validation-labels', {
      skipCsrf: true,
      validations: {
        display_name: {
          rule: { validate: value => ({ valid: false, errors: [{ message: `cannot use ${value}` }, { message: 'must be public' }] }) },
        },
        'contact-email': {
          rule: { validate: () => ({ valid: false, errors: [{ message: 'Contact email is unavailable' }] }) },
        },
        apiKey: {
          rule: { validate: () => ({ valid: false, errors: [{ message: 'APIKEY was revoked' }, { message: 'must be active' }] }) },
        },
      },
      handle() { handled = true; return { ok: true } },
    })

    const send = (value: string) => router.handleRequest(new Request('http://localhost/validation-labels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: value }),
    }))
    const first = await send('first')
    const second = await send('second')

    for (const [response, value] of [[first, 'first'], [second, 'second']] as const) {
      expect(response.status).toBe(422)
      expect(await response.json()).toEqual({
        success: false,
        message: 'Validation failed',
        request_id: expect.any(String),
        errors: {
          display_name: [`Display name cannot use ${value}`, 'Display name must be public'],
          'contact-email': ['Contact email is unavailable'],
          apiKey: ['APIKEY was revoked', 'Api Key must be active'],
        },
      })
    }
    expect(handled).toBe(false)
  })

  it('preserves custom messages, missing details and thrown validators on warm requests', async () => {
    const router = createStacksRouter()
    router.post('/validation-custom-labels', {
      skipCsrf: true,
      validations: {
        custom_text: { rule: { validate: () => ({ valid: false, errors: [{ message: 'ignored' }] }) }, message: 'Custom text override' },
        custom_map: { rule: { validate: () => ({ valid: false, errors: [{ message: 'ignored' }] }) }, message: { custom_map: 'Custom map override' } },
        fallback_map: { rule: { validate: () => ({ valid: false, errors: [{ message: 'must be accepted' }] }) }, message: {} },
        missing_details: { rule: { validate: () => ({ valid: false }) } },
        throwing_rule: { rule: { validate() { throw new Error('validator failed') } } },
      },
      handle: () => ({ ok: true }),
    })

    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await router.handleRequest(new Request('http://localhost/validation-custom-labels', { method: 'POST' }))
      expect(response.status).toBe(422)
      expect((await response.json()).errors).toEqual({
        custom_text: ['Custom text override'],
        custom_map: ['Custom map override'],
        fallback_map: ['Fallback map must be accepted'],
        missing_details: ['Missing details is invalid'],
        throwing_rule: ['throwing_rule validation failed'],
      })
    }
  })
})
