/**
 * Stacks under test.
 *
 * Two profiles, chosen with `BENCH_MODE`:
 *
 *   secure   (default) — stock framework defaults. CSRF injected on the POST,
 *                        the render-token seed on every GET, security headers
 *                        on every response, request-id,
 *                        AsyncLocalStorage request context.
 *   minimal            — CSRF disabled for a token-only API and
 *                        `STACKS_SECURITY_HEADERS_DISABLE=true` (set by the
 *                        runner), with request IDs owned by an upstream proxy.
 *                        Everything else is unchanged: this profile exists to
 *                        price the safe-by-default work, NOT to produce a
 *                        headline number. See the README.
 *
 * BENCH_SQLITE_PROFILE=wal-full opts into 1000-page WAL checkpoints and
 * synchronous=FULL for the database scenario. It keeps the secure profile.
 */

import process from 'node:process'
import { createStacksRouter, disableViewRouting } from '@stacksjs/router'

const port = Number(process.env.BENCH_PORT ?? 3999)
const minimal = process.env.BENCH_MODE === 'minimal'
const withDb = process.env.BENCH_DB === '1'
const sqliteProfile = process.env.BENCH_SQLITE_PROFILE ?? 'stock'
if (sqliteProfile !== 'stock' && sqliteProfile !== 'wal-full')
  throw new Error(`Unknown benchmark SQLite profile: ${sqliteProfile}`)
if (withDb && sqliteProfile === 'wal-full') {
  const { setConfig } = await import('@stacksjs/query-builder')
  setConfig({ sqlite: { pragmas: ['PRAGMA wal_autocheckpoint = 1000', 'PRAGMA synchronous = FULL'] } })
}
const scenario = process.env.BENCH_SCENARIO
const serves = (id: string) => !scenario || scenario === id

const router = createStacksRouter({ requestIds: !minimal, csrf: !minimal })
// This is an API benchmark. The repository also contains application views,
// and bun-router otherwise discovers and registers them during serve(). Every
// peer process registers only the selected benchmark route, so use Stacks'
// public API-server configuration here too.
disableViewRouting(router.bunRouter)

if (serves('static-json'))
  router.get('/bench/json', () => ({ hello: 'world' }))

if (serves('path-param'))
  router.get('/bench/users/{id}', (req: any) => ({ id: req.params.id }))

/*
 * A real action, registered by import through the typed router.
 *
 * Scenario 3 is meant to price "a JSON body through the framework's schema
 * validation", and in Stacks that means the action pipeline: declared
 * `validations`, the `authorize`/`before` hooks, `formatResult`. An inline
 * handler calling `request.validate()` skips most of it and would flatter the
 * number.
 */
if (serves('post-validate')) {
  const [{ Action }, { schema }, { createTypedRouter }] = await Promise.all([
    import('@stacksjs/actions'),
    import('@stacksjs/validation'),
    import('@stacksjs/router'),
  ])
  const EchoAction = new Action({
    name: 'BenchEcho',
    validations: {
      name: { rule: schema.string().required() },
      count: { rule: schema.number().required() },
    },
    handle(request: any) {
      const validated = request.getValidated()
      return { name: validated.name, count: validated.count }
    },
  })

  createTypedRouter(router).post('/bench/echo', EchoAction)
}

if (withDb && serves('db-roundtrip')) {
  // Imported lazily so the two DB-free profiles never pay for the database
  // package's boot, and so a machine with no fixture can still run scenarios
  // 1 to 3.
  const { db } = await import('@stacksjs/database') as any
  if (sqliteProfile === 'wal-full') {
    const checkpoint = await db.unsafe('PRAGMA wal_autocheckpoint').execute()
    const synchronous = await db.unsafe('PRAGMA synchronous').execute()
    if (checkpoint[0]?.wal_autocheckpoint !== 1000 || synchronous[0]?.synchronous !== 2)
      throw new Error('Tuned SQLite benchmark requires wal_autocheckpoint=1000 and synchronous=FULL')
  }
  const selectItem = db.selectFrom('bench_items').select(['id', 'name']).where('id', '=', 1).limit(1)
  router.get('/bench/db', () => {
    const row = selectItem.executeTakeFirstSync()
    return { id: row.id, name: row.name }
  })
}

const server = await router.serve({ port })
console.error(`[bench] stacks (${minimal ? 'minimal' : 'secure'}) listening on ${server.port}`)
