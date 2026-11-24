import { describe, expect, it } from 'bun:test'

/**
 * A direct native route that fails answers in the router's one error shape,
 * `{ error, message, status, timestamp }`, and says nothing about the cause
 * (stacksjs/stacks#3361). It answered `{ success, message, error }` with the
 * raw `error.message` and `Access-Control-Allow-Origin: *`, whatever the
 * app's CORS policy said.
 */
describe('a failing direct native route', () => {
  it('answers 500 in the standard shape, with no cause and no wildcard CORS', async () => {
    const { createStacksRouter } = await import('../src')
    const direct = createStacksRouter({ csrf: false })
    // A BigInt cannot be serialized, so the handler's promise rejects past
    // the action wrapper and the native route's own error path answers.
    direct.get('/_shape/native-failure', async () => ({ secret: 'db password is hunter2', invalid: 1n }))
    const server = await direct.serve({ port: 0, hostname: '127.0.0.1', nativeRoutes: true })
    const quiet = console.error
    console.error = () => {}
    try {
      const routes = (direct.bunRouter as any)._buildNativeRoutes()
      const answer = await routes['/_shape/native-failure'].GET(new Request('http://localhost/_shape/native-failure', { headers: { accept: 'application/json' } }))

      expect(answer.status).toBe(500)
      expect(answer.headers.get('access-control-allow-origin')).toBeNull()
      const text = await answer.text()
      expect(text).not.toContain('BigInt')
      const body = JSON.parse(text)
      // `request_id` is the router's usual addition to an error body.
      expect(Object.keys(body).filter(key => key !== 'request_id').sort()).toEqual(['error', 'message', 'status', 'timestamp'])
      expect(body).toMatchObject({ error: 'Internal Server Error', message: 'An unexpected error occurred.', status: 500 })
    }
    finally {
      console.error = quiet
      server.stop()
    }
  })
})

describe('nativeRouteErrorResponse, with no error handler to defer to', () => {
  it('is the standard 500: no cause, no wildcard CORS, security headers on', async () => {
    const { nativeRouteErrorResponse } = await import('../src/stacks-router')
    const answer = nativeRouteErrorResponse()

    expect(answer.status).toBe(500)
    expect(answer.headers.get('access-control-allow-origin')).toBeNull()
    expect(answer.headers.get('content-type')).toContain('application/json')
    expect(answer.headers.get('x-content-type-options')).toBe('nosniff')
    const body = await answer.json()
    expect(Object.keys(body).sort()).toEqual(['error', 'message', 'status', 'timestamp'])
    expect(body).toMatchObject({ error: 'Internal Server Error', message: 'An unexpected error occurred.', status: 500 })
  })
})
