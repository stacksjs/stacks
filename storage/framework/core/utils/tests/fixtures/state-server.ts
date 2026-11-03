import { Database } from 'bun:sqlite'
import { createStacksRouter } from '../../../router/src/stacks-router'
import { resolveCursorArgs, enrichPaginatorUrls } from '../../../orm/src/paginator-request'
import { toCursorPaginator } from '../../../pagination/src'
import { SqliteCacheStore } from '../../../cache/src/drivers/sqlite'
import { createMemoryStorage } from '../../../storage/src/adapters/memory'
import { parseBytes } from '../../src/bytes'
import { safeJsonStringify } from '../../src/safe-json'

/** A real HTTP consumer: router, request context, SQL cursor binding and storage. */
export async function startStateServer(script = '') {
  const cache = new SqliteCacheStore({ path: ':memory:' })
  const db = new Database(':memory:')
  db.run('CREATE TABLE items (id INTEGER PRIMARY KEY, category TEXT NOT NULL)')
  for (const id of ['9007199254740993', '9007199254740994', '9007199254740995'])
    db.query('INSERT INTO items VALUES (CAST(? AS INTEGER), ?)').run(id, 'a')
  await cache.set('__proto__', { value: 1 })
  const disk = createMemoryStorage()
  await disk.write('same.txt', 'important')
  const router = createStacksRouter({ autoDiscoverRoutes: false })
  router.get('/bytes', (request) => {
    try { return Response.json({ bytes: parseBytes(new URL(request.url).searchParams.get('value') ?? '') }) }
    catch { return Response.json({ error: 'Invalid byte size' }, { status: 422 }) }
  })
  router.get('/snapshot', () => { const row = { id: 1 }; return { serialized: safeJsonStringify({ first: row, second: row }) } })
  router.get('/cache', () => cache.mget(['__proto__']))
  for (const composite of [false, true]) {
    router.get(composite ? '/composite' : '/feed', (request) => {
      const { cursor } = resolveCursorArgs(1)
      // The consumer chooses query direction; the native helpers transport tokens.
      const backward = new URL(request.url).searchParams.get('direction') === 'prev'
      const comparison = backward ? '<' : '>'
      const order = backward ? 'DESC' : 'ASC'
      const rows = (cursor === null
        ? db.query('SELECT CAST(id AS TEXT) AS id FROM items ORDER BY id LIMIT 1').all()
        : composite
          ? db.query(`SELECT CAST(id AS TEXT) AS id FROM items WHERE (category, id) ${comparison} (?, ?) ORDER BY category ${order}, id ${order} LIMIT 1`).all(...cursor as [string, string])
          : db.query(`SELECT CAST(id AS TEXT) AS id FROM items WHERE id ${comparison} ? ORDER BY id ${order} LIMIT 1`).all(cursor as string)) as { id: string }[]
      const current = rows[0]
      const token = current ? (composite ? ['a', BigInt(current.id)] : BigInt(current.id)) : null
      const nextCursor = current && db.query('SELECT 1 FROM items WHERE id > ? LIMIT 1').get(current.id) ? token : null
      const prevCursor = current && db.query('SELECT 1 FROM items WHERE id < ? LIMIT 1').get(current.id) ? token : null
      const page = enrichPaginatorUrls(toCursorPaginator({ data: rows, meta: { perPage: 1, nextCursor, prevCursor } }))
      for (const key of ['next_page_url', 'prev_page_url'] as const) {
        if (!page[key]) continue
        const link = new URL(page[key], request.url)
        if (key === 'prev_page_url') link.searchParams.set('direction', 'prev')
        else link.searchParams.delete('direction')
        page[key] = link.pathname + link.search
      }
      return page
    })
  }
  router.get('/move', async () => { await disk.moveFile('same.txt', 'same.txt'); return { contents: await disk.readToString('same.txt') } })
  const server = Bun.serve({ port: 0, hostname: '127.0.0.1', fetch(request) {
    const path = new URL(request.url).pathname
    if (path === '/favicon.ico') return new Response(null, { status: 204 })
    if (path === '/client.js') return new Response(script, { headers: { 'content-type': 'application/javascript' } })
    if (path === '/') return new Response('<!doctype html><html><body><script type="module" src="/client.js"></script></body></html>', { headers: { 'content-type': 'text/html' } })
    return router.bunRouter.handleRequest(request)
  } })
  return { url: `http://127.0.0.1:${server.port}`, async close() { server.stop(true); db.close(); await cache.close() } }
}
