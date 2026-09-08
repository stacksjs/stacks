import { mock } from 'bun:test'
import { strict as assert } from 'node:assert'
import process from 'node:process'
import { clearMiddlewareCache, createStacksRouter } from '../../src/stacks-router'

const modulePath = Bun.resolveSync('../../../../defaults/app/Middleware/Cors.ts', import.meta.dir)
const router = createStacksRouter({ autoDiscoverRoutes: false })
router.get('/cors-loader', (req) => {
  req._corsConfig = { origin: '*', methods: [], allowedHeaders: [], exposedHeaders: [], credentials: false, maxAge: 0 }
  return { ok: true }
})
const dispatch = () => router.handleRequest(new Request('https://example.test/cors-loader', { headers: { accept: 'application/json' } }))

if (process.argv[2] === 'failure') {
  const unhandled: unknown[] = []
  process.on('unhandledRejection', error => unhandled.push(error))
  mock.module(modulePath, () => { throw new Error('CORS import unavailable') })
  for (const response of await Promise.all([dispatch(), dispatch()])) {
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { ok: true })
    assert.equal(response.headers.get('access-control-allow-origin'), null)
  }
  const retried = await dispatch()
  assert.equal(retried.status, 200)
  assert.deepEqual(await retried.json(), { ok: true })
  assert.equal(retried.headers.get('access-control-allow-origin'), null)
  await Bun.sleep(10)
  assert.equal(unhandled.length, 0)
}
else {
  const original = { ...await import(modulePath) }
  const apply = original.applyCorsHeaders
  const install = (version: string) => mock.module(modulePath, () => ({
    ...original,
    applyCorsHeaders(req: Request, response: Response, cfg: unknown) {
      response.headers.set('x-cors-version', version)
      return apply(req, response, cfg)
    },
  }))
  install('first')
  assert.equal((await dispatch()).headers.get('x-cors-version'), 'first')
  install('second')
  clearMiddlewareCache()
  const response = await dispatch()
  assert.equal(response.headers.get('x-cors-version'), 'second')
  assert.equal(response.headers.get('access-control-allow-origin'), '*')
}
