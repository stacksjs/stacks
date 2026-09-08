import { mock } from 'bun:test'
import { strict as assert } from 'node:assert'
import process from 'node:process'
import { clearMiddlewareCache, createStacksRouter } from '../../src/stacks-router'

const modulePath = Bun.resolveSync('../../../../defaults/app/Middleware/Compress.ts', import.meta.dir)
const router = createStacksRouter({ autoDiscoverRoutes: false })
router.get('/compression-loader', (req) => {
  req._compress = true
  return { ok: true }
})
const dispatch = () => router.handleRequest(new Request('https://example.test/compression-loader', { headers: { accept: 'application/json' } }))

if (process.argv[2] === 'failure') {
  const unhandled: unknown[] = []
  process.on('unhandledRejection', error => unhandled.push(error))
  mock.module(modulePath, () => { throw new Error('Compression import unavailable') })
  for (const response of await Promise.all([dispatch(), dispatch()])) {
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { ok: true })
    assert.equal(response.headers.get('content-encoding'), null)
  }
  const retried = await dispatch()
  assert.equal(retried.status, 200)
  assert.deepEqual(await retried.json(), { ok: true })
  assert.equal(retried.headers.get('content-encoding'), null)
  await Bun.sleep(10)
  assert.equal(unhandled.length, 0)
}
else if (process.argv[2] === 'function-failure') {
  const original = { ...await import(modulePath) }
  let calls = 0
  mock.module(modulePath, () => ({
    ...original,
    async applyCompression(req: Request, response: Response) {
      if (++calls === 1) throw new Error('Compression temporarily unavailable')
      response.headers.set('x-compression-recovered', 'true')
      return original.applyCompression(req, response)
    },
  }))
  const failed = await dispatch()
  assert.equal(failed.status, 200)
  assert.deepEqual(await failed.json(), { ok: true })
  const recovered = await dispatch()
  assert.equal(recovered.headers.get('x-compression-recovered'), 'true')
  assert.deepEqual(await recovered.json(), { ok: true })
  assert.equal(calls, 2)
}
else {
  const original = { ...await import(modulePath) }
  const apply = original.applyCompression
  const install = (version: string) => mock.module(modulePath, () => ({
    ...original,
    applyCompression(req: Request, response: Response) {
      response.headers.set('x-compression-version', version)
      return apply(req, response)
    },
  }))
  install('first')
  assert.equal((await dispatch()).headers.get('x-compression-version'), 'first')
  install('second')
  clearMiddlewareCache()
  const response = await dispatch()
  assert.equal(response.headers.get('x-compression-version'), 'second')
  assert.equal(response.headers.get('content-encoding'), null)
  assert.deepEqual(await response.json(), { ok: true })
}
