/**
 * A handler that validates for itself answers in the same 422 envelope as a
 * `validations:` block (stacksjs/stacks#3012).
 *
 * `request.validate()` inside `handle()` throws `HttpError(422, ..., { errors })`.
 * The router serialized that through the generic error path, which nested the
 * field map under `details` in production and dropped it altogether in
 * development. Clients read `errors`, so a dashboard dialog that failed
 * validation showed no message at all and the caller could not tell which field
 * was wrong.
 */

import { afterEach, describe, expect, it } from 'bun:test'
import process from 'node:process'
import { schema } from '@stacksjs/validation/runtime'
import { Action } from '@stacksjs/actions'
import { createStacksRouter } from '../src/stacks-router'

const originalEnv = process.env.APP_ENV

function subject() {
  const router = createStacksRouter()
  router.post('/self-validating', new Action({
    name: 'SelfValidating',
    skipCsrf: true,
    async handle(req: any) {
      await req.validate({ parent_id: { rule: schema.number() } })
      return { ok: true }
    },
  }) as any)
  return router
}

describe('a validation error thrown by a handler', () => {
  afterEach(() => {
    if (originalEnv === undefined)
      delete process.env.APP_ENV
    else
      process.env.APP_ENV = originalEnv
  })

  for (const env of ['development', 'production']) {
    it(`names the failing field in ${env}`, async () => {
      process.env.APP_ENV = env
      const response = await subject().handleRequest(new Request('http://localhost/self-validating', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'accept': 'application/json' },
        body: JSON.stringify({ parent_id: 'not a number' }),
      }))

      expect(response.status).toBe(422)
      const body = await response.json()
      expect(Object.keys(body.errors ?? {})).toEqual(['parent_id'])
      expect(body.errors.parent_id.length).toBeGreaterThan(0)
      expect(typeof body.message).toBe('string')
    })
  }
})
