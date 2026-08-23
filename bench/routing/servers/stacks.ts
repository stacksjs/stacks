/**
 * Stacks under test.
 *
 * Two profiles, chosen with `BENCH_MODE`:
 *
 *   secure   (default) — stock framework defaults. CSRF injected on the POST,
 *                        the render-token seed on every GET, security headers
 *                        on every response, request-id + Server-Timing,
 *                        AsyncLocalStorage request context.
 *   minimal            — `.skipCsrf()` on the mutating route and
 *                        `STACKS_SECURITY_HEADERS_DISABLE=true` (set by the
 *                        runner). Everything else is unchanged: this profile
 *                        exists to price the safe-by-default work, NOT to
 *                        produce a headline number. See the README.
 */

import process from 'node:process'
import { Action } from '@stacksjs/actions'
import { createStacksRouter, createTypedRouter } from '@stacksjs/router'
import { schema } from '@stacksjs/validation'

const port = Number(process.env.BENCH_PORT ?? 3999)
const minimal = process.env.BENCH_MODE === 'minimal'
const withDb = process.env.BENCH_DB === '1'

const router = createStacksRouter()

router.get('/bench/json', () => ({ hello: 'world' }))

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
const EchoAction = new Action({
  name: 'BenchEcho',
  validations: {
    name: { rule: schema.string() },
    count: { rule: schema.number() },
  },
  handle(request: any) {
    return { name: request.get('name'), count: request.get('count') }
  },
})

createTypedRouter(router).post('/bench/echo', EchoAction, minimal ? { skipCsrf: true } : undefined)

if (withDb) {
  // Imported lazily so the two DB-free profiles never pay for the database
  // package's boot, and so a machine with no fixture can still run scenarios
  // 1 to 3.
  const { db } = await import('@stacksjs/database') as any
  router.get('/bench/db', async () => {
    const rows = await db.selectFrom('bench_items').select(['id', 'name']).where('id', '=', 1).limit(1).execute()
    const row = rows[0]
    return { id: row.id, name: row.name }
  })
}

const server = await router.serve({ port })
console.error(`[bench] stacks (${minimal ? 'minimal' : 'secure'}) listening on ${server.port}`)
