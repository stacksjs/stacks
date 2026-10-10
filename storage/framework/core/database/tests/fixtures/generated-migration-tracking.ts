import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, unlinkSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = realpathSync(process.env.STACKS_GENERATED_TRACKING_ROOT!)
assert.equal(realpathSync(process.cwd()), root)
const dir = join(root, 'database/migrations')
mkdirSync(dir, { recursive: true })
mkdirSync(join(root, 'app/Models'), { recursive: true })
function git(...args: string[]) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  return result.stdout
}
git('init', '-q')
const excludes = join(root, '.git/global-excludes')
writeFileSync(excludes, '*.sql\n')
git('config', 'core.excludesFile', excludes)
const configBefore = readFileSync(join(root, '.git/config'), 'utf8')
const orm = resolve(import.meta.dir, '../../../orm/src/index.ts')
const validation = resolve(import.meta.dir, '../../../validation/src/schema.ts')
writeFileSync(join(root, 'app/Models/Widget.ts'), `
import { defineModel } from ${JSON.stringify(orm)}
import { schema } from ${JSON.stringify(validation)}
export default defineModel({ name: 'Widget', table: 'widgets', traits: { useTimestamps: true }, attributes: { title: { fillable: true, validation: { rule: schema.string().required().max(100) } } } } as const)
`)
const { overridesReady } = await import('@stacksjs/config')
await overridesReady
const { ensureDatabaseConfigLoaded, initializeDbConfig, resetDatabaseConnection } = await import('../../src/utils')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: { default: 'sqlite', connections: { sqlite: { database: join(root, 'app.sqlite') } }, models: { includeFrameworkDefaults: false }, queryLogging: { enabled: false } } })
const { generateMigrations, regenerateMigrationCorpus } = await import('../../src/migrations')
const { findIgnoredMigrations } = await import('../../src/ignored-migrations')
function files() { return readdirSync(dir).filter(file => file.endsWith('.sql')).sort() }
function visible() {
  assert.deepEqual(findIgnoredMigrations(dir), [])
  assert.equal(git('diff', '--cached', '--name-only'), '')
  assert(!existsSync(join(root, '.gitignore')))
  assert.equal(readFileSync(join(root, '.git/config'), 'utf8'), configBefore)
  for (const file of files()) assert(git('diff', '--name-only').includes(file))
}
function forgetPaths() { git('rm', '--cached', '--force', '--', ...files().map(file => `database/migrations/${file}`)) }
try {
  // Git failure cannot advance the schema snapshot past an undiscoverable file.
  const snapshot = join(root, 'storage/framework/database/model-snapshot.sqlite.json')
  writeFileSync(join(root, '.git/index.lock'), '')
  const blocked = await generateMigrations()
  assert.equal(blocked.isOk, false)
  assert(!existsSync(snapshot))
  assert(findIgnoredMigrations(dir).length > 0)
  unlinkSync(join(root, '.git/index.lock'))
  const generated = await generateMigrations()
  assert(generated.isOk, String(generated.error))
  assert(files().length > 0)
  visible()
  const before = files().map(file => readFileSync(join(dir, file), 'utf8'))
  forgetPaths()
  assert(findIgnoredMigrations(dir).length > 0)
  const noop = await generateMigrations()
  assert(noop.isOk, String(noop.error))
  assert.deepEqual(files().map(file => readFileSync(join(dir, file), 'utf8')), before)
  visible()
  forgetPaths()
  const index = readFileSync(join(root, '.git/index'))
  const preview = await regenerateMigrationCorpus({ dialect: 'sqlite', dir, dryRun: true })
  assert(preview.isOk, String(preview.error))
  assert.deepEqual(readFileSync(join(root, '.git/index')), index)
  assert(findIgnoredMigrations(dir).length > 0)
  const regenerated = await regenerateMigrationCorpus({ dialect: 'sqlite', dir })
  assert(regenerated.isOk, String(regenerated.error))
  visible()
  git('add', '-A')
  const staged = git('diff', '--cached', '--name-only')
  for (const file of files()) assert(staged.includes(file))
  assert(staged.includes('model-snapshot.sqlite.json'))
  console.log('generated migration tracking OK')
}
finally { resetDatabaseConnection() }
