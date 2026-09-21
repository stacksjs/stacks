// Child for query-logging.test.ts: exactly which query hook kinds each profile
// installs for one driver, named by argv[2] and by the parent's DB_CONNECTION.
//
// Production with query logging off installs no hooks on SQLite. On
// PostgreSQL and MySQL it installs one onQueryError hook, the oven-sh/bun#42804
// detector in src/utils.ts, and no hook that runs for a successful query.
// Every initializeDbConfig call names the driver, and the parent pins the
// environment, so neither the shell nor the checkout's env files pick the
// profile under test. No query is sent.
import process from 'node:process'
import { config as queryBuilderConfig } from 'bun-query-builder'
import { initializeDbConfig } from '../../src/utils'

const driver = process.argv[2]
if (driver !== 'sqlite' && driver !== 'postgres' && driver !== 'mysql')
  throw new Error(`Expected sqlite, postgres or mysql as the driver, got ${driver}`)
if (process.env.DB_CONNECTION !== driver)
  throw new Error(`The parent must pin DB_CONNECTION=${driver}, got ${process.env.DB_CONNECTION}`)

// Port 1 on loopback rather than a database's default port, so a connection
// this fixture should never make could not reach a real database either.
const connection = { name: 'stacks_hook_profile', host: '127.0.0.1', port: 1, username: 'stacks', password: '' }

function initialize(appEnv: string, enabled: boolean): void {
  initializeDbConfig({
    app: { env: appEnv },
    database: {
      default: driver,
      queryLogging: { enabled },
      connections: { sqlite: { database: ':memory:' }, postgres: connection, mysql: connection },
    },
  })
}

function installed(): string {
  return queryBuilderConfig.hooks === undefined ? 'no hooks' : JSON.stringify(Object.keys(queryBuilderConfig.hooks).sort())
}

function expectHooks(expected: string, profile: string): void {
  if (installed() !== expected)
    throw new Error(`${driver}, ${profile}: expected ${expected}, installed ${installed()}`)
}

const fastProfile = driver === 'sqlite' ? 'no hooks' : '["onQueryError"]'
const diagnostics = '["onQueryEnd","onQueryError"]'

// What the module installed from the pinned environment at import.
expectHooks(fastProfile, 'production without query logging, from the environment')

initialize('production', false)
expectHooks(fastProfile, 'production without query logging')

initialize('production', true)
expectHooks(diagnostics, 'production with query logging')

initialize('development', false)
expectHooks(diagnostics, 'development')

initialize('production', false)
expectHooks(fastProfile, 'back to production without query logging')

console.log(`query-hook-profile-ok ${driver}`)
