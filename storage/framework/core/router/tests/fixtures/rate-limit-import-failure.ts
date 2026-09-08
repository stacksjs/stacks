import type { EnhancedRequest } from '@stacksjs/bun-router'
import { mock } from 'bun:test'
import { strict as assert } from 'node:assert'
import process from 'node:process'

// Isolate the module-loader failure from the parent suite's successful import.
mock.module(Bun.resolveSync('ts-rate-limiter', import.meta.dir), () => {
  throw new Error('limiter import unavailable')
})
const { runWithRequest } = await import('../../src/request-context')
const { clearRateLimit, rateLimit, rateLimitStatus } = await import('../../src/rate-limit')
const { createStacksRouter } = await import('../../src/stacks-router')
const router = createStacksRouter({ autoDiscoverRoutes: false })
router.get('/without-rate-limit', () => ({ ok: true }))
const response = await router.handleRequest(new Request('http://localhost/without-rate-limit'))
assert.equal(response.status, 200)
assert.deepEqual(await response.json(), { ok: true })
const unhandled: unknown[] = []
process.on('unhandledRejection', reason => unhandled.push(reason))
const request = new Request('http://localhost', { headers: { 'x-real-ip': '192.0.2.1' } }) as EnhancedRequest
await runWithRequest(request, async () => {
  await assert.rejects(() => rateLimit('failure', 1).per('minute'), /limiter import unavailable/)
  await assert.rejects(() => rateLimitStatus('failure', 1, 60), /limiter import unavailable/)
  await assert.rejects(() => clearRateLimit('failure', 1, 60), /limiter import unavailable/)
})
// Unhandled rejections are reported after promise callbacks finish.
await Bun.sleep(10)
assert.equal(unhandled.length, 0)
