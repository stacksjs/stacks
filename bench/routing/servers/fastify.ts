import process from 'node:process'

const port = Number(process.env.BENCH_PORT ?? 3999)
const withDb = process.env.BENCH_DB === '1'

let fastify: any
try {
  ;({ default: fastify } = await import('fastify') as any)
}
catch {
  console.error('[bench] fastify is not installed, run `bun install --cwd bench/routing` to include it')
  process.exit(78)
}

const app = fastify({ logger: false })
app.get('/bench/json', () => ({ hello: 'world' }))
app.get('/bench/users/:id', (request: any) => ({ id: request.params.id }))
app.post('/bench/echo', {
  schema: {
    body: {
      type: 'object',
      required: ['name', 'count'],
      properties: { name: { type: 'string' }, count: { type: 'number' } },
    },
  },
}, (request: any) => ({ name: request.body.name, count: request.body.count }))

if (withDb) {
  const { Database } = await import('bun:sqlite')
  const db = new Database(process.env.BENCH_DB_FILE!, { readonly: true })
  const selectItem = db.prepare('SELECT id, name FROM bench_items WHERE id = 1')
  app.get('/bench/db', () => selectItem.get())
}

await app.listen({ port, host: '127.0.0.1' })
console.error(`[bench] fastify listening on ${port}`)
