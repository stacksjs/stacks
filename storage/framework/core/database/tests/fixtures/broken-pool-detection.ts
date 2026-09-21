// Child for broken-pool.test.ts. Sends real queries through the `db` facade to
// real Bun SQL pools that bun-42804-server.ts breaks, so the errors reach
// ./broken-pool through bun-query-builder's own hook dispatch rather than a
// call made by the test. Exits without closing those pools: a broken pool's
// close() was still pending 2 seconds later in local runs.
import process from 'node:process'
import { config as queryBuilderConfig } from '@stacksjs/query-builder'
import { startBun42804Server } from './bun-42804-server'

const primary = startBun42804Server()
const replica = startBun42804Server()
const refusing = startBun42804Server({ authFailure: true })

const { db, ensureDatabaseConfigLoaded, getBrokenDatabasePools, initializeDbConfig } = await import('@stacksjs/database')
// Let the project config finish loading first, or its late initializeDbConfig
// call replaces the configuration below partway through.
await ensureDatabaseConfigLoaded()

function usePrimaryOn(port: number): void {
  initializeDbConfig({
    app: { env: 'production' },
    database: {
      default: 'postgres',
      queryLogging: { enabled: false },
      connections: {
        postgres: {
          name: 'stacks_broken_pool',
          host: '127.0.0.1',
          port,
          username: 'stacks',
          password: 'fixture-secret',
          replicas: [{ host: '127.0.0.1', port: replica.port }],
        },
      },
    },
  })
}

/** The query's rejection message, or a marker when it resolves or does not settle in time. */
async function rejectionOf(run: () => Promise<unknown>): Promise<string> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      run(),
      new Promise((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('fixture: no answer within 5000ms')), 5000)
      }),
    ])
    return 'fixture: the query resolved'
  }
  catch (error) {
    return (error as Error).message
  }
  finally {
    clearTimeout(timer)
  }
}

const installedHookKinds = (): string[] => Object.keys(queryBuilderConfig.hooks ?? {}).sort()

// With query logging off, the detection hook is the only one.
usePrimaryOn(refusing.port)
const hooksOnPostgres = installedHookKinds()

// An ordinary failure through the same hook must not be reported.
const ordinary = await rejectionOf(() => db.selectFrom('users').selectAll().execute())
const poolsAfterOrdinary = getBrokenDatabasePools().length

// Three failing queries on the broken primary, for one report.
usePrimaryOn(primary.port)
const primaryErrors: string[] = []
for (let attempt = 0; attempt < 3; attempt++)
  primaryErrors.push(await rejectionOf(() => db.selectFrom('users').selectAll().execute()))

// A broken replica is reported under its own address, and only once.
const replicaErrors: string[] = []
for (let attempt = 0; attempt < 2; attempt++)
  replicaErrors.push(await rejectionOf(() => db.read.selectFrom('users').selectAll().execute()))

// Back on SQLite it is removed again, leaving no hooks at all.
initializeDbConfig({ app: { env: 'production' }, database: { default: 'sqlite', queryLogging: { enabled: false }, connections: { sqlite: { database: ':memory:' } } } })
const hooksOnSqlite = queryBuilderConfig.hooks === undefined ? null : installedHookKinds()

console.log(JSON.stringify({
  hooksOnPostgres,
  hooksOnSqlite,
  ordinary,
  poolsAfterOrdinary,
  primaryErrors,
  replicaErrors,
  pools: getBrokenDatabasePools().map(({ driver, host, port, database }) => ({ driver, host, port, database })),
  ports: { primary: primary.port, replica: replica.port },
}))

primary.stop()
replica.stop()
refusing.stop()
process.exit(0)
