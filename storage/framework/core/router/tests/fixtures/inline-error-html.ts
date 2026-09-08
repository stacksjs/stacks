import { strict as assert } from 'node:assert'
import { HttpError } from '@stacksjs/error-handling'
import { createStacksRouter } from '../../src/stacks-router'

const router = createStacksRouter({ autoDiscoverRoutes: false })
let calls = 0
router.get('/cold-html-error', () => {
  calls++
  throw new HttpError(409, 'Conflict')
})
const server = await router.serve({ port: 0, nativeRoutes: true })
try {
  const response = await fetch(`http://localhost:${server.port}/cold-html-error`, {
    headers: { accept: 'text/html', 'x-request-id': 'cold-html-error' },
  })
  assert.equal(response.status, 409)
  assert.equal(calls, 1)
  assert.match(response.headers.get('content-type') ?? '', /text\/html/)
  assert.equal(response.headers.get('x-request-id'), 'cold-html-error')
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
  assert.match(response.headers.get('set-cookie') ?? '', /X-CSRF-Token=/)
  await response.text()
}
finally {
  await server.stop(true)
}
