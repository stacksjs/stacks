import assert from 'node:assert/strict'
import { Database } from 'bun:sqlite'
import { config, overridesReady } from '@stacksjs/config'
import { initializeDbConfig, resetDatabaseConnection } from '@stacksjs/database/runtime'
import { createStacksRouter } from '../../src/stacks-router'
import { flushRequestCaptures } from '../../src/request-capture'
import { beginRequestCapture, finishRequestCapture } from '../../src/request-capture'
import { proxyToBackend } from '@stacksjs/server/proxy'

await overridesReady
const file = process.env.HTTP_CAPTURE_TEST_FILE!
const database = new Database(file)
database.exec(`CREATE TABLE requests (
 id INTEGER PRIMARY KEY, method TEXT, path TEXT, status_code INTEGER,
 duration_ms INTEGER, memory_usage INTEGER, ip_address TEXT, user_agent TEXT,
 error_message TEXT, created_at TEXT, updated_at TEXT
)`)
initializeDbConfig({ database: { default: 'sqlite', connections: { sqlite: { database: file } } } })
config.server = { captureRequests: { enabled: true, exclude: ['/assets/*'] } }

try {
  for (const nativeRoutes of [false, true]) {
    database.exec('DELETE FROM requests')
    const router = createStacksRouter({ autoDiscoverRoutes: false, csrf: false })
    router.get('/ok', () => new Response('hello'))
    router.get('/denied', () => new Response('no', { status: 401 }))
    router.get('/failure', () => new Response('private details', { status: 503 }))
    router.get('/protected', () => new Response('should not run')).middleware('auth')
    router.get('/throws', () => { throw new Error('private-throw') })
    router.post('/body', async request => new Response(await request.text(), { status: 201 }))
    router.get('/api/dashboard/poll', () => new Response())
    router.get('/assets/app.js', () => new Response())
    const server = await router.serve({ port: 0, nativeRoutes })
    try {
      const origin = `http://localhost:${server.port}`
      for (const [path, expected] of [['/ok?token=secret-query', 200], ['/denied', 401], ['/failure', 503], ['/missing', 404], ['/throws', 500]] as const) {
        const response = await fetch(origin + path, { headers: { authorization: 'Bearer private-header' } })
        assert.equal(response.status, expected)
        await response.arrayBuffer()
      }
      const protectedResponse = await fetch(origin + '/protected')
      assert.equal(protectedResponse.status, 401)
      await protectedResponse.arrayBuffer()
      const posted = await fetch(origin + '/body', { method: 'POST', body: 'private-body' })
      assert.equal(posted.status, 201)
      assert.equal(await posted.text(), 'private-body')
      const wrongMethod = await fetch(origin + '/ok', { method: 'PROPFIND' })
      assert.equal(wrongMethod.status, 405)
      await wrongMethod.arrayBuffer()
      const head = await fetch(origin + '/ok', { method: 'HEAD' })
      assert.equal(head.status, 200)
      assert.equal(await head.text(), '')
      const preflight = await fetch(origin + '/ok', { method: 'OPTIONS' })
      assert.equal(preflight.status, 204)
      await preflight.arrayBuffer()
      for (const path of ['/api/dashboard/poll', '/assets/app.js']) await (await fetch(origin + path)).arrayBuffer()
      const views = Bun.serve({ port: 0, async fetch(request) {
        beginRequestCapture(request)
        const response = await proxyToBackend(request, origin)
        finishRequestCapture(request, response)
        return response
      } })
      try { await (await fetch(`http://localhost:${views.port}/ok`)).arrayBuffer() }
      finally { await views.stop(true) }
      await flushRequestCaptures()
      const rows = database.query('SELECT * FROM requests ORDER BY id').all() as any[]
      assert.deepEqual(rows.map(row => row.status_code), [200, 401, 503, 404, 500, 401, 201, 405, 200, 204, 200], `nativeRoutes=${nativeRoutes}`)
      assert.equal(rows[7].method, 'PROPFIND')
      assert(rows.every(row => row.duration_ms >= 0 && row.created_at && row.memory_usage > 0))
      assert(!JSON.stringify(rows).includes('private'))
      assert(!JSON.stringify(rows).includes('secret-query'))
    }
    finally { await server.stop(true) }
  }
  console.log('HTTP_CAPTURE_STORAGE_OK')
}
finally { await flushRequestCaptures(); resetDatabaseConnection(); database.close() }
