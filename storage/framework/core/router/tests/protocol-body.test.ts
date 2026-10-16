import { expect, test } from 'bun:test'
import { readJsonBody, RequestBodyError } from '../src/body'
import { createStacksRouter } from '../src/stacks-router'

for (const nativeRoutes of [false, true]) {
  test(`protocol routes own bounded parsing and preserve the error envelope (nativeRoutes=${nativeRoutes})`, async () => {
    const router = createStacksRouter({ autoDiscoverRoutes: false, csrf: false })
    const protocol = async (request: Request) => {
      try { return Response.json({ wire: await readJsonBody(request, 16) }) }
      catch (error) {
        if (error instanceof RequestBodyError) return Response.json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: String(error.status) } }, { status: error.status })
        throw error
      }
    }
    router.post('/protocol', protocol).parseBody(false)
    // Mutating a duplicate's parsing policy must not alter the active route.
    router.post('/protocol', protocol).parseBody(true)
    const server = await router.serve({ port: 0, hostname: '127.0.0.1', nativeRoutes })
    try {
      for (const [body, status, expected] of [['{"ok":true}', 200, { wire: { ok: true } }], ['{', 400, { jsonrpc: '2.0', id: null, error: { code: -32700, message: '400' } }], [JSON.stringify('x'.repeat(20)), 413, { jsonrpc: '2.0', id: null, error: { code: -32700, message: '413' } }]] as const) {
        const response = await fetch(`http://127.0.0.1:${server.port}/protocol`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })
        expect(response.status).toBe(status)
        expect(await response.json()).toEqual(expected)
      }
    }
    finally { await server.stop(true) }
  })
}
