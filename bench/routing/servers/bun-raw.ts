/**
 * The baseline: `Bun.serve` with a hand-written switch.
 *
 * Nothing can beat this, which is exactly why it is here. A framework's number
 * only means something next to the ceiling of the runtime it sits on — without
 * it, "40k rps" reads as either fast or slow depending on what the reader
 * already believed.
 */

import { Database } from 'bun:sqlite'
import process from 'node:process'

const port = Number(process.env.BENCH_PORT ?? 3999)
const withDb = process.env.BENCH_DB === '1'

const JSON_HEADERS = { 'content-type': 'application/json' } as const

let selectItem: import('bun:sqlite').Statement | undefined
if (withDb) {
  const db = new Database(process.env.BENCH_DB_FILE!, { readonly: true })
  selectItem = db.prepare('SELECT id, name FROM bench_items WHERE id = 1')
}

Bun.serve({
  port,
  async fetch(req) {
    const url = req.url
    const pathStart = url.indexOf('/', url.indexOf('://') + 3)
    const path = pathStart === -1 ? '/' : url.slice(pathStart)

    if (path === '/bench/json')
      return new Response('{"hello":"world"}', { headers: JSON_HEADERS })

    if (path.startsWith('/bench/users/'))
      return new Response(JSON.stringify({ id: path.slice('/bench/users/'.length) }), { headers: JSON_HEADERS })

    if (path === '/bench/echo' && req.method === 'POST') {
      const body = await req.json() as { name?: unknown, count?: unknown }
      if (typeof body.name !== 'string' || typeof body.count !== 'number')
        return new Response('{"errors":{}}', { status: 422, headers: JSON_HEADERS })
      return new Response(JSON.stringify({ name: body.name, count: body.count }), { headers: JSON_HEADERS })
    }

    if (path === '/bench/db' && selectItem) {
      const row = selectItem.get() as { id: number, name: string }
      return new Response(JSON.stringify({ id: row.id, name: row.name }), { headers: JSON_HEADERS })
    }

    return new Response('Not Found', { status: 404 })
  },
})

console.error(`[bench] bun-raw listening on ${port}`)
