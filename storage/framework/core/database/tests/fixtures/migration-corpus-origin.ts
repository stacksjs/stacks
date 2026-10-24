import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = process.cwd()
const flat = join(root, 'database/migrations')
const mysql = join(flat, 'mysql')
const snapshots = join(root, 'storage/framework/database')
mkdirSync(mysql, { recursive: true })
mkdirSync(snapshots, { recursive: true })
mkdirSync(join(root, 'app/Models'), { recursive: true })
// The incumbent Postgres corpus and a later MySQL corpus, as in ReviewOS.
writeFileSync(join(flat, '0000000001-create-legacy.sql'), 'CREATE TABLE "legacy" ("id" BIGSERIAL PRIMARY KEY);\n')
for (const dialect of ['postgres', 'mysql'])
  writeFileSync(join(snapshots, `model-snapshot.${dialect}.json`), JSON.stringify({ plan: { dialect, tables: [] }, dialect, hash: '', updatedAt: new Date().toISOString() }))
const orm = resolve(import.meta.dir, '../../../orm/src/index.ts')
const validation = resolve(import.meta.dir, '../../../validation/src/schema.ts')
writeFileSync(join(root, 'app/Models/Widget.ts'), `import {defineModel} from ${JSON.stringify(orm)}; import {schema} from ${JSON.stringify(validation)}; export default defineModel({name:'Widget',table:'widgets',attributes:{title:{validation:{rule:schema.string().required().max(100)}}}})`)

const { overridesReady } = await import('@stacksjs/config')
await overridesReady
const { initializeDbConfig, ensureDatabaseConfigLoaded } = await import('../../src/utils')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: { default: 'mysql', connections: { mysql: { host: '127.0.0.1', port: 1, name: 'not_connected', username: 'unused' } }, models: { includeFrameworkDefaults: false }, queryLogging: { enabled: false } } })
const { activeMigrationDirectory, generateMigrations } = await import('../../src/migrations')
assert.equal(await activeMigrationDirectory(), mysql)
for (const dialect of ['mysql', 'postgres', 'mysql', 'postgres'] as const) {
  const result = await generateMigrations({ dialect })
  assert.equal(result.isOk, true, String((result as any).error))
}
const files = (directory: string) => readdirSync(directory).filter(name => name.endsWith('.sql'))
assert.equal(files(flat).length, 2)
assert.equal(files(mysql).length, 1)
assert.match(readFileSync(join(mysql, files(mysql)[0]!), 'utf8'), /`widgets`/)
const postgresFile = files(flat).find(name => name.includes('widgets'))!
assert.match(readFileSync(join(flat, postgresFile), 'utf8'), /"widgets"/)
console.log('migration corpus origin OK')
process.exit(0)
