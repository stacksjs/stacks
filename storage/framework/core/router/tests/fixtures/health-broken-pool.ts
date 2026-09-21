// Child for health-broken-pool.test.ts. Asks the real router for `/api/health`
// against, in turn: an in-memory SQLite database, a server that refuses every
// login, a real Bun SQL pool that the database package's bun-42804-server.ts
// breaks, and the in-memory SQLite database again. Nothing but the health
// check queries the first three, so the check has to tell them apart itself.
// Exits without closing the pools: a broken pool's close() was still pending 2
// seconds later in local runs.
import process from 'node:process'
import { startBun42804Server } from '../../../database/tests/fixtures/bun-42804-server'

const refusing = startBun42804Server({ authFailure: true })
const server = startBun42804Server()

const { db, ensureDatabaseConfigLoaded, getBrokenDatabasePools, initializeDbConfig } = await import('@stacksjs/database')
// Let the project config finish loading first, or its late initializeDbConfig
// call replaces the configuration below.
await ensureDatabaseConfigLoaded()

function usePostgresOn(port: number): void {
  initializeDbConfig({
    app: { env: 'production' },
    database: {
      default: 'postgres',
      queryLogging: { enabled: false },
      connections: {
        postgres: { name: 'stacks_health', host: '127.0.0.1', port, username: 'stacks', password: 'fixture-secret' },
      },
    },
  })
}

function useHealthySqlite(): void {
  initializeDbConfig({
    app: { env: 'production' },
    database: { default: 'sqlite', queryLogging: { enabled: false }, connections: { sqlite: { database: ':memory:' } } },
  })
}

/** Settles within 5s either way, so a hung request cannot outlive the parent's watchdog unexplained. */
async function bounded<T>(run: () => Promise<T>, what: string): Promise<T | { fixtureTimeout: string }> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      run(),
      new Promise<{ fixtureTimeout: string }>((resolve) => {
        timer = setTimeout(() => resolve({ fixtureTimeout: `${what}: no answer within 5000ms` }), 5000)
      }),
    ])
  }
  finally {
    clearTimeout(timer)
  }
}

const { createStacksRouter } = await import('../../src/stacks-router')
const router = createStacksRouter({ autoDiscoverRoutes: false })
router.health()

function health() {
  return bounded(async () => {
    const response = await router.handleRequest(new Request('http://localhost/api/health'))
    return { status: response.status, body: await response.json() as unknown }
  }, 'GET /api/health')
}

useHealthySqlite()
const healthy = await health()

usePostgresOn(refusing.port)
const refused = await health()

usePostgresOn(server.port)
const broken = [await health(), await health()]
const brokenPoolsRecorded = getBrokenDatabasePools().length
// Only now, after the health checks, query the pool directly: whether Bun
// still breaks it, whatever the health check made of it.
const brokenPoolError = await bounded(async () => {
  await (db as unknown as { unsafe: (sql: string) => Promise<unknown> }).unsafe('SELECT 1')
  return 'resolved'
}, 'SELECT 1 on the broken pool').catch((error: Error) => error.message)

// The recorded pool must keep the check failing even when its own probe
// succeeds, so point the database at a connection that answers and show it does.
useHealthySqlite()
const probe = await bounded(async () => {
  await (db as unknown as { unsafe: (sql: string) => Promise<unknown> }).unsafe('SELECT 1')
  return 'ok'
}, 'SELECT 1 on SQLite').catch((error: Error) => error.message)
const afterRecovery = await health()

console.log(JSON.stringify({ port: server.port, healthy, refused, broken, brokenPoolsRecorded, brokenPoolError, probe, afterRecovery }))
refusing.stop()
server.stop()
process.exit(0)
