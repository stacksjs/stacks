import assert from 'node:assert/strict'
import { Database } from 'bun:sqlite'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

// A database migrated before its corpus was rebuilt still records the old
// corpus's filenames. The generator must never hand a new migration one of
// them: `migrate` skips any file the ledger lists, so production would never
// apply it. Run in a disposable app, never in the framework's corpus.
const root = realpathSync(process.env.STACKS_GENERATED_NAMES_ROOT!)
assert.equal(realpathSync(process.cwd()), root)
const dir = join(root, 'database/migrations')
const sqlite = join(root, 'app.sqlite')
const snapshot = join(root, 'storage/framework/database/model-snapshot.sqlite.json')
mkdirSync(dir, { recursive: true })
mkdirSync(join(root, 'app/Models'), { recursive: true })

function git(...args: string[]) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  return result.stdout
}
git('init', '-q')
git('config', 'user.email', 'test@example.com')
git('config', 'user.name', 'Test')
git('config', 'commit.gpgsign', 'false')

const orm = resolve(import.meta.dir, '../../../orm/src/index.ts')
const validation = resolve(import.meta.dir, '../../../validation/src/schema.ts')
writeFileSync(join(root, 'app/Models/Widget.ts'), `
import { defineModel } from ${JSON.stringify(orm)}
import { schema } from ${JSON.stringify(validation)}
export default defineModel({ name: 'Widget', table: 'widgets', traits: { useTimestamps: true }, attributes: { title: { fillable: true, validation: { rule: schema.string().required().max(100) } } } } as const)
`)

// The corpus before a rebuild: committed, then deleted. Its names are what an
// older ledger holds, and the first one is exactly what the generator writes.
writeFileSync(join(dir, '0000000001-create-widgets-table.sql'), 'CREATE TABLE widgets (id INTEGER PRIMARY KEY, name TEXT);\n')
writeFileSync(join(dir, '0000000002-alter-widgets-columns.sql'), 'ALTER TABLE widgets ADD COLUMN size INTEGER;\n')
git('add', '-A', '-f')
git('commit', '-q', '-m', 'old corpus')
git('rm', '-q', '-r', 'database/migrations')
git('commit', '-q', '-m', 'rebuild')
mkdirSync(dir, { recursive: true })

const { overridesReady } = await import('@stacksjs/config')
await overridesReady
const { ensureDatabaseConfigLoaded, initializeDbConfig, resetDatabaseConnection } = await import('../../src/utils')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: { default: 'sqlite', connections: { sqlite: { database: sqlite } }, models: { includeFrameworkDefaults: false }, queryLogging: { enabled: false } } })
const { generateMigrations } = await import('../../src/migrations')

function files() { return readdirSync(dir).filter(file => file.endsWith('.sql')).sort() }
function reset() {
  for (const file of files()) rmSync(join(dir, file))
  rmSync(snapshot, { force: true })
  // Generation itself may have opened (and so created) an empty file; this
  // step starts from a database that has a ledger.
  rmSync(sqlite, { force: true })
}

try {
  // 1. No database at all: the git history is what stands in for the ledger.
  assert(!existsSync(sqlite))
  const fromHistory = await generateMigrations()
  assert(fromHistory.isOk, String(fromHistory.error))
  assert.deepEqual(files(), ['0000000003-create-widgets-table.sql'])

  // 2. A database whose ledger goes further than the history: past it, too.
  reset()
  resetDatabaseConnection()
  const ledger = [
    // The pre-rebuild corpus, recorded as run...
    '0000000001-create-widgets-table.sql',
    '0000000002-alter-widgets-columns.sql',
    // ...and what this machine generated and migrated since.
    '0000000003-create-widgets-table.sql',
    '0000000004-alter-widgets-columns.sql',
    '0000000007-create-gadgets-table.sql',
    // A stray timestamp-named row whose file is long gone must not drag every
    // later migration up to its number.
    '1784267334-create-leads-table.sql',
  ]
  const database = new Database(sqlite)
  database.run('CREATE TABLE migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, migration TEXT NOT NULL UNIQUE, executed_at DATETIME DEFAULT CURRENT_TIMESTAMP)')
  for (const name of ledger) database.run('INSERT INTO migrations (migration) VALUES (?)', [name])
  database.close()

  const fromLedger = await generateMigrations()
  assert(fromLedger.isOk, String(fromLedger.error))
  const written = files()
  assert.equal(written.length, 1, written.join(', '))
  for (const file of written) {
    assert(!ledger.includes(file), `${file} is already in the ledger, so migrate would skip it`)
    assert(!['0000000001-create-widgets-table.sql', '0000000002-alter-widgets-columns.sql'].includes(file))
  }
  // Numbering continues after the ledger's highest sequential ordinal (7),
  // not after the timestamp row and not in the gap at 5.
  assert.deepEqual(written, ['0000000008-create-widgets-table.sql'])

  console.log('generated migration names OK')
}
finally { resetDatabaseConnection() }
