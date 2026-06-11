/**
 * Wire-level regression for the handler chokepoint (stacksjs/stacks#1957).
 *
 * Before this fix, `wrapHandler`'s catch forwarded only `{ handlerPath }` to
 * `createErrorResponse`, whose status defaults to 500 (`options?.status || 500`).
 * A handler-thrown `HttpError(409, …)` therefore came out HTTP 500 over the
 * wire — flattening the status AND masking the message — even though #1946 had
 * already taught `createErrorResponse` to surface 4xx messages when given a
 * status. The chokepoint now extracts the thrown error's status/statusCode and
 * forwards it, so action-thrown 4xx HttpErrors (register()'s 409, the new
 * commerce/cms 409s, validation 422s) reach the client correctly while 5xx and
 * plain Errors stay masked at 500.
 *
 * These exercise the real string-handler resolution path (the only path the
 * chokepoint covers): a throwing Action fixture on disk, dispatched through
 * `createStacksRouter().handleRequest` in production mode with a Bearer header
 * (CSRF bypass).
 */

import { afterAll, beforeAll, beforeEach, afterEach, describe, expect, test } from 'bun:test'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { projectPath } from '@stacksjs/path'
import { createStacksRouter } from '../src/stacks-router'

const actionsDir = projectPath('app/Actions')
const fixtures = [
  {
    name: 'ConflictFixtureAction',
    body: `import { HttpError } from '@stacksjs/error-handling'
export default {
  name: 'ConflictFixtureAction',
  method: 'POST',
  skipCsrf: true,
  apiResponse: true,
  async handle() { throw new HttpError(409, 'Email already exists') },
}`,
  },
  {
    name: 'ValidationFixtureAction',
    body: `import { HttpError } from '@stacksjs/error-handling'
export default {
  name: 'ValidationFixtureAction',
  method: 'POST',
  skipCsrf: true,
  apiResponse: true,
  async handle() { throw new HttpError(422, 'Validation failed', { email: ['required'] }) },
}`,
  },
  {
    name: 'BoomFixtureAction',
    body: `export default {
  name: 'BoomFixtureAction',
  method: 'POST',
  skipCsrf: true,
  apiResponse: true,
  async handle() { throw new Error('db connection string leaked') },
}`,
  },
]

let prevAppEnv: string | undefined
let prevNodeEnv: string | undefined

beforeAll(() => {
  mkdirSync(actionsDir, { recursive: true })
  for (const f of fixtures)
    writeFileSync(`${actionsDir}/${f.name}.ts`, f.body)
})

afterAll(() => {
  for (const f of fixtures)
    rmSync(`${actionsDir}/${f.name}.ts`, { force: true })
})

beforeEach(() => {
  prevAppEnv = process.env.APP_ENV
  prevNodeEnv = process.env.NODE_ENV
  process.env.APP_ENV = 'production'
  process.env.NODE_ENV = 'production'
})

afterEach(() => {
  if (prevAppEnv === undefined) delete process.env.APP_ENV
  else process.env.APP_ENV = prevAppEnv
  if (prevNodeEnv === undefined) delete process.env.NODE_ENV
  else process.env.NODE_ENV = prevNodeEnv
})

function postReq(path: string): Request {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'content-type': 'application/json',
      // Bearer presence bypasses CSRF for the state-mutating method.
      'authorization': 'Bearer test-token',
    },
    body: '{}',
  })
}

describe('handler-thrown HttpError reaches the wire with its status (#1957)', () => {
  test('thrown HttpError(409) surfaces as HTTP 409 with the clean message', async () => {
    const router = createStacksRouter()
    router.post('/api/conflict-fixture', 'Actions/ConflictFixtureAction')
    const res = await router.handleRequest(postReq('/api/conflict-fixture'))

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toBe('Conflict')
    expect(body.message).toBe('Email already exists')
  })

  test('thrown HttpError(422, …, details) surfaces 422 with details', async () => {
    const router = createStacksRouter()
    router.post('/api/validation-fixture', 'Actions/ValidationFixtureAction')
    const res = await router.handleRequest(postReq('/api/validation-fixture'))

    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error).toBe('Unprocessable Entity')
    expect(body.message).toBe('Validation failed')
    expect(body.details).toEqual({ email: ['required'] })
  })

  test('a plain thrown Error stays 500 with a masked body (no leak)', async () => {
    const router = createStacksRouter()
    router.post('/api/boom-fixture', 'Actions/BoomFixtureAction')
    const res = await router.handleRequest(postReq('/api/boom-fixture'))

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(JSON.stringify(body)).not.toContain('db connection string')
  })
})
