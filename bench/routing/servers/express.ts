import process from 'node:process'

const port = Number(process.env.BENCH_PORT ?? 3999)
const withDb = process.env.BENCH_DB === '1'
const scenario = process.env.BENCH_SCENARIO
const serves = (id: string) => !scenario || scenario === id

let express: any
try {
  ;({ default: express } = await import('express') as any)
}
catch {
  console.error('[bench] express is not installed, run `bun install --cwd bench/routing` to include it')
  process.exit(78)
}

const app = express()
if (serves('static-json'))
  app.get('/bench/json', (_req: any, res: any) => res.json({ hello: 'world' }))
if (serves('path-param'))
  app.get('/bench/users/:id', (req: any, res: any) => res.json({ id: req.params.id }))
if (serves('post-validate')) {
  app.use(express.json())
  app.post('/bench/echo', (req: any, res: any) => {
    const { name, count } = req.body ?? {}
    if (typeof name !== 'string' || typeof count !== 'number') return res.status(422).json({ errors: {} })
    return res.json({ name, count })
  })
}

if (withDb && serves('db-roundtrip')) {
  const { Database } = await import('bun:sqlite')
  const db = new Database(process.env.BENCH_DB_FILE!, { readonly: true })
  const selectItem = db.prepare('SELECT id, name FROM bench_items WHERE id = 1')
  app.get('/bench/db', (_req: any, res: any) => res.json(selectItem.get()))
}

app.listen(port, '127.0.0.1')
console.error(`[bench] express listening on ${port}`)
