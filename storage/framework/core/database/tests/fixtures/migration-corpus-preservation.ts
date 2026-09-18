import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { Database } from 'bun:sqlite'

// realpath on both sides: macOS hands out /var/folders/... while the process
// reports /private/var/folders/... for the same directory.
const root = process.env.STACKS_CORPUS_ROOT ? realpathSync(process.env.STACKS_CORPUS_ROOT) : ''
assert(root && realpathSync(process.cwd()) === root, 'the sweep must run in the throwaway app root')
const migrations = join(root, 'database/migrations')

const { overridesReady } = await import('@stacksjs/config')
await overridesReady
const { ensureDatabaseConfigLoaded, initializeDbConfig, preprocessSqliteMigrations, resetDatabaseConnection } = await import('../../src')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: {
  default: 'sqlite',
  connections: { sqlite: { database: 'app.sqlite' } },
  queryLogging: { enabled: false },
} })

// An installed database where `users` exists and `page_views` has no geo
// columns, so the hand-authored drops read as unreachable.
const installed = new Database(join(root, 'app.sqlite'))
installed.run('CREATE TABLE "users" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "email" TEXT)')
installed.run('CREATE TABLE "page_views" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "path" TEXT)')
installed.close()

const before = readdirSync(migrations).sort()
const handAuthored = join(migrations, '1754000000000-drop-geo-region-city.sql')
const handAuthoredBefore = readFileSync(handAuthored, 'utf8')

try {
  preprocessSqliteMigrations()

  const after = readdirSync(migrations).sort()
  assert.deepEqual(after, before, `the sweep deleted ${before.filter(f => !after.includes(f)).join(', ') || 'nothing'}`)
  assert(existsSync(handAuthored), 'the hand-authored migration must survive')
  assert.equal(readFileSync(handAuthored, 'utf8'), handAuthoredBefore, 'and must not be rewritten')
  console.log('corpus preserved OK')
}
finally { resetDatabaseConnection() }
