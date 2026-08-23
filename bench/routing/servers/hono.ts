/**
 * Hono under test, if it is installed.
 *
 * Same opt-in contract as the Elysia server: `bun add -d hono`, or the runner
 * records it as skipped. Validation goes through Hono's own `validator()`
 * seam with a hand-written check, rather than `@hono/zod-validator`, so no
 * second package is needed — worth knowing when reading scenario 3, since a
 * pair of `typeof` tests is cheaper than a compiled schema.
 */

import process from 'node:process'

const port = Number(process.env.BENCH_PORT ?? 3999)
const withDb = process.env.BENCH_DB === '1'

let Hono: any
let validator: any
try {
  ;({ Hono } = await import('hono') as any)
  ;({ validator } = await import('hono/validator') as any)
}
catch {
  console.error('[bench] hono is not installed — run `bun add -d hono` to include it')
  process.exit(78)
}

const app = new Hono()

app.get('/bench/json', (c: any) => c.json({ hello: 'world' }))
app.get('/bench/users/:id', (c: any) => c.json({ id: c.req.param('id') }))
app.post(
  '/bench/echo',
  validator('json', (value: any, c: any) => {
    if (typeof value.name !== 'string' || typeof value.count !== 'number')
      return c.json({ errors: {} }, 422)
    return value
  }),
  (c: any) => {
    const body = c.req.valid('json')
    return c.json({ name: body.name, count: body.count })
  },
)

if (withDb) {
  const { Database } = await import('bun:sqlite')
  const db = new Database(process.env.BENCH_DB_FILE!, { readonly: true })
  const selectItem = db.prepare('SELECT id, name FROM bench_items WHERE id = 1')
  app.get('/bench/db', (c: any) => {
    const row = selectItem.get() as { id: number, name: string }
    return c.json({ id: row.id, name: row.name })
  })
}

Bun.serve({ port, fetch: app.fetch })
console.error(`[bench] hono listening on ${port}`)
