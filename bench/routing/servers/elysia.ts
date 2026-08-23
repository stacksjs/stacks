/**
 * Elysia under test, if it is installed.
 *
 * Not a dependency of this repo — `bun add -d elysia` inside `bench/routing`
 * (or anywhere Bun will resolve it from) enables this server. Absent, the
 * process exits 78 and the runner records the framework as skipped rather than
 * as a zero.
 */

import process from 'node:process'

const port = Number(process.env.BENCH_PORT ?? 3999)
const withDb = process.env.BENCH_DB === '1'

let Elysia: any
let t: any
try {
  ;({ Elysia, t } = await import('elysia') as any)
}
catch {
  console.error('[bench] elysia is not installed — run `bun add -d elysia` to include it')
  process.exit(78)
}

const app = new Elysia()
  .get('/bench/json', () => ({ hello: 'world' }))
  .get('/bench/users/:id', ({ params }: any) => ({ id: params.id }))
  .post(
    '/bench/echo',
    ({ body }: any) => ({ name: body.name, count: body.count }),
    { body: t.Object({ name: t.String(), count: t.Number() }) },
  )

if (withDb) {
  const { Database } = await import('bun:sqlite')
  const db = new Database(process.env.BENCH_DB_FILE!, { readonly: true })
  const selectItem = db.prepare('SELECT id, name FROM bench_items WHERE id = 1')
  app.get('/bench/db', () => {
    const row = selectItem.get() as { id: number, name: string }
    return { id: row.id, name: row.name }
  })
}

app.listen(port)
console.error(`[bench] elysia listening on ${port}`)
