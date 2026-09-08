import { expect, it } from 'bun:test'
import { config, overridesReady } from '@stacksjs/config'
import { clearMiddlewareCache, createStacksRouter } from '../src/stacks-router'

it.each([false, true])('keeps repeated body and negated-middleware errors request-specific (nativeRoutes=%s)', async (nativeRoutes) => {
  await overridesReady
  const previous = config.app.env
  config.app.env = 'production'
  const router = createStacksRouter({ autoDiscoverRoutes: false })
  const path = `/http-error-imports-${nativeRoutes}`
  let calls = 0
  router.post(`${path}/body`, (req) => {
    calls++
    return req.jsonBody
  }).skipCsrf()
  router.get(`${path}/environment`, () => ({ calls: ++calls })).middleware('!env:production')
  router.get(`${path}/logger`, () => ({ calls: ++calls })).middleware('!logger')
  const server = await router.serve({ port: 0, hostname: '127.0.0.1', nativeRoutes })

  try {
    const base = `http://127.0.0.1:${server.port}${path}`
    const post = (body: string) => fetch(`${base}/body`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body,
    })
    for (let attempt = 0; attempt < 2; attempt++) {
      const malformed = await Promise.all(['{"truncated":', 'not-json'].map(post))
      const messages: string[] = []
      for (const response of malformed) {
        expect(response.status).toBe(400)
        expect(response.headers.get('x-content-type-options')).toBe('nosniff')
        const body = await response.json()
        expect(body.error).toBe('Bad Request')
        expect(body.message).toStartWith('Invalid JSON body:')
        messages.push(body.message)
      }
      expect(messages[0]).not.toBe(messages[1])

      for (const [suffix, name] of [['environment', 'env:production'], ['logger', 'logger']]) {
        const response = await fetch(`${base}/${suffix}`, { headers: { accept: 'application/json' } })
        expect(response.status).toBe(403)
        expect(response.headers.get('x-content-type-options')).toBe('nosniff')
        const body = await response.json()
        expect(body.error).toBe('Forbidden')
        expect(body.message).toBe(`Access denied. This route requires "${name}" not to apply.`)
      }
    }
    expect(calls).toBe(0)

    const valid = await post('{"ok":true}')
    expect(valid.status).toBe(200)
    expect(await valid.json()).toEqual({ ok: true })
    config.app.env = 'local'
    const allowed = await fetch(`${base}/environment`)
    expect(allowed.status).toBe(200)
    expect(await allowed.json()).toEqual({ calls: 2 })
  }
  finally {
    await server.stop(true)
    config.app.env = previous
    clearMiddlewareCache()
  }
})
