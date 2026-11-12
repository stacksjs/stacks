/**
 * An action can be run by its name without a route of its own.
 *
 * `resolveActionHandler('Actions/Orders/ShipOrderAction')` hands back what a
 * route registered with that string would run. The dashboard uses it for the
 * actions a model lists under `dashboard.actions`: one route
 * (`POST /models/{slug}/{id}/actions/{name}`) runs whichever action the model
 * named, and it has to behave as that action's own route would, not as a
 * second way of calling `handle()` that skips `validations` and `authorize`.
 *
 * Driven through a real server, with the outer route doing what the dashboard
 * does: resolve by name, call with its own request, return the answer.
 */

import { afterAll, beforeAll, describe, expect, it } from 'bun:test'

let server: any = null
let port = 0
const calls: string[] = []

beforeAll(async () => {
  const { provideActions, resolveActionHandler, route } = await import('../src')
  const { schema } = await import('@stacksjs/validation')

  provideActions({
    'Actions/ResolveTest/Plain': async () => ({
      default: {
        handle: (request: any) => {
          calls.push(`plain:${request.params.id}`)
          return { message: `Ran for ${request.params.id}` }
        },
      },
    }),
    'Actions/ResolveTest/Validated': async () => ({
      default: {
        validations: { reason: { rule: schema.string().required().min(3), message: 'A reason is required.' } },
        handle: () => {
          calls.push('validated')
          return { ok: true }
        },
      },
    }),
    'Actions/ResolveTest/Guarded': async () => ({
      default: {
        authorize: () => false,
        handle: () => {
          calls.push('guarded')
          return { ok: true }
        },
      },
    }),
    'Actions/ResolveTest/Throws': async () => ({
      default: {
        handle: () => {
          throw Object.assign(new Error('Already shipped.'), { status: 409 })
        },
      },
    }),
  })

  route.post('/_resolve/{name}/{id}', async (request: any) => {
    const handler = await resolveActionHandler(`Actions/ResolveTest/${request.params.name}`)
    return handler(request)
  }).skipCsrf()

  server = await route.serve({ port: 0, hostname: '127.0.0.1' })
  port = Number(server?.port ?? server?.server?.port ?? 0)
})

afterAll(() => {
  server?.stop?.()
})

function run(name: string, body: unknown = {}): Promise<Response> {
  return fetch(`http://127.0.0.1:${port}/_resolve/${name}/7`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'accept': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('resolveActionHandler', () => {
  it('runs the named action with the calling route\'s request', async () => {
    const answer = await run('Plain')

    expect(answer.status).toBe(200)
    expect(await answer.json()).toEqual({ message: 'Ran for 7' })
    expect(calls).toContain('plain:7')
  })

  it('checks the action\'s validations before handle() runs', async () => {
    const refused = await run('Validated', {})
    expect(refused.status).toBe(422)
    expect(JSON.stringify(await refused.json())).toContain('A reason is required.')
    expect(calls).not.toContain('validated')

    const accepted = await run('Validated', { reason: 'damaged in transit' })
    expect(accepted.status).toBe(200)
    expect(calls).toContain('validated')
  })

  it('asks the action\'s authorize() before handle() runs', async () => {
    const answer = await run('Guarded')

    expect(answer.status).toBe(403)
    expect(calls).not.toContain('guarded')
  })

  it('leaves an error handle() throws to the route that called it', async () => {
    const answer = await run('Throws')

    expect(answer.status).toBe(409)
    expect(JSON.stringify(await answer.json())).toContain('Already shipped.')
  })

  it('refuses anything that is not an action', async () => {
    const { resolveActionHandler } = await import('../src')

    for (const name of ['Controllers/OrderController@ship', 'Jobs/ShipOrder', '../Actions/Ship', '/etc/passwd', 'Actions/../../secrets', 'Actions/OrderController', ''])
      await expect(resolveActionHandler(name)).rejects.toThrow('does not name an action')
  })
})
