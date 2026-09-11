/**
 * The routing runtime Stacks sits on, measured on its own.
 *
 * Between `bun-raw` and the Stacks profiles there are two layers, and a single
 * number spanning both cannot say which one a change moved. This target is the
 * boundary: everything `bun-raw` pays plus route registration, request
 * enhancement and native dispatch, and none of what Stacks adds on top.
 *
 * It is opt-in. Published rankings compare frameworks, and this is a component
 * of one of them, not an entry in its own right.
 */

import process from 'node:process'
import { Router } from '@stacksjs/bun-router'

const port = Number(process.env.BENCH_PORT ?? 3999)
const hostname = '127.0.0.1'
const withDb = process.env.BENCH_DB === '1'
const scenario = process.env.BENCH_SCENARIO
const serves = (id: string) => !scenario || scenario === id

const router = new Router()
// Every peer process registers only the selected scenario. Without this the
// repository's own view directory would be discovered during serve().
;(router as Router & { disableFileRouting?: () => unknown }).disableFileRouting?.()

// Returning a plain value is bun-router's documented idiom, and it is what
// the Elysia and Stacks fixtures do, so the router serializes for all three.
if (serves('static-json'))
  router.get('/bench/json', () => ({ hello: 'world' }))

if (serves('path-param'))
  router.get('/bench/users/{id}', (req: any) => ({ id: req.params.id }))

if (serves('post-validate')) {
  router.post('/bench/echo', async (req: Request) => {
    const body = await req.json() as { name?: unknown, count?: unknown } | unknown[] | null
    if (!body || Array.isArray(body) || typeof body.name !== 'string' || typeof body.count !== 'number')
      return Response.json({ errors: {} }, { status: 422 })
    return { name: body.name, count: body.count }
  })
}

if (withDb && serves('db-roundtrip')) {
  const { Database } = await import('bun:sqlite')
  const db = new Database(process.env.BENCH_DB_FILE!, { readonly: true })
  const selectItem = db.prepare('SELECT id, name FROM bench_items WHERE id = ? LIMIT 1')
  router.get('/bench/db', () => {
    const row = selectItem.get(1) as { id: number, name: string }
    return { id: row.id, name: row.name }
  })
}

// Native dispatch is opt-in in bun-router and on by default in Stacks, which
// decides it per route table. Matching that here keeps this row a measurement
// of the layer Stacks actually runs on rather than of a path it never takes.
const server = await router.serve({ port, hostname, nativeRoutes: true })
console.error(`[bench] bun-router listening on ${server.port}`)
