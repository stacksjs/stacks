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
